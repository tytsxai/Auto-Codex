import { create } from 'zustand';
import type { Task, TaskStatus, ImplementationPlan, Subtask, TaskMetadata, ExecutionProgress, ExecutionPhase, ReviewReason, TaskDraft } from '../../shared/types';

interface TaskState {
  tasks: Task[];
  selectedTaskId: string | null;
  isLoading: boolean;
  error: string | null;

  // 操作
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  updateTaskFromPlan: (taskId: string, plan: ImplementationPlan) => void;
  updateExecutionProgress: (taskId: string, progress: Partial<ExecutionProgress>) => void;
  appendLog: (taskId: string, log: string) => void;
  selectTask: (taskId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearTasks: () => void;

  // 选择器
  getSelectedTask: () => Task | undefined;
  getTasksByStatus: (status: TaskStatus) => Task[];
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  selectedTaskId: null,
  isLoading: false,
  error: null,

  setTasks: (tasks) => set({ tasks }),

  addTask: (task) =>
    set((state) => ({
      tasks: [...state.tasks, task]
    })),

  updateTask: (taskId, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId || t.specId === taskId ? { ...t, ...updates } : t
      )
    })),

  updateTaskStatus: (taskId, status) =>
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id !== taskId && t.specId !== taskId) return t;

        // 当状态变为 backlog 时，将执行进度重置为 idle
        // 这确保任务停止时规划/编码动画停止
        const executionProgress = status === 'backlog'
          ? { phase: 'idle' as ExecutionPhase, phaseProgress: 0, overallProgress: 0 }
          : t.executionProgress;

        return { ...t, status, executionProgress, updatedAt: new Date() };
      })
    })),

  updateTaskFromPlan: (taskId, plan) =>
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id !== taskId && t.specId !== taskId) return t;

        // 从计划中提取子任务
        const subtasks: Subtask[] = plan.phases.flatMap((phase) =>
          phase.subtasks.map((subtask) => ({
            id: subtask.id,
            title: subtask.description,
            description: subtask.description,
            status: subtask.status,
            files: [],
            verification: subtask.verification as Subtask['verification']
          }))
        );

        // 根据子任务确定 status 和 reviewReason
        // 此逻辑必须与后端（project-store.ts）完全一致
        const allCompleted = subtasks.length > 0 && subtasks.every((s) => s.status === 'completed');
        const anyInProgress = subtasks.some((s) => s.status === 'in_progress');
        const anyFailed = subtasks.some((s) => s.status === 'failed');
        const anyCompleted = subtasks.some((s) => s.status === 'completed');

        let status: TaskStatus = t.status;
        let reviewReason: ReviewReason | undefined = t.reviewReason;

        if (allCompleted) {
          // 手动任务跳过 AI 评审，直接进入人工评审
          status = t.metadata?.sourceType === 'manual' ? 'human_review' : 'ai_review';
          if (t.metadata?.sourceType === 'manual') {
            reviewReason = 'completed';
          } else {
            reviewReason = undefined;
          }
        } else if (anyFailed) {
          // 部分子任务失败 - 需要人工关注
          status = 'human_review';
          reviewReason = 'errors';
        } else if (anyInProgress || anyCompleted) {
          // 进行中
          status = 'in_progress';
          reviewReason = undefined;
        }

        return {
          ...t,
          title: plan.feature || t.title,
          subtasks,
          status,
          reviewReason,
          updatedAt: new Date()
        };
      })
    })),

  updateExecutionProgress: (taskId, progress) =>
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id !== taskId && t.specId !== taskId) return t;

        // 与现有进度合并
        const existingProgress = t.executionProgress || {
          phase: 'idle' as ExecutionPhase,
          phaseProgress: 0,
          overallProgress: 0
        };

        return {
          ...t,
          executionProgress: {
            ...existingProgress,
            ...progress
          },
          updatedAt: new Date()
        };
      })
    })),

  appendLog: (taskId, log) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId || t.specId === taskId
          ? { ...t, logs: [...(t.logs || []), log] }
          : t
      )
    })),

  selectTask: (taskId) => set({ selectedTaskId: taskId }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  clearTasks: () => set({ tasks: [], selectedTaskId: null }),

  getSelectedTask: () => {
    const state = get();
    return state.tasks.find((t) => t.id === state.selectedTaskId);
  },

  getTasksByStatus: (status) => {
    const state = get();
    return state.tasks.filter((t) => t.status === status);
  }
}));

/**
 * 加载项目任务
 */
export async function loadTasks(projectId: string): Promise<void> {
  const store = useTaskStore.getState();
  store.setLoading(true);
  store.setError(null);

  try {
    const result = await window.electronAPI.getTasks(projectId);
    if (result.success && result.data) {
      store.setTasks(result.data);
    } else {
      store.setError(result.error || 'Failed to load tasks');
    }
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    store.setLoading(false);
  }
}

/**
 * 创建新任务
 */
