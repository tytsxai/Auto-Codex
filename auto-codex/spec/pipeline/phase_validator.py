"""
Phase Validator
===============

Validates phase outputs for completeness and correctness.
"""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# Phase output expectations
PHASE_OUTPUTS: dict[str, dict[str, Any]] = {
    "discovery": {
        "required_files": ["project_index.json"],
        "optional_files": [],
    },
    "requirements": {
        "required_files": ["requirements.json"],
        "optional_files": [],
        "json_fields": ["task_description", "workflow_type", "services_involved"],
    },
    "research": {
        "required_files": ["research.json"],
        "optional_files": [],
        "json_fields": ["integrations_researched"],
    },
    "context": {
        "required_files": ["context.json"],
        "optional_files": [],
    },
    "spec_writing": {
        "required_files": ["spec.md"],
        "optional_files": [],
        "markdown_sections": ["## Overview", "## Requirements"],
    },
    "planning": {
        "required_files": ["implementation_plan.json"],
        "optional_files": ["init.sh", "build-progress.txt"],
        "json_fields": ["phases"],
    },
    "self_critique": {
        "required_files": ["spec.md"],
        "optional_files": ["spec_critique.md"],
    },
    "validation": {
        "required_files": ["implementation_plan.json"],
        "optional_files": [],
    },
}


@dataclass
class ValidationResult:
    """Result of phase validation."""
    success: bool
    errors: list[str]
    warnings: list[str]


class PhaseValidator:
    """Validates phase outputs for completeness and correctness."""
    
    def __init__(self, spec_dir: Path):
        """
        Initialize the phase validator.
        
        Args:
            spec_dir: Path to the spec directory
        """
        self.spec_dir = Path(spec_dir)
    
    def validate_phase(self, phase_name: str) -> ValidationResult:
        """
        Validate outputs for a specific phase.
        
        Args:
            phase_name: Name of the phase to validate
            
        Returns:
            ValidationResult with success status, errors, and warnings
        """
        if phase_name not in PHASE_OUTPUTS:
            return ValidationResult(
                success=True,
                errors=[],
                warnings=[f"No validation rules defined for phase: {phase_name}"]
            )
        
        config = PHASE_OUTPUTS[phase_name]
        errors: list[str] = []
        warnings: list[str] = []
        
        # Check required files
        for filename in config.get("required_files", []):
            file_path = self.spec_dir / filename
            if not file_path.exists():
                errors.append(f"Missing required file: {filename}")
            elif filename.endswith(".json"):
                # Validate JSON format
                json_errors = self._validate_json_file(file_path, config)
                errors.extend(json_errors)
            elif filename.endswith(".md"):
                # Validate markdown sections
                md_errors = self._validate_markdown_file(file_path, config)
                errors.extend(md_errors)
        
        # Check optional files
        for filename in config.get("optional_files", []):
            file_path = self.spec_dir / filename
            if not file_path.exists():
                warnings.append(f"Optional file missing: {filename}")
        
        return ValidationResult(
            success=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
    
    def _validate_json_file(
        self, 
        file_path: Path, 
        config: dict[str, Any]
    ) -> list[str]:
        """Validate a JSON file."""
        errors = []
        
        try:
            with open(file_path) as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            return [f"Invalid JSON in {file_path.name}: {e}"]
        
        # Check required fields
        for field in config.get("json_fields", []):
            if field not in data:
                errors.append(f"Missing required field '{field}' in {file_path.name}")
        
        return errors
    
    def _validate_markdown_file(
        self, 
        file_path: Path, 
        config: dict[str, Any]
    ) -> list[str]:
        """Validate a markdown file."""
        errors = []
        
        try:
            content = file_path.read_text()
        except OSError as e:
            return [f"Cannot read {file_path.name}: {e}"]
        
        # Check required sections
        for section in config.get("markdown_sections", []):
            if section not in content:
                errors.append(f"Missing section '{section}' in {file_path.name}")
        
        return errors
    
    def validate_self_critique(self, subtask_id: str) -> ValidationResult:
        """
        Validate self-critique report for a subtask.
        
        Args:
            subtask_id: ID of the subtask
            
        Returns:
            ValidationResult
        """
        report_file = self.spec_dir / "self_critique_report.json"
        errors = []
        warnings = []
        
        if not report_file.exists():
            return ValidationResult(
                success=False,
                errors=["Self-critique report not found"],
                warnings=[]
            )
        
        try:
            with open(report_file) as f:
                report = json.load(f)
        except json.JSONDecodeError as e:
            return ValidationResult(
                success=False,
                errors=[f"Invalid JSON in self-critique report: {e}"],
                warnings=[]
            )
        
        # Verify it's for the correct subtask
        if report.get("subtask_id") != subtask_id:
            errors.append(
                f"Self-critique report is for subtask '{report.get('subtask_id')}', "
                f"expected '{subtask_id}'"
            )
        
        # Check verdict
        verdict = report.get("verdict", {})
        if not verdict.get("proceed"):
            errors.append(f"Self-critique failed: {verdict.get('reason', 'Unknown reason')}")
        
        # Check confidence
        confidence = verdict.get("confidence", "unknown")
        if confidence == "low":
            warnings.append("Self-critique confidence is low")
        
        return ValidationResult(
            success=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
    
    def archive_self_critique(self, subtask_id: str) -> None:
        """
        Archive self-critique report after successful validation.
        
        Args:
            subtask_id: ID of the subtask
        """
        report_file = self.spec_dir / "self_critique_report.json"
        if not report_file.exists():
            return
        
        # Create archive directory
        archive_dir = self.spec_dir / "self_critique_history"
        archive_dir.mkdir(exist_ok=True)
        
        # Move to archive with subtask ID
        archive_file = archive_dir / f"{subtask_id}_critique.json"
        report_file.rename(archive_file)
