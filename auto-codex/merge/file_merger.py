"""
File Merger
===========

File content manipulation and merging utilities.

This module handles the actual merging of file content:
- Applying single task changes
- Combining non-conflicting changes from multiple tasks
- Finding import locations
- Extracting content from specific code locations
"""

from __future__ import annotations

import re
from pathlib import Path

from .types import ChangeType, SemanticChange, TaskSnapshot


def _replace_once(content: str, old: str, new: str) -> str:
    if not old or old == new:
        return content
    return content.replace(old, new, 1)


def _detect_line_ending(content: str) -> str:
    if "\r\n" in content:
        return "\r\n"
    if "\r" in content:
        return "\r"
    return "\n"


def _remove_once(content: str, block: str) -> str:
    if not block:
        return content
    updated = content.replace(block, "", 1)
    if updated != content:
        return updated
    trimmed = block.strip("\n")
    if trimmed and trimmed != block:
        return content.replace(trimmed, "", 1)
    return content


def _remove_matching_lines(content: str, block: str) -> str:
    targets = [line.strip() for line in block.splitlines() if line.strip()]
    if not targets:
        return content
    # Use splitlines() to handle all line ending styles (LF, CRLF, CR)
    lines = content.splitlines()
    newline = _detect_line_ending(content)
    remaining_targets = set(targets)
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped in remaining_targets:
            remaining_targets.discard(stripped)
            continue
        new_lines.append(line)
    return newline.join(new_lines)


def _maybe_replace_in_location(
    content: str,
    location: str,
    old: str,
    new: str,
) -> str | None:
    if not location or ":" not in location:
        return None
    loc_type = location.split(":", 1)[0]
    if loc_type not in {"function", "class"}:
        return None
    region = extract_location_content(content, location)
    if not region or region == content:
        return None
    if old in region:
        updated_region = region.replace(old, new, 1)
        return content.replace(region, updated_region, 1)
    if region == old:
        return content.replace(region, new, 1)
    return None


def _maybe_remove_in_location(
    content: str,
    location: str,
    old: str,
) -> str | None:
    if not location or ":" not in location:
        return None
    loc_type = location.split(":", 1)[0]
    if loc_type not in {"function", "class"}:
        return None
    region = extract_location_content(content, location)
    if not region or region == content:
        return None
    if old in region:
        updated_region = region.replace(old, "", 1)
        return content.replace(region, updated_region, 1)
    if region == old:
        return content.replace(region, "", 1)
    return None


def _insert_imports(content: str, imports: list[str], file_path: str) -> str:
    if not imports:
        return content
    # Use splitlines() to handle all line ending styles (LF, CRLF, CR)
    lines = content.splitlines()
    newline = _detect_line_ending(content)
    import_end = find_import_end(lines, file_path)
    existing = {line.strip() for line in lines[:import_end] if line.strip()}
    new_imports: list[str] = []
    for imp in imports:
        stripped = imp.strip()
        if not stripped or stripped in existing or stripped in new_imports:
            continue
        new_imports.append(imp.rstrip("\n"))
    for imp in reversed(new_imports):
        lines.insert(import_end, imp)
    return newline.join(lines)


def _block_is_indented(block_lines: list[str], base_indent: int) -> bool:
    for line in block_lines:
        if line.strip():
            return (len(line) - len(line.lstrip())) > base_indent
    return True


def _indent_block(block_lines: list[str], indent: int) -> list[str]:
    prefix = " " * indent
    return [prefix + line if line.strip() else line for line in block_lines]


def _insert_into_python_class(content: str, class_name: str, block: str) -> str | None:
    class_pattern = re.compile(rf"^(\s*)class\s+{re.escape(class_name)}\b")
    # Use splitlines() to handle all line ending styles (LF, CRLF, CR)
    lines = content.splitlines()
    newline = _detect_line_ending(content)
    for idx, line in enumerate(lines):
        match = class_pattern.match(line)
        if not match:
            continue
        class_indent = len(match.group(1))
        insert_at = idx + 1
        while insert_at < len(lines):
            candidate = lines[insert_at]
            if candidate.strip() == "":
                insert_at += 1
                continue
            indent = len(candidate) - len(candidate.lstrip())
            if indent <= class_indent:
                break
            insert_at += 1
        block_lines = block.rstrip("\n").splitlines()
        if not block_lines:
            return content
        if not _block_is_indented(block_lines, class_indent):
            block_lines = _indent_block(block_lines, class_indent + 4)
        if insert_at > 0 and lines[insert_at - 1].strip() and block_lines[0].strip():
            block_lines = [""] + block_lines
        lines[insert_at:insert_at] = block_lines
        return newline.join(lines)
    return None


