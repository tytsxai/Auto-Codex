import { create } from 'zustand';
import type {
  IdeationSession,
  Idea,
  IdeationStatus,
  IdeationGenerationStatus,
  IdeationType,
  IdeationConfig,
  IdeationSummary
} from '../../shared/types';
import { DEFAULT_IDEATION_CONFIG } from '../../shared/constants';

// 跟踪并行生成期间各个创意类型的状态
export type IdeationTypeState = 'pending' | 'generating' | 'completed' | 'failed';

interface IdeationState {
  // 数据
  session: IdeationSession | null;
  generationStatus: IdeationGenerationStatus;
  config: IdeationConfig;
  logs: string[];
  // 跟踪创意类型处于待处理、生成中、已完成或失败的状态
  typeStates: Record<IdeationType, IdeationTypeState>;
  // 选择状态
  selectedIds: Set<string>;

  // 操作
  setSession: (session: IdeationSession | null) => void;
  setGenerationStatus: (status: IdeationGenerationStatus) => void;
  setConfig: (config: Partial<IdeationConfig>) => void;
  updateIdeaStatus: (ideaId: string, status: IdeationStatus) => void;
  setIdeaTaskId: (ideaId: string, taskId: string) => void;
  dismissIdea: (ideaId: string) => void;
  dismissAllIdeas: () => void;
  archiveIdea: (ideaId: string) => void;
  deleteIdea: (ideaId: string) => void;
  deleteMultipleIdeas: (ideaIds: string[]) => void;
  clearSession: () => void;
  addLog: (log: string) => void;
  clearLogs: () => void;
  // 选择相关操作
  toggleSelectIdea: (ideaId: string) => void;
  selectAllIdeas: (ideaIds: string[]) => void;
  clearSelection: () => void;
  // 用于流式并行结果的新操作
  initializeTypeStates: (types: IdeationType[]) => void;
  setTypeState: (type: IdeationType, state: IdeationTypeState) => void;
  addIdeasForType: (ideationType: string, ideas: Idea[]) => void;
}

const initialGenerationStatus: IdeationGenerationStatus = {
  phase: 'idle',
  progress: 0,
  message: ''
};

const initialConfig: IdeationConfig = {
  enabledTypes: [...DEFAULT_IDEATION_CONFIG.enabledTypes] as IdeationType[],
  includeRoadmapContext: DEFAULT_IDEATION_CONFIG.includeRoadmapContext,
  includeKanbanContext: DEFAULT_IDEATION_CONFIG.includeKanbanContext,
  maxIdeasPerType: DEFAULT_IDEATION_CONFIG.maxIdeasPerType
};

/**
 * 检查所有启用的创意类型是否都已完成（completed 或 failed）
 * @param typeStates 当前所有类型的状态
 * @param enabledTypes 启用的类型列表
 * @returns 如果所有启用的类型都已完成则返回 true
 */
export function areAllTypesComplete(
  typeStates: Record<IdeationType, IdeationTypeState>,
  enabledTypes: IdeationType[]
): boolean {
  return enabledTypes.every(
    (type) => typeStates[type] === 'completed' || typeStates[type] === 'failed'
  );
}

// 初始化所有类型状态为 'pending'（生成开始时会设置）
// 注意：high_value_features 已移除，low_hanging_fruit 更名为 code_improvements
const initialTypeStates: Record<IdeationType, IdeationTypeState> = {
  code_improvements: 'pending',
  ui_ux_improvements: 'pending',
  documentation_gaps: 'pending',
  security_hardening: 'pending',
  performance_optimizations: 'pending',
  code_quality: 'pending'
};

