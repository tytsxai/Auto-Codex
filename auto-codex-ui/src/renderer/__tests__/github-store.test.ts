/**
 * Unit tests for GitHub Store
 * Tests Zustand store for GitHub integration state management
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useGitHubStore,
  loadGitHubIssues,
  checkGitHubConnection,
  investigateGitHubIssue,
  importGitHubIssues
} from '../stores/github-store';
import type { GitHubIssue, GitHubSyncStatus } from '../../shared/types';

function createIssue(overrides: Partial<GitHubIssue> = {}): GitHubIssue {
  return {
    id: 1,
    number: 123,
    title: 'Test Issue',
    body: 'Issue body',
    state: 'open',
    labels: [],
    assignees: [],
    author: { login: 'octocat' },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    commentsCount: 0,
    url: 'https://api.github.com/repos/org/repo/issues/123',
    htmlUrl: 'https://github.com/org/repo/issues/123',
    repoFullName: 'org/repo',
    ...overrides
  };
}

describe('GitHub Store', () => {
  let electronAPI: {
    getGitHubIssues: ReturnType<typeof vi.fn>;
    checkGitHubConnection: ReturnType<typeof vi.fn>;
    investigateGitHubIssue: ReturnType<typeof vi.fn>;
    importGitHubIssues: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    electronAPI = {
      getGitHubIssues: vi.fn(),
      checkGitHubConnection: vi.fn(),
      investigateGitHubIssue: vi.fn(),
      importGitHubIssues: vi.fn()
    };

    const globalWithWindow = globalThis as unknown as { window?: Window & typeof globalThis };
    if (!globalWithWindow.window) {
      globalWithWindow.window = {} as unknown as Window & typeof globalThis;
    }

    (window as unknown as { electronAPI: typeof electronAPI }).electronAPI = electronAPI;

    useGitHubStore.setState({
      issues: [],
      syncStatus: null,
      isLoading: false,
      error: null,
      selectedIssueNumber: null,
      filterState: 'open',
      investigationStatus: { phase: 'idle', progress: 0, message: '' },
      lastInvestigationResult: null
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('state management', () => {
    it('sets issues and clears error', () => {
      useGitHubStore.setState({ error: 'Old error' });
      const issue = createIssue({ number: 1 });

      useGitHubStore.getState().setIssues([issue]);

      expect(useGitHubStore.getState().issues).toHaveLength(1);
      expect(useGitHubStore.getState().error).toBeNull();
    });

    it('adds issue to the front and de-duplicates by number', () => {
      const existing = createIssue({ number: 101, title: 'Old' });
      useGitHubStore.setState({ issues: [existing] });

      useGitHubStore.getState().addIssue(createIssue({ number: 101, title: 'New' }));

      const issues = useGitHubStore.getState().issues;
      expect(issues).toHaveLength(1);
      expect(issues[0].title).toBe('New');
    });

    it('updates an issue by number', () => {
      const issue = createIssue({ number: 42, title: 'Before' });
      useGitHubStore.setState({ issues: [issue] });

      useGitHubStore.getState().updateIssue(42, { title: 'After', state: 'closed' });

      const updated = useGitHubStore.getState().issues[0];
      expect(updated.title).toBe('After');
      expect(updated.state).toBe('closed');
    });

    it('selects and returns the selected issue', () => {
      const issueA = createIssue({ number: 1, title: 'A' });
      const issueB = createIssue({ number: 2, title: 'B' });
      useGitHubStore.setState({ issues: [issueA, issueB] });

      useGitHubStore.getState().selectIssue(2);

      expect(useGitHubStore.getState().selectedIssueNumber).toBe(2);
      expect(useGitHubStore.getState().getSelectedIssue()?.title).toBe('B');
    });

    it('filters issues and counts open issues', () => {
      const openIssue = createIssue({ number: 1, state: 'open' });
      const closedIssue = createIssue({ number: 2, state: 'closed' });
      useGitHubStore.setState({ issues: [openIssue, closedIssue] });

      useGitHubStore.getState().setFilterState('closed');

      const filtered = useGitHubStore.getState().getFilteredIssues();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].number).toBe(2);
      expect(useGitHubStore.getState().getOpenIssuesCount()).toBe(1);
    });

    it('clears issues and investigation state', () => {
      useGitHubStore.setState({
        issues: [createIssue()],
        syncStatus: { connected: true },
        selectedIssueNumber: 1,
        error: 'Problem',
        investigationStatus: { phase: 'fetching', progress: 25, message: 'Working' },
        lastInvestigationResult: {
          success: true,
          issueNumber: 1,
          analysis: {
            summary: 'Summary',
            proposedSolution: 'Solution',
            affectedFiles: ['a.ts'],
            estimatedComplexity: 'simple',
            acceptanceCriteria: ['Done']
          }
        }
      });

      useGitHubStore.getState().clearIssues();

      const state = useGitHubStore.getState();
      expect(state.issues).toEqual([]);
      expect(state.syncStatus).toBeNull();
      expect(state.selectedIssueNumber).toBeNull();
      expect(state.error).toBeNull();
      expect(state.investigationStatus.phase).toBe('idle');
      expect(state.lastInvestigationResult).toBeNull();
    });
  });

  describe('loadGitHubIssues', () => {
    it('clears error and sets issues on success', async () => {
      useGitHubStore.setState({ error: 'Old error' });
      const issue = createIssue({ number: 5 });
      electronAPI.getGitHubIssues.mockResolvedValue({ success: true, data: [issue] });

      await loadGitHubIssues('project-1', 'open');

      expect(electronAPI.getGitHubIssues).toHaveBeenCalledWith('project-1', 'open');
      expect(useGitHubStore.getState().issues).toHaveLength(1);
      expect(useGitHubStore.getState().issues[0].number).toBe(5);
      expect(useGitHubStore.getState().isLoading).toBe(false);
      expect(useGitHubStore.getState().error).toBeNull();
    });

    it('sets error when IPC returns failure', async () => {
      electronAPI.getGitHubIssues.mockResolvedValue({ success: false, error: 'Load failed' });

      await loadGitHubIssues('project-1');

      expect(useGitHubStore.getState().error).toBe('Load failed');
      expect(useGitHubStore.getState().isLoading).toBe(false);
    });

    it('sets error when IPC throws', async () => {
      electronAPI.getGitHubIssues.mockRejectedValue(new Error('Boom'));

      await loadGitHubIssues('project-1');

      expect(useGitHubStore.getState().error).toBe('Boom');
      expect(useGitHubStore.getState().isLoading).toBe(false);
    });
  });

  describe('checkGitHubConnection', () => {
    it('sets sync status when IPC succeeds', async () => {
      const status: GitHubSyncStatus = { connected: true, repoFullName: 'org/repo' };
      electronAPI.checkGitHubConnection.mockResolvedValue({ success: true, data: status });

      const result = await checkGitHubConnection('project-1');

      expect(result).toEqual(status);
      expect(useGitHubStore.getState().syncStatus).toEqual(status);
    });

    it('sets error when IPC returns failure', async () => {
      electronAPI.checkGitHubConnection.mockResolvedValue({ success: false, error: 'Nope' });

      const result = await checkGitHubConnection('project-1');

      expect(result).toBeNull();
      expect(useGitHubStore.getState().error).toBe('Nope');
    });

    it('sets error when IPC throws', async () => {
      electronAPI.checkGitHubConnection.mockRejectedValue(new Error('Bad'));

      const result = await checkGitHubConnection('project-1');

      expect(result).toBeNull();
      expect(useGitHubStore.getState().error).toBe('Bad');
    });
  });

  describe('investigateGitHubIssue', () => {
    it('sets investigation status and calls IPC', () => {
      useGitHubStore.setState({
        investigationStatus: { phase: 'idle', progress: 0, message: '' },
        lastInvestigationResult: { success: false, issueNumber: 1, analysis: {
          summary: 'Old',
          proposedSolution: 'Old',
          affectedFiles: [],
          estimatedComplexity: 'simple',
          acceptanceCriteria: []
        } }
      });

      investigateGitHubIssue('project-1', 99, [1, 2]);

      const state = useGitHubStore.getState();
      expect(state.investigationStatus.phase).toBe('fetching');
      expect(state.investigationStatus.issueNumber).toBe(99);
      expect(state.lastInvestigationResult).toBeNull();
      expect(electronAPI.investigateGitHubIssue).toHaveBeenCalledWith('project-1', 99, [1, 2]);
    });
  });

  describe('importGitHubIssues', () => {
    it('returns true when import succeeds', async () => {
      electronAPI.importGitHubIssues.mockResolvedValue({ success: true });

      const result = await importGitHubIssues('project-1', [1, 2]);

      expect(result).toBe(true);
      expect(useGitHubStore.getState().isLoading).toBe(false);
    });

    it('sets error when IPC returns failure', async () => {
      electronAPI.importGitHubIssues.mockResolvedValue({ success: false, error: 'Import failed' });

      const result = await importGitHubIssues('project-1', [1]);

      expect(result).toBe(false);
      expect(useGitHubStore.getState().error).toBe('Import failed');
      expect(useGitHubStore.getState().isLoading).toBe(false);
    });

    it('sets error when IPC throws', async () => {
      electronAPI.importGitHubIssues.mockRejectedValue(new Error('Crash'));

      const result = await importGitHubIssues('project-1', [1]);

      expect(result).toBe(false);
      expect(useGitHubStore.getState().error).toBe('Crash');
      expect(useGitHubStore.getState().isLoading).toBe(false);
    });
  });
});
