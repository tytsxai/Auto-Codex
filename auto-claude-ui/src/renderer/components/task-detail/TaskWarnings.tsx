import { AlertTriangle, Play, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';

interface TaskWarningsProps {
  isStuck: boolean;
  isIncomplete: boolean;
  isRecovering: boolean;
  taskProgress: { completed: number; total: number };
  onRecover: () => void;
  onResume: () => void;
}

export function TaskWarnings({
  isStuck,
  isIncomplete,
  isRecovering,
  taskProgress,
  onRecover,
  onResume
}: TaskWarningsProps) {
  if (!isStuck && !isIncomplete) return null;

  return (
    <>
      {/* Stuck Task Warning */}
      {isStuck && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-sm text-foreground mb-1">
                任务似乎卡住了
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                此任务标记为运行中，但未发现活动进程。
                这可能是应用崩溃或进程意外终止导致的。
              </p>
              <Button
                variant="warning"
                size="sm"
                onClick={onRecover}
                disabled={isRecovering}
                className="w-full"
              >
                {isRecovering ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    正在恢复...
                  </>
                ) : (
                  <>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    恢复并重启任务
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Incomplete Task Warning */}
      {isIncomplete && !isStuck && (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-sm text-foreground mb-1">
                任务未完成
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                此任务已有规格说明和实现计划，但从未完成任何子任务（{taskProgress.completed}/{taskProgress.total}）。
                过程可能在创建规格说明时崩溃。点击继续以完成实现。
              </p>
              <Button
                variant="default"
                size="sm"
                onClick={onResume}
                className="w-full"
              >
                <Play className="mr-2 h-4 w-4" />
                继续任务
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
