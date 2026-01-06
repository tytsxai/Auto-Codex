import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { Plus, Inbox, Loader2, Eye, CheckCircle2, Archive, RefreshCw } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { TaskCard } from './TaskCard';
import { SortableTaskCard } from './SortableTaskCard';
import { TASK_STATUS_COLUMNS, TASK_STATUS_LABELS } from '../../shared/constants';
import { cn } from '../lib/utils';
import { persistTaskStatus, archiveTasks } from '../stores/task-store';
import type { Task, TaskStatus } from '../../shared/types';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onNewTaskClick?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

interface DroppableColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  isOver: boolean;
  onAddClick?: () => void;
  onArchiveAll?: () => void;
}

// 每列的空状态内容
const getEmptyStateContent = (status: TaskStatus): { icon: React.ReactNode; message: string; subtext?: string } => {
  switch (status) {
    case 'backlog':
      return {
        icon: <Inbox className="h-6 w-6 text-muted-foreground/50" />,
        message: '暂无计划任务',
        subtext: '添加任务以开始'
      };
    case 'in_progress':
      return {
        icon: <Loader2 className="h-6 w-6 text-muted-foreground/50" />,
        message: '无运行中任务',
        subtext: '从规划中启动任务'
      };
    case 'ai_review':
      return {
        icon: <Eye className="h-6 w-6 text-muted-foreground/50" />,
        message: '无审核中任务',
        subtext: 'AI 将审核已完成的任务'
      };
    case 'human_review':
      return {
        icon: <Eye className="h-6 w-6 text-muted-foreground/50" />,
        message: '无待审核任务',
        subtext: '任务在此等待您的审批'
      };
    case 'done':
      return {
        icon: <CheckCircle2 className="h-6 w-6 text-muted-foreground/50" />,
        message: '无已完成任务',
        subtext: '已批准的任务显示在此'
      };
    default:
      return {
        icon: <Inbox className="h-6 w-6 text-muted-foreground/50" />,
        message: '暂无任务'
      };
  }
};