def _insert_into_js_class(content: str, class_name: str, block: str) -> str | None:
    pattern = r"class\s+" + re.escape(class_name) + r"\b[^{]*\{"
    match = re.search(pattern, content)
    if not match:
        return None
    start = match.end()
    depth = 1
    idx = start
    while idx < len(content):
        char = content[idx]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                break
        idx += 1
    if depth != 0:
        return None
    insert_pos = idx
    insert_block = block.rstrip("\n")
    if not insert_block:
        return content
    prefix = "\n" if not content[:insert_pos].endswith("\n") else ""
    suffix = "\n" if not insert_block.endswith("\n") else ""
    return content[:insert_pos] + prefix + insert_block + suffix + content[insert_pos:]


def _insert_into_class(
    content: str,
    class_name: str,
    block: str,
    file_path: str,
) -> str | None:
    ext = Path(file_path).suffix.lower()
    if ext == ".py":
        return _insert_into_python_class(content, class_name, block)
    if ext in {".js", ".jsx", ".ts", ".tsx"}:
        return _insert_into_js_class(content, class_name, block)
    return None


def _get_class_name_from_location(location: str) -> str | None:
    if ":" not in location:
        return None
    _, name = location.split(":", 1)
    if "." not in name:
        return None
    return name.split(".", 1)[0]


def apply_single_task_changes(
    baseline: str,
    snapshot: TaskSnapshot,
    file_path: str,
) -> str:
    """
    Apply changes from a single task to baseline content.

    Args:
        baseline: The baseline file content
        snapshot: Task snapshot with semantic changes
        file_path: Path to the file (for context on file type)

    Returns:
        Modified content with changes applied
    """
    content = baseline

    removals: list[SemanticChange] = []
    modifications: list[SemanticChange] = []
    additions: list[SemanticChange] = []

    for change in snapshot.semantic_changes:
        if change.content_before and change.content_after:
            modifications.append(change)
        elif change.content_before and not change.content_after:
            removals.append(change)
        elif change.content_after and not change.content_before:
            additions.append(change)

    for change in removals:
        if change.change_type == ChangeType.REMOVE_IMPORT and change.content_before:
            content = _remove_matching_lines(content, change.content_before)
            continue
        updated = None
        if change.content_before:
            updated = _maybe_remove_in_location(
                content, change.location, change.content_before
            )
        if updated is None and change.content_before:
            updated = _remove_once(content, change.content_before)
        content = updated if updated is not None else content

    for change in modifications:
        if not (change.content_before and change.content_after):
            continue
        updated = _maybe_replace_in_location(
            content, change.location, change.content_before, change.content_after
        )
        if updated is None:
            updated = _replace_once(content, change.content_before, change.content_after)
        content = updated

    import_additions = [
        change.content_after
        for change in additions
        if change.change_type == ChangeType.ADD_IMPORT and change.content_after
    ]
    content = _insert_imports(content, import_additions, file_path)

    for change in additions:
        if not change.content_after:
            continue
        if change.change_type == ChangeType.ADD_IMPORT:
            continue
        class_name = _get_class_name_from_location(change.location)
        if change.change_type in {ChangeType.ADD_METHOD, ChangeType.ADD_FUNCTION} and class_name:
            updated = _insert_into_class(
                content, class_name, change.content_after, file_path
            )
            if updated is not None:
                content = updated
                continue
        if change.content_after not in content:
            content += f"\n\n{change.content_after}"

    return content


