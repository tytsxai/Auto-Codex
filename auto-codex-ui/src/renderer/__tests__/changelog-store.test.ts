/**
 * Unit tests for Changelog Store
 * Tests Zustand store for changelog state management
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useChangelogStore,
  loadChangelogData,
  loadTaskSpecs,
  loadGitData,
  loadCommitsPreview,
  generateChangelog,
  saveChangelog,
  copyChangelogToClipboard,
  getSelectedTasks,
  getTasksWithSpecs,
  canGenerate,
  canSave
} from '../stores/changelog-store';
import { useTaskStore } from '../stores/task-store';
import { useSettingsStore } from '../stores/settings-store';
import { DEFAULT_APP_SETTINGS } from '../../shared/constants';
import type {
  ChangelogTask,
  ExistingChangelog,
  TaskSpecContent,
  GitBranchInfo,
  GitTagInfo,
  GitCommit
} from '../../shared/types';
import type { Task } from '../../shared/types';

const fixedDate = '2024-02-03';

const initialState = {
  doneTasks: [] as ChangelogTask[],
  selectedTaskIds: [] as string[],
  loadedSpecs: [] as TaskSpecContent[],
  existingChangelog: null as ExistingChangelog | null,

  sourceMode: 'tasks' as const,

  branches: [] as GitBranchInfo[],
  tags: [] as GitTagInfo[],
  currentBranch: '',
  defaultBranch: 'main',
  previewCommits: [] as GitCommit[],
  isLoadingGitData: false,
  isLoadingCommits: false,

  gitHistoryType: 'recent' as const,
  gitHistoryCount: 25,
  gitHistorySinceDate: '',
  gitHistoryFromTag: '',
  gitHistoryToTag: '',
  gitHistorySinceVersion: '',
  includeMergeCommits: false,

  baseBranch: '',
  compareBranch: '',

  version: '1.0.0',
  date: fixedDate,
  format: 'keep-a-changelog' as const,
  audience: 'user-facing' as const,
  emojiLevel: 'none' as const,
  customInstructions: '',

  generationProgress: null,
  generatedChangelog: '',
  isGenerating: false,
  error: null as string | null
};

function createChangelogTask(overrides: Partial<ChangelogTask> = {}): ChangelogTask {
  return {
    id: 'task-1',
    specId: 'spec-1',
    title: 'Task Title',
    description: 'Task Description',
    completedAt: new Date('2024-01-01T00:00:00Z'),
    hasSpecs: true,
    ...overrides
  };
}

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    specId: 'spec-1',
    projectId: 'project-1',
    title: 'Task Title',
    description: 'Task Description',
    status: 'done',
    subtasks: [],
    logs: [],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides
  };
}

function createBranch(overrides: Partial<GitBranchInfo> = {}): GitBranchInfo {
  return {
    name: 'main',
    isRemote: false,
    isCurrent: false,
    ...overrides
  };
}

function createTag(overrides: Partial<GitTagInfo> = {}): GitTagInfo {
  return {
    name: 'v1.0.0',
    date: '2024-01-01T00:00:00Z',
    commit: 'abc123',
    ...overrides
  };
}

function createCommit(overrides: Partial<GitCommit> = {}): GitCommit {
  return {
    hash: 'abc1234',
    fullHash: 'abc1234def5678',
    subject: 'feat: add feature',
    author: 'Dev',
    authorEmail: 'dev@example.com',
    date: '2024-01-02T00:00:00Z',
    ...overrides
  };
}

describe('Changelog Store', () => {
  let electronAPI: {
    getChangelogDoneTasks: ReturnType<typeof vi.fn>;
    readExistingChangelog: ReturnType<typeof vi.fn>;
    loadTaskSpecs: ReturnType<typeof vi.fn>;
    getChangelogBranches: ReturnType<typeof vi.fn>;
    getChangelogTags: ReturnType<typeof vi.fn>;
    getChangelogCommitsPreview: ReturnType<typeof vi.fn>;
    generateChangelog: ReturnType<typeof vi.fn>;
    saveChangelog: ReturnType<typeof vi.fn>;
    saveSettings: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${fixedDate}T00:00:00Z`));

    electronAPI = {
      getChangelogDoneTasks: vi.fn(),
      readExistingChangelog: vi.fn(),
      loadTaskSpecs: vi.fn(),
      getChangelogBranches: vi.fn(),
      getChangelogTags: vi.fn(),
      getChangelogCommitsPreview: vi.fn(),
      generateChangelog: vi.fn(),
      saveChangelog: vi.fn(),
      saveSettings: vi.fn().mockResolvedValue({ success: true })
    };

    if (!(globalThis as typeof globalThis & { window?: Window }).window) {
      (globalThis as typeof globalThis & { window: Window }).window = {} as Window;
    }

    if (!(globalThis as typeof globalThis & { navigator?: Navigator }).navigator) {
      (globalThis as typeof globalThis & { navigator: Navigator }).navigator = {} as Navigator;
    }

    (window as Window & { electronAPI: typeof electronAPI }).electronAPI = electronAPI;
    (navigator as Navigator & { clipboard?: { writeText: ReturnType<typeof vi.fn> } }).clipboard = {
      writeText: vi.fn()
    };

    useChangelogStore.setState({ ...initialState });
    useTaskStore.setState({
      tasks: [createTask()],
      selectedTaskId: null,
      isLoading: false,
      error: null
    });
    useSettingsStore.setState({
      settings: {
        ...DEFAULT_APP_SETTINGS,
        changelogFormat: 'simple-list',
        changelogAudience: 'marketing',
        changelogEmojiLevel: 'high'
      },
      isLoading: false,
      error: null
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('state management', () => {
    it('toggles task selection', () => {
      useChangelogStore.getState().toggleTaskSelection('task-1');
      expect(useChangelogStore.getState().selectedTaskIds).toEqual(['task-1']);

      useChangelogStore.getState().toggleTaskSelection('task-1');
      expect(useChangelogStore.getState().selectedTaskIds).toEqual([]);
    });

    it('selects all tasks and clears selections', () => {
      const tasks = [createChangelogTask({ id: 't1' }), createChangelogTask({ id: 't2' })];
      useChangelogStore.setState({ doneTasks: tasks });

      useChangelogStore.getState().selectAllTasks();
      expect(useChangelogStore.getState().selectedTaskIds).toEqual(['t1', 't2']);

      useChangelogStore.getState().deselectAllTasks();
      expect(useChangelogStore.getState().selectedTaskIds).toEqual([]);
    });

    it('auto-increments version when existing changelog has a version', () => {
      useChangelogStore.getState().setExistingChangelog({
        exists: true,
        lastVersion: '2.3.4'
      });

      const state = useChangelogStore.getState();
      expect(state.existingChangelog?.lastVersion).toBe('2.3.4');
      expect(state.version).toBe('2.3.5');
    });

    it('changes source mode and clears preview/error', () => {
      useChangelogStore.setState({ previewCommits: [createCommit()], error: 'Old error' });

      useChangelogStore.getState().setSourceMode('git-history');

      const state = useChangelogStore.getState();
      expect(state.sourceMode).toBe('git-history');
      expect(state.previewCommits).toEqual([]);
      expect(state.error).toBeNull();
    });

    it('sets default branch and auto-fills base branch when empty', () => {
      useChangelogStore.getState().setDefaultBranch('develop');

      const state = useChangelogStore.getState();
      expect(state.defaultBranch).toBe('develop');
      expect(state.baseBranch).toBe('develop');
    });

    it('persists format/audience/emoji level to settings', () => {
      useChangelogStore.getState().setFormat('simple-list');
      useChangelogStore.getState().setAudience('marketing');
      useChangelogStore.getState().setEmojiLevel('high');

      expect(useChangelogStore.getState().format).toBe('simple-list');
      expect(useChangelogStore.getState().audience).toBe('marketing');
      expect(useChangelogStore.getState().emojiLevel).toBe('high');
      expect(electronAPI.saveSettings).toHaveBeenCalledTimes(3);
    });

    it('initializes config from settings store', () => {
      useChangelogStore.getState().initializeFromSettings();

      const state = useChangelogStore.getState();
      expect(state.format).toBe('simple-list');
      expect(state.audience).toBe('marketing');
      expect(state.emojiLevel).toBe('high');
    });

    it('resets state and refreshes the date', () => {
      useChangelogStore.setState({
        doneTasks: [createChangelogTask()],
        selectedTaskIds: ['task-1'],
        format: 'simple-list',
        date: '2024-01-01',
        error: 'Oops'
      });

      useChangelogStore.getState().reset();

      const state = useChangelogStore.getState();
      expect(state.doneTasks).toEqual([]);
      expect(state.selectedTaskIds).toEqual([]);
      expect(state.format).toBe('keep-a-changelog');
      expect(state.date).toBe(fixedDate);
      expect(state.error).toBeNull();
    });
  });

  describe('loadChangelogData', () => {
    it('loads done tasks and existing changelog', async () => {
      const doneTask = createChangelogTask({ id: 'done-1' });
      const existing = { exists: true, lastVersion: '1.2.3' };

      electronAPI.getChangelogDoneTasks.mockResolvedValue({
        success: true,
        data: [doneTask]
      });
      electronAPI.readExistingChangelog.mockResolvedValue({
        success: true,
        data: existing
      });

      await loadChangelogData('project-1');

      const state = useChangelogStore.getState();
      expect(electronAPI.getChangelogDoneTasks).toHaveBeenCalledWith('project-1', [createTask()]);
      expect(electronAPI.readExistingChangelog).toHaveBeenCalledWith('project-1');
      expect(state.doneTasks).toEqual([doneTask]);
      expect(state.existingChangelog).toEqual(existing);
      expect(state.version).toBe('1.2.4');
    });

    it('sets error when loading fails', async () => {
      electronAPI.getChangelogDoneTasks.mockRejectedValue(new Error('Load failed'));

      await loadChangelogData('project-1');

      const state = useChangelogStore.getState();
      expect(state.error).toBe('Load failed');
    });
  });

  describe('loadTaskSpecs', () => {
    it('stores loaded specs', async () => {
      const specs: TaskSpecContent[] = [{ taskId: 'task-1', specId: 'spec-1', spec: 'Spec' }];
      electronAPI.loadTaskSpecs.mockResolvedValue({ success: true, data: specs });

      await loadTaskSpecs('project-1', ['task-1']);

      expect(useChangelogStore.getState().loadedSpecs).toEqual(specs);
    });

    it('sets error when loading specs fails', async () => {
      electronAPI.loadTaskSpecs.mockRejectedValue(new Error('Spec load failed'));

      await loadTaskSpecs('project-1', ['task-1']);

      expect(useChangelogStore.getState().error).toBe('Spec load failed');
    });
  });

  describe('loadGitData', () => {
    it('loads branches/tags and applies defaults', async () => {
      const branches = [
        createBranch({ name: 'main', isCurrent: true }),
        createBranch({ name: 'feature', isCurrent: false })
      ];
      const tags = [createTag({ name: 'v2.0.0' }), createTag({ name: 'v1.9.0' })];

      electronAPI.getChangelogBranches.mockResolvedValue({ success: true, data: branches });
      electronAPI.getChangelogTags.mockResolvedValue({ success: true, data: tags });

      await loadGitData('project-1');

      const state = useChangelogStore.getState();
      expect(state.isLoadingGitData).toBe(false);
      expect(state.branches).toEqual(branches);
      expect(state.tags).toEqual(tags);
      expect(state.currentBranch).toBe('main');
      expect(state.compareBranch).toBe('main');
      expect(state.defaultBranch).toBe('main');
      expect(state.baseBranch).toBe('main');
      expect(state.gitHistoryFromTag).toBe('v2.0.0');
      expect(state.gitHistoryToTag).toBe('v1.9.0');
      expect(state.gitHistorySinceVersion).toBe('v2.0.0');
      expect(state.error).toBeNull();
    });

    it('sets error when loading git data fails', async () => {
      electronAPI.getChangelogBranches.mockRejectedValue(new Error('Git load failed'));

      await loadGitData('project-1');

      const state = useChangelogStore.getState();
      expect(state.error).toBe('Git load failed');
      expect(state.isLoadingGitData).toBe(false);
    });
  });

  describe('loadCommitsPreview', () => {
    it('clears preview in tasks mode', async () => {
      useChangelogStore.setState({ sourceMode: 'tasks', previewCommits: [createCommit()] });

      await loadCommitsPreview('project-1');

      expect(electronAPI.getChangelogCommitsPreview).not.toHaveBeenCalled();
      expect(useChangelogStore.getState().previewCommits).toEqual([]);
      expect(useChangelogStore.getState().isLoadingCommits).toBe(false);
    });

    it('loads commits for git-history mode', async () => {
      useChangelogStore.setState({
        sourceMode: 'git-history',
        gitHistoryType: 'since-version',
        gitHistoryCount: 10,
        gitHistorySinceVersion: 'v1.0.0',
        gitHistoryToTag: 'v1.1.0',
        includeMergeCommits: true
      });

      const commits = [createCommit({ hash: '1234567' })];
      electronAPI.getChangelogCommitsPreview.mockResolvedValue({
        success: true,
        data: commits
      });

      await loadCommitsPreview('project-1');

      expect(electronAPI.getChangelogCommitsPreview).toHaveBeenCalledWith(
        'project-1',
        {
          type: 'since-version',
          count: 10,
          sinceDate: undefined,
          fromTag: 'v1.0.0',
          toTag: 'v1.1.0',
          includeMergeCommits: true
        },
        'git-history'
      );
      expect(useChangelogStore.getState().previewCommits).toEqual(commits);
      expect(useChangelogStore.getState().isLoadingCommits).toBe(false);
    });

    it('handles branch-diff errors and clears preview', async () => {
      useChangelogStore.setState({
        sourceMode: 'branch-diff',
        baseBranch: 'main',
        compareBranch: 'feature'
      });

      electronAPI.getChangelogCommitsPreview.mockResolvedValue({
        success: false,
        error: 'No commits'
      });

      await loadCommitsPreview('project-1');

      expect(electronAPI.getChangelogCommitsPreview).toHaveBeenCalledWith(
        'project-1',
        { baseBranch: 'main', compareBranch: 'feature' },
        'branch-diff'
      );
      expect(useChangelogStore.getState().previewCommits).toEqual([]);
      expect(useChangelogStore.getState().error).toBe('No commits');
      expect(useChangelogStore.getState().isLoadingCommits).toBe(false);
    });
  });

  describe('generateChangelog', () => {
    it('validates task selection before generating', () => {
      useChangelogStore.setState({ sourceMode: 'tasks', selectedTaskIds: [] });

      generateChangelog('project-1');

      expect(useChangelogStore.getState().error).toBe(
        'Please select at least one task to include in the changelog'
      );
      expect(electronAPI.generateChangelog).not.toHaveBeenCalled();
    });

    it('validates git-history before generating', () => {
      useChangelogStore.setState({ sourceMode: 'git-history', previewCommits: [] });

      generateChangelog('project-1');

      expect(useChangelogStore.getState().error).toBe(
        'No commits found for the selected options. Please adjust your filters.'
      );
      expect(electronAPI.generateChangelog).not.toHaveBeenCalled();
    });

    it('starts generation for task mode', () => {
      useChangelogStore.setState({
        sourceMode: 'tasks',
        selectedTaskIds: ['task-1'],
        emojiLevel: 'none'
      });

      generateChangelog('project-1');

      const state = useChangelogStore.getState();
      expect(state.isGenerating).toBe(true);
      expect(state.generationProgress?.stage).toBe('loading_specs');
      expect(electronAPI.generateChangelog).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-1',
          sourceMode: 'tasks',
          taskIds: ['task-1'],
          emojiLevel: undefined
        })
      );
    });
  });

  describe('saveChangelog and clipboard', () => {
    it('blocks save when no generated changelog', async () => {
      const result = await saveChangelog('project-1');

      expect(result).toBe(false);
      expect(useChangelogStore.getState().error).toBe('No changelog to save');
    });

    it('saves changelog when IPC succeeds', async () => {
      useChangelogStore.setState({ generatedChangelog: 'Content' });
      electronAPI.saveChangelog.mockResolvedValue({ success: true });

      const result = await saveChangelog('project-1', 'append');

      expect(result).toBe(true);
      expect(electronAPI.saveChangelog).toHaveBeenCalledWith({
        projectId: 'project-1',
        content: 'Content',
        mode: 'append'
      });
    });

    it('copies changelog to clipboard', () => {
      useChangelogStore.setState({ generatedChangelog: 'Clipboard content' });

      const result = copyChangelogToClipboard();

      expect(result).toBe(true);
      expect(navigator.clipboard?.writeText).toHaveBeenCalledWith('Clipboard content');
    });
  });

  describe('selectors', () => {
    it('selects tasks and filters tasks with specs', () => {
      const tasks = [
        createChangelogTask({ id: 't1', hasSpecs: true }),
        createChangelogTask({ id: 't2', hasSpecs: false })
      ];
      useChangelogStore.setState({ doneTasks: tasks, selectedTaskIds: ['t1'] });

      expect(getSelectedTasks()).toEqual([tasks[0]]);
      expect(getTasksWithSpecs()).toEqual([tasks[0]]);
    });

    it('computes canGenerate and canSave', () => {
      useChangelogStore.setState({ sourceMode: 'tasks', selectedTaskIds: ['t1'] });
      expect(canGenerate()).toBe(true);

      useChangelogStore.setState({
        sourceMode: 'branch-diff',
        baseBranch: 'main',
        compareBranch: 'feature',
        previewCommits: [createCommit()]
      });
      expect(canGenerate()).toBe(true);

      useChangelogStore.setState({ generatedChangelog: 'Content', isGenerating: false });
      expect(canSave()).toBe(true);
    });
  });
});
