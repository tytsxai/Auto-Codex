#!/usr/bin/env python3
"""
Tests for file_merger utilities.
"""

import sys
from datetime import datetime
from pathlib import Path

# Add auto-codex directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "auto-codex"))

from merge import ChangeType, SemanticChange, TaskSnapshot
from merge.file_merger import (
    apply_ai_merge,
    apply_single_task_changes,
    combine_non_conflicting_changes,
)


def test_apply_single_task_removes_import():
    baseline = "import os\nimport sys\n\nprint('hi')\n"
    snapshot = TaskSnapshot(
        task_id="task-001",
        task_intent="Remove sys import",
        started_at=datetime.now(),
        semantic_changes=[
            SemanticChange(
                change_type=ChangeType.REMOVE_IMPORT,
                target="sys",
                location="file_top",
                line_start=1,
                line_end=1,
                content_before="import sys",
            )
        ],
    )

    merged = apply_single_task_changes(baseline, snapshot, "app.py")

    assert "import sys" not in merged
    assert "import os" in merged


def test_apply_single_task_inserts_method_into_python_class():
    baseline = (
        "class Greeter:\n"
        "    def greet(self):\n"
        "        return \"hi\"\n"
        "\n"
        "def outside():\n"
        "    return \"outside\"\n"
    )
    snapshot = TaskSnapshot(
        task_id="task-002",
        task_intent="Add farewell method",
        started_at=datetime.now(),
        semantic_changes=[
            SemanticChange(
                change_type=ChangeType.ADD_FUNCTION,
                target="Greeter.farewell",
                location="function:Greeter.farewell",
                line_start=1,
                line_end=1,
                content_after="    def farewell(self):\n        return \"bye\"",
            )
        ],
    )

    merged = apply_single_task_changes(baseline, snapshot, "greeter.py")

    assert "def farewell" in merged
    assert merged.index("def farewell") < merged.index("def outside")


def test_combine_non_conflicting_applies_removals_and_additions():
    baseline = "import os\nimport sys\n\nVALUE = 1\n"
    snapshot_remove = TaskSnapshot(
        task_id="task-003",
        task_intent="Remove sys import",
        started_at=datetime.now(),
        semantic_changes=[
            SemanticChange(
                change_type=ChangeType.REMOVE_IMPORT,
                target="sys",
                location="file_top",
                line_start=1,
                line_end=1,
                content_before="import sys",
            )
        ],
    )
    snapshot_add = TaskSnapshot(
        task_id="task-004",
        task_intent="Add new variable",
        started_at=datetime.now(),
        semantic_changes=[
            SemanticChange(
                change_type=ChangeType.ADD_VARIABLE,
                target="NEW_VALUE",
                location="file_bottom",
                line_start=1,
                line_end=1,
                content_after="NEW_VALUE = 2",
            )
        ],
    )

    merged = combine_non_conflicting_changes(
        baseline, [snapshot_remove, snapshot_add], "app.py"
    )

    assert "import sys" not in merged
    assert "NEW_VALUE = 2" in merged


def test_apply_single_task_replaces_once():
    baseline = (
        "def hello():\n"
        "    return \"hi\"\n"
        "\n"
        "def hello():\n"
        "    return \"hi\"\n"
    )
    snapshot = TaskSnapshot(
        task_id="task-005",
        task_intent="Update hello return",
        started_at=datetime.now(),
        semantic_changes=[
            SemanticChange(
                change_type=ChangeType.MODIFY_FUNCTION,
                target="hello",
                location="function:hello",
                line_start=1,
                line_end=2,
                content_before="def hello():\n    return \"hi\"",
                content_after="def hello():\n    return \"bye\"",
            )
        ],
    )

    merged = apply_single_task_changes(baseline, snapshot, "hello.py")

    assert merged.count("return \"bye\"") == 1
    assert merged.count("return \"hi\"") == 1


def test_apply_single_task_preserves_crlf_line_endings():
    baseline = "import os\r\nimport sys\r\n\r\nVALUE = 1\r\n"
    snapshot = TaskSnapshot(
        task_id="task-006",
        task_intent="Remove sys import",
        started_at=datetime.now(),
        semantic_changes=[
            SemanticChange(
                change_type=ChangeType.REMOVE_IMPORT,
                target="sys",
                location="file_top",
                line_start=1,
                line_end=1,
                content_before="import sys",
            )
        ],
    )

    merged = apply_single_task_changes(baseline, snapshot, "app.py")

    assert "import sys" not in merged
    assert "\r\n" in merged
    assert "\n" not in merged.replace("\r\n", "")


def test_apply_ai_merge_allows_empty_region():
    content = (
        "function greet() {\n"
        "  return 'hi';\n"
        "}\n"
        "\n"
        "console.log('ok');\n"
    )

    merged = apply_ai_merge(content, "function:greet", "")

    assert "function greet" not in merged
    assert "console.log('ok');" in merged
