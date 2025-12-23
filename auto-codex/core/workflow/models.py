#!/usr/bin/env python3
"""
Workflow Data Models
====================

Data classes for the smart worktree workflow system.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any


class RiskLevel(Enum):
    """Conflict risk level."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class IssueType(Enum):
    """Review issue type."""
    CONFLICT = "conflict"
    IMPORT_ERROR = "import_error"
    TYPE_MISMATCH = "type_mismatch"
    TEST_FAILURE = "test_failure"
    SYNTAX_ERROR = "syntax_error"


class CommitMode(Enum):
    """Commit mode options."""
    ALL = "all"
    BY_TASK = "by_task"
    PARTIAL = "partial"


@dataclass
class WorkflowSettings:
    """Settings for workflow management."""
    auto_cleanup_after_merge: bool = True
    stale_worktree_days: int = 7
    max_worktrees_warning: int = 10
    show_conflict_risks: bool = True
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "auto_cleanup_after_merge": self.auto_cleanup_after_merge,
            "stale_worktree_days": self.stale_worktree_days,
            "max_worktrees_warning": self.max_worktrees_warning,
            "show_conflict_risks": self.show_conflict_risks,
        }
    
    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "WorkflowSettings":
        """Create from dictionary."""
        return cls(
            auto_cleanup_after_merge=data.get("auto_cleanup_after_merge", True),
            stale_worktree_days=data.get("stale_worktree_days", 7),
            max_worktrees_warning=data.get("max_worktrees_warning", 10),
            show_conflict_risks=data.get("show_conflict_risks", True),
        )


@dataclass
class StagedChange:
    """Represents a staged change from a task."""
    task_id: str
    spec_name: str
    files: list[str]
    staged_at: datetime
    merge_source: str  # worktree path
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "task_id": self.task_id,
            "spec_name": self.spec_name,
            "files": self.files,
            "staged_at": self.staged_at.isoformat(),
            "merge_source": self.merge_source,
        }
    
    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "StagedChange":
        """Create from dictionary."""
        staged_at = data.get("staged_at")
        if isinstance(staged_at, str):
            staged_at = datetime.fromisoformat(staged_at)
        elif staged_at is None:
            staged_at = datetime.now()
        
        return cls(
            task_id=data.get("task_id", ""),
            spec_name=data.get("spec_name", ""),
            files=data.get("files", []),
            staged_at=staged_at,
            merge_source=data.get("merge_source", ""),
        )


@dataclass
class StagedChangesStore:
    """Persistent store for staged changes."""
    version: int = 1
    changes: list[StagedChange] = field(default_factory=list)
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "version": self.version,
            "changes": [c.to_dict() for c in self.changes],
        }
    
    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "StagedChangesStore":
        """Create from dictionary."""
        return cls(
            version=data.get("version", 1),
            changes=[StagedChange.from_dict(c) for c in data.get("changes", [])],
        )


@dataclass
class StageResult:
    """Result of staging a worktree."""
    success: bool
    files_staged: list[str] = field(default_factory=list)
    worktree_cleaned: bool = False
    error: str | None = None
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "success": self.success,
            "files_staged": self.files_staged,
            "worktree_cleaned": self.worktree_cleaned,
            "error": self.error,
        }


@dataclass
class WorktreeInfo:
    """Information about a single worktree."""
    spec_name: str
    path: str
    branch: str
    days_since_activity: int
    disk_usage_mb: float
    has_conflicts: bool = False
    conflict_files: list[str] = field(default_factory=list)
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "spec_name": self.spec_name,
            "path": self.path,
            "branch": self.branch,
            "days_since_activity": self.days_since_activity,
            "disk_usage_mb": self.disk_usage_mb,
            "has_conflicts": self.has_conflicts,
            "conflict_files": self.conflict_files,
        }


@dataclass
class WorktreeHealthStatus:
    """Overall health status of worktrees."""
    total_count: int
    stale_count: int
    total_disk_usage_mb: float
    worktrees: list[WorktreeInfo] = field(default_factory=list)
    warning_message: str | None = None
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "total_count": self.total_count,
            "stale_count": self.stale_count,
            "total_disk_usage_mb": self.total_disk_usage_mb,
            "worktrees": [w.to_dict() for w in self.worktrees],
            "warning_message": self.warning_message,
        }


@dataclass
class ConflictRisk:
    """Potential conflict between two worktrees."""
    worktree_a: str
    worktree_b: str
    conflicting_files: list[str]
    risk_level: RiskLevel
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "worktree_a": self.worktree_a,
            "worktree_b": self.worktree_b,
            "conflicting_files": self.conflicting_files,
            "risk_level": self.risk_level.value,
        }
    
    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ConflictRisk":
        """Create from dictionary."""
        risk_level = data.get("risk_level", "low")
        if isinstance(risk_level, str):
            risk_level = RiskLevel(risk_level)
        
        return cls(
            worktree_a=data.get("worktree_a", ""),
            worktree_b=data.get("worktree_b", ""),
            conflicting_files=data.get("conflicting_files", []),
            risk_level=risk_level,
        )


@dataclass
class ReviewIssue:
    """An issue found during AI review."""
    file: str
    line: int | None
    type: IssueType
    message: str
    suggestion: str | None = None
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "file": self.file,
            "line": self.line,
            "type": self.type.value,
            "message": self.message,
            "suggestion": self.suggestion,
        }


@dataclass
class TestResults:
    """Results from running tests."""
    passed: int
    failed: int
    skipped: int
    errors: list[str] = field(default_factory=list)
    duration_seconds: float = 0.0
    
    @property
    def success(self) -> bool:
        """Check if all tests passed."""
        return self.failed == 0 and len(self.errors) == 0
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "passed": self.passed,
            "failed": self.failed,
            "skipped": self.skipped,
            "errors": self.errors,
            "duration_seconds": self.duration_seconds,
            "success": self.success,
        }


@dataclass
class ReviewReport:
    """Report from AI review of staged changes."""
    success: bool
    issues: list[ReviewIssue] = field(default_factory=list)
    test_results: TestResults | None = None
    suggestions: list[str] = field(default_factory=list)
    summary: str = ""
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "success": self.success,
            "issues": [i.to_dict() for i in self.issues],
            "test_results": self.test_results.to_dict() if self.test_results else None,
            "suggestions": self.suggestions,
            "summary": self.summary,
        }


@dataclass
class CommitResult:
    """Result of a commit operation."""
    success: bool
    commit_hash: str | None = None
    message: str = ""
    files_committed: list[str] = field(default_factory=list)
    error: str | None = None
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "success": self.success,
            "commit_hash": self.commit_hash,
            "message": self.message,
            "files_committed": self.files_committed,
            "error": self.error,
        }