def combine_non_conflicting_changes(
    baseline: str,
    snapshots: list[TaskSnapshot],
    file_path: str,
) -> str:
    """
    Combine changes from multiple non-conflicting tasks.

    Args:
        baseline: The baseline file content
        snapshots: List of task snapshots with changes
        file_path: Path to the file

    Returns:
        Combined content with all changes applied
    """
    content = baseline

    removals: list[SemanticChange] = []
    modifications: list[SemanticChange] = []
    additions: list[SemanticChange] = []

    for snapshot in snapshots:
        for change in snapshot.semantic_changes:
            if change.content_before and change.content_after:
                modifications.append(change)
            elif change.content_before and not change.content_after:
                removals.append(change)
            elif change.content_after and not change.content_before:
                additions.append(change)

    for change in removals:
        if change.change_type == ChangeType.REMOVE_IMPORT and change.content_before:
            content = _remove_matching_lines(content, change.content_before)
            continue
        updated = None
        if change.content_before:
            updated = _maybe_remove_in_location(
                content, change.location, change.content_before
            )
        if updated is None and change.content_before:
            updated = _remove_once(content, change.content_before)
        content = updated if updated is not None else content

    for mod in modifications:
        if not (mod.content_before and mod.content_after):
            continue
        updated = _maybe_replace_in_location(
            content, mod.location, mod.content_before, mod.content_after
        )
        if updated is None:
            updated = _replace_once(content, mod.content_before, mod.content_after)
        content = updated

    import_additions = [
        change.content_after
        for change in additions
        if change.change_type == ChangeType.ADD_IMPORT and change.content_after
    ]
    content = _insert_imports(content, import_additions, file_path)

    for change in additions:
        if not change.content_after or change.change_type == ChangeType.ADD_IMPORT:
            continue
        class_name = _get_class_name_from_location(change.location)
        if change.change_type in {ChangeType.ADD_METHOD, ChangeType.ADD_FUNCTION} and class_name:
            updated = _insert_into_class(
                content, class_name, change.content_after, file_path
            )
            if updated is not None:
                content = updated
                continue
        if change.content_after not in content:
            content += f"\n\n{change.content_after}"

    return content


def find_import_end(lines: list[str], file_path: str) -> int:
    """
    Find where imports end in a file.

    Args:
        lines: File content split into lines
        file_path: Path to file (for determining language)

    Returns:
        Index where imports end (insert position for new imports)
    """
    ext = Path(file_path).suffix.lower()
    last_import = 0

    for i, line in enumerate(lines):
        stripped = line.strip()
        if ext == ".py":
            if stripped.startswith(("import ", "from ")):
                last_import = i + 1
        elif ext in {".js", ".jsx", ".ts", ".tsx"}:
            if stripped.startswith("import "):
                last_import = i + 1

    return last_import


def extract_location_content(content: str, location: str) -> str:
    """
    Extract content at a specific location (e.g., function:App).

    Args:
        content: Full file content
        location: Location string (e.g., "function:myFunction", "class:MyClass")

    Returns:
        Extracted content, or full content if location not found
    """
    # Parse location
    if ":" not in location:
        return content

    loc_type, loc_name = location.split(":", 1)

    if loc_type == "function":
        # Find function content using regex
        patterns = [
            rf"(function\s+{loc_name}\s*\([^)]*\)\s*\{{[\s\S]*?\n\}})",
            rf"((?:const|let|var)\s+{loc_name}\s*=[\s\S]*?\n\}};?)",
        ]
        for pattern in patterns:
            match = re.search(pattern, content)
            if match:
                return match.group(1)

    elif loc_type == "class":
        pattern = rf"(class\s+{loc_name}\s*(?:extends\s+\w+)?\s*\{{[\s\S]*?\n\}})"
        match = re.search(pattern, content)
        if match:
            return match.group(1)

    return content


def _find_location_span(content: str, location: str) -> tuple[int, int] | None:
    if ":" not in location:
        return None

    loc_type, loc_name = location.split(":", 1)

    if loc_type == "function":
        patterns = [
            rf"(function\s+{loc_name}\s*\([^)]*\)\s*\{{[\s\S]*?\n\}})",
            rf"((?:const|let|var)\s+{loc_name}\s*=[\s\S]*?\n\}};?)",
        ]
        for pattern in patterns:
            match = re.search(pattern, content)
            if match:
                return match.span(1)

    if loc_type == "class":
        pattern = rf"(class\s+{loc_name}\s*(?:extends\s+\w+)?\s*\{{[\s\S]*?\n\}})"
        match = re.search(pattern, content)
        if match:
            return match.span(1)

    return None


def apply_ai_merge(
    content: str,
    location: str,
    merged_region: str | None,
) -> str:
    """
    Apply AI-merged content to the full file.

    Args:
        content: Full file content
        location: Location where merge was performed
        merged_region: The merged content from AI (None to skip)

    Returns:
        Updated file content with AI merge applied
    """
    if merged_region is None:
        return content

    span = _find_location_span(content, location)
    if span:
        start, end = span
        return content[:start] + merged_region + content[end:]

    # Find and replace the location content as a fallback
    original = extract_location_content(content, location)
    if original and original != content:
        return _replace_once(content, original, merged_region)

    return content