export const useIdeationStore = create<IdeationState>((set) => ({
  // 初始状态
  session: null,
  generationStatus: initialGenerationStatus,
  config: initialConfig,
  logs: [],
  typeStates: { ...initialTypeStates },
  selectedIds: new Set<string>(),

  // 操作
  setSession: (session) => set({ session }),

  setGenerationStatus: (status) => set({ generationStatus: status }),

  setConfig: (newConfig) =>
    set((state) => ({
      config: { ...state.config, ...newConfig }
    })),

  updateIdeaStatus: (ideaId, status) =>
    set((state) => {
      if (!state.session) return state;

      const updatedIdeas = state.session.ideas.map((idea) =>
        idea.id === ideaId ? { ...idea, status } : idea
      );

      return {
        session: {
          ...state.session,
          ideas: updatedIdeas,
          updatedAt: new Date()
        }
      };
    }),

  setIdeaTaskId: (ideaId, taskId) =>
    set((state) => {
      if (!state.session) return state;

      const updatedIdeas = state.session.ideas.map((idea) =>
        idea.id === ideaId
          ? { ...idea, taskId, status: 'archived' as IdeationStatus }
          : idea
      );

      return {
        session: {
          ...state.session,
          ideas: updatedIdeas,
          updatedAt: new Date()
        }
      };
    }),

  dismissIdea: (ideaId) =>
    set((state) => {
      if (!state.session) return state;

      const updatedIdeas = state.session.ideas.map((idea) =>
        idea.id === ideaId ? { ...idea, status: 'dismissed' as IdeationStatus } : idea
      );

      return {
        session: {
          ...state.session,
          ideas: updatedIdeas,
          updatedAt: new Date()
        }
      };
    }),

  dismissAllIdeas: () =>
    set((state) => {
      if (!state.session) return state;

      const updatedIdeas = state.session.ideas.map((idea) =>
        idea.status !== 'dismissed' && idea.status !== 'converted' && idea.status !== 'archived'
          ? { ...idea, status: 'dismissed' as IdeationStatus }
          : idea
      );

      return {
        session: {
          ...state.session,
          ideas: updatedIdeas,
          updatedAt: new Date()
        }
      };
    }),

  archiveIdea: (ideaId) =>
    set((state) => {
      if (!state.session) return state;

      const updatedIdeas = state.session.ideas.map((idea) =>
        idea.id === ideaId ? { ...idea, status: 'archived' as IdeationStatus } : idea
      );

      return {
        session: {
          ...state.session,
          ideas: updatedIdeas,
          updatedAt: new Date()
        }
      };
    }),

  deleteIdea: (ideaId) =>
    set((state) => {
      if (!state.session) return state;

      const updatedIdeas = state.session.ideas.filter((idea) => idea.id !== ideaId);

      // 如果已选中，也从选择中移除
      const newSelectedIds = new Set(state.selectedIds);
      newSelectedIds.delete(ideaId);

      return {
        session: {
          ...state.session,
          ideas: updatedIdeas,
          updatedAt: new Date()
        },
        selectedIds: newSelectedIds
      };
    }),

  deleteMultipleIdeas: (ideaIds) =>
    set((state) => {
      if (!state.session) return state;

      const idsToDelete = new Set(ideaIds);
      const updatedIdeas = state.session.ideas.filter((idea) => !idsToDelete.has(idea.id));

      // 清除已删除条目的选择
      const newSelectedIds = new Set(state.selectedIds);
      ideaIds.forEach((id) => newSelectedIds.delete(id));

      return {
        session: {
          ...state.session,
          ideas: updatedIdeas,
          updatedAt: new Date()
        },
        selectedIds: newSelectedIds
      };
    }),

  clearSession: () =>
    set({
      session: null,
      generationStatus: initialGenerationStatus,
      typeStates: { ...initialTypeStates },
      selectedIds: new Set<string>()
    }),

  addLog: (log) =>
    set((state) => ({
      logs: [...state.logs, log].slice(-100) // 保留最近 100 条日志
    })),

  clearLogs: () => set({ logs: [] }),

  // 选择相关操作
  toggleSelectIdea: (ideaId) =>
    set((state) => {
      const newSelectedIds = new Set(state.selectedIds);
      if (newSelectedIds.has(ideaId)) {
        newSelectedIds.delete(ideaId);
      } else {
        newSelectedIds.add(ideaId);
      }
      return { selectedIds: newSelectedIds };
    }),

  selectAllIdeas: (ideaIds) =>
    set(() => ({
      selectedIds: new Set(ideaIds)
    })),

  clearSelection: () =>
    set(() => ({
      selectedIds: new Set<string>()
    })),

  // 在开始生成时初始化类型状态
  initializeTypeStates: (types) =>
    set((_state) => {
      const newTypeStates = { ...initialTypeStates };
      // 将所有启用的类型设为 'generating'
      types.forEach((type) => {
        newTypeStates[type] = 'generating';
      });
      // 将所有禁用的类型设为 'pending'（不会生成）
      Object.keys(newTypeStates).forEach((type) => {
        if (!types.includes(type as IdeationType)) {
          newTypeStates[type as IdeationType] = 'pending';
        }
      });
      return { typeStates: newTypeStates };
    }),

  // 更新单个类型状态
  setTypeState: (type, state) =>
    set((prevState) => {
      const newTypeStates = { ...prevState.typeStates, [type]: state };
      
      // 检查是否所有启用的类型都已完成，如果是则自动更新生成状态
      const config = prevState.config;
      const allComplete = areAllTypesComplete(newTypeStates, config.enabledTypes);
      const newGenerationStatus = allComplete
        ? { phase: 'complete' as const, progress: 100, message: 'Ideation complete' }
        : prevState.generationStatus;
      
      return {
        typeStates: newTypeStates,
        generationStatus: newGenerationStatus
      };
    }),

  // 为特定类型添加想法（流式更新）
  addIdeasForType: (ideationType, ideas) =>
    set((state) => {
      // 将类型状态更新为 completed
      const newTypeStates = { ...state.typeStates };
      newTypeStates[ideationType as IdeationType] = 'completed';

      const config = state.config;
      
      // 检查是否所有启用的类型都已完成，如果是则自动更新生成状态
      const allComplete = areAllTypesComplete(newTypeStates, config.enabledTypes);
      const newGenerationStatus = allComplete
        ? { phase: 'complete' as const, progress: 100, message: 'Ideation complete' }
        : state.generationStatus;

      // 如果尚无会话，则创建一个部分会话
      if (!state.session) {
        return {
          typeStates: newTypeStates,
          generationStatus: newGenerationStatus,
          session: {
            id: `session-${Date.now()}`,
            projectId: '', // 将在最终会话中设置
            config,
            ideas,
            projectContext: {
              existingFeatures: [],
              techStack: [],
              plannedFeatures: []
            },
            generatedAt: new Date(),
            updatedAt: new Date()
          }
        };
      }

      // 将新想法与现有想法合并（按 id 避免重复）
      const existingIds = new Set(state.session.ideas.map((i) => i.id));
      const newIdeas = ideas.filter((idea) => !existingIds.has(idea.id));

      return {
        typeStates: newTypeStates,
        generationStatus: newGenerationStatus,
        session: {
          ...state.session,
          ideas: [...state.session.ideas, ...newIdeas],
          updatedAt: new Date()
        }
      };
    })
}));

