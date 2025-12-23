# Design Document: Smart Worktree Workflow

## Overview

智能工作流管理系统重构 Auto Codex 的工作树生命周期，实现：
1. 开发时隔离（工作树）
2. 合并后自动清理
3. 统一暂存审查
4. 灵活提交选项

核心理念：**工作树是临时的开发环境，不是永久存储**。

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Smart Worktree Workflow                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│  │  WorkflowManager │    │  ChangeTracker   │    │   AIReviewer     │   │
│  │                  │    │                  │    │                  │   │
│  │  - stageWorktree │    │  - trackChanges  │    │  - reviewAll     │   │
│  │  - autoCleanup   │    │  - getByTask     │    │  - detectIssues  │   │
│  │  - getHealth     │    │  - persist       │    │  - runTests      │   │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘   │
│           │                       │                       │              │
│           └───────────────────────┼───────────────────────┘              │
│                                   │                                      │
│                                   ▼                                      │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                        StagedChangesStore                         │   │
│  │                                                                   │   │
│  │  .auto-codex/staged_changes.json                                 │   │
│  │  {                                                                │   │
│  │    "version": 1,                                                  │   │
│  │    "changes": [                                                   │   │
│  │      { "taskId": "...", "specName": "...", "files": [...] }      │   │
│  │    ]                                                              │   │
│  │  }                                                                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. WorkflowManager

负责工作树生命周期管理。

```python
class WorkflowManager:
    def __init__(self, project_dir: Path, settings: WorkflowSettings):
        self.project_dir = project_dir
        self.settings = settings
        self.change_tracker = ChangeTracker(project_dir)
    
    def stage_worktree(self, spec_name: str, auto_cleanup: bool = None) -> StageResult:
        """
        Stage worktree changes to main repository.
        
        Args:
            spec_name: Name of the spec/worktree
            auto_cleanup: Override settings.auto_cleanup_after_merge
        
        Returns:
            StageResult with success status and staged files
        """
        pass
    
    def cleanup_worktree(self, spec_name: str) -> bool:
        """Delete a worktree and its branch."""
        pass
    
    def cleanup_stale_worktrees(self, days: int = 7) -> list[str]:
        """Remove all worktrees older than N days."""
        pass
    
    def get_health_status(self) -> WorktreeHealthStatus:
        """Get overall worktree health metrics."""
        pass
    
    def get_conflict_risks(self) -> list[ConflictRisk]:
        """Analyze potential conflicts between worktrees."""
        pass
    
    def suggest_merge_order(self) -> list[str]:
        """Suggest optimal merge order based on conflicts."""
        pass
```

### 2. ChangeTracker

追踪暂存更改的来源。

```python
class ChangeTracker:
    def __init__(self, project_dir: Path):
        self.project_dir = project_dir
        self.store_path = project_dir / ".auto-codex" / "staged_changes.json"
    
    def track_changes(self, task_id: str, spec_name: str, files: list[str]) -> None:
        """Record which files belong to which task."""
        pass
    
    def get_changes_by_task(self, task_id: str) -> list[str]:
        """Get files staged by a specific task."""
        pass
    
    def get_all_staged(self) -> list[StagedChange]:
        """Get all staged changes grouped by task."""
        pass
    
    def remove_changes(self, task_id: str) -> None:
        """Remove tracking for a task (after commit/discard)."""
        pass
    
    def persist(self) -> None:
        """Save state to disk."""
        pass
    
    def restore(self) -> None:
        """Load state from disk."""
        pass
```

### 3. AIReviewer

AI 统一审查模块。

```python
class AIReviewer:
    def __init__(self, project_dir: Path):
        self.project_dir = project_dir
    
    async def review_staged_changes(self) -> ReviewReport:
        """
        Analyze all staged changes for issues.
        
        Returns:
            ReviewReport with issues, suggestions, and test results
        """
        pass
    
    async def run_tests(self) -> TestResults:
        """Execute tests and return results."""
        pass
    
    def detect_conflicts(self, changes: list[StagedChange]) -> list[Conflict]:
        """Detect conflicts between staged changes."""
        pass
    
    def generate_commit_message(self, changes: list[StagedChange], mode: str) -> str:
        """Generate AI-suggested commit message."""
        pass
```

