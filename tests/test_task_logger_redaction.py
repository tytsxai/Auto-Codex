#!/usr/bin/env python3
"""
Tests for task_logger redaction utilities.
"""

import sys
from pathlib import Path

# Add auto-codex to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "auto-codex"))

from task_logger.models import LogEntry, LogEntryType, LogPhase
from task_logger.redaction import redact_text
from task_logger.storage import LogStorage, load_task_logs


def test_redact_text_masks_common_patterns():
    original = (
        "sk-test1234567890abcdef "
        "codex_oauth_1234567890abcdef "
        "Bearer supersecrettoken "
        "token=abc123"
    )
    redacted = redact_text(original)

    assert "sk-test" not in redacted
    assert "codex_oauth_" not in redacted
    assert "Bearer supersecrettoken" not in redacted
    assert "token=abc123" not in redacted
    assert "[REDACTED]" in redacted


def test_log_storage_redacts_before_persist(tmp_path: Path):
    storage = LogStorage(tmp_path)
    entry = LogEntry(
        timestamp="2024-01-01T00:00:00Z",
        type=LogEntryType.TEXT.value,
        content="sk-test1234567890abcdef",
        phase=LogPhase.PLANNING.value,
        detail="Bearer supersecrettoken",
        tool_input="token=abc123",
    )

    storage.add_entry(entry)
    data = load_task_logs(tmp_path)
    assert data is not None

    entries = data["phases"][LogPhase.PLANNING.value]["entries"]
    assert len(entries) == 1
    saved = entries[0]

    assert "sk-test" not in saved["content"]
    assert "[REDACTED]" in saved["content"]
    assert "Bearer supersecrettoken" not in saved["detail"]
    assert "[REDACTED]" in saved["detail"]
    assert "token=abc123" not in saved["tool_input"]
    assert "[REDACTED]" in saved["tool_input"]