// 加载创意的辅助函数
export async function loadIdeation(projectId: string): Promise<void> {
  const result = await window.electronAPI.getIdeation(projectId);
  if (result.success && result.data) {
    useIdeationStore.getState().setSession(result.data);
  } else {
    useIdeationStore.getState().setSession(null);
  }
}

export function generateIdeation(projectId: string): void {
  const store = useIdeationStore.getState();
  const config = store.config;

  // 调试日志
  if (window.DEBUG) {
    console.warn('[Ideation] Starting generation:', {
      projectId,
      enabledTypes: config.enabledTypes,
      includeRoadmapContext: config.includeRoadmapContext,
      includeKanbanContext: config.includeKanbanContext,
      maxIdeasPerType: config.maxIdeasPerType
    });
  }

  store.clearLogs();
  store.clearSession(); // 清除现有会话以重新生成
  store.initializeTypeStates(config.enabledTypes);
  store.addLog('Starting ideation generation in parallel...');
  store.setGenerationStatus({
    phase: 'generating',
    progress: 0,
    message: `Generating ${config.enabledTypes.length} ideation types in parallel...`
  });
  window.electronAPI.generateIdeation(projectId, config);
}

export async function stopIdeation(projectId: string): Promise<boolean> {
  const store = useIdeationStore.getState();

  // 调试日志
  if (window.DEBUG) {
    console.warn('[Ideation] Stop requested:', { projectId });
  }

  // 无论后端响应如何，用户请求停止时始终将 UI 状态更新为 'idle'
  // 这可防止进程已结束时 UI 卡在“生成中”状态
  store.addLog('Stopping ideation generation...');
  store.setGenerationStatus({
    phase: 'idle',
    progress: 0,
    message: 'Generation stopped'
  });

  const result = await window.electronAPI.stopIdeation(projectId);

  // 调试日志
  if (window.DEBUG) {
    console.warn('[Ideation] Stop result:', { projectId, success: result.success });
  }

  if (!result.success) {
    // 后端找不到/无法停止该进程（可能已完成/崩溃）
    store.addLog('Process already stopped');
  } else {
    store.addLog('Ideation generation stopped');
  }

  return result.success;
}

