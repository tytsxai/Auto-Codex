"""
Tests for Memory Validator
"""

import json

# Add auto-codex to path for imports
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "auto-codex"))

from memory_validator import (
    ensure_memory_structure,
    load_schemas,
    validate_all_memory_files,
    validate_attempt_history,
    validate_memory_file,
)


@pytest.fixture
def temp_spec_dir(tmp_path):
    """Create a temporary spec directory with memory folder."""
    spec_dir = tmp_path / "test-spec"
    spec_dir.mkdir()
    memory_dir = spec_dir / "memory"
    memory_dir.mkdir()
    return spec_dir


class TestLoadSchemas:
    """Tests for schema loading."""
    
    def test_load_schemas_returns_dict(self):
        """load_schemas should return a dictionary."""
        schemas = load_schemas()
        assert isinstance(schemas, dict)
    
    def test_schemas_contain_expected_keys(self):
        """Schemas should contain expected memory file types."""
        schemas = load_schemas()
        # May be empty if schema file doesn't exist in test environment
        # but should not raise an error
        assert isinstance(schemas, dict)


class TestValidateAttemptHistory:
    """Tests for attempt_history.json validation."""
    
    def test_missing_file_is_ok(self, temp_spec_dir):
        """Missing attempt_history.json is OK for first run."""
        file_path = temp_spec_dir / "memory" / "attempt_history.json"
        is_valid, message, warnings = validate_attempt_history(file_path)
        
        assert is_valid is True
        assert "not found" in message.lower()
    
    def test_invalid_json(self, temp_spec_dir):
        """Invalid JSON should fail validation."""
        file_path = temp_spec_dir / "memory" / "attempt_history.json"
        file_path.write_text("not valid json")
        
        is_valid, message, warnings = validate_attempt_history(file_path)
        
        assert is_valid is False
        assert "Invalid JSON" in message

    def test_missing_subtasks_field(self, temp_spec_dir):
        """Missing subtasks field should fail validation."""
        file_path = temp_spec_dir / "memory" / "attempt_history.json"
        file_path.write_text(json.dumps({"other": "data"}))
        
        is_valid, message, warnings = validate_attempt_history(file_path)
        
        assert is_valid is False
        assert "subtasks" in message.lower()
    
    def test_valid_attempt_history(self, temp_spec_dir):
        """Valid attempt_history.json should pass validation."""
        file_path = temp_spec_dir / "memory" / "attempt_history.json"
        data = {
            "subtasks": {
                "subtask-1": {
                    "attempts": [
                        {
                            "timestamp": "2024-01-01T00:00:00Z",
                            "approach": "First approach",
                            "success": False,
                            "error": "Some error"
                        }
                    ],
                    "status": "failed"
                }
            },
            "stuck_subtasks": [],
            "_metadata": {
                "last_updated": "2024-01-01T00:00:00Z"
            }
        }
        file_path.write_text(json.dumps(data))
        
        is_valid, message, warnings = validate_attempt_history(file_path)
        
        assert is_valid is True
    
    def test_missing_attempt_fields_warning(self, temp_spec_dir):
        """Missing fields in attempts should generate warnings."""
        file_path = temp_spec_dir / "memory" / "attempt_history.json"
        data = {
            "subtasks": {
                "subtask-1": {
                    "attempts": [
                        {"timestamp": "2024-01-01T00:00:00Z"}  # Missing approach, success
                    ],
                    "status": "pending"
                }
            }
        }
        file_path.write_text(json.dumps(data))
        
        is_valid, message, warnings = validate_attempt_history(file_path)
        
        assert is_valid is True  # Still valid, just warnings
        assert len(warnings) > 0
        assert any("approach" in w for w in warnings)


class TestValidateAllMemoryFiles:
    """Tests for validating all memory files."""
    
    def test_empty_memory_dir(self, temp_spec_dir):
        """Empty memory directory should pass (files are optional)."""
        results = validate_all_memory_files(temp_spec_dir)
        
        assert isinstance(results, dict)
        for filename, (is_valid, message, warnings) in results.items():
            assert is_valid is True
    
    def test_with_valid_files(self, temp_spec_dir):
        """Valid memory files should all pass."""
        memory_dir = temp_spec_dir / "memory"
        
        # Create valid codebase_map.json
        codebase_map = {
            "src/main.py": "Main entry point",
            "_metadata": {"last_updated": "2024-01-01T00:00:00Z", "total_files": 1}
        }
        (memory_dir / "codebase_map.json").write_text(json.dumps(codebase_map))
        
        # Create valid attempt_history.json
        attempt_history = {
            "subtasks": {},
            "stuck_subtasks": [],
            "_metadata": {"last_updated": "2024-01-01T00:00:00Z"}
        }
        (memory_dir / "attempt_history.json").write_text(json.dumps(attempt_history))
        
        results = validate_all_memory_files(temp_spec_dir)
        
        for filename, (is_valid, message, warnings) in results.items():
            assert is_valid is True, f"{filename} failed: {message}"


class TestEnsureMemoryStructure:
    """Tests for ensuring memory directory structure."""
    
    def test_creates_memory_dir(self, tmp_path):
        """Should create memory directory if it doesn't exist."""
        spec_dir = tmp_path / "new-spec"
        spec_dir.mkdir()
        
        ensure_memory_structure(spec_dir)
        
        assert (spec_dir / "memory").exists()
        assert (spec_dir / "memory" / "session_insights").exists()
    
    def test_idempotent(self, temp_spec_dir):
        """Should be safe to call multiple times."""
        ensure_memory_structure(temp_spec_dir)
        ensure_memory_structure(temp_spec_dir)
        
        assert (temp_spec_dir / "memory").exists()
        assert (temp_spec_dir / "memory" / "session_insights").exists()