export async function createTask(
  projectId: string,
  title: string,
  description: string,
  metadata?: TaskMetadata
): Promise<Task | null> {
  const store = useTaskStore.getState();

  try {
    const result = await window.electronAPI.createTask(projectId, title, description, metadata);
    if (result.success && result.data) {
      store.addTask(result.data);
      return result.data;
    } else {
      store.setError(result.error || 'Failed to create task');
      return null;
    }
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * 启动任务
 */
export function startTask(taskId: string, options?: { parallel?: boolean; workers?: number }): void {
  window.electronAPI.startTask(taskId, options);
}

/**
 * 停止任务
 */
export function stopTask(taskId: string): void {
  window.electronAPI.stopTask(taskId);
}

/**
 * 提交任务评审
 */
export async function submitReview(
  taskId: string,
  approved: boolean,
  feedback?: string
): Promise<boolean> {
  const store = useTaskStore.getState();

  try {
    const result = await window.electronAPI.submitReview(taskId, approved, feedback);
    if (result.success) {
      store.updateTaskStatus(taskId, approved ? 'done' : 'in_progress');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 更新任务状态并持久化到文件
 */
export async function persistTaskStatus(
  taskId: string,
  status: TaskStatus
): Promise<boolean> {
  const store = useTaskStore.getState();
  const previousTask = store.tasks.find((t) => t.id === taskId || t.specId === taskId);

  try {
    // 先更新本地状态以获得即时反馈
    store.updateTaskStatus(taskId, status);

    // 持久化到文件
    const result = await window.electronAPI.updateTaskStatus(taskId, status);
    if (!result.success) {
      console.error('Failed to persist task status:', result.error);
      if (previousTask) {
        store.updateTask(taskId, {
          status: previousTask.status,
          executionProgress: previousTask.executionProgress,
          updatedAt: previousTask.updatedAt
        });
      }
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error persisting task status:', error);
    if (previousTask) {
      store.updateTask(taskId, {
        status: previousTask.status,
        executionProgress: previousTask.executionProgress,
        updatedAt: previousTask.updatedAt
      });
    }
    return false;
  }
}

/**
 * 更新任务标题/描述/元数据并持久化到文件
 */
export async function persistUpdateTask(
  taskId: string,
  updates: { title?: string; description?: string; metadata?: Partial<TaskMetadata> }
): Promise<boolean> {
  const store = useTaskStore.getState();

  try {
    // 调用 IPC 将更改持久化到 spec 文件
    const result = await window.electronAPI.updateTask(taskId, updates);

    if (result.success && result.data) {
      // 使用返回的任务数据更新本地状态
      store.updateTask(taskId, {
        title: result.data.title,
        description: result.data.description,
        metadata: result.data.metadata,
        updatedAt: new Date()
      });
      return true;
    }

    console.error('Failed to persist task update:', result.error);
    return false;
  } catch (error) {
    console.error('Error persisting task update:', error);
    return false;
  }
}

/**
 * 检查任务是否有正在运行的进程
 */
export async function checkTaskRunning(taskId: string): Promise<boolean> {
  try {
    const result = await window.electronAPI.checkTaskRunning(taskId);
    return result.success && result.data === true;
  } catch (error) {
    console.error('Error checking task running status:', error);
    return false;
  }
}

/**
 * 恢复卡住的任务（状态显示 in_progress 但没有进程在运行）
 * @param taskId - 要恢复的任务 ID
 * @param options - 恢复选项（autoRestart 默认为 true）
 */
export async function recoverStuckTask(
  taskId: string,
  options: { targetStatus?: TaskStatus; autoRestart?: boolean } = { autoRestart: true }
): Promise<{ success: boolean; message: string; autoRestarted?: boolean }> {
  const store = useTaskStore.getState();

  try {
    const result = await window.electronAPI.recoverStuckTask(taskId, options);

    if (result.success && result.data) {
      // 更新本地状态
      store.updateTaskStatus(taskId, result.data.newStatus);
      return { 
        success: true, 
        message: result.data.message,
        autoRestarted: result.data.autoRestarted
      };
    }

    return {
      success: false,
      message: result.error || 'Failed to recover task'
    };
  } catch (error) {
    console.error('Error recovering stuck task:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 删除任务及其 spec 目录
 * 同时删除路线图中关联的 feature
 */
export async function deleteTask(
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  const store = useTaskStore.getState();

  // 获取任务的 specId，用于查找关联的路线图 feature
  const task = store.tasks.find(t => t.id === taskId || t.specId === taskId);
  const specId = task?.specId || taskId;

  try {
    const result = await window.electronAPI.deleteTask(taskId);

    if (result.success) {
      // 从本地状态移除
      store.setTasks(store.tasks.filter(t => t.id !== taskId && t.specId !== specId));
      // 如果此任务被选中则清除选择
      if (store.selectedTaskId && (store.selectedTaskId === taskId || store.selectedTaskId === specId)) {
        store.selectTask(null);
      }

      // 同步删除路线图中关联的 feature
      // 延迟导入避免循环依赖
      const { useRoadmapStore } = await import('./roadmap-store');
      const roadmapStore = useRoadmapStore.getState();
      if (roadmapStore.roadmap) {
        const linkedFeatures = roadmapStore.roadmap.features.filter(
          f => f.linkedSpecId === specId
        );
        if (linkedFeatures.length > 0) {
          linkedFeatures.forEach(feature => roadmapStore.deleteFeature(feature.id));
          // 持久化路线图更改
          const updatedRoadmap = useRoadmapStore.getState().roadmap;
          const projectId = roadmapStore.currentProjectId ?? task?.projectId;
          if (updatedRoadmap && projectId) {
            window.electronAPI.saveRoadmap(projectId, updatedRoadmap).catch(err => {
              console.error('Failed to save roadmap after deleting linked feature:', err);
            });
          }
        }
      }

      return { success: true };
    }

    return {
      success: false,
      error: result.error || 'Failed to delete task'
    };
  } catch (error) {
    console.error('Error deleting task:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 归档任务
 * 通过在元数据中添加 archivedAt 时间戳将任务标记为已归档
 */
export async function archiveTasks(
  projectId: string,
  taskIds: string[],
  version?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await window.electronAPI.archiveTasks(projectId, taskIds, version);

    if (result.success) {
      // 重新加载任务以更新 UI（默认会过滤掉已归档任务）
      await loadTasks(projectId);
      return { success: true };
    }

    return {
      success: false,
      error: result.error || 'Failed to archive tasks'
    };
  } catch (error) {
    console.error('Error archiving tasks:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================
// 任务创建草稿管理
// ============================================

const DRAFT_KEY_PREFIX = 'task-creation-draft';

/**
 * 获取项目草稿的 localStorage 键
 */
function getDraftKey(projectId: string): string {
  return `${DRAFT_KEY_PREFIX}-${projectId}`;
}

/**
 * 将任务创建草稿保存到 localStorage
 * 注意：对于大图片，我们只在草稿中保存缩略图以避免 localStorage 限制
 */
export function saveDraft(draft: TaskDraft): void {
  try {
    const key = getDraftKey(draft.projectId);
    // 创建仅包含缩略图的副本以避免 localStorage 大小限制
    const draftToStore = {
      ...draft,
      images: draft.images.map(img => ({
        ...img,
        data: undefined // 不在 localStorage 中存储完整图片数据
      })),
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(draftToStore));
  } catch (error) {
    console.error('Failed to save draft:', error);
  }
}

/**
 * 从 localStorage 加载任务创建草稿
 */
export function loadDraft(projectId: string): TaskDraft | null {
  try {
    const key = getDraftKey(projectId);
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const draft = JSON.parse(stored);
    // 将 savedAt 转回 Date
    draft.savedAt = new Date(draft.savedAt);
    return draft as TaskDraft;
  } catch (error) {
    console.error('Failed to load draft:', error);
    return null;
  }
}

/**
 * 从 localStorage 清除任务创建草稿
 */
export function clearDraft(projectId: string): void {
  try {
    const key = getDraftKey(projectId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear draft:', error);
  }
}

/**
 * 检查项目是否存在草稿
 */
export function hasDraft(projectId: string): boolean {
  const key = getDraftKey(projectId);
  return localStorage.getItem(key) !== null;
}

/**
 * 检查草稿是否有任何有效内容（标题、描述或图片）
 */
export function isDraftEmpty(draft: TaskDraft | null): boolean {
  if (!draft) return true;
  return (
    !draft.title.trim() &&
    !draft.description.trim() &&
    draft.images.length === 0 &&
    !draft.category &&
    !draft.priority &&
    !draft.complexity &&
    !draft.impact
  );
}

// ============================================
// GitHub Issue 关联辅助
// ============================================

/**
 * 通过 GitHub issue 编号查找任务
 * 用于检查该 GitHub issue 是否已存在任务
 */
export function getTaskByGitHubIssue(issueNumber: number): Task | undefined {
  const store = useTaskStore.getState();
  return store.tasks.find(t => t.metadata?.githubIssueNumber === issueNumber);
}

// ============================================
// 任务状态检测辅助
// ============================================

/**
 * 检查任务是否处于 human_review 且没有完成的子任务。
 * 这表示任务在实现完成前崩溃/退出，
 * 应恢复执行而不是评审。
 */
export function isIncompleteHumanReview(task: Task): boolean {
  if (task.status !== 'human_review') return false;

  // 如果未定义子任务，说明任务尚未规划（不应处于 human_review）
  if (!task.subtasks || task.subtasks.length === 0) return true;

  // 检查是否有已完成的子任务
  const completedSubtasks = task.subtasks.filter(s => s.status === 'completed').length;

  // 如果已完成子任务为 0，说明任务在实现前崩溃
  return completedSubtasks === 0;
}

/**
 * 获取任务已完成子任务的数量
 */
export function getCompletedSubtaskCount(task: Task): number {
  if (!task.subtasks || task.subtasks.length === 0) return 0;
  return task.subtasks.filter(s => s.status === 'completed').length;
}

/**
 * 获取任务进度信息
 */
export function getTaskProgress(task: Task): { completed: number; total: number; percentage: number } {
  const total = task.subtasks?.length || 0;
  const completed = task.subtasks?.filter(s => s.status === 'completed').length || 0;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percentage };
}