export async function refreshIdeation(projectId: string): Promise<void> {
  const store = useIdeationStore.getState();
  const config = store.config;

  // 先停止任何正在进行的生成
  await window.electronAPI.stopIdeation(projectId);

  store.clearLogs();
  store.clearSession(); // 清除现有会话以重新生成
  store.initializeTypeStates(config.enabledTypes);
  store.addLog('Refreshing ideation in parallel...');
  store.setGenerationStatus({
    phase: 'generating',
    progress: 0,
    message: `Refreshing ${config.enabledTypes.length} ideation types in parallel...`
  });
  window.electronAPI.refreshIdeation(projectId, config);
}

export async function dismissAllIdeasForProject(projectId: string): Promise<boolean> {
  const store = useIdeationStore.getState();
  const result = await window.electronAPI.dismissAllIdeas(projectId);
  if (result.success) {
    store.dismissAllIdeas();
    store.addLog('All ideas dismissed');
  }
  return result.success;
}

export async function archiveIdeaForProject(projectId: string, ideaId: string): Promise<boolean> {
  const store = useIdeationStore.getState();
  const result = await window.electronAPI.archiveIdea(projectId, ideaId);
  if (result.success) {
    store.archiveIdea(ideaId);
    store.addLog('Idea archived');
  }
  return result.success;
}

export async function deleteIdeaForProject(projectId: string, ideaId: string): Promise<boolean> {
  const store = useIdeationStore.getState();
  const result = await window.electronAPI.deleteIdea(projectId, ideaId);
  if (result.success) {
    store.deleteIdea(ideaId);
    store.addLog('Idea deleted');
  }
  return result.success;
}

export async function deleteMultipleIdeasForProject(projectId: string, ideaIds: string[]): Promise<boolean> {
  const store = useIdeationStore.getState();
  const result = await window.electronAPI.deleteMultipleIdeas(projectId, ideaIds);
  if (result.success) {
    store.deleteMultipleIdeas(ideaIds);
    store.clearSelection();
    store.addLog(`${ideaIds.length} ideas deleted`);
  }
  return result.success;
}

/**
 * 在不清除现有想法的情况下，将新的创意类型追加到现有会话。
 * 这允许用户在保留现有想法的同时添加更多类别（如安全、性能）。
 */
