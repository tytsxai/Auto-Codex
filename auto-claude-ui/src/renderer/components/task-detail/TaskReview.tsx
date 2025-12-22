import type { Task, WorktreeStatus, WorktreeDiff, MergeConflict, MergeStats, GitConflictInfo } from '../../../shared/types';
import {
  StagedSuccessMessage,
  WorkspaceStatus,
  QAFeedbackSection,
  DiscardDialog,
  DiffViewDialog,
  ConflictDetailsDialog,
  LoadingMessage,
  NoWorkspaceMessage,
  StagedInProjectMessage
} from './task-review';

interface TaskReviewProps {
  task: Task;
  feedback: string;
  isSubmitting: boolean;
  worktreeStatus: WorktreeStatus | null;
  worktreeDiff: WorktreeDiff | null;
  isLoadingWorktree: boolean;
  isMerging: boolean;
  isDiscarding: boolean;
  showDiscardDialog: boolean;
  showDiffDialog: boolean;
  workspaceError: string | null;
  stageOnly: boolean;
  stagedSuccess: string | null;
  stagedProjectPath: string | undefined;
  suggestedCommitMessage: string | undefined;
  mergePreview: { files: string[]; conflicts: MergeConflict[]; summary: MergeStats; gitConflicts?: GitConflictInfo; uncommittedChanges?: { hasChanges: boolean; files: string[]; count: number } | null } | null;
  isLoadingPreview: boolean;
  showConflictDialog: boolean;
  onFeedbackChange: (value: string) => void;
  onReject: () => void;
  onMerge: () => void;
  onDiscard: () => void;
  onShowDiscardDialog: (show: boolean) => void;
  onShowDiffDialog: (show: boolean) => void;
  onStageOnlyChange: (value: boolean) => void;
  onShowConflictDialog: (show: boolean) => void;
  onLoadMergePreview: () => void;
  onClose?: () => void;
}

/**
 * 任务审核组件
 *
 * 用于审核任务完成情况的主组件，展示工作区状态、
 * 合并预览，并提供合并、暂存或丢弃更改的选项。
 *
 * 该组件已被重构为更小、更聚焦的子组件以提升可维护性。
 * 参见 ./task-review/ 目录中的各子组件实现。
 */
export function TaskReview({
  task,
  feedback,
  isSubmitting,
  worktreeStatus,
  worktreeDiff,
  isLoadingWorktree,
  isMerging,
  isDiscarding,
  showDiscardDialog,
  showDiffDialog,
  workspaceError,
  stageOnly,
  stagedSuccess,
  stagedProjectPath,
  suggestedCommitMessage,
  mergePreview,
  isLoadingPreview,
  showConflictDialog,
  onFeedbackChange,
  onReject,
  onMerge,
  onDiscard,
  onShowDiscardDialog,
  onShowDiffDialog,
  onStageOnlyChange,
  onShowConflictDialog,
  onLoadMergePreview,
  onClose
}: TaskReviewProps) {
  return (
    <div className="space-y-4">
      {/* 分隔线 */}
      <div className="section-divider-gradient" />

      {/* 暂存成功消息 */}
      {stagedSuccess && (
        <StagedSuccessMessage
          stagedSuccess={stagedSuccess}
          stagedProjectPath={stagedProjectPath}
          task={task}
          suggestedCommitMessage={suggestedCommitMessage}
        />
      )}

      {/* 工作区状态 - 暂存成功时隐藏（暂存后会删除 worktree） */}
      {isLoadingWorktree ? (
        <LoadingMessage />
      ) : worktreeStatus?.exists && !stagedSuccess ? (
        <WorkspaceStatus
          task={task}
          worktreeStatus={worktreeStatus}
          workspaceError={workspaceError}
          stageOnly={stageOnly}
          mergePreview={mergePreview}
          isLoadingPreview={isLoadingPreview}
          isMerging={isMerging}
          isDiscarding={isDiscarding}
          onShowDiffDialog={onShowDiffDialog}
          onShowDiscardDialog={onShowDiscardDialog}
          onShowConflictDialog={onShowConflictDialog}
          onLoadMergePreview={onLoadMergePreview}
          onStageOnlyChange={onStageOnlyChange}
          onMerge={onMerge}
        />
      ) : task.stagedInMainProject && !stagedSuccess ? (
        <StagedInProjectMessage
          task={task}
          projectPath={stagedProjectPath}
          hasWorktree={worktreeStatus?.exists || false}
          onClose={onClose}
        />
      ) : (
        <NoWorkspaceMessage task={task} onClose={onClose} />
      )}

      {/* QA 反馈区域 */}
      <QAFeedbackSection
        feedback={feedback}
        isSubmitting={isSubmitting}
        onFeedbackChange={onFeedbackChange}
        onReject={onReject}
      />

      {/* 丢弃确认对话框 */}
      <DiscardDialog
        open={showDiscardDialog}
        task={task}
        worktreeStatus={worktreeStatus}
        isDiscarding={isDiscarding}
        onOpenChange={onShowDiscardDialog}
        onDiscard={onDiscard}
      />

      {/* 差异查看对话框 */}
      <DiffViewDialog
        open={showDiffDialog}
        worktreeDiff={worktreeDiff}
        onOpenChange={onShowDiffDialog}
      />

      {/* 冲突详情对话框 */}
      <ConflictDetailsDialog
        open={showConflictDialog}
        mergePreview={mergePreview}
        stageOnly={stageOnly}
        onOpenChange={onShowConflictDialog}
        onMerge={onMerge}
      />
    </div>
  );
}
