import { X, Pencil, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';
import { TASK_STATUS_LABELS } from '../../../shared/constants';
import type { Task } from '../../../shared/types';

interface TaskHeaderProps {
  task: Task;
  isStuck: boolean;
  isIncomplete: boolean;
  taskProgress: { completed: number; total: number };
  isRunning: boolean;
  onClose: () => void;
  onEdit: () => void;
}

export function TaskHeader({
  task,
  isStuck,
  isIncomplete,
  taskProgress,
  isRunning,
  onClose,
  onEdit
}: TaskHeaderProps) {
  return (
    <div className="flex items-start justify-between p-4 pb-3">
      <div className="flex-1 min-w-0 pr-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <h2 className="font-semibold text-lg text-foreground line-clamp-2 leading-snug cursor-default">
              {task.title}
            </h2>
          </TooltipTrigger>
          {task.title.length > 40 && (
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="text-sm">{task.title}</p>
            </TooltipContent>
          )}
        </Tooltip>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs font-mono">
            {task.specId}
          </Badge>
          {isStuck ? (
            <Badge variant="warning" className="text-xs flex items-center gap-1 animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              已卡住
            </Badge>
          ) : isIncomplete ? (
            <>
              <Badge variant="warning" className="text-xs flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                未完成
              </Badge>
              <Badge variant="outline" className="text-xs text-orange-400">
                {taskProgress.completed}/{taskProgress.total} 子任务
              </Badge>
            </>
          ) : (
            <>
              <Badge
                variant={task.status === 'done' ? 'success' : task.status === 'human_review' ? 'purple' : task.status === 'in_progress' ? 'info' : 'secondary'}
                className={cn('text-xs', (task.status === 'in_progress' && !isStuck) && 'status-running')}
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
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 -mr-1 -mt-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-primary/10 hover:text-primary transition-colors"
                onClick={onEdit}
                disabled={isRunning && !isStuck}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isRunning && !isStuck ? '任务运行中无法编辑' : '编辑任务'}
          </TooltipContent>
        </Tooltip>
        <Button variant="ghost" size="icon" className="hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