function DroppableColumn({ status, tasks, onTaskClick, isOver, onAddClick, onArchiveAll }: DroppableColumnProps) {
  const { setNodeRef } = useDroppable({
    id: status
  });

  const taskIds = tasks.map((t) => t.id);

  const getColumnBorderColor = (): string => {
    switch (status) {
      case 'backlog':
        return 'column-backlog';
      case 'in_progress':
        return 'column-in-progress';
      case 'ai_review':
        return 'column-ai-review';
      case 'human_review':
        return 'column-human-review';
      case 'done':
        return 'column-done';
      default:
        return 'border-t-muted-foreground/30';
    }
  };

  const emptyState = getEmptyStateContent(status);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl border border-white/5 bg-linear-to-b from-secondary/30 to-transparent backdrop-blur-sm transition-all duration-200',
        getColumnBorderColor(),
        'border-t-2',
        isOver && 'drop-zone-highlight'
      )}
    >
      {/* 列头 - 增强样式 */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <h2 className="font-semibold text-sm text-foreground">
            {TASK_STATUS_LABELS[status]}
          </h2>
          <span className="column-count-badge">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {status === 'backlog' && onAddClick && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={onAddClick}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          {status === 'done' && onArchiveAll && tasks.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-muted-foreground/10 hover:text-muted-foreground transition-colors"
              onClick={onArchiveAll}
              title="归档所有已完成任务"
            >
              <Archive className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 任务列表 */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full px-3 pb-3 pt-2">
          <SortableContext
            items={taskIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3 min-h-[120px]">
              {tasks.length === 0 ? (
                <div
                  className={cn(
                    'empty-column-dropzone flex flex-col items-center justify-center py-6',
                    isOver && 'active'
                  )}
                >
                  {isOver ? (
                    <>
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center mb-2">
                        <Plus className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium text-primary">拖放到此处</span>
                    </>
                  ) : (
                    <>
                      {emptyState.icon}
                      <span className="mt-2 text-sm font-medium text-muted-foreground/70">
                        {emptyState.message}
                      </span>
                      {emptyState.subtext && (
                        <span className="mt-0.5 text-xs text-muted-foreground/50">
                          {emptyState.subtext}
                        </span>
                      )}
                    </>
                  )}
                </div>
              ) : (
                tasks.map((task) => (
                  <SortableTaskCard
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick(task)}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </ScrollArea>
      </div>
    </div>
  );
}

export function KanbanBoard({ tasks, onTaskClick, onNewTaskClick, onRefresh, isRefreshing }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // 统计已归档任务数量用于展示
  const archivedCount = useMemo(() => {
    return tasks.filter((t) => t.metadata?.archivedAt).length;
  }, [tasks]);

  // 根据归档状态筛选任务
  const filteredTasks = useMemo(() => {
    if (showArchived) {
      return tasks; // 显示所有任务，包括已归档
    }
    return tasks.filter((t) => !t.metadata?.archivedAt);
  }, [tasks, showArchived]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8 // 拖拽开始前需要移动 8px
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      backlog: [],
      in_progress: [],
      ai_review: [],
      human_review: [],
      done: []
    };

    filteredTasks.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });

    return grouped;
  }, [filteredTasks]);

  const handleArchiveAll = async () => {
    // 从第一个任务获取 projectId（所有任务应有相同的 projectId）
    const projectId = tasks[0]?.projectId;
    if (!projectId) {
      console.error('No projectId found');
      return;
    }

    const doneTaskIds = tasksByStatus.done.map((t) => t.id);
    if (doneTaskIds.length === 0) return;

    await archiveTasks(projectId, doneTaskIds);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;

    if (!over) {
      setOverColumnId(null);
      return;
    }

    const overId = over.id as string;

    // 检查是否在列上方
    if (TASK_STATUS_COLUMNS.includes(overId as TaskStatus)) {
      setOverColumnId(overId);
      return;
    }

    // 检查是否在任务上方 - 获取其列
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask) {
      setOverColumnId(overTask.status);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setOverColumnId(null);

    if (!over) return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;

    // 检查是否放置在列上
    if (TASK_STATUS_COLUMNS.includes(overId as TaskStatus)) {
      const newStatus = overId as TaskStatus;
      const task = tasks.find((t) => t.id === activeTaskId);

      if (task && task.status !== newStatus) {
        // 将状态变更持久化到文件并更新本地状态
        persistTaskStatus(activeTaskId, newStatus);
      }
      return;
    }

    // 检查是否放置在另一个任务上 - 移动到该任务所在列
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask) {
      const task = tasks.find((t) => t.id === activeTaskId);
      if (task && task.status !== overTask.status) {
        // 将状态变更持久化到文件并更新本地状态
        persistTaskStatus(activeTaskId, overTask.status);
      }
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* 带筛选的看板头部 */}
      <div className="flex items-center px-6 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              {isRefreshing ? '刷新中...' : '刷新'}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Checkbox
            id="showArchived"
            checked={showArchived}
            onCheckedChange={(checked) => setShowArchived(checked === true)}
          />
          <Label
            htmlFor="showArchived"
            className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer"
          >
            <Archive className="h-3.5 w-3.5" />
            显示已归档
            {archivedCount > 0 && (
              <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-muted">
                {archivedCount}
              </span>
            )}
          </Label>
        </div>
      </div>

      {/* 看板列 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 gap-4 overflow-x-auto p-6">
          {TASK_STATUS_COLUMNS.map((status) => (
            <DroppableColumn
              key={status}
              status={status}
              tasks={tasksByStatus[status]}
              onTaskClick={onTaskClick}
              isOver={overColumnId === status}
              onAddClick={status === 'backlog' ? onNewTaskClick : undefined}
              onArchiveAll={status === 'done' ? handleArchiveAll : undefined}
            />
          ))}
        </div>

        {/* 拖拽覆盖层 - 增强视觉反馈 */}
        <DragOverlay>
          {activeTask ? (
            <div className="drag-overlay-card">
              <TaskCard task={activeTask} onClick={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
