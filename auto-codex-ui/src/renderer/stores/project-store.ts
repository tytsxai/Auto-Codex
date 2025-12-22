import { create } from 'zustand';
import type { Project, ProjectSettings, AutoBuildVersionInfo, InitializationResult } from '../../shared/types';

// 用于持久化最后选中项目的 localStorage 键
const LAST_SELECTED_PROJECT_KEY = 'lastSelectedProjectId';

interface ProjectState {
  projects: Project[];
  selectedProjectId: string | null;
  isLoading: boolean;
  error: string | null;

  // 操作
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  removeProject: (projectId: string) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  selectProject: (projectId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // 选择器
  getSelectedProject: () => Project | undefined;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  selectedProjectId: null,
  isLoading: false,
  error: null,

  setProjects: (projects) => set({ projects }),

  addProject: (project) =>
    set((state) => ({
      projects: [...state.projects, project]
    })),

  removeProject: (projectId) =>
    set((state) => {
      const isSelectedProject = state.selectedProjectId === projectId;
      // 如果移除的是当前选中项目，则清除 localStorage
      if (isSelectedProject) {
        localStorage.removeItem(LAST_SELECTED_PROJECT_KEY);
      }
      return {
        projects: state.projects.filter((p) => p.id !== projectId),
        selectedProjectId: isSelectedProject ? null : state.selectedProjectId
      };
    }),

  updateProject: (projectId, updates) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, ...updates } : p
      )
    })),

  selectProject: (projectId) => {
    // 持久化到 localStorage 以便应用重载时恢复
    if (projectId) {
      localStorage.setItem(LAST_SELECTED_PROJECT_KEY, projectId);
    } else {
      localStorage.removeItem(LAST_SELECTED_PROJECT_KEY);
    }
    set({ selectedProjectId: projectId });
  },

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  getSelectedProject: () => {
    const state = get();
    return state.projects.find((p) => p.id === state.selectedProjectId);
  }
}));

/**
 * 从主进程加载项目
 */
export async function loadProjects(): Promise<void> {
  const store = useProjectStore.getState();
  store.setLoading(true);
  store.setError(null);

  try {
    const result = await window.electronAPI.getProjects();
    if (result.success && result.data) {
      store.setProjects(result.data);

      // 从 localStorage 恢复上次选中的项目，或回退到第一个项目
      if (!store.selectedProjectId && result.data.length > 0) {
        const lastSelectedId = localStorage.getItem(LAST_SELECTED_PROJECT_KEY);
        const projectExists = lastSelectedId && result.data.some((p) => p.id === lastSelectedId);

        if (projectExists) {
          store.selectProject(lastSelectedId);
        } else {
          store.selectProject(result.data[0].id);
        }
      }
    } else {
      store.setError(result.error || 'Failed to load projects');
    }
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    store.setLoading(false);
  }
}

/**
 * 添加新项目
 */
export async function addProject(projectPath: string): Promise<Project | null> {
  const store = useProjectStore.getState();

  try {
    const result = await window.electronAPI.addProject(projectPath);
    if (result.success && result.data) {
      store.addProject(result.data);
      store.selectProject(result.data.id);
      return result.data;
    } else {
      store.setError(result.error || 'Failed to add project');
      return null;
    }
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * 移除项目
 */
export async function removeProject(projectId: string): Promise<boolean> {
  const store = useProjectStore.getState();

  try {
    const result = await window.electronAPI.removeProject(projectId);
    if (result.success) {
      store.removeProject(projectId);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 更新项目设置
 */
export async function updateProjectSettings(
  projectId: string,
  settings: Partial<ProjectSettings>
): Promise<boolean> {
  const store = useProjectStore.getState();

  try {
    const result = await window.electronAPI.updateProjectSettings(
      projectId,
      settings
    );
    if (result.success) {
      const project = store.projects.find((p) => p.id === projectId);
      if (project) {
        store.updateProject(projectId, {
          settings: { ...project.settings, ...settings }
        });
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 检查项目的 auto-codex 版本状态
 */
export async function checkProjectVersion(
  projectId: string
): Promise<AutoBuildVersionInfo | null> {
  try {
    const result = await window.electronAPI.checkProjectVersion(projectId);
    if (result.success && result.data) {
      return result.data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 在项目中初始化 auto-codex
 */
export async function initializeProject(
  projectId: string
): Promise<InitializationResult | null> {
  const store = useProjectStore.getState();

  try {
    if (window.DEBUG) console.warn('[ProjectStore] initializeProject called for:', projectId);
    const result = await window.electronAPI.initializeProject(projectId);
    if (window.DEBUG) console.warn('[ProjectStore] IPC result:', result);

    // Note: some IPC handlers return operation status inside `result.data.success`
    // (and may set IPC `result.success` to false for expected operation failures).
    // Always prefer the structured data when present so the UI can show the real error.
    if (result.data) {
      if (window.DEBUG) console.warn('[ProjectStore] IPC returned data:', result.data);
      // 在本地状态中更新项目的 autoBuildPath
      if (result.data.success) {
        if (window.DEBUG) console.warn('[ProjectStore] Updating project autoBuildPath to .auto-codex');
        store.updateProject(projectId, { autoBuildPath: '.auto-codex' });
      } else {
        if (window.DEBUG) console.warn('[ProjectStore] result.data.success is false, not updating project');
      }
      return result.data;
    }
    if (window.DEBUG) console.warn('[ProjectStore] IPC failed or no data, setting error');
    store.setError(result.error || 'Failed to initialize project');
    return null;
  } catch (error) {
    console.error('[ProjectStore] Exception during initializeProject:', error);
    store.setError(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * 在项目中更新 auto-codex
 */
export async function updateProjectAutoBuild(
  projectId: string
): Promise<InitializationResult | null> {
  const store = useProjectStore.getState();

  try {
    const result = await window.electronAPI.updateProjectAutoBuild(projectId);
    if (result.success && result.data) {
      return result.data;
    }
    store.setError(result.error || 'Failed to update auto-codex');
    return null;
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}
