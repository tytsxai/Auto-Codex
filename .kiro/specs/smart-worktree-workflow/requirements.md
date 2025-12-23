# Requirements Document

## Introduction

智能工作流管理系统，优化 Auto Codex 的多任务并行开发体验。通过工作树隔离开发、自动清理、统一暂存和 AI 审查，实现高效可靠的代码合并流程。

## Glossary

- **Worktree**: Git 工作树，为每个 spec 提供独立的开发环境
- **Stage**: Git 暂存区，存放待提交的更改
- **Staged_Changes**: 已暂存但未提交的代码更改
- **AI_Reviewer**: AI 审查模块，分析所有暂存更改的一致性和质量
- **Workflow_Manager**: 工作流管理器，协调工作树生命周期
- **Change_Tracker**: 更改追踪器，记录每个更改的来源任务

## Requirements

### Requirement 1: 合并后自动清理工作树

**User Story:** As a developer, I want worktrees to be automatically cleaned up after successful merge, so that I don't accumulate unused worktrees.

#### Acceptance Criteria

1. WHEN a worktree is successfully staged to main repository, THE Workflow_Manager SHALL automatically delete the worktree
2. WHEN auto-cleanup is disabled in settings, THE Workflow_Manager SHALL keep the worktree after merge
3. WHEN cleanup fails, THE Workflow_Manager SHALL log the error and notify the user without blocking the merge result
4. THE Workflow_Manager SHALL provide a setting `autoCleanupAfterMerge` with default value `true`

### Requirement 2: 统一暂存模式

**User Story:** As a developer, I want all task changes to be staged without auto-commit, so that I can review all changes together before committing.

#### Acceptance Criteria

1. WHEN merging a worktree, THE Workflow_Manager SHALL stage changes to main repository without committing (default behavior)
2. WHEN multiple tasks are staged, THE Change_Tracker SHALL record which files belong to which task
3. WHEN viewing staged changes, THE System SHALL display changes grouped by source task
4. THE System SHALL persist task-to-file mapping in `.auto-codex/staged_changes.json`

### Requirement 3: AI 统一审查

**User Story:** As a developer, I want AI to review all staged changes together, so that I can catch conflicts and issues before committing.

#### Acceptance Criteria

1. WHEN user requests AI review, THE AI_Reviewer SHALL analyze all staged changes for conflicts
2. WHEN AI_Reviewer detects issues, THE System SHALL display a detailed report with file locations and suggested fixes
3. WHEN AI_Reviewer finds no issues, THE System SHALL display a success confirmation
4. THE AI_Reviewer SHALL check for: code conflicts, import errors, type mismatches, test failures
5. WHEN running AI review, THE System SHALL execute tests and include results in the report

### Requirement 4: 灵活提交选项

**User Story:** As a developer, I want flexible commit options, so that I can choose how to organize my commits.

#### Acceptance Criteria

1. WHEN user selects "commit all", THE System SHALL create a single commit with all staged changes
2. WHEN user selects "commit by task", THE System SHALL create separate commits for each task's changes
3. WHEN user selects "partial commit", THE System SHALL allow selecting specific files to commit
4. WHEN user selects "discard all", THE System SHALL unstage all changes and optionally restore worktrees
5. THE System SHALL generate AI-suggested commit messages for each commit option

### Requirement 5: 暂存状态持久化

**User Story:** As a developer, I want staged changes to persist across app restarts, so that I don't lose my work.

#### Acceptance Criteria

1. WHEN app starts, THE System SHALL restore staged changes state from `.auto-codex/staged_changes.json`
2. WHEN staged changes exist, THE System SHALL display a notification in the UI
3. WHEN staged changes are committed or discarded, THE System SHALL update the persisted state
4. THE Change_Tracker SHALL record: task_id, spec_name, files, staged_at timestamp, merge_source (worktree path)

### Requirement 6: 工作树健康监控

**User Story:** As a developer, I want to see the health status of all worktrees, so that I can manage them effectively.

#### Acceptance Criteria

1. THE Workflow_Manager SHALL display worktree count and total disk usage in the UI
2. WHEN worktrees exceed a configurable limit (default 10), THE System SHALL show a warning
3. THE System SHALL provide a "cleanup all stale" action that removes worktrees older than N days
4. WHEN a worktree has merge conflicts with main, THE System SHALL indicate this in the worktree list

### Requirement 7: 冲突预检测

**User Story:** As a developer, I want to know about potential conflicts before merging, so that I can plan my merge order.

#### Acceptance Criteria

1. WHEN listing worktrees, THE System SHALL show conflict risk indicator for each worktree
2. WHEN two worktrees modify the same file, THE System SHALL mark both as "potential conflict"
3. THE System SHALL suggest optimal merge order based on conflict analysis
4. WHEN user hovers on conflict indicator, THE System SHALL show which files may conflict

