#!/usr/bin/env python3
"""
Smart Worktree Workflow
=======================

Provides intelligent worktree management with:
- Staged changes tracking
- AI-powered review before commit
- Flexible commit modes (all/by-task/partial)
- Health monitoring and conflict detection

Usage:
    from auto_codex.core.workflow import (
        WorkflowManager,
        ChangeTracker,
        CommitManager,
        AIReviewer,
        WorkflowSettings,
    )
    
    # Initialize
    manager = WorkflowManager(project_dir)
    
    # Stage worktree changes
    result = manager.stage_worktree("my-feature")
    
    # Review before commit
    reviewer = AIReviewer(project_dir, manager.change_tracker)
    report = await reviewer.review_staged_changes()
    
    # Commit
    commit_mgr = CommitManager(project_dir, manager.change_tracker)
    commit_result = commit_mgr.commit_all("feat: implement feature")
"""

from .ai_reviewer import AIReviewer
from .change_tracker import ChangeTracker
from .commit_manager import CommitManager
from .manager import WorkflowManager
from .models import (
    CommitMode,
    CommitResult,
    ConflictRisk,
    IssueType,
    ReviewIssue,
    ReviewReport,
    RiskLevel,
    StageResult,
    StagedChange,
    StagedChangesStore,
    TestResults,
    WorkflowSettings,
    WorktreeHealthStatus,
    WorktreeInfo,
)

__all__ = [
    # Managers
    "WorkflowManager",
    "ChangeTracker",
    "CommitManager",
    "AIReviewer",
    # Models
    "WorkflowSettings",
    "StagedChange",
    "StagedChangesStore",
    "StageResult",
    "WorktreeInfo",
    "WorktreeHealthStatus",
    "ConflictRisk",
    "ReviewIssue",
    "ReviewReport",
    "TestResults",
    "CommitResult",
    # Enums
    "RiskLevel",
    "IssueType",
    "CommitMode",
]
