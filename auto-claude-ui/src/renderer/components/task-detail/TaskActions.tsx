import { Play, Square, CheckCircle2, RotateCcw, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
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
import type { Task } from '../../../shared/types';

interface TaskActionsProps {
  task: Task;
  isStuck: boolean;
  isIncomplete: boolean;
  isRunning: boolean;
  isRecovering: boolean;
  showDeleteDialog: boolean;
  isDeleting: boolean;
  deleteError: string | null;
  onStartStop: () => void;
  onRecover: () => void;
  onDelete: () => void;
  onShowDeleteDialog: (show: boolean) => void;
}

export function TaskActions({
  task,
  isStuck,
  isIncomplete,
  isRunning,
  isRecovering,
  showDeleteDialog,
  isDeleting,
  deleteError,
  onStartStop,
  onRecover,
  onDelete,
  onShowDeleteDialog
}: TaskActionsProps) {
  return (
    <>
      <div className="p-4">
        {isStuck ? (
          <Button
            className="w-full"
            variant="warning"
            onClick={onRecover}
            disabled={isRecovering}
          >
            {isRecovering ? (
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
        ) : isIncomplete ? (
          <Button
            className="w-full"
            variant="default"
            onClick={onStartStop}
          >
            <Play className="mr-2 h-4 w-4" />
            继续任务
          </Button>
        ) : (task.status === 'backlog' || task.status === 'in_progress') && (
          <Button
            className="w-full"
            variant={isRunning ? 'destructive' : 'default'}
            onClick={onStartStop}
          >
            {isRunning ? (
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
        )}
        {task.status === 'done' && (
          <div className="completion-state text-sm">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">任务已成功完成</span>
          </div>
        )}

        {/* 删除按钮 - 始终可见，但运行时禁用 */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={() => onShowDeleteDialog(true)}
          disabled={isRunning && !isStuck}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          删除任务
        </Button>
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={onShowDeleteDialog}>
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
                {deleteError && (
                  <p className="text-destructive bg-destructive/10 px-3 py-2 rounded-lg text-sm">
                    {deleteError}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
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
    </>
  );
}
