/**
 * Unit tests for Project Store
 * Tests Zustand store for project state management
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useProjectStore,
  loadProjects,
  addProject
} from '../stores/project-store';
import type { Project, ProjectSettings } from '../../shared/types';

const defaultSettings: ProjectSettings = {
  model: 'gpt-4.1-mini',
  memoryBackend: 'file',
  linearSync: false,
  notifications: {
    onTaskComplete: false,
    onTaskFailed: false,
    onReviewNeeded: false,
    sound: false
  },
  graphitiMcpEnabled: false
};

function createTestProject(overrides: Partial<Project> = {}): Project {
  return {
    id: `project-${Math.random().toString(36).slice(2)}`,
    name: 'Test Project',
    path: '/tmp/test-project',
    autoBuildPath: '.auto-codex',
    settings: defaultSettings,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

describe('Project Store', () => {
  let electronAPI: {
    getProjects: ReturnType<typeof vi.fn>;
    addProject: ReturnType<typeof vi.fn>;
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
      getProjects: vi.fn(),
      addProject: vi.fn()
    };

    const globalWithWindow = globalThis as unknown as { window?: Window & typeof globalThis };
    if (!globalWithWindow.window) {
      globalWithWindow.window = {} as unknown as Window & typeof globalThis;
    }

    (window as unknown as { electronAPI: typeof electronAPI }).electronAPI = electronAPI;
    (globalThis as typeof globalThis & { localStorage?: Storage }).localStorage = localStorageMock as Storage;
    localStorageMock.clear();

    useProjectStore.setState({
      projects: [],
      selectedProjectId: null,
      isLoading: false,
      error: null
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('store state', () => {
    it('sets projects and returns selected project', () => {
      const projectA = createTestProject({ id: 'project-a' });
      const projectB = createTestProject({ id: 'project-b' });

      useProjectStore.getState().setProjects([projectA, projectB]);
      useProjectStore.getState().selectProject('project-b');

      const state = useProjectStore.getState();
      expect(state.projects).toHaveLength(2);
      expect(state.selectedProjectId).toBe('project-b');
      expect(state.getSelectedProject()?.id).toBe('project-b');
      expect(localStorage.getItem('lastSelectedProjectId')).toBe('project-b');
    });

    it('clears selection when selectProject(null) is called', () => {
      useProjectStore.getState().selectProject('project-a');
      useProjectStore.getState().selectProject(null);

      expect(useProjectStore.getState().selectedProjectId).toBeNull();
      expect(localStorage.getItem('lastSelectedProjectId')).toBeNull();
    });
  });

  describe('loadProjects', () => {
    it('loads projects and restores last selected project when present', async () => {
      const projectA = createTestProject({ id: 'project-a' });
      const projectB = createTestProject({ id: 'project-b' });
      localStorage.setItem('lastSelectedProjectId', 'project-b');

      electronAPI.getProjects.mockResolvedValue({
        success: true,
        data: [projectA, projectB]
      });

      await loadProjects();

      const state = useProjectStore.getState();
      expect(state.projects).toHaveLength(2);
      expect(state.selectedProjectId).toBe('project-b');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('selects first project if last selected project does not exist', async () => {
      const projectA = createTestProject({ id: 'project-a' });
      const projectB = createTestProject({ id: 'project-b' });
      localStorage.setItem('lastSelectedProjectId', 'missing');

      electronAPI.getProjects.mockResolvedValue({
        success: true,
        data: [projectA, projectB]
      });

      await loadProjects();

      expect(useProjectStore.getState().selectedProjectId).toBe('project-a');
    });

    it('sets error when IPC returns failure', async () => {
      electronAPI.getProjects.mockResolvedValue({
        success: false,
        error: 'IPC failed'
      });

      await loadProjects();

      expect(useProjectStore.getState().error).toBe('IPC failed');
      expect(useProjectStore.getState().isLoading).toBe(false);
    });

    it('sets error when IPC throws', async () => {
      electronAPI.getProjects.mockRejectedValue(new Error('Boom'));

      await loadProjects();

      expect(useProjectStore.getState().error).toBe('Boom');
      expect(useProjectStore.getState().isLoading).toBe(false);
    });
  });

  describe('addProject', () => {
    it('adds project and selects it on success', async () => {
      const project = createTestProject({ id: 'project-123' });

      electronAPI.addProject.mockResolvedValue({
        success: true,
        data: project
      });

      const result = await addProject('/path/to/project');

      expect(result).toEqual(project);
      expect(useProjectStore.getState().projects).toHaveLength(1);
      expect(useProjectStore.getState().selectedProjectId).toBe('project-123');
      expect(localStorage.getItem('lastSelectedProjectId')).toBe('project-123');
    });

    it('sets error when IPC returns failure', async () => {
      electronAPI.addProject.mockResolvedValue({
        success: false,
        error: 'Add failed'
      });

      const result = await addProject('/path/to/project');

      expect(result).toBeNull();
      expect(useProjectStore.getState().error).toBe('Add failed');
    });

    it('sets error when IPC throws', async () => {
      electronAPI.addProject.mockRejectedValue(new Error('Add boom'));

      const result = await addProject('/path/to/project');

      expect(result).toBeNull();
      expect(useProjectStore.getState().error).toBe('Add boom');
    });
  });
});
