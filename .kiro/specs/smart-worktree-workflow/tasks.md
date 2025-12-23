# Implementation Plan: Smart Worktree Workflow

## Overview

实现智能工作流管理系统，分阶段完成：核心数据模型 → 工作流管理器 → 更改追踪器 → AI 审查 → 提交管理 → UI 集成。

## Tasks

- [x] 1. 实现核心数据模型和配置
  - [x] 1.1 创建 `auto-codex/core/workflow/models.py` 定义数据类
    - 实现 WorkflowSettings, StagedChange, StageResult, WorktreeHealthStatus, ConflictRisk, ReviewReport, ReviewIssue
    - _Requirements: 5.4, 6.1_
  - [ ]* 1.2 编写数据模型的属性测试
    - **Property 2: Change tracking round-trip**
    - **Validates: Requirements 2.4, 5.1, 5.3, 5.4**
  - [x] 1.3 在 `auto-codex-ui/src/shared/types/workflow.ts` 添加 TypeScript 类型
    - _Requirements: 5.4_

- [x] 2. 实现 ChangeTracker 更改追踪器
  - [x] 2.1 创建 `auto-codex/core/workflow/change_tracker.py`
    - 实现 track_changes, get_changes_by_task, get_all_staged, remove_changes
    - 实现 persist/restore 持久化到 staged_changes.json
    - _Requirements: 2.2, 2.3, 2.4, 5.1, 5.3_
  - [ ]* 2.2 编写 ChangeTracker 属性测试
    - **Property 3: Task-file mapping integrity**
    - **Validates: Requirements 2.2, 2.3**

- [x] 3. 实现 WorkflowManager 工作流管理器
  - [x] 3.1 创建 `auto-codex/core/workflow/manager.py`
    - 实现 stage_worktree 方法（暂存 + 可选自动清理）
    - 实现 cleanup_worktree, cleanup_stale_worktrees
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1_
  - [ ]* 3.2 编写自动清理属性测试
    - **Property 1: Auto-cleanup respects settings**
    - **Validates: Requirements 1.1, 1.2**
  - [x] 3.3 实现 get_health_status 健康状态检查
    - 计算工作树数量、磁盘占用、过期数量
    - _Requirements: 6.1, 6.2, 6.3_
  - [ ]* 3.4 编写健康状态属性测试
    - **Property 6: Health metrics accuracy**
    - **Validates: Requirements 6.1, 6.2, 6.3**
  - [x] 3.5 实现 get_conflict_risks 和 suggest_merge_order
    - 检测工作树间的文件冲突
    - 建议最优合并顺序
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [ ]* 3.6 编写冲突检测属性测试
    - **Property 7: Conflict detection completeness**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

- [ ] 4. Checkpoint - 核心功能验证
  - 确保所有测试通过，如有问题请询问用户

- [x] 5. 实现 CommitManager 提交管理器
  - [x] 5.1 创建 `auto-codex/core/workflow/commit_manager.py`
    - 实现 commit_all, commit_by_task, commit_partial, discard_all
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [ ]* 5.2 编写提交模式属性测试
    - **Property 4: Commit mode correctness**
    - **Property 5: Discard restores clean state**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 6. 实现 AIReviewer AI 审查模块
  - [x] 6.1 创建 `auto-codex/core/workflow/ai_reviewer.py`
    - 实现 review_staged_changes 分析所有暂存更改
    - 实现 detect_conflicts 检测冲突
    - 实现 run_tests 执行测试
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 6.2 实现 generate_commit_message 生成提交消息
    - _Requirements: 4.5_

- [x] 7. 创建 workflow 包导出
  - [x] 7.1 创建 `auto-codex/core/workflow/__init__.py`
    - 导出所有公共 API
    - _Requirements: all_

- [ ] 8. Checkpoint - Python 后端完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 9. 实现 TypeScript IPC 处理器
  - [x] 9.1 创建 `auto-codex-ui/src/main/ipc-handlers/workflow-handlers.ts`
    - 实现 stage-worktree, get-staged-changes, commit-changes, discard-changes
    - 实现 get-health-status, get-conflict-risks, ai-review
    - _Requirements: all_
  - [x] 9.2 在 `auto-codex-ui/src/main/ipc-handlers/index.ts` 注册处理器
    - _Requirements: all_
  - [x] 9.3 在 `auto-codex-ui/src/shared/constants.ts` 添加 IPC 通道常量
    - _Requirements: all_
  - [x] 9.4 在 `auto-codex-ui/src/preload/index.ts` 暴露 API
    - _Requirements: all_

- [ ] 10. 实现 UI 组件
  - [ ] 10.1 创建 `auto-codex-ui/src/renderer/components/StagedChanges.tsx`
    - 显示所有暂存更改，按任务分组
    - 提供提交选项：全部/按任务/部分/撤销
    - _Requirements: 2.3, 4.1, 4.2, 4.3, 4.4_
  - [ ] 10.2 创建 `auto-codex-ui/src/renderer/components/AIReviewPanel.tsx`
    - 显示 AI 审查结果
    - 显示问题列表和建议
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ] 10.3 更新 `auto-codex-ui/src/renderer/components/Worktrees.tsx`
    - 添加冲突风险指示器
    - 添加建议合并顺序
    - 添加健康状态摘要
    - _Requirements: 6.1, 6.2, 7.1, 7.2, 7.3, 7.4_
  - [ ] 10.4 更新合并对话框支持新的暂存模式
    - 合并后显示"已暂存"状态而非"已完成"
    - _Requirements: 2.1_

- [ ] 11. 更新设置页面
  - [ ] 11.1 在设置页面添加工作流配置选项
    - autoCleanupAfterMerge 开关
    - staleWorktreeDays 输入
    - maxWorktreesWarning 输入
    - _Requirements: 1.4, 6.2_

- [ ] 12. 集成到现有合并流程
  - [ ] 12.1 修改 `auto-codex/core/workspace.py` 的 merge_existing_build
    - 使用 WorkflowManager.stage_worktree 替代直接合并
    - 支持自动清理选项
    - _Requirements: 1.1, 1.2, 2.1_
  - [ ] 12.2 修改 `auto-codex-ui/src/main/ipc-handlers/task/worktree-handlers.ts`
    - 更新合并处理器使用新的工作流
    - _Requirements: 1.1, 2.1_

- [ ] 13. Final Checkpoint - 完整功能验证
  - 确保所有测试通过
  - 验证 UI 功能正常
  - 如有问题请询问用户

## Notes

- Tasks marked with `*` are optional property-based tests
- 实现顺序：数据模型 → 追踪器 → 管理器 → 提交 → AI审查 → UI
- 每个 checkpoint 确保阶段性功能完整
- Python 使用 Hypothesis 进行属性测试
- TypeScript 使用 Vitest 进行单元测试