export function appendIdeation(projectId: string, typesToAdd: IdeationType[]): void {
  const store = useIdeationStore.getState();
  const config = store.config;

  // 不清除现有会话 - 我们是在追加
  store.clearLogs();

  // 仅初始化我们要新增的类型状态
  // 已有的类型保持为 'completed'
  const newTypeStates = { ...store.typeStates };
  typesToAdd.forEach((type) => {
    newTypeStates[type] = 'generating';
  });
  store.initializeTypeStates(typesToAdd);

  store.addLog(`Adding ${typesToAdd.length} new ideation types...`);
  store.setGenerationStatus({
    phase: 'generating',
    progress: 0,
    message: `Generating ${typesToAdd.length} additional ideation types...`
  });

  // 使用追加模式调用生成，并仅传入新增类型
  const appendConfig = {
    ...config,
    enabledTypes: typesToAdd,
    append: true
  };
  window.electronAPI.generateIdeation(projectId, appendConfig);
}

// 选择器
export function getIdeasByType(
  session: IdeationSession | null,
  type: IdeationType
): Idea[] {
  if (!session) return [];
  return session.ideas.filter((idea) => idea.type === type);
}

export function getIdeasByStatus(
  session: IdeationSession | null,
  status: IdeationStatus
): Idea[] {
  if (!session) return [];
  return session.ideas.filter((idea) => idea.status === status);
}

export function getActiveIdeas(session: IdeationSession | null): Idea[] {
  if (!session) return [];
  return session.ideas.filter((idea) => idea.status !== 'dismissed' && idea.status !== 'archived');
}

export function getArchivedIdeas(session: IdeationSession | null): Idea[] {
  if (!session) return [];
  return session.ideas.filter((idea) => idea.status === 'archived');
}

export function getIdeationSummary(session: IdeationSession | null): IdeationSummary {
  if (!session) {
    return {
      totalIdeas: 0,
      byType: {} as Record<IdeationType, number>,
      byStatus: {} as Record<IdeationStatus, number>
    };
  }

  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  session.ideas.forEach((idea) => {
    byType[idea.type] = (byType[idea.type] || 0) + 1;
    byStatus[idea.status] = (byStatus[idea.status] || 0) + 1;
  });

  return {
    totalIdeas: session.ideas.length,
    byType: byType as Record<IdeationType, number>,
    byStatus: byStatus as Record<IdeationStatus, number>,
    lastGenerated: session.generatedAt
  };
}

// 想法类型的类型守卫
// 注意：isLowHangingFruitIdea 更名为 isCodeImprovementIdea
// isHighValueIdea 已移除 - 战略性功能属于 Roadmap
export function isCodeImprovementIdea(idea: Idea): idea is Idea & { type: 'code_improvements' } {
  return idea.type === 'code_improvements';
}

export function isUIUXIdea(idea: Idea): idea is Idea & { type: 'ui_ux_improvements' } {
  return idea.type === 'ui_ux_improvements';
}

