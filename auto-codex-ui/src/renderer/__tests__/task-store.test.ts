/**
 * Unit tests for Task Store
 * Tests Zustand store for task state management
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useTaskStore,
  loadTasks,
  createTask,
  deleteTask,
  startTask,
  stopTask,
  submitReview,
  persistTaskStatus,
  persistUpdateTask,
  checkTaskRunning,
  recoverStuckTask,
  archiveTasks,
  saveDraft,
  loadDraft,
  clearDraft,
  hasDraft,
  isDraftEmpty,
  getTaskByGitHubIssue,
  isIncompleteHumanReview,
  getCompletedSubtaskCount,
  getTaskProgress
} from '../stores/task-store';
import type { Task, TaskStatus, ImplementationPlan, TaskDraft } from '../../shared/types';

// Helper to create test tasks
function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    specId: 'test-spec-001',
    projectId: 'project-1',
    title: 'Test Task',
    description: 'Test description',
    status: 'backlog' as TaskStatus,
    subtasks: [],
    logs: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

// Helper to create test implementation plan
function createTestPlan(overrides: Partial<ImplementationPlan> = {}): ImplementationPlan {
  return {
    feature: 'Test Feature',
    workflow_type: 'feature',
    services_involved: [],
    phases: [
      {
        phase: 1,
        name: 'Test Phase',
        type: 'implementation',
        subtasks: [
          { id: 'subtask-1', description: 'First subtask', status: 'pending' },
          { id: 'subtask-2', description: 'Second subtask', status: 'pending' }
        ]
      }
    ],
    final_acceptance: ['Tests pass'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    spec_file: 'spec.md',
    ...overrides
  };
}

describe('Task Store', () => {
  let electronAPI: {
    getTasks: ReturnType<typeof vi.fn>;
    createTask: ReturnType<typeof vi.fn>;
    startTask: ReturnType<typeof vi.fn>;
    stopTask: ReturnType<typeof vi.fn>;
    submitReview: ReturnType<typeof vi.fn>;
    updateTaskStatus: ReturnType<typeof vi.fn>;
    updateTask: ReturnType<typeof vi.fn>;
    checkTaskRunning: ReturnType<typeof vi.fn>;
    recoverStuckTask: ReturnType<typeof vi.fn>;
    deleteTask: ReturnType<typeof vi.fn>;
    archiveTasks: ReturnType<typeof vi.fn>;
  };
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => (key in store ? store[key] : null),
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      }
    };
  })();

  beforeEach(() => {
    electronAPI = {
      getTasks: vi.fn(),
      createTask: vi.fn(),
      startTask: vi.fn(),
      stopTask: vi.fn(),
      submitReview: vi.fn(),
      updateTaskStatus: vi.fn(),
      updateTask: vi.fn(),
      checkTaskRunning: vi.fn(),
      recoverStuckTask: vi.fn(),
      deleteTask: vi.fn(),
      archiveTasks: vi.fn()
    };

    if (!(globalThis as typeof globalThis & { window?: Window }).window) {
      (globalThis as typeof globalThis & { window: Window }).window = {} as Window;
    }

    (window as Window & { electronAPI: typeof electronAPI }).electronAPI = electronAPI;
    (globalThis as typeof globalThis & { localStorage?: Storage }).localStorage = localStorageMock as Storage;
    localStorageMock.clear();

    // Reset store to initial state before each test
    useTaskStore.setState({
      tasks: [],
      selectedTaskId: null,
      isLoading: false,
      error: null
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('setTasks', () => {
    it('should set tasks array', () => {
      const tasks = [createTestTask({ id: 'task-1' }), createTestTask({ id: 'task-2' })];

      useTaskStore.getState().setTasks(tasks);

      expect(useTaskStore.getState().tasks).toHaveLength(2);
      expect(useTaskStore.getState().tasks[0].id).toBe('task-1');
    });

    it('should replace existing tasks', () => {
      const initialTasks = [createTestTask({ id: 'old-task' })];
      const newTasks = [createTestTask({ id: 'new-task' })];

      useTaskStore.getState().setTasks(initialTasks);
      useTaskStore.getState().setTasks(newTasks);

      expect(useTaskStore.getState().tasks).toHaveLength(1);
      expect(useTaskStore.getState().tasks[0].id).toBe('new-task');
    });

    it('should handle empty array', () => {
      useTaskStore.getState().setTasks([createTestTask()]);
      useTaskStore.getState().setTasks([]);

      expect(useTaskStore.getState().tasks).toHaveLength(0);
    });
  });

  describe('addTask', () => {
    it('should add task to empty array', () => {
      const task = createTestTask({ id: 'new-task' });

      useTaskStore.getState().addTask(task);

      expect(useTaskStore.getState().tasks).toHaveLength(1);
      expect(useTaskStore.getState().tasks[0].id).toBe('new-task');
    });

    it('should append task to existing array', () => {
      useTaskStore.setState({ tasks: [createTestTask({ id: 'existing' })] });

      useTaskStore.getState().addTask(createTestTask({ id: 'new-task' }));

      expect(useTaskStore.getState().tasks).toHaveLength(2);
      expect(useTaskStore.getState().tasks[1].id).toBe('new-task');
    });
  });

  describe('updateTask', () => {
    it('should update task by id', () => {
      useTaskStore.setState({
        tasks: [createTestTask({ id: 'task-1', title: 'Original Title' })]
      });

      useTaskStore.getState().updateTask('task-1', { title: 'Updated Title' });

      expect(useTaskStore.getState().tasks[0].title).toBe('Updated Title');
    });

    it('should update task by specId', () => {
      useTaskStore.setState({
        tasks: [createTestTask({ id: 'task-1', specId: 'spec-001', title: 'Original' })]
      });

      useTaskStore.getState().updateTask('spec-001', { title: 'Updated via specId' });

      expect(useTaskStore.getState().tasks[0].title).toBe('Updated via specId');
    });

    it('should not modify other tasks', () => {
      useTaskStore.setState({
        tasks: [
          createTestTask({ id: 'task-1', title: 'Task 1' }),
          createTestTask({ id: 'task-2', title: 'Task 2' })
        ]
      });

      useTaskStore.getState().updateTask('task-1', { title: 'Updated Task 1' });

      expect(useTaskStore.getState().tasks[0].title).toBe('Updated Task 1');
      expect(useTaskStore.getState().tasks[1].title).toBe('Task 2');
    });

    it('should merge updates with existing task', () => {
      useTaskStore.setState({
        tasks: [createTestTask({ id: 'task-1', title: 'Original', description: 'Original Desc' })]
      });

      useTaskStore.getState().updateTask('task-1', { title: 'Updated' });

      expect(useTaskStore.getState().tasks[0].title).toBe('Updated');
      expect(useTaskStore.getState().tasks[0].description).toBe('Original Desc');
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status by id', () => {
      useTaskStore.setState({
        tasks: [createTestTask({ id: 'task-1', status: 'backlog' })]
      });

      useTaskStore.getState().updateTaskStatus('task-1', 'in_progress');

      expect(useTaskStore.getState().tasks[0].status).toBe('in_progress');
    });

    it('should update task status by specId', () => {
      useTaskStore.setState({
        tasks: [createTestTask({ id: 'task-1', specId: 'spec-001', status: 'backlog' })]
      });

      useTaskStore.getState().updateTaskStatus('spec-001', 'done');

      expect(useTaskStore.getState().tasks[0].status).toBe('done');
    });

    it('should update updatedAt timestamp', () => {
      const originalDate = new Date('2024-01-01');
      useTaskStore.setState({
        tasks: [createTestTask({ id: 'task-1', updatedAt: originalDate })]
      });

      useTaskStore.getState().updateTaskStatus('task-1', 'in_progress');

      expect(useTaskStore.getState().tasks[0].updatedAt.getTime()).toBeGreaterThan(
        originalDate.getTime()
      );
    });

    it('should reset execution progress when status returns to backlog', () => {
      useTaskStore.setState({
        tasks: [
          createTestTask({
            id: 'task-1',
            status: 'in_progress',
            executionProgress: { phase: 'coding', phaseProgress: 50, overallProgress: 60 }
          })
        ]
      });

      useTaskStore.getState().updateTaskStatus('task-1', 'backlog');

      expect(useTaskStore.getState().tasks[0].status).toBe('backlog');
      expect(useTaskStore.getState().tasks[0].executionProgress).toEqual({
        phase: 'idle',
        phaseProgress: 0,
        overallProgress: 0
      });
    });
  });

  describe('updateTaskFromPlan', () => {
    it('should extract subtasks from plan', () => {
      useTaskStore.setState({
        tasks: [createTestTask({ id: 'task-1', subtasks: [] })]
      });

      const plan = createTestPlan({
        phases: [
          {
            phase: 1,
            name: 'Phase 1',
            type: 'implementation',
            subtasks: [
              { id: 'c1', description: 'Subtask 1', status: 'completed' },
              { id: 'c2', description: 'Subtask 2', status: 'pending' }
            ]
          }
        ]
      });

      useTaskStore.getState().updateTaskFromPlan('task-1', plan);

      expect(useTaskStore.getState().tasks[0].subtasks).toHaveLength(2);
      expect(useTaskStore.getState().tasks[0].subtasks[0].id).toBe('c1');
      expect(useTaskStore.getState().tasks[0].subtasks[0].status).toBe('completed');
    });

    it('should extract subtasks from multiple phases', () => {
      useTaskStore.setState({
        tasks: [createTestTask({ id: 'task-1' })]
      });

      const plan = createTestPlan({
        phases: [
          {
            phase: 1,
            name: 'Phase 1',
            type: 'implementation',
            subtasks: [{ id: 'c1', description: 'Subtask 1', status: 'completed' }]
          },
          {
            phase: 2,
            name: 'Phase 2',
            type: 'cleanup',
            subtasks: [{ id: 'c2', description: 'Subtask 2', status: 'pending' }]
          }
        ]
      });

      useTaskStore.getState().updateTaskFromPlan('task-1', plan);

      expect(useTaskStore.getState().tasks[0].subtasks).toHaveLength(2);
    });

    it('should update status to ai_review when all subtasks completed', () => {
      useTaskStore.setState({
        tasks: [createTestTask({ id: 'task-1', status: 'in_progress' })]
      });

      const plan = createTestPlan({
        phases: [
          {
            phase: 1,
            name: 'Phase 1',
            type: 'implementation',
            subtasks: [
              { id: 'c1', description: 'Subtask 1', status: 'completed' },
              { id: 'c2', description: 'Subtask 2', status: 'completed' }
            ]
          }
        ]
      });

      useTaskStore.getState().updateTaskFromPlan('task-1', plan);

      expect(useTaskStore.getState().tasks[0].status).toBe('ai_review');
    });

    it('should update status to human_review when any subtask failed', () => {
      useTaskStore.setState({
        tasks: [createTestTask({ id: 'task-1', status: 'in_progress' })]
      });

      const plan = createTestPlan({
        phases: [
          {
            phase: 1,
            name: 'Phase 1',
            type: 'implementation',
            subtasks: [
              { id: 'c1', description: 'Subtask 1', status: 'completed' },
              { id: 'c2', description: 'Subtask 2', status: 'failed' }
            ]
          }
        ]
      });

      useTaskStore.getState().updateTaskFromPlan('task-1', plan);

      expect(useTaskStore.getState().tasks[0].status).toBe('human_review');
    });

    it('should update status to in_progress when some subtasks in progress', () => {
      useTaskStore.setState({
        tasks: [createTestTask({ id: 'task-1', status: 'backlog' })]
      });

      const plan = createTestPlan({
        phases: [
          {
            phase: 1,
            name: 'Phase 1',
            type: 'implementation',
            subtasks: [
              { id: 'c1', description: 'Subtask 1', status: 'completed' },
              { id: 'c2', description: 'Subtask 2', status: 'in_progress' }
            ]
          }
        ]
      });

      useTaskStore.getState().updateTaskFromPlan('task-1', plan);

      expect(useTaskStore.getState().tasks[0].status).toBe('in_progress');
    });

    it('should update title from plan feature', () => {
      useTaskStore.setState({
        tasks: [createTestTask({ id: 'task-1', title: 'Original Title' })]
      });

      const plan = createTestPlan({ feature: 'New Feature Name' });

      useTaskStore.getState().updateTaskFromPlan('task-1', plan);

      expect(useTaskStore.getState().tasks[0].title).toBe('New Feature Name');
    });

    it('should set human_review and reviewReason for manual tasks when all subtasks completed', () => {
      useTaskStore.setState({
        tasks: [
          createTestTask({
            id: 'task-1',
            status: 'in_progress',
            metadata: { sourceType: 'manual' }
          })
        ]
      });

      const plan = createTestPlan({
        phases: [
          {
            phase: 1,
            name: 'Phase 1',
            type: 'implementation',
            subtasks: [{ id: 'c1', description: 'Subtask 1', status: 'completed' }]
          }
        ]
      });

      useTaskStore.getState().updateTaskFromPlan('task-1', plan);

      expect(useTaskStore.getState().tasks[0].status).toBe('human_review');
      expect(useTaskStore.getState().tasks[0].reviewReason).toBe('completed');
    });
  });

  describe('updateExecutionProgress', () => {
    it('should initialize and merge execution progress updates', () => {
      useTaskStore.setState({
        tasks: [createTestTask({ id: 'task-1' })]
      });

      useTaskStore.getState().updateExecutionProgress('task-1', { phase: 'coding' });
      useTaskStore.getState().updateExecutionProgress('task-1', { phaseProgress: 40 });

      expect(useTaskStore.getState().tasks[0].executionProgress).toEqual({
        phase: 'coding',
        phaseProgress: 40,
        overallProgress: 0
      });
    });
  });

  describe('appendLog', () => {
    it('should append log to task by id', () => {
      useTaskStore.setState({
        tasks: [createTestTask({ id: 'task-1', logs: [] })]
      });

      useTaskStore.getState().appendLog('task-1', 'First log');
      useTaskStore.getState().appendLog('task-1', 'Second log');

      expect(useTaskStore.getState().tasks[0].logs).toHaveLength(2);
      expect(useTaskStore.getState().tasks[0].logs[0]).toBe('First log');
      expect(useTaskStore.getState().tasks[0].logs[1]).toBe('Second log');
    });

    it('should append log to task by specId', () => {
      useTaskStore.setState({
        tasks: [createTestTask({ id: 'task-1', specId: 'spec-001', logs: [] })]
      });

      useTaskStore.getState().appendLog('spec-001', 'Log message');

      expect(useTaskStore.getState().tasks[0].logs).toContain('Log message');
    });

    it('should accumulate logs correctly', () => {
      useTaskStore.setState({
        tasks: [createTestTask({ id: 'task-1', logs: ['existing log'] })]
      });

      useTaskStore.getState().appendLog('task-1', 'new log');

      expect(useTaskStore.getState().tasks[0].logs).toHaveLength(2);
      expect(useTaskStore.getState().tasks[0].logs[0]).toBe('existing log');
      expect(useTaskStore.getState().tasks[0].logs[1]).toBe('new log');
    });
  });

  describe('selectTask', () => {
    it('should set selected task id', () => {
      useTaskStore.getState().selectTask('task-1');

      expect(useTaskStore.getState().selectedTaskId).toBe('task-1');
    });

    it('should clear selection with null', () => {
      useTaskStore.setState({ selectedTaskId: 'task-1' });

      useTaskStore.getState().selectTask(null);

      expect(useTaskStore.getState().selectedTaskId).toBeNull();
    });
  });

  describe('setLoading', () => {
    it('should set loading state to true', () => {
      useTaskStore.getState().setLoading(true);

      expect(useTaskStore.getState().isLoading).toBe(true);
    });

    it('should set loading state to false', () => {
      useTaskStore.setState({ isLoading: true });

      useTaskStore.getState().setLoading(false);

      expect(useTaskStore.getState().isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set error message', () => {
      useTaskStore.getState().setError('Something went wrong');

      expect(useTaskStore.getState().error).toBe('Something went wrong');
    });

    it('should clear error with null', () => {
      useTaskStore.setState({ error: 'Previous error' });

      useTaskStore.getState().setError(null);

      expect(useTaskStore.getState().error).toBeNull();
    });
  });

  describe('clearTasks', () => {
    it('should clear all tasks and selection', () => {
      useTaskStore.setState({
        tasks: [createTestTask(), createTestTask()],
        selectedTaskId: 'task-1'
      });

      useTaskStore.getState().clearTasks();

      expect(useTaskStore.getState().tasks).toHaveLength(0);
      expect(useTaskStore.getState().selectedTaskId).toBeNull();
    });
  });

  describe('getSelectedTask', () => {
    it('should return undefined when no task selected', () => {
      useTaskStore.setState({
        tasks: [createTestTask({ id: 'task-1' })],
        selectedTaskId: null
      });

      const selected = useTaskStore.getState().getSelectedTask();

      expect(selected).toBeUndefined();
    });

    it('should return selected task', () => {
      useTaskStore.setState({
        tasks: [
          createTestTask({ id: 'task-1', title: 'Task 1' }),
          createTestTask({ id: 'task-2', title: 'Task 2' })
        ],
        selectedTaskId: 'task-2'
      });

      const selected = useTaskStore.getState().getSelectedTask();

      expect(selected).toBeDefined();
      expect(selected?.title).toBe('Task 2');
    });

    it('should return undefined for non-existent selected id', () => {
      useTaskStore.setState({
        tasks: [createTestTask({ id: 'task-1' })],
        selectedTaskId: 'nonexistent'
      });

      const selected = useTaskStore.getState().getSelectedTask();

      expect(selected).toBeUndefined();
    });
  });

  describe('getTasksByStatus', () => {
    it('should return empty array when no tasks match status', () => {
      useTaskStore.setState({
        tasks: [createTestTask({ status: 'backlog' })]
      });

      const tasks = useTaskStore.getState().getTasksByStatus('in_progress');

      expect(tasks).toHaveLength(0);
    });

    it('should return all tasks with matching status', () => {
      useTaskStore.setState({
        tasks: [
          createTestTask({ id: 'task-1', status: 'in_progress' }),
          createTestTask({ id: 'task-2', status: 'backlog' }),
          createTestTask({ id: 'task-3', status: 'in_progress' })
        ]
      });

      const tasks = useTaskStore.getState().getTasksByStatus('in_progress');

      expect(tasks).toHaveLength(2);
      expect(tasks.map((t) => t.id)).toContain('task-1');
      expect(tasks.map((t) => t.id)).toContain('task-3');
    });

    it('should filter by each status type', () => {
      const statuses: TaskStatus[] = ['backlog', 'in_progress', 'ai_review', 'human_review', 'done'];

      useTaskStore.setState({
        tasks: statuses.map((status) => createTestTask({ id: `task-${status}`, status }))
      });

      statuses.forEach((status) => {
        const tasks = useTaskStore.getState().getTasksByStatus(status);
        expect(tasks).toHaveLength(1);
        expect(tasks[0].status).toBe(status);
      });
    });
  });

  describe('task API operations', () => {
    it('loadTasks should set tasks on success', async () => {
      const tasks = [createTestTask({ id: 'task-1' })];
      electronAPI.getTasks.mockResolvedValue({ success: true, data: tasks });

      await loadTasks('project-1');

      expect(electronAPI.getTasks).toHaveBeenCalledWith('project-1');
      expect(useTaskStore.getState().tasks).toHaveLength(1);
      expect(useTaskStore.getState().error).toBeNull();
      expect(useTaskStore.getState().isLoading).toBe(false);
    });

    it('loadTasks should set error on failure response', async () => {
      electronAPI.getTasks.mockResolvedValue({ success: false, error: 'nope' });

      await loadTasks('project-1');

      expect(useTaskStore.getState().tasks).toHaveLength(0);
      expect(useTaskStore.getState().error).toBe('nope');
      expect(useTaskStore.getState().isLoading).toBe(false);
    });

    it('loadTasks should set error on thrown exception', async () => {
      electronAPI.getTasks.mockRejectedValue(new Error('boom'));

      await loadTasks('project-1');

      expect(useTaskStore.getState().error).toBe('boom');
      expect(useTaskStore.getState().isLoading).toBe(false);
    });

    it('createTask should add task and return it on success', async () => {
      const task = createTestTask({ id: 'task-1' });
      electronAPI.createTask.mockResolvedValue({ success: true, data: task });

      const result = await createTask('project-1', 'Title', 'Desc');

      expect(result).toEqual(task);
      expect(useTaskStore.getState().tasks).toHaveLength(1);
      expect(useTaskStore.getState().tasks[0].id).toBe('task-1');
    });

    it('createTask should set error and return null on failure', async () => {
      electronAPI.createTask.mockResolvedValue({ success: false, error: 'bad' });

      const result = await createTask('project-1', 'Title', 'Desc');

      expect(result).toBeNull();
      expect(useTaskStore.getState().error).toBe('bad');
    });

    it('createTask should set error and return null on exception', async () => {
      electronAPI.createTask.mockRejectedValue(new Error('explode'));

      const result = await createTask('project-1', 'Title', 'Desc');

      expect(result).toBeNull();
      expect(useTaskStore.getState().error).toBe('explode');
    });

    it('deleteTask should remove task and clear selection on success', async () => {
      useTaskStore.setState({
        tasks: [
          createTestTask({ id: 'task-1' }),
          createTestTask({ id: 'task-2' })
        ],
        selectedTaskId: 'task-1'
      });
      electronAPI.deleteTask.mockResolvedValue({ success: true });

      const result = await deleteTask('task-1');

      expect(result.success).toBe(true);
      expect(useTaskStore.getState().tasks).toHaveLength(1);
      expect(useTaskStore.getState().tasks[0].id).toBe('task-2');
      expect(useTaskStore.getState().selectedTaskId).toBeNull();
    });

    it('deleteTask should return error on failure', async () => {
      electronAPI.deleteTask.mockResolvedValue({ success: false, error: 'nope' });

      const result = await deleteTask('task-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('nope');
    });

    it('deleteTask should return error on exception', async () => {
      electronAPI.deleteTask.mockRejectedValue(new Error('boom'));

      const result = await deleteTask('task-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('boom');
    });

    it('startTask and stopTask should call electronAPI', () => {
      startTask('task-1', { parallel: true, workers: 2 });
      stopTask('task-1');

      expect(electronAPI.startTask).toHaveBeenCalledWith('task-1', { parallel: true, workers: 2 });
      expect(electronAPI.stopTask).toHaveBeenCalledWith('task-1');
    });

    it('submitReview should update status and return true on success', async () => {
      const updateSpy = vi.spyOn(useTaskStore.getState(), 'updateTaskStatus');
      electronAPI.submitReview.mockResolvedValue({ success: true });

      const result = await submitReview('task-1', true, 'looks good');

      expect(result).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith('task-1', 'done');
    });

    it('submitReview should return false on failure response', async () => {
      electronAPI.submitReview.mockResolvedValue({ success: false });

      const result = await submitReview('task-1', false, 'needs work');

      expect(result).toBe(false);
    });

    it('submitReview should return false on exception', async () => {
      electronAPI.submitReview.mockRejectedValue(new Error('fail'));

      const result = await submitReview('task-1', true);

      expect(result).toBe(false);
    });

    it('persistTaskStatus should revert on failure response', async () => {
      const originalDate = new Date('2024-01-01');
      useTaskStore.setState({
        tasks: [
          createTestTask({
            id: 'task-1',
            status: 'in_progress',
            executionProgress: { phase: 'coding', phaseProgress: 10, overallProgress: 10 },
            updatedAt: originalDate
          })
        ]
      });
      electronAPI.updateTaskStatus.mockResolvedValue({ success: false, error: 'nope' });

      const result = await persistTaskStatus('task-1', 'backlog');

      expect(result).toBe(false);
      const task = useTaskStore.getState().tasks[0];
      expect(task.status).toBe('in_progress');
      expect(task.executionProgress).toEqual({
        phase: 'coding',
        phaseProgress: 10,
        overallProgress: 10
      });
      expect(task.updatedAt).toEqual(originalDate);
    });

    it('persistTaskStatus should revert on exception', async () => {
      const originalDate = new Date('2024-02-01');
      useTaskStore.setState({
        tasks: [
          createTestTask({
            id: 'task-1',
            status: 'in_progress',
            updatedAt: originalDate
          })
        ]
      });
      electronAPI.updateTaskStatus.mockRejectedValue(new Error('fail'));

      const result = await persistTaskStatus('task-1', 'done');

      expect(result).toBe(false);
      expect(useTaskStore.getState().tasks[0].status).toBe('in_progress');
      expect(useTaskStore.getState().tasks[0].updatedAt).toEqual(originalDate);
    });

    it('persistTaskStatus should return true on success', async () => {
      useTaskStore.setState({
        tasks: [createTestTask({ id: 'task-1', status: 'backlog' })]
      });
      electronAPI.updateTaskStatus.mockResolvedValue({ success: true });

      const result = await persistTaskStatus('task-1', 'in_progress');

      expect(result).toBe(true);
      expect(useTaskStore.getState().tasks[0].status).toBe('in_progress');
    });

    it('persistUpdateTask should update local task when API succeeds', async () => {
      useTaskStore.setState({
        tasks: [createTestTask({ id: 'task-1', title: 'Old', description: 'Old' })]
      });
      electronAPI.updateTask.mockResolvedValue({
        success: true,
        data: {
          title: 'New Title',
          description: 'New Desc',
          metadata: { priority: 'high' }
        }
      });

      const result = await persistUpdateTask('task-1', { title: 'New Title' });

      expect(result).toBe(true);
      expect(useTaskStore.getState().tasks[0].title).toBe('New Title');
      expect(useTaskStore.getState().tasks[0].description).toBe('New Desc');
    });

    it('persistUpdateTask should return false on failure', async () => {
      electronAPI.updateTask.mockResolvedValue({ success: false, error: 'nope' });

      const result = await persistUpdateTask('task-1', { title: 'New Title' });

      expect(result).toBe(false);
    });

    it('persistUpdateTask should return false on exception', async () => {
      electronAPI.updateTask.mockRejectedValue(new Error('boom'));

      const result = await persistUpdateTask('task-1', { title: 'New Title' });

      expect(result).toBe(false);
    });

    it('checkTaskRunning should return true when running', async () => {
      electronAPI.checkTaskRunning.mockResolvedValue({ success: true, data: true });

      const result = await checkTaskRunning('task-1');

      expect(result).toBe(true);
    });

    it('checkTaskRunning should return false on failure', async () => {
      electronAPI.checkTaskRunning.mockResolvedValue({ success: false, data: false });

      const result = await checkTaskRunning('task-1');

      expect(result).toBe(false);
    });

    it('checkTaskRunning should return false on exception', async () => {
      electronAPI.checkTaskRunning.mockRejectedValue(new Error('boom'));

      const result = await checkTaskRunning('task-1');

      expect(result).toBe(false);
    });

    it('recoverStuckTask should update status and return success', async () => {
      useTaskStore.setState({
        tasks: [createTestTask({ id: 'task-1', status: 'in_progress' })]
      });
      electronAPI.recoverStuckTask.mockResolvedValue({
        success: true,
        data: { newStatus: 'backlog', message: 'Recovered', autoRestarted: true }
      });

      const result = await recoverStuckTask('task-1', { autoRestart: true });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Recovered');
      expect(result.autoRestarted).toBe(true);
      expect(useTaskStore.getState().tasks[0].status).toBe('backlog');
    });

    it('recoverStuckTask should return error message on failure', async () => {
      electronAPI.recoverStuckTask.mockResolvedValue({ success: false, error: 'nope' });

      const result = await recoverStuckTask('task-1', { autoRestart: false });

      expect(result.success).toBe(false);
      expect(result.message).toBe('nope');
    });

    it('recoverStuckTask should return error message on exception', async () => {
      electronAPI.recoverStuckTask.mockRejectedValue(new Error('boom'));

      const result = await recoverStuckTask('task-1');

      expect(result.success).toBe(false);
      expect(result.message).toBe('boom');
    });

    it('archiveTasks should reload tasks on success', async () => {
      const tasks = [createTestTask({ id: 'task-1' })];
      electronAPI.archiveTasks.mockResolvedValue({ success: true });
      electronAPI.getTasks.mockResolvedValue({ success: true, data: tasks });

      const result = await archiveTasks('project-1', ['task-1'], '1.2.3');

      expect(result.success).toBe(true);
      expect(electronAPI.archiveTasks).toHaveBeenCalledWith('project-1', ['task-1'], '1.2.3');
      expect(useTaskStore.getState().tasks).toHaveLength(1);
    });

    it('archiveTasks should return error on failure', async () => {
      electronAPI.archiveTasks.mockResolvedValue({ success: false, error: 'nope' });

      const result = await archiveTasks('project-1', ['task-1']);

      expect(result.success).toBe(false);
      expect(result.error).toBe('nope');
    });

    it('archiveTasks should return error on exception', async () => {
      electronAPI.archiveTasks.mockRejectedValue(new Error('boom'));

      const result = await archiveTasks('project-1', ['task-1']);

      expect(result.success).toBe(false);
      expect(result.error).toBe('boom');
    });
  });

  describe('draft helpers and task utilities', () => {
    it('saveDraft/loadDraft/clearDraft should round-trip draft data', () => {
      const draft: TaskDraft = {
        projectId: 'project-1',
        title: 'Draft Title',
        description: 'Draft description',
        category: '',
        priority: '',
        complexity: '',
        impact: '',
        model: '',
        thinkingLevel: '',
        images: [
          {
            id: 'img-1',
            filename: 'img.png',
            mimeType: 'image/png',
            size: 10,
            data: 'data',
            thumbnail: 'thumb'
          }
        ],
        referencedFiles: [],
        savedAt: new Date('2024-03-01')
      };

      saveDraft(draft);
      expect(hasDraft('project-1')).toBe(true);

      const loaded = loadDraft('project-1');
      expect(loaded?.title).toBe('Draft Title');
      expect(loaded?.savedAt).toBeInstanceOf(Date);
      expect(loaded?.images[0].data).toBeUndefined();

      clearDraft('project-1');
      expect(hasDraft('project-1')).toBe(false);
    });

    it('loadDraft should return null on invalid JSON', () => {
      localStorage.setItem('task-creation-draft-project-1', 'not-json');

      const result = loadDraft('project-1');

      expect(result).toBeNull();
    });

    it('isDraftEmpty should detect empty and non-empty drafts', () => {
      expect(isDraftEmpty(null)).toBe(true);
      expect(
        isDraftEmpty({
          projectId: 'project-1',
          title: '',
          description: '',
          category: '',
          priority: '',
          complexity: '',
          impact: '',
          model: '',
          thinkingLevel: '',
          images: [],
          referencedFiles: [],
          savedAt: new Date()
        })
      ).toBe(true);
      expect(
        isDraftEmpty({
          projectId: 'project-1',
          title: 'Has title',
          description: '',
          category: '',
          priority: '',
          complexity: '',
          impact: '',
          model: '',
          thinkingLevel: '',
          images: [],
          referencedFiles: [],
          savedAt: new Date()
        })
      ).toBe(false);
    });

    it('getTaskByGitHubIssue should find matching task', () => {
      useTaskStore.setState({
        tasks: [
          createTestTask({ id: 'task-1', metadata: { githubIssueNumber: 123 } }),
          createTestTask({ id: 'task-2', metadata: { githubIssueNumber: 456 } })
        ]
      });

      const task = getTaskByGitHubIssue(456);

      expect(task?.id).toBe('task-2');
    });

    it('isIncompleteHumanReview should detect incomplete review states', () => {
      expect(
        isIncompleteHumanReview(createTestTask({ status: 'backlog', subtasks: [] }))
      ).toBe(false);

      expect(
        isIncompleteHumanReview(createTestTask({ status: 'human_review', subtasks: [] }))
      ).toBe(true);

      expect(
        isIncompleteHumanReview(
          createTestTask({
            status: 'human_review',
            subtasks: [{ id: 's1', title: 't', description: 'd', status: 'completed', files: [] }]
          })
        )
      ).toBe(false);
    });

    it('getCompletedSubtaskCount and getTaskProgress should compute progress', () => {
      const task = createTestTask({
        subtasks: [
          { id: 's1', title: 't1', description: 'd', status: 'completed', files: [] },
          { id: 's2', title: 't2', description: 'd', status: 'pending', files: [] }
        ]
      });

      expect(getCompletedSubtaskCount(task)).toBe(1);
      expect(getTaskProgress(task)).toEqual({ completed: 1, total: 2, percentage: 50 });
    });
  });
});
