"""
Memory File Validator
=====================

Validates memory files against defined schemas.
"""

import json
from pathlib import Path
from typing import Any

# Schema definitions (inline to avoid jsonschema dependency)
SCHEMAS_FILE = Path(__file__).parent / "schemas" / "memory_schemas.json"


def load_schemas() -> dict[str, Any]:
    """Load memory schemas from JSON file."""
    if not SCHEMAS_FILE.exists():
        return {}
    
    with open(SCHEMAS_FILE) as f:
        data = json.load(f)
    
    return data.get("definitions", {})


def validate_memory_file(
    file_path: Path,
    schema_name: str
) -> tuple[bool, str, list[str]]:
    """
    Validate a memory file against its schema.
    
    Args:
        file_path: Path to the memory file
        schema_name: Name of the schema to validate against
        
    Returns:
        Tuple of (is_valid, message, warnings)
    """
    schemas = load_schemas()
    
    if schema_name not in schemas:
        return False, f"Unknown schema: {schema_name}", []
    
    if not file_path.exists():
        return False, f"File not found: {file_path}", []
    
    try:
        with open(file_path) as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return False, f"Invalid JSON: {e}", []
    
    # Basic validation without jsonschema dependency
    schema = schemas[schema_name]
    warnings = []
    
    # Check required properties
    if "properties" in schema:
        for prop, prop_schema in schema["properties"].items():
            if prop.startswith("_"):
                continue  # Skip metadata
            if prop not in data:
                if prop_schema.get("required", False):
                    return False, f"Missing required property: {prop}", warnings
                else:
                    warnings.append(f"Optional property missing: {prop}")

    # Check metadata
    if "_metadata" in data:
        metadata = data["_metadata"]
        if "last_updated" not in metadata:
            warnings.append("Metadata missing last_updated timestamp")
    else:
        warnings.append("No _metadata section found")
    
    return True, "Valid", warnings


def validate_codebase_map(file_path: Path) -> tuple[bool, str, list[str]]:
    """Validate codebase_map.json."""
    return validate_memory_file(file_path, "codebase_map")


def validate_attempt_history(file_path: Path) -> tuple[bool, str, list[str]]:
    """Validate attempt_history.json."""
    if not file_path.exists():
        return True, "File not found (OK for first run)", []
    
    try:
        with open(file_path) as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return False, f"Invalid JSON: {e}", []
    
    warnings = []
    
    # Check structure
    if "subtasks" not in data:
        return False, "Missing 'subtasks' field", warnings
    
    if not isinstance(data["subtasks"], dict):
        return False, "'subtasks' must be an object", warnings
    
    # Validate each subtask entry
    for subtask_id, subtask_data in data["subtasks"].items():
        if "attempts" not in subtask_data:
            warnings.append(f"Subtask {subtask_id} missing 'attempts' array")
            continue
        
        if "status" not in subtask_data:
            warnings.append(f"Subtask {subtask_id} missing 'status' field")
        
        for i, attempt in enumerate(subtask_data.get("attempts", [])):
            if "timestamp" not in attempt:
                warnings.append(f"Subtask {subtask_id} attempt {i} missing timestamp")
            if "approach" not in attempt:
                warnings.append(f"Subtask {subtask_id} attempt {i} missing approach")
            if "success" not in attempt:
                warnings.append(f"Subtask {subtask_id} attempt {i} missing success flag")
    
    return True, "Valid", warnings


def validate_all_memory_files(spec_dir: Path) -> dict[str, tuple[bool, str, list[str]]]:
    """
    Validate all memory files in a spec directory.
    
    Args:
        spec_dir: Path to the spec directory
        
    Returns:
        Dict mapping file names to validation results
    """
    memory_dir = spec_dir / "memory"
    results = {}
    
    # Define files to validate
    files_to_validate = [
        ("codebase_map.json", "codebase_map"),
        ("attempt_history.json", "attempt_history"),
        ("build_commits.json", "build_commits"),
    ]
    
    for filename, schema_name in files_to_validate:
        file_path = memory_dir / filename
        if file_path.exists():
            results[filename] = validate_memory_file(file_path, schema_name)
        else:
            results[filename] = (True, "File not found (OK)", [])
    
    return results


def ensure_memory_structure(spec_dir: Path) -> None:
    """
    Ensure memory directory exists with proper structure.
    
    Args:
        spec_dir: Path to the spec directory
    """
    memory_dir = spec_dir / "memory"
    memory_dir.mkdir(parents=True, exist_ok=True)
    
    session_insights_dir = memory_dir / "session_insights"
    session_insights_dir.mkdir(exist_ok=True)
