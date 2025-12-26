"""
Tests for PhaseValidator
"""

import json

# Add auto-codex to path for imports
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "auto-codex"))

from spec.pipeline.phase_validator import (
    PHASE_OUTPUTS,
    PhaseValidator,
    ValidationResult,
)


@pytest.fixture
def temp_spec_dir(tmp_path):
    """Create a temporary spec directory."""
    spec_dir = tmp_path / "test-spec"
    spec_dir.mkdir()
    return spec_dir


class TestPhaseValidator:
    """Tests for PhaseValidator class."""
    
    def test_validate_unknown_phase(self, temp_spec_dir):
        """Unknown phases should pass with a warning."""
        validator = PhaseValidator(temp_spec_dir)
        result = validator.validate_phase("unknown_phase")
        
        assert result.success is True
        assert len(result.errors) == 0
        assert len(result.warnings) == 1
        assert "No validation rules" in result.warnings[0]
    
    def test_validate_missing_required_file(self, temp_spec_dir):
        """Missing required files should fail validation."""
        validator = PhaseValidator(temp_spec_dir)
        result = validator.validate_phase("requirements")
        
        assert result.success is False
        assert any("Missing required file" in e for e in result.errors)
    
    def test_validate_valid_requirements(self, temp_spec_dir):
        """Valid requirements.json should pass validation."""
        # Create valid requirements.json
        requirements = {
            "task_description": "Test task",
            "workflow_type": "feature",
            "services_involved": ["service1"]
        }
        (temp_spec_dir / "requirements.json").write_text(json.dumps(requirements))
        
        validator = PhaseValidator(temp_spec_dir)
        result = validator.validate_phase("requirements")
        
        assert result.success is True
        assert len(result.errors) == 0

    def test_validate_invalid_json(self, temp_spec_dir):
        """Invalid JSON should fail validation."""
        (temp_spec_dir / "requirements.json").write_text("not valid json")
        
        validator = PhaseValidator(temp_spec_dir)
        result = validator.validate_phase("requirements")
        
        assert result.success is False
        assert any("Invalid JSON" in e for e in result.errors)
    
    def test_validate_missing_json_fields(self, temp_spec_dir):
        """Missing required JSON fields should fail validation."""
        # Create requirements.json missing required fields
        requirements = {"task_description": "Test"}  # Missing workflow_type, services_involved
        (temp_spec_dir / "requirements.json").write_text(json.dumps(requirements))
        
        validator = PhaseValidator(temp_spec_dir)
        result = validator.validate_phase("requirements")
        
        assert result.success is False
        assert any("workflow_type" in e for e in result.errors)
    
    def test_validate_markdown_sections(self, temp_spec_dir):
        """Markdown files should have required sections."""
        # Create spec.md without required sections
        (temp_spec_dir / "spec.md").write_text("# Some Title\n\nSome content")
        
        validator = PhaseValidator(temp_spec_dir)
        result = validator.validate_phase("spec_writing")
        
        assert result.success is False
        assert any("## Overview" in e for e in result.errors)
    
    def test_validate_valid_spec_md(self, temp_spec_dir):
        """Valid spec.md should pass validation."""
        spec_content = """# Test Spec

## Overview

This is the overview.

## Requirements

These are the requirements.
"""
        (temp_spec_dir / "spec.md").write_text(spec_content)
        
        validator = PhaseValidator(temp_spec_dir)
        result = validator.validate_phase("spec_writing")
        
        assert result.success is True
    
    def test_validate_optional_files_warning(self, temp_spec_dir):
        """Missing optional files should generate warnings, not errors."""
        # Create required file for planning phase
        plan = {"phases": []}
        (temp_spec_dir / "implementation_plan.json").write_text(json.dumps(plan))
        
        validator = PhaseValidator(temp_spec_dir)
        result = validator.validate_phase("planning")
        
        assert result.success is True
        # Should have warnings for missing optional files
        assert any("init.sh" in w for w in result.warnings)


class TestSelfCritiqueValidation:
    """Tests for self-critique validation."""
    
    def test_missing_self_critique_report(self, temp_spec_dir):
        """Missing self-critique report should fail."""
        validator = PhaseValidator(temp_spec_dir)
        result = validator.validate_self_critique("subtask-1")
        
        assert result.success is False
        assert any("not found" in e for e in result.errors)
    
    def test_wrong_subtask_id(self, temp_spec_dir):
        """Self-critique for wrong subtask should fail."""
        report = {
            "subtask_id": "subtask-2",
            "verdict": {"proceed": True, "confidence": "high", "reason": "OK"}
        }
        (temp_spec_dir / "self_critique_report.json").write_text(json.dumps(report))
        
        validator = PhaseValidator(temp_spec_dir)
        result = validator.validate_self_critique("subtask-1")
        
        assert result.success is False
        assert any("subtask-2" in e for e in result.errors)
    
    def test_failed_verdict(self, temp_spec_dir):
        """Self-critique with proceed=False should fail."""
        report = {
            "subtask_id": "subtask-1",
            "verdict": {"proceed": False, "confidence": "high", "reason": "Issues found"}
        }
        (temp_spec_dir / "self_critique_report.json").write_text(json.dumps(report))
        
        validator = PhaseValidator(temp_spec_dir)
        result = validator.validate_self_critique("subtask-1")
        
        assert result.success is False
        assert any("Issues found" in e for e in result.errors)
    
    def test_valid_self_critique(self, temp_spec_dir):
        """Valid self-critique should pass."""
        report = {
            "subtask_id": "subtask-1",
            "verdict": {"proceed": True, "confidence": "high", "reason": "All good"}
        }
        (temp_spec_dir / "self_critique_report.json").write_text(json.dumps(report))
        
        validator = PhaseValidator(temp_spec_dir)
        result = validator.validate_self_critique("subtask-1")
        
        assert result.success is True
    
    def test_low_confidence_warning(self, temp_spec_dir):
        """Low confidence should generate warning."""
        report = {
            "subtask_id": "subtask-1",
            "verdict": {"proceed": True, "confidence": "low", "reason": "Uncertain"}
        }
        (temp_spec_dir / "self_critique_report.json").write_text(json.dumps(report))
        
        validator = PhaseValidator(temp_spec_dir)
        result = validator.validate_self_critique("subtask-1")
        
        assert result.success is True
        assert any("low" in w for w in result.warnings)
    
    def test_archive_self_critique(self, temp_spec_dir):
        """Self-critique should be archived after validation."""
        report = {
            "subtask_id": "subtask-1",
            "verdict": {"proceed": True, "confidence": "high", "reason": "OK"}
        }
        report_file = temp_spec_dir / "self_critique_report.json"
        report_file.write_text(json.dumps(report))
        
        validator = PhaseValidator(temp_spec_dir)
        validator.archive_self_critique("subtask-1")
        
        # Original file should be moved
        assert not report_file.exists()
        
        # Archive should exist
        archive_file = temp_spec_dir / "self_critique_history" / "subtask-1_critique.json"
        assert archive_file.exists()