### 4. CommitManager

处理各种提交模式。

```python
class CommitManager:
    def __init__(self, project_dir: Path, change_tracker: ChangeTracker):
        self.project_dir = project_dir
        self.change_tracker = change_tracker
    
    def commit_all(self, message: str) -> CommitResult:
        """Create single commit with all staged changes."""
        pass
    
    def commit_by_task(self, messages: dict[str, str] = None) -> list[CommitResult]:
        """Create separate commits for each task."""
        pass
    
    def commit_partial(self, files: list[str], message: str) -> CommitResult:
        """Commit only selected files."""
        pass
    
    def discard_all(self, restore_worktrees: bool = False) -> None:
        """Unstage all changes."""
        pass
```

## Data Models

```python
@dataclass
class WorkflowSettings:
    auto_cleanup_after_merge: bool = True
    stale_worktree_days: int = 7
    max_worktrees_warning: int = 10
    show_conflict_risks: bool = True

@dataclass
class StagedChange:
    task_id: str
    spec_name: str
    files: list[str]
    staged_at: datetime
    merge_source: str  # worktree path

@dataclass
class StageResult:
    success: bool
    files_staged: list[str]
    worktree_cleaned: bool
    error: str | None = None

@dataclass
class WorktreeHealthStatus:
    total_count: int
    stale_count: int
    total_disk_usage_mb: float
    worktrees: list[WorktreeInfo]

@dataclass
class ConflictRisk:
    worktree_a: str
    worktree_b: str
    conflicting_files: list[str]
    risk_level: str  # "low", "medium", "high"

@dataclass
class ReviewReport:
    success: bool
    issues: list[ReviewIssue]
    test_results: TestResults | None
    suggestions: list[str]
    
@dataclass
class ReviewIssue:
    file: str
    line: int | None
    type: str  # "conflict", "import_error", "type_mismatch", "test_failure"
    message: str
    suggestion: str | None
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Auto-cleanup respects settings

*For any* worktree staging operation, if `auto_cleanup_after_merge` is true and staging succeeds, the worktree should be deleted; if false, the worktree should be preserved.

**Validates: Requirements 1.1, 1.2**

### Property 2: Change tracking round-trip

*For any* set of staged changes, persisting to `staged_changes.json` and then restoring should produce an equivalent set of changes with all fields preserved.

**Validates: Requirements 2.4, 5.1, 5.3, 5.4**

### Property 3: Task-file mapping integrity

*For any* staged change, the files recorded in the change tracker should exactly match the files that were staged from that task's worktree.

**Validates: Requirements 2.2, 2.3**

### Property 4: Commit mode correctness

*For any* commit operation:
- "commit all" produces exactly 1 commit containing all staged files
- "commit by task" produces N commits for N tasks, each containing only that task's files
- "commit partial" produces 1 commit containing only the selected files

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 5: Discard restores clean state

*For any* discard operation, after completion there should be no staged changes in git and the change tracker should be empty.

**Validates: Requirements 4.4**

### Property 6: Health metrics accuracy

*For any* set of worktrees, the health status should accurately report: total count, stale count (based on configured days), and disk usage.

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 7: Conflict detection completeness

*For any* two worktrees that modify the same file, both should be marked with conflict risk, and the conflicting files should be listed.

**Validates: Requirements 7.1, 7.2, 7.3, 7.4**

## Error Handling

| Error | Handling |
|-------|----------|
| Worktree cleanup fails | Log error, notify user, don't block merge result |
| Staged changes file corrupted | Reset to empty state, warn user |
| AI review timeout | Return partial results with timeout warning |
| Test execution fails | Include failure in report, don't block review |
| Git operations fail | Retry once, then report error with recovery steps |

## Testing Strategy

### Unit Tests
- Test each component in isolation with mocked dependencies
- Test data model serialization/deserialization
- Test settings validation

### Property-Based Tests
- Use Hypothesis to generate random worktree states
- Test round-trip persistence
- Test commit mode correctness
- Test conflict detection

### Integration Tests
- Test full workflow: stage → track → review → commit
- Test cleanup behavior with real git operations
- Test UI integration with IPC handlers

