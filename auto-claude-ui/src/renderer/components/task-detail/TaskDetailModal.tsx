import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { TooltipProvider } from '../ui/tooltip';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  Play,
  Square,
  CheckCircle2,
  RotateCcw,
  Trash2,
  Loader2,
  AlertTriangle,
  Pencil,
  X
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { calculateProgress } from '../../lib/utils';
import { startTask, stopTask, submitReview, recoverStuckTask, deleteTask } from '../../stores/task-store';
import { TASK_STATUS_LABELS } from '../../../shared/constants';
import { TaskEditDialog } from '../TaskEditDialog';
import { useTaskDetail } from './hooks/useTaskDetail';
import { TaskMetadata } from './TaskMetadata';
import { TaskWarnings } from './TaskWarnings';
import { TaskSubtasks } from './TaskSubtasks';
import { TaskLogs } from './TaskLogs';
import { TaskReview } from './TaskReview';
import type { Task } from '../../../shared/types';

interface TaskDetailModalProps {
  open: boolean;
  task: Task | null;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailModal({ open, task, onOpenChange }: TaskDetailModalProps) {
  // 如果没有任务则不渲染任何内容
  if (!task) {
    return null;
  }

  return (
    <TaskDetailModalContent
      open={open}
      task={task}
      onOpenChange={onOpenChange}
    />
  );
}

// 单独组件：仅在任务存在时使用 hooks
function TaskDetailModalContent({ open, task, onOpenChange }: { open: boolean; task: Task; onOpenChange: (open: boolean) => void }) {
  const state = useTaskDetail({ task });
  const progressPercent = calculateProgress(task.subtasks);
  const completedSubtasks = task.subtasks.filter(s => s.status === 'completed').length;
  const totalSubtasks = task.subtasks.length;

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
      onOpenChange(false);
    } else {
      state.setDeleteError(result.error || '删除任务失败');
    }
    state.setIsDeleting(false);
  };

  const handleMerge = async () => {
    state.setIsMerging(true);
    state.setWorkspaceError(null);
    try {
      const result = await window.electronAPI.mergeWorktree(task.id, { noCommit: state.stageOnly });
      if (result.success && result.data?.success) {
        if (state.stageOnly && result.data.staged) {
          state.setWorkspaceError(null);
          state.setStagedSuccess(result.data.message || '更改已暂存到主项目');
          state.setStagedProjectPath(result.data.projectPath);
          state.setSuggestedCommitMessage(result.data.suggestedCommitMessage);
        } else {
          onOpenChange(false);
        }
      } else {
        state.setWorkspaceError(result.data?.message || result.error || '合并更改失败');
      }
    } catch (error) {
      state.setWorkspaceError(error instanceof Error ? error.message : '合并时发生未知错误');
    } finally {
      state.setIsMerging(false);
    }
  };

  const handleDiscard = async () => {
    state.setIsDiscarding(true);
    state.setWorkspaceError(null);
    const result = await window.electronAPI.discardWorktree(task.id);
    if (result.success && result.data?.success) {
      state.setShowDiscardDialog(false);
      onOpenChange(false);
    } else {
      state.setWorkspaceError(result.data?.message || result.error || '丢弃更改失败');
    }
    state.setIsDiscarding(false);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  // 根据状态渲染主操作按钮
  const renderPrimaryAction = () => {
    if (state.isStuck) {
      return (
        <Button
          variant="warning"
          onClick={handleRecover}
          disabled={state.isRecovering}
        >
          {state.isRecovering ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在恢复...
            </>
          ) : (
            <>
              <RotateCcw className="mr-2 h-4 w-4" />
              恢复任务
            </>
          )}
        </Button>
      );
    }

    if (state.isIncomplete) {
      return (
        <Button variant="default" onClick={handleStartStop}>
          <Play className="mr-2 h-4 w-4" />
          继续任务
        </Button>
      );
    }

    if (task.status === 'backlog' || task.status === 'in_progress') {
      return (
        <Button
          variant={state.isRunning ? 'destructive' : 'default'}
          onClick={handleStartStop}
        >
          {state.isRunning ? (
            <>
              <Square className="mr-2 h-4 w-4" />
              停止任务
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              开始任务
            </>
          )}
        </Button>
      );
    }

    if (task.status === 'done') {
      return (
        <div className="completion-state text-sm flex items-center gap-2 text-success">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">任务已完成</span>
        </div>
      );
    }

    return null;
  };


  return (
    <TooltipProvider delayDuration={300}>
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          {/* 半透明遮罩层 - 可看到背景内容 */}
          <DialogPrimitive.Overlay
            className={cn(
              'fixed inset-0 z-50 bg-black/60',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
            )}
          />

          {/* 全高居中的模态内容 */}
          <DialogPrimitive.Content
            className={cn(
              'fixed left-[50%] top-4 z-50',
              'translate-x-[-50%]',
              'w-[95vw] max-w-5xl h-[calc(100vh-32px)]',
              'bg-card border border-border rounded-xl',
              'shadow-2xl overflow-hidden flex flex-col',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
              'duration-200'
            )}
          >
            {/* 头部 */}
            <div className="p-5 pb-4 border-b border-border shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <DialogPrimitive.Title className="text-xl font-semibold leading-tight text-foreground pr-4">
                    {task.title}
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description asChild>
                    <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs font-mono">
                        {task.specId}
                      </Badge>
                      {state.isStuck ? (
                        <Badge variant="warning" className="text-xs flex items-center gap-1 animate-pulse">
                          <AlertTriangle className="h-3 w-3" />
                          已卡住
                        </Badge>
                      ) : state.isIncomplete ? (
                        <>
                          <Badge variant="warning" className="text-xs flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            未完成
                          </Badge>
                        </>
                      ) : (
                        <>
                          <Badge
                            variant={task.status === 'done' ? 'success' : task.status === 'human_review' ? 'purple' : task.status === 'in_progress' ? 'info' : 'secondary'}
                            className={cn('text-xs', (task.status === 'in_progress' && !state.isStuck) && 'status-running')}
                          >
                            {TASK_STATUS_LABELS[task.status]}
                          </Badge>
                          {task.status === 'human_review' && task.reviewReason && (
                            <Badge
                              variant={task.reviewReason === 'completed' ? 'success' : task.reviewReason === 'errors' ? 'destructive' : 'warning'}
                              className="text-xs"
                            >
                              {task.reviewReason === 'completed' ? '已完成' :
                               task.reviewReason === 'errors' ? '存在错误' :
                               task.reviewReason === 'plan_review' ? '审核计划' : 'QA 问题'}
                            </Badge>
                          )}
                        </>
                      )}
                      {/* 紧凑进度指示 */}
                      {totalSubtasks > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          {completedSubtasks}/{totalSubtasks} 子任务
                        </span>
                      )}
                    </div>
                  </DialogPrimitive.Description>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-primary/10 hover:text-primary transition-colors"
                    onClick={() => state.setIsEditDialogOpen(true)}
                    disabled={state.isRunning && !state.isStuck}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <DialogPrimitive.Close asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-muted transition-colors"
                    >
                      <X className="h-5 w-5" />
                      <span className="sr-only">关闭</span>
                    </Button>
                  </DialogPrimitive.Close>
                </div>
              </div>

              {/* 进度条 - 仅在运行中或有进度时显示 */}
              {(state.isRunning || completedSubtasks > 0) && totalSubtasks > 0 && (
                <div className="mt-3 flex items-center gap-3">
                  <Progress value={progressPercent} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{progressPercent}%</span>
                </div>
              )}

              {/* 警告 - 紧凑内联 */}
              {(state.isStuck || state.isIncomplete) && (
                <div className="mt-3">
                  <TaskWarnings
                    isStuck={state.isStuck}
                    isIncomplete={state.isIncomplete}
                    isRecovering={state.isRecovering}
                    taskProgress={state.taskProgress}
                    onRecover={handleRecover}
                    onResume={handleStartStop}
                  />
                </div>
              )}
            </div>

            {/* 主体 - 单列带标签页 */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <Tabs value={state.activeTab} onValueChange={state.setActiveTab} className="flex flex-col h-full">
                <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-5 h-auto shrink-0">
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
                    <div className="p-5 space-y-5">
                      {/* 元数据 */}
                      <TaskMetadata task={task} />

                      {/* 人工审核区域 */}
                      {state.needsReview && (
                        <>
                          <Separator />
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
                            onClose={handleClose}
                          />
                        </>
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
            </div>

            {/* 底部 - 操作 */}
            <div className="flex items-center gap-3 px-5 py-3 border-t border-border shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => state.setShowDeleteDialog(true)}
                disabled={state.isRunning && !state.isStuck}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除任务
              </Button>
              <div className="flex-1" />
              {renderPrimaryAction()}
              <Button variant="outline" onClick={handleClose}>
                关闭
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* 编辑任务对话框 */}
      <TaskEditDialog
        task={task}
        open={state.isEditDialogOpen}
        onOpenChange={state.setIsEditDialogOpen}
      />

      {/* 删除确认对话框 */}
      <AlertDialog open={state.showDeleteDialog} onOpenChange={state.setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              删除任务
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground space-y-3">
                <p>
                  确定要删除 <strong className="text-foreground">"{task.title}"</strong> 吗？
                </p>
                <p className="text-destructive">
                  此操作无法撤销。所有任务文件（包括规格说明、实现计划以及生成的代码）将从项目中永久删除。
                </p>
                {state.deleteError && (
                  <p className="text-destructive bg-destructive/10 px-3 py-2 rounded-lg text-sm">
                    {state.deleteError}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={state.isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={state.isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {state.isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在删除...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  永久删除
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