// IPC 监听器设置 - 应用初始化时调用一次
export function setupIdeationListeners(): () => void {
  const store = useIdeationStore.getState;

  // 监听进度更新
  const unsubProgress = window.electronAPI.onIdeationProgress((_projectId, status) => {
    // 调试日志
    if (window.DEBUG) {
      console.warn('[Ideation] Progress update:', {
        projectId: _projectId,
        phase: status.phase,
        progress: status.progress,
        message: status.message
      });
    }
    store().setGenerationStatus(status);
  });

  // 监听日志消息
  const unsubLog = window.electronAPI.onIdeationLog((_projectId, log) => {
    store().addLog(log);
  });

  // 监听单个创意类型完成（流式）
  const unsubTypeComplete = window.electronAPI.onIdeationTypeComplete(
    (_projectId, ideationType, ideas) => {
      // 调试日志
      if (window.DEBUG) {
        console.warn('[Ideation] Type completed:', {
          projectId: _projectId,
          ideationType,
          ideasCount: ideas.length,
          ideas: ideas.map(i => ({ id: i.id, title: i.title, type: i.type }))
        });
      }

      store().addIdeasForType(ideationType, ideas);
      store().addLog(`✓ ${ideationType} completed with ${ideas.length} ideas`);

      // 根据实际的 typeStates 计算进度，使用 areAllTypesComplete 统一判断逻辑
      const typeStates = store().typeStates;
      const config = store().config;
      const completedCount = Object.entries(typeStates).filter(
        ([type, state]) =>
          config.enabledTypes.includes(type as IdeationType) &&
          (state === 'completed' || state === 'failed')
      ).length;
      const totalTypes = config.enabledTypes.length;
      const progress = Math.round((completedCount / totalTypes) * 100);

      // 使用 areAllTypesComplete 统一判断是否所有类型都已完成
      // 如果所有类型都已完成，设置 phase 为 'complete'，否则保持 'generating'
      const allComplete = areAllTypesComplete(typeStates, config.enabledTypes);
      
      if (allComplete) {
        store().setGenerationStatus({
          phase: 'complete',
          progress: 100,
          message: 'Ideation complete'
        });
      } else {
        store().setGenerationStatus({
          phase: 'generating',
          progress,
          message: `${completedCount}/${totalTypes} ideation types complete`
        });
      }
    }
  );

  // 监听单个创意类型失败
  const unsubTypeFailed = window.electronAPI.onIdeationTypeFailed(
    (_projectId, ideationType) => {
      // 调试日志
      if (window.DEBUG) {
        console.error('[Ideation] Type failed:', { projectId: _projectId, ideationType });
      }

      store().setTypeState(ideationType as IdeationType, 'failed');
      store().addLog(`✗ ${ideationType} failed`);

      // 根据实际的 typeStates 计算进度，与 onIdeationTypeComplete 保持一致
      const typeStates = store().typeStates;
      const config = store().config;
      const completedCount = Object.entries(typeStates).filter(
        ([type, state]) =>
          config.enabledTypes.includes(type as IdeationType) &&
          (state === 'completed' || state === 'failed')
      ).length;
      const totalTypes = config.enabledTypes.length;
      const progress = Math.round((completedCount / totalTypes) * 100);

      // 使用 areAllTypesComplete 统一判断是否所有类型都已完成
      const allComplete = areAllTypesComplete(typeStates, config.enabledTypes);

      if (allComplete) {
        store().setGenerationStatus({
          phase: 'complete',
          progress: 100,
          message: 'Ideation complete'
        });
      } else {
        store().setGenerationStatus({
          phase: 'generating',
          progress,
          message: `${completedCount}/${totalTypes} ideation types complete`
        });
      }
    }
  );

  // 监听完成事件（包含全部数据的最终会话）
  const unsubComplete = window.electronAPI.onIdeationComplete((_projectId, session) => {
    // 调试日志
    if (window.DEBUG) {
      console.warn('[Ideation] Generation complete:', {
        projectId: _projectId,
        totalIdeas: session.ideas.length,
        ideaTypes: session.ideas.reduce((acc, idea) => {
          acc[idea.type] = (acc[idea.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });
    }

    // 最终会话用完整数据替换部分会话
    store().setSession(session);
    store().setGenerationStatus({
      phase: 'complete',
      progress: 100,
      message: 'Ideation complete'
    });
    store().addLog('Ideation generation complete!');
  });

  // 监听错误
  const unsubError = window.electronAPI.onIdeationError((_projectId, error) => {
    // 调试日志
    if (window.DEBUG) {
      console.error('[Ideation] Error received:', { projectId: _projectId, error });
    }

    store().setGenerationStatus({
      phase: 'error',
      progress: 0,
      message: 'Generation failed',
      error
    });
    store().addLog(`Error: ${error}`);
  });

  // 监听停止事件
  const unsubStopped = window.electronAPI.onIdeationStopped((_projectId) => {
    store().setGenerationStatus({
      phase: 'idle',
      progress: 0,
      message: 'Generation stopped'
    });
    store().addLog('Ideation generation stopped');
  });

  // 返回清理函数
  return () => {
    unsubProgress();
    unsubLog();
    unsubTypeComplete();
    unsubTypeFailed();
    unsubComplete();
    unsubError();
    unsubStopped();
  };
}
