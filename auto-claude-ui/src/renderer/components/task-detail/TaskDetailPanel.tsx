import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { TooltipProvider } from '../ui/tooltip';
import { calculateProgress } from '../../lib/utils';
import { startTask, stopTask, submitReview, recoverStuckTask, deleteTask } from '../../stores/task-store';
import { TaskEditDialog } from '../TaskEditDialog';
import { useTaskDetail } from './hooks/useTaskDetail';
import { TaskHeader } from './TaskHeader';
import { TaskProgress } from './TaskProgress';
import { TaskMetadata } from './TaskMetadata';
import { TaskActions } from './TaskActions';
import { TaskWarnings } from './TaskWarnings';
import { TaskSubtasks } from './TaskSubtasks';
import { TaskLogs } from './TaskLogs';
import { TaskReview } from './TaskReview';
import type { Task } from '../../../shared/types';

interface TaskDetailPanelProps {
  task: Task;
  onClose: () => void;
}

export function TaskDetailPanel({ task, onClose }: TaskDetailPanelProps) {
  const state = useTaskDetail({ task });
  const _progress = calculateProgress(task.subtasks);

  // 事件处理器
  const handleStartStop = () => {
    if (state.isRunning && !state.isStuck) {
      stopTask(task.id);
    } else {
      startTask(task.id);
    }
  };

  const handleRecover = async () => {
    state.setIsRecovering(true);
    const result = await recoverStuckTask(task.id, { autoRestart: true });
    if (result.success) {
      state.setIsStuck(false);
      state.setHasCheckedRunning(false);
    }
    state.setIsRecovering(false);
  };

  const handleReject = async () => {
    if (!state.feedback.trim()) {
      return;
    }
    state.setIsSubmitting(true);
    await submitReview(task.id, false, state.feedback);
    state.setIsSubmitting(false);
    state.setFeedback('');
  };

  const handleDelete = async () => {
    state.setIsDeleting(true);
    state.setDeleteError(null);
    const result = await deleteTask(task.id);
    if (result.success) {
      state.setShowDeleteDialog(false);
      onClose();
    } else {
      state.setDeleteError(result.error || '删除任务失败');
    }
    state.setIsDeleting(false);
  };

  const handleMerge = async () => {
    console.warn('[TaskDetailPanel] handleMerge called, stageOnly:', state.stageOnly);
    state.setIsMerging(true);
    state.setWorkspaceError(null);
    try {
      console.warn('[TaskDetailPanel] Calling mergeWorktree...');
      const result = await window.electronAPI.mergeWorktree(task.id, { noCommit: state.stageOnly });
      console.warn('[TaskDetailPanel] mergeWorktree result:', JSON.stringify(result, null, 2));
      if (result.success && result.data?.success) {
        // 仅暂存：不关闭面板，显示成功消息
        // 完整合并：关闭面板
        if (state.stageOnly && result.data.staged) {
          // 更改已暂存到主项目 - 显示成功但保持面板打开
          console.warn('[TaskDetailPanel] Stage-only success, showing success message');
          state.setWorkspaceError(null);
          state.setStagedSuccess(result.data.message || '更改已暂存到主项目');
          state.setStagedProjectPath(result.data.projectPath);
          state.setSuggestedCommitMessage(result.data.suggestedCommitMessage);
        } else {
          console.warn('[TaskDetailPanel] Full merge success, closing panel');
          onClose();
        }
      } else {
        console.warn('[TaskDetailPanel] Merge failed:', result.data?.message || result.error);
        state.setWorkspaceError(result.data?.message || result.error || '合并更改失败');
      }
    } catch (error) {
      console.error('[TaskDetailPanel] handleMerge exception:', error);
      state.setWorkspaceError(error instanceof Error ? error.message : '合并时发生未知错误');
    } finally {
      console.warn('[TaskDetailPanel] Setting isMerging to false');
      state.setIsMerging(false);
    }
  };

  const handleDiscard = async () => {
    state.setIsDiscarding(true);
    state.setWorkspaceError(null);
    const result = await window.electronAPI.discardWorktree(task.id);
    if (result.success && result.data?.success) {
      state.setShowDiscardDialog(false);
      onClose();
    } else {
      state.setWorkspaceError(result.data?.message || result.error || '丢弃更改失败');
    }
    state.setIsDiscarding(false);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full w-96 flex-col bg-card border-l border-border">
        {/* 头部 */}
        <TaskHeader
          task={task}
          isStuck={state.isStuck}
          isIncomplete={state.isIncomplete}
          taskProgress={state.taskProgress}
          isRunning={state.isRunning}
          onClose={onClose}
          onEdit={() => state.setIsEditDialogOpen(true)}
        />

        <Separator />

        {/* 标签页 */}
        <Tabs value={state.activeTab} onValueChange={state.setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent p-0 h-auto">
            <TabsTrigger
              value="overview"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm"
            >
              概览
            </TabsTrigger>
            <TabsTrigger
              value="subtasks"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm"
            >
              子任务（{task.subtasks.length}）
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm"
            >
              日志
            </TabsTrigger>
          </TabsList>

          {/* 概览标签页 */}
          <TabsContent value="overview" className="flex-1 min-h-0 overflow-hidden mt-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-5">
                {/* 警告 */}
                <TaskWarnings
                  isStuck={state.isStuck}
                  isIncomplete={state.isIncomplete}
                  isRecovering={state.isRecovering}
                  taskProgress={state.taskProgress}
                  onRecover={handleRecover}
                  onResume={handleStartStop}
                />

                {/* 进度 */}
                <TaskProgress
                  task={task}
                  isRunning={state.isRunning}
                  hasActiveExecution={!!state.hasActiveExecution}
                  executionPhase={state.executionPhase}
                  isStuck={state.isStuck}
                />

                {/* 元数据 */}
                <TaskMetadata task={task} />

                {/* 人工审核区域 */}
                {state.needsReview && (
                  <TaskReview
                    task={task}
                    feedback={state.feedback}
                    isSubmitting={state.isSubmitting}
                    worktreeStatus={state.worktreeStatus}
                    worktreeDiff={state.worktreeDiff}
                    isLoadingWorktree={state.isLoadingWorktree}
                    isMerging={state.isMerging}
                    isDiscarding={state.isDiscarding}
                    showDiscardDialog={state.showDiscardDialog}
                    showDiffDialog={state.showDiffDialog}
                    workspaceError={state.workspaceError}
                    stageOnly={state.stageOnly}
                    stagedSuccess={state.stagedSuccess}
                    stagedProjectPath={state.stagedProjectPath}
                    suggestedCommitMessage={state.suggestedCommitMessage}
                    mergePreview={state.mergePreview}
                    isLoadingPreview={state.isLoadingPreview}
                    showConflictDialog={state.showConflictDialog}
                    onFeedbackChange={state.setFeedback}
                    onReject={handleReject}
                    onMerge={handleMerge}
                    onDiscard={handleDiscard}
                    onShowDiscardDialog={state.setShowDiscardDialog}
                    onShowDiffDialog={state.setShowDiffDialog}
                    onStageOnlyChange={state.setStageOnly}
                    onShowConflictDialog={state.setShowConflictDialog}
                    onLoadMergePreview={state.loadMergePreview}
                  />
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* 子任务标签页 */}
          <TabsContent value="subtasks" className="flex-1 min-h-0 overflow-hidden mt-0">
            <TaskSubtasks task={task} />
          </TabsContent>

          {/* 日志标签页 */}
          <TabsContent value="logs" className="flex-1 min-h-0 overflow-hidden mt-0">
            <TaskLogs
              task={task}
              phaseLogs={state.phaseLogs}
              isLoadingLogs={state.isLoadingLogs}
              expandedPhases={state.expandedPhases}
              isStuck={state.isStuck}
              logsEndRef={state.logsEndRef}
              logsContainerRef={state.logsContainerRef}
              onLogsScroll={state.handleLogsScroll}
              onTogglePhase={state.togglePhase}
            />
          </TabsContent>
        </Tabs>

        <Separator />

        {/* 操作 */}
        <TaskActions
          task={task}
          isStuck={state.isStuck}
          isIncomplete={state.isIncomplete}
          isRunning={state.isRunning}
          isRecovering={state.isRecovering}
          showDeleteDialog={state.showDeleteDialog}
          isDeleting={state.isDeleting}
          deleteError={state.deleteError}
          onStartStop={handleStartStop}
          onRecover={handleRecover}
          onDelete={handleDelete}
          onShowDeleteDialog={state.setShowDeleteDialog}
        />

        {/* 编辑任务对话框 */}
        <TaskEditDialog
          task={task}
          open={state.isEditDialogOpen}
          onOpenChange={state.setIsEditDialogOpen}
        />
      </div>
    </TooltipProvider>
  );
}
