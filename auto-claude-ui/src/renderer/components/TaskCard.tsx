import { useState, useEffect } from 'react';
import { Play, Square, Clock, Zap, Target, Shield, Gauge, Palette, FileCode, Bug, Wrench, Loader2, AlertTriangle, RotateCcw, Archive } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { cn, formatRelativeTime, sanitizeMarkdownForDisplay } from '../lib/utils';
import { PhaseProgressIndicator } from './PhaseProgressIndicator';
import {
  TASK_CATEGORY_LABELS,
  TASK_CATEGORY_COLORS,
  TASK_COMPLEXITY_COLORS,
  TASK_COMPLEXITY_LABELS,
  TASK_IMPACT_COLORS,
  TASK_IMPACT_LABELS,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  EXECUTION_PHASE_LABELS,
  EXECUTION_PHASE_BADGE_COLORS
} from '../../shared/constants';
import { startTask, stopTask, checkTaskRunning, recoverStuckTask, isIncompleteHumanReview, archiveTasks } from '../stores/task-store';
import type { Task, TaskCategory, ReviewReason } from '../../shared/types';

// 分类图标映射
const CategoryIcon: Record<TaskCategory, typeof Zap> = {
  feature: Target,
  bug_fix: Bug,
  refactoring: Wrench,
  documentation: FileCode,
  security: Shield,
  performance: Gauge,
  ui_ux: Palette,
  infrastructure: Wrench,
  testing: FileCode
};

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const [isStuck, setIsStuck] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  const isRunning = task.status === 'in_progress';
  const executionPhase = task.executionProgress?.phase;
  const hasActiveExecution = executionPhase && executionPhase !== 'idle' && executionPhase !== 'complete' && executionPhase !== 'failed';
  
  // 检查任务是否处于 human_review 但没有已完成子任务（崩溃/未完成）
  const isIncomplete = isIncompleteHumanReview(task);

  // 检查任务是否卡住（状态为 in_progress 但实际进程不存在）
  // 增加宽限期以避免进程启动时的误判
  useEffect(() => {
    if (!isRunning) {
      setIsStuck(false);
      return;
    }

    // 2 秒宽限期后进行首次检查
    const initialTimeout = setTimeout(() => {
      checkTaskRunning(task.id).then((actuallyRunning) => {
        setIsStuck(!actuallyRunning);
      });
    }, 2000);

    // 每 15 秒定期复查
    const recheckInterval = setInterval(() => {
      checkTaskRunning(task.id).then((actuallyRunning) => {
        setIsStuck(!actuallyRunning);
      });
    }, 15000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(recheckInterval);
    };
  }, [task.id, isRunning]);

  // 添加可见性变化处理器，在聚焦时重新校验
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRunning) {
        checkTaskRunning(task.id).then((actuallyRunning) => {
          setIsStuck(!actuallyRunning);
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [task.id, isRunning]);

  const handleStartStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning && !isStuck) {
      stopTask(task.id);
    } else {
      startTask(task.id);
    }
  };

  const handleRecover = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRecovering(true);
    // 恢复后自动重启任务（无需再次点击开始）
    const result = await recoverStuckTask(task.id, { autoRestart: true });
    if (result.success) {
      setIsStuck(false);
    }
    setIsRecovering(false);
  };

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await archiveTasks(task.projectId, [task.id]);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'info';
      case 'ai_review':
        return 'warning';
      case 'human_review':
        return 'purple';
      case 'done':
        return 'success';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in_progress':
        return '进行中';
      case 'ai_review':
        return 'AI 审核';
      case 'human_review':
        return '需要审核';
      case 'done':
        return '已完成';
      default:
        return '待处理';
    }
  };

  const getReviewReasonLabel = (reason?: ReviewReason): { label: string; variant: 'success' | 'destructive' | 'warning' } | null => {
    if (!reason) return null;
    switch (reason) {
      case 'completed':
        return { label: '已完成', variant: 'success' };
      case 'errors':
        return { label: '有错误', variant: 'destructive' };
      case 'qa_rejected':
        return { label: 'QA 问题', variant: 'warning' };
      case 'plan_review':
        return { label: '批准计划', variant: 'warning' };
      default:
        return null;
    }
  };

  const reviewReasonInfo = task.status === 'human_review' ? getReviewReasonLabel(task.reviewReason) : null;

  const isArchived = !!task.metadata?.archivedAt;

  return (
    <Card
      className={cn(
        'card-surface task-card-enhanced cursor-pointer',
        isRunning && !isStuck && 'ring-2 ring-primary border-primary task-running-pulse',
        isStuck && 'ring-2 ring-warning border-warning task-stuck-pulse',
        isArchived && 'opacity-60 hover:opacity-80'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* 头部 - 改进的视觉层级 */}
        <div className="flex items-start justify-between gap-3">
          <h3
            className="font-semibold text-sm text-foreground line-clamp-2 leading-snug flex-1 min-w-0"
            title={task.title}
          >
            {task.title}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end max-w-[160px]">
            {/* 卡住指示 - 最高优先级 */}
            {isStuck && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0.5 flex items-center gap-1 bg-warning/10 text-warning border-warning/30 badge-priority-urgent"
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                卡住
              </Badge>
            )}
            {/* 未完成指示 - 任务处于 human_review 但无已完成子任务 */}
            {isIncomplete && !isStuck && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0.5 flex items-center gap-1 bg-orange-500/10 text-orange-400 border-orange-500/30"
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                未完成
              </Badge>
            )}
            {/* 归档指示 - 任务已发布 */}
            {task.metadata?.archivedAt && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0.5 flex items-center gap-1 bg-muted text-muted-foreground border-border"
              >
                <Archive className="h-2.5 w-2.5" />
                已归档
              </Badge>
            )}
            {/* 执行阶段徽章 - 运行中显示 */}
            {hasActiveExecution && executionPhase && !isStuck && !isIncomplete && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] px-1.5 py-0.5 flex items-center gap-1',
                  EXECUTION_PHASE_BADGE_COLORS[executionPhase]
                )}
              >
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                {EXECUTION_PHASE_LABELS[executionPhase]}
              </Badge>
            )}
            <Badge
              variant={isStuck ? 'warning' : isIncomplete ? 'warning' : getStatusBadgeVariant(task.status)}
              className="text-[10px] px-1.5 py-0.5"
            >
              {isStuck ? '需要恢复' : isIncomplete ? '需要继续' : getStatusLabel(task.status)}
            </Badge>
            {/* 审核原因徽章 - 说明需要人工审核的原因 */}
            {reviewReasonInfo && !isStuck && !isIncomplete && (
              <Badge
                variant={reviewReasonInfo.variant}
                className="text-[10px] px-1.5 py-0.5"
              >
                {reviewReasonInfo.label}
              </Badge>
            )}
          </div>
        </div>

        {/* 描述 - 清理以处理 Markdown 内容 */}
        {task.description && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
            {sanitizeMarkdownForDisplay(task.description, 150)}
          </p>
        )}

        {/* 元数据徽章 */}
        {task.metadata && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {/* 带图标的分类徽章 */}
            {task.metadata.category && (
              <Badge
                variant="outline"
                className={cn('text-[10px] px-1.5 py-0', TASK_CATEGORY_COLORS[task.metadata.category])}
              >
                {CategoryIcon[task.metadata.category] && (
                  (() => {
                    const Icon = CategoryIcon[task.metadata.category!];
                    return <Icon className="h-2.5 w-2.5 mr-0.5" />;
                  })()
                )}
                {TASK_CATEGORY_LABELS[task.metadata.category]}
              </Badge>
            )}
            {/* 影响徽章 - 重要任务高可见度 */}
            {task.metadata.impact && (task.metadata.impact === 'high' || task.metadata.impact === 'critical') && (
              <Badge
                variant="outline"
                className={cn('text-[10px] px-1.5 py-0', TASK_IMPACT_COLORS[task.metadata.impact])}
              >
                {TASK_IMPACT_LABELS[task.metadata.impact]}
              </Badge>
            )}
            {/* 复杂度徽章 */}
            {task.metadata.complexity && (
              <Badge
                variant="outline"
                className={cn('text-[10px] px-1.5 py-0', TASK_COMPLEXITY_COLORS[task.metadata.complexity])}
              >
                {TASK_COMPLEXITY_LABELS[task.metadata.complexity]}
              </Badge>
            )}
            {/* 优先级徽章 - 仅显示紧急/高 */}
            {task.metadata.priority && (task.metadata.priority === 'urgent' || task.metadata.priority === 'high') && (
              <Badge
                variant="outline"
                className={cn('text-[10px] px-1.5 py-0', TASK_PRIORITY_COLORS[task.metadata.priority])}
              >
                {TASK_PRIORITY_LABELS[task.metadata.priority]}
              </Badge>
            )}
            {/* 安全严重性 - 始终显示 */}
            {task.metadata.securitySeverity && (
              <Badge
                variant="outline"
                className={cn('text-[10px] px-1.5 py-0', TASK_IMPACT_COLORS[task.metadata.securitySeverity])}
              >
                {task.metadata.securitySeverity} 严重性
              </Badge>
            )}
          </div>
        )}

        {/* 进度区域 - 阶段感知并带动画 */}
        {(task.subtasks.length > 0 || hasActiveExecution || isRunning || isStuck) && (
          <div className="mt-4">
            <PhaseProgressIndicator
              phase={executionPhase}
              subtasks={task.subtasks}
              isStuck={isStuck}
              isRunning={isRunning}
            />
          </div>
        )}

        {/* 底部 */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatRelativeTime(task.updatedAt)}</span>
          </div>

          {/* 操作按钮 */}
          {isStuck ? (
            <Button
              variant="warning"
              size="sm"
              className="h-7 px-2.5"
              onClick={handleRecover}
              disabled={isRecovering}
            >
              {isRecovering ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  正在恢复...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-1.5 h-3 w-3" />
                  恢复
                </>
              )}
            </Button>
          ) : isIncomplete ? (
            <Button
              variant="default"
              size="sm"
              className="h-7 px-2.5"
              onClick={handleStartStop}
            >
              <Play className="mr-1.5 h-3 w-3" />
              恢复
            </Button>
          ) : task.status === 'done' && !task.metadata?.archivedAt ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 hover:bg-muted-foreground/10"
              onClick={handleArchive}
              title="归档任务"
            >
              <Archive className="mr-1.5 h-3 w-3" />
              归档
            </Button>
          ) : (task.status === 'backlog' || task.status === 'in_progress') && (
            <Button
              variant={isRunning ? 'destructive' : 'default'}
              size="sm"
              className="h-7 px-2.5"
              onClick={handleStartStop}
            >
              {isRunning ? (
                <>
                  <Square className="mr-1.5 h-3 w-3" />
                  停止
                </>
              ) : (
                <>
                  <Play className="mr-1.5 h-3 w-3" />
                  开始
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
