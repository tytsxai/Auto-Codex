/**
 * Unit tests for Context Store
 * Tests Zustand store for context state management
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useContextStore,
  loadProjectContext,
  refreshProjectIndex,
  searchMemories,
  loadRecentMemories
} from '../stores/context-store';
import type {
  ProjectIndex,
  GraphitiMemoryStatus,
  GraphitiMemoryState,
  MemoryEpisode,
  ContextSearchResult
} from '../../shared/types';

function createProjectIndex(overrides: Partial<ProjectIndex> = {}): ProjectIndex {
  return {
    project_root: '/tmp/project',
    project_type: 'single',
    services: {},
    infrastructure: {},
    conventions: {},
    ...overrides
  };
}

function createMemoryStatus(overrides: Partial<GraphitiMemoryStatus> = {}): GraphitiMemoryStatus {
  return {
    enabled: true,
    available: true,
    ...overrides
  };
}

function createMemoryState(overrides: Partial<GraphitiMemoryState> = {}): GraphitiMemoryState {
  return {
    initialized: true,
    indices_built: true,
    episode_count: 2,
    error_log: [],
    ...overrides
  };
}

function createMemoryEpisode(overrides: Partial<MemoryEpisode> = {}): MemoryEpisode {
  return {
    id: `mem-${Math.random().toString(36).slice(2)}`,
    type: 'session_insight',
    timestamp: new Date().toISOString(),
    content: 'Memory content',
    ...overrides
  };
}

function createSearchResult(overrides: Partial<ContextSearchResult> = {}): ContextSearchResult {
  return {
    content: 'Result content',
    score: 0.8,
    type: 'session_insight',
    ...overrides
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('Context Store', () => {
  let electronAPI: {
    getProjectContext: ReturnType<typeof vi.fn>;
    refreshProjectIndex: ReturnType<typeof vi.fn>;
    searchMemories: ReturnType<typeof vi.fn>;
    getRecentMemories: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    electronAPI = {
      getProjectContext: vi.fn(),
      refreshProjectIndex: vi.fn(),
      searchMemories: vi.fn(),
      getRecentMemories: vi.fn()
    };

    const globalWithWindow = globalThis as unknown as { window?: Window & typeof globalThis };
    if (!globalWithWindow.window) {
      globalWithWindow.window = {} as unknown as Window & typeof globalThis;
    }

    (window as unknown as { electronAPI: typeof electronAPI }).electronAPI = electronAPI;

    useContextStore.setState({
      projectIndex: null,
      indexLoading: false,
      indexError: null,
      memoryStatus: null,
      memoryState: null,
      memoryLoading: false,
      memoryError: null,
      recentMemories: [],
      memoriesLoading: false,
      searchResults: [],
      searchLoading: false,
      searchQuery: ''
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('state management', () => {
    it('sets state and clears all values', () => {
      const index = createProjectIndex({ project_root: '/repo' });
      const status = createMemoryStatus({ available: false, reason: 'Offline' });
      const state = createMemoryState({ episode_count: 5 });
      const memories = [createMemoryEpisode({ id: 'mem-1' })];
      const results = [createSearchResult({ content: 'hit' })];

      const store = useContextStore.getState();
      store.setProjectIndex(index);
      store.setIndexLoading(true);
      store.setIndexError('Oops');
      store.setMemoryStatus(status);
      store.setMemoryState(state);
      store.setMemoryLoading(true);
      store.setMemoryError('Memory error');
      store.setRecentMemories(memories);
      store.setMemoriesLoading(true);
      store.setSearchResults(results);
      store.setSearchLoading(true);
      store.setSearchQuery('query');

      const updated = useContextStore.getState();
      expect(updated.projectIndex).toEqual(index);
      expect(updated.indexLoading).toBe(true);
      expect(updated.indexError).toBe('Oops');
      expect(updated.memoryStatus).toEqual(status);
      expect(updated.memoryState).toEqual(state);
      expect(updated.memoryLoading).toBe(true);
      expect(updated.memoryError).toBe('Memory error');
      expect(updated.recentMemories).toEqual(memories);
      expect(updated.memoriesLoading).toBe(true);
      expect(updated.searchResults).toEqual(results);
      expect(updated.searchLoading).toBe(true);
      expect(updated.searchQuery).toBe('query');

      updated.clearAll();

      const cleared = useContextStore.getState();
      expect(cleared.projectIndex).toBeNull();
      expect(cleared.indexLoading).toBe(false);
      expect(cleared.indexError).toBeNull();
      expect(cleared.memoryStatus).toBeNull();
      expect(cleared.memoryState).toBeNull();
      expect(cleared.memoryLoading).toBe(false);
      expect(cleared.memoryError).toBeNull();
      expect(cleared.recentMemories).toEqual([]);
      expect(cleared.memoriesLoading).toBe(false);
      expect(cleared.searchResults).toEqual([]);
      expect(cleared.searchLoading).toBe(false);
      expect(cleared.searchQuery).toBe('');
    });
  });

  describe('loadProjectContext', () => {
    it('toggles loading and populates data on success', async () => {
      const deferred = createDeferred<{
        success: boolean;
        data?: {
          projectIndex: ProjectIndex | null;
          memoryStatus: GraphitiMemoryStatus | null;
          memoryState: GraphitiMemoryState | null;
          recentMemories?: MemoryEpisode[];
        };
      }>();

      electronAPI.getProjectContext.mockReturnValue(deferred.promise);

      const promise = loadProjectContext('project-1');
      expect(useContextStore.getState().indexLoading).toBe(true);
      expect(useContextStore.getState().memoryLoading).toBe(true);

      const projectIndex = createProjectIndex();
      const memoryStatus = createMemoryStatus();
      const memoryState = createMemoryState();
      const recentMemories = [createMemoryEpisode({ id: 'mem-1' })];

      deferred.resolve({
        success: true,
        data: {
          projectIndex,
          memoryStatus,
          memoryState,
          recentMemories
        }
      });

      await promise;

      const state = useContextStore.getState();
      expect(state.projectIndex).toEqual(projectIndex);
      expect(state.memoryStatus).toEqual(memoryStatus);
      expect(state.memoryState).toEqual(memoryState);
      expect(state.recentMemories).toEqual(recentMemories);
      expect(state.indexLoading).toBe(false);
      expect(state.memoryLoading).toBe(false);
      expect(state.indexError).toBeNull();
    });

    it('sets indexError when IPC returns failure', async () => {
      electronAPI.getProjectContext.mockResolvedValue({
        success: false,
        error: 'Failed to load'
      });

      await loadProjectContext('project-1');

      const state = useContextStore.getState();
      expect(state.indexError).toBe('Failed to load');
      expect(state.indexLoading).toBe(false);
      expect(state.memoryLoading).toBe(false);
    });

    it('sets indexError when IPC throws', async () => {
      electronAPI.getProjectContext.mockRejectedValue(new Error('Boom'));

      await loadProjectContext('project-1');

      const state = useContextStore.getState();
      expect(state.indexError).toBe('Boom');
      expect(state.indexLoading).toBe(false);
      expect(state.memoryLoading).toBe(false);
    });
  });

  describe('refreshProjectIndex', () => {
    it('sets project index and toggles loading', async () => {
      const deferred = createDeferred<{ success: boolean; data?: ProjectIndex }>();
      electronAPI.refreshProjectIndex.mockReturnValue(deferred.promise);

      const promise = refreshProjectIndex('project-1');
      expect(useContextStore.getState().indexLoading).toBe(true);

      const projectIndex = createProjectIndex({ project_root: '/tmp/refresh' });
      deferred.resolve({ success: true, data: projectIndex });
      await promise;

      const state = useContextStore.getState();
      expect(state.projectIndex).toEqual(projectIndex);
      expect(state.indexLoading).toBe(false);
      expect(state.indexError).toBeNull();
    });

    it('sets indexError when refresh fails', async () => {
      electronAPI.refreshProjectIndex.mockResolvedValue({
        success: false,
        error: 'Refresh failed'
      });

      await refreshProjectIndex('project-1');

      const state = useContextStore.getState();
      expect(state.indexError).toBe('Refresh failed');
      expect(state.indexLoading).toBe(false);
    });
  });

  describe('searchMemories', () => {
    it('clears results for empty query and skips IPC', async () => {
      useContextStore.setState({
        searchResults: [createSearchResult({ content: 'stale' })],
        searchQuery: 'old'
      });

      await searchMemories('project-1', '   ');

      const state = useContextStore.getState();
      expect(state.searchResults).toEqual([]);
      expect(state.searchQuery).toBe('   ');
      expect(state.searchLoading).toBe(false);
      expect(electronAPI.searchMemories).not.toHaveBeenCalled();
    });

    it('sets loading and updates results on success', async () => {
      const deferred = createDeferred<{ success: boolean; data?: ContextSearchResult[] }>();
      electronAPI.searchMemories.mockReturnValue(deferred.promise);

      const promise = searchMemories('project-1', 'query');
      expect(useContextStore.getState().searchLoading).toBe(true);

      const results = [createSearchResult({ content: 'match' })];
      deferred.resolve({ success: true, data: results });
      await promise;

      const state = useContextStore.getState();
      expect(state.searchResults).toEqual(results);
      expect(state.searchLoading).toBe(false);
    });

    it('clears results when IPC returns failure', async () => {
      useContextStore.setState({ searchResults: [createSearchResult()] });
      electronAPI.searchMemories.mockResolvedValue({ success: false });

      await searchMemories('project-1', 'query');

      const state = useContextStore.getState();
      expect(state.searchResults).toEqual([]);
      expect(state.searchLoading).toBe(false);
    });

    it('clears results when IPC throws', async () => {
      useContextStore.setState({ searchResults: [createSearchResult()] });
      electronAPI.searchMemories.mockRejectedValue(new Error('Search failed'));

      await searchMemories('project-1', 'query');

      const state = useContextStore.getState();
      expect(state.searchResults).toEqual([]);
      expect(state.searchLoading).toBe(false);
    });
  });

  describe('loadRecentMemories', () => {
    it('loads recent memories and toggles loading', async () => {
      const deferred = createDeferred<{ success: boolean; data?: MemoryEpisode[] }>();
      electronAPI.getRecentMemories.mockReturnValue(deferred.promise);

      const promise = loadRecentMemories('project-1', 5);
      expect(useContextStore.getState().memoriesLoading).toBe(true);

      const memories = [createMemoryEpisode({ id: 'mem-1' })];
      deferred.resolve({ success: true, data: memories });
      await promise;

      const state = useContextStore.getState();
      expect(state.recentMemories).toEqual(memories);
      expect(state.memoriesLoading).toBe(false);
    });

    it('keeps existing memories when IPC throws', async () => {
      const existing = [createMemoryEpisode({ id: 'mem-keep' })];
      useContextStore.setState({ recentMemories: existing });
      electronAPI.getRecentMemories.mockRejectedValue(new Error('Nope'));

      await loadRecentMemories('project-1');

      const state = useContextStore.getState();
      expect(state.recentMemories).toEqual(existing);
      expect(state.memoriesLoading).toBe(false);
    });
  });
});
