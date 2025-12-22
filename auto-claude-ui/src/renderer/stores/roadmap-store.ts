import { create } from 'zustand';
import type {
  CompetitorAnalysis,
  Roadmap,
  RoadmapFeature,
  RoadmapFeatureStatus,
  RoadmapGenerationStatus,
  FeatureSource
} from '../../shared/types';

/**
 * 将路线图数据迁移到最新 schema
 * - 将 'idea' 状态转换为 'under_review'（与 Canny 兼容）
 * - 为缺少来源的功能添加默认来源
 */
function migrateRoadmapIfNeeded(roadmap: Roadmap): Roadmap {
  let needsMigration = false;

  const migratedFeatures = roadmap.features.map((feature) => {
    const migratedFeature = { ...feature };

    // 将 'idea' 状态迁移为 'under_review'
    if ((feature.status as string) === 'idea') {
      migratedFeature.status = 'under_review';
      needsMigration = true;
    }

    // 如果缺少来源则添加默认来源
    if (!feature.source) {
      migratedFeature.source = { provider: 'internal' } as FeatureSource;
      needsMigration = true;
    }

    return migratedFeature;
  });

  if (needsMigration) {
    console.log('[Roadmap] Migrated roadmap data to latest schema');
    return {
      ...roadmap,
      features: migratedFeatures,
      updatedAt: new Date()
    };
  }

  return roadmap;
}

interface RoadmapState {
  // 数据
  roadmap: Roadmap | null;
  competitorAnalysis: CompetitorAnalysis | null;
  generationStatus: RoadmapGenerationStatus;
  currentProjectId: string | null;  // 跟踪当前正在查看/生成的项目

  // 操作
  setRoadmap: (roadmap: Roadmap | null) => void;
  setCompetitorAnalysis: (analysis: CompetitorAnalysis | null) => void;
  setGenerationStatus: (status: RoadmapGenerationStatus) => void;
  setCurrentProjectId: (projectId: string | null) => void;
  updateFeatureStatus: (featureId: string, status: RoadmapFeatureStatus) => void;
  markFeatureDoneBySpecId: (specId: string) => void;
  updateFeatureLinkedSpec: (featureId: string, specId: string) => void;
  deleteFeature: (featureId: string) => void;
  clearRoadmap: () => void;
  // 拖拽操作
  reorderFeatures: (phaseId: string, featureIds: string[]) => void;
  updateFeaturePhase: (featureId: string, newPhaseId: string) => void;
  addFeature: (feature: Omit<RoadmapFeature, 'id'>) => string;
}

const initialGenerationStatus: RoadmapGenerationStatus = {
  phase: 'idle',
  progress: 0,
  message: ''
};

export const useRoadmapStore = create<RoadmapState>((set) => ({
  // 初始状态
  roadmap: null,
  competitorAnalysis: null,
  generationStatus: initialGenerationStatus,
  currentProjectId: null,

  // 操作
  setRoadmap: (roadmap) => set({ roadmap }),

  setCompetitorAnalysis: (analysis) => set({ competitorAnalysis: analysis }),

  setGenerationStatus: (status) => set({ generationStatus: status }),

  setCurrentProjectId: (projectId) => set({ currentProjectId: projectId }),

  updateFeatureStatus: (featureId, status) =>
    set((state) => {
      if (!state.roadmap) return state;

      const updatedFeatures = state.roadmap.features.map((feature) =>
        feature.id === featureId ? { ...feature, status } : feature
      );

      return {
        roadmap: {
          ...state.roadmap,
          features: updatedFeatures,
          updatedAt: new Date()
        }
      };
    }),

  // 关联任务完成时将功能标记为完成
  markFeatureDoneBySpecId: (specId: string) =>
    set((state) => {
      if (!state.roadmap) return state;

      const updatedFeatures = state.roadmap.features.map((feature) =>
        feature.linkedSpecId === specId
          ? { ...feature, status: 'done' as RoadmapFeatureStatus }
          : feature
      );

      return {
        roadmap: {
          ...state.roadmap,
          features: updatedFeatures,
          updatedAt: new Date()
        }
      };
    }),

  updateFeatureLinkedSpec: (featureId, specId) =>
    set((state) => {
      if (!state.roadmap) return state;

      const updatedFeatures = state.roadmap.features.map((feature) =>
        feature.id === featureId
          ? { ...feature, linkedSpecId: specId, status: 'in_progress' as RoadmapFeatureStatus }
          : feature
      );

      return {
        roadmap: {
          ...state.roadmap,
          features: updatedFeatures,
          updatedAt: new Date()
        }
      };
    }),

  deleteFeature: (featureId) =>
    set((state) => {
      if (!state.roadmap) return state;

      const updatedFeatures = state.roadmap.features.filter(
        (feature) => feature.id !== featureId
      );

      return {
        roadmap: {
          ...state.roadmap,
          features: updatedFeatures,
          updatedAt: new Date()
        }
      };
    }),

  clearRoadmap: () =>
    set({
      roadmap: null,
      competitorAnalysis: null,
      generationStatus: initialGenerationStatus,
      currentProjectId: null
    }),

  // 在阶段内重新排序功能
  reorderFeatures: (phaseId, featureIds) =>
    set((state) => {
      if (!state.roadmap) return state;

      // 按新顺序获取该阶段的功能
      const phaseFeatures = featureIds
        .map((id) => state.roadmap!.features.find((f) => f.id === id))
        .filter((f): f is RoadmapFeature => f !== undefined);

      // 获取其他阶段的功能（不变）
      const otherFeatures = state.roadmap.features.filter(
        (f) => f.phaseId !== phaseId
      );

      // 合并：先其他阶段，再当前阶段的重排序功能
      const updatedFeatures = [...otherFeatures, ...phaseFeatures];

      return {
        roadmap: {
          ...state.roadmap,
          features: updatedFeatures,
          updatedAt: new Date()
        }
      };
    }),

  // 将功能移动到其他阶段
  updateFeaturePhase: (featureId, newPhaseId) =>
    set((state) => {
      if (!state.roadmap) return state;

      const updatedFeatures = state.roadmap.features.map((feature) =>
        feature.id === featureId ? { ...feature, phaseId: newPhaseId } : feature
      );

      return {
        roadmap: {
          ...state.roadmap,
          features: updatedFeatures,
          updatedAt: new Date()
        }
      };
    }),

  // 向路线图添加新功能
  addFeature: (featureData) => {
    const newId = `feature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newFeature: RoadmapFeature = {
      ...featureData,
      id: newId
    };

    set((state) => {
      if (!state.roadmap) return state;

      return {
        roadmap: {
          ...state.roadmap,
          features: [...state.roadmap.features, newFeature],
          updatedAt: new Date()
        }
      };
    });

    return newId;
  }
}));

// 加载路线图的辅助函数
export async function loadRoadmap(projectId: string): Promise<void> {
  const store = useRoadmapStore.getState();

  // 始终先设置当前项目 ID，这确保事件处理器
  // 只处理当前查看的项目事件
  store.setCurrentProjectId(projectId);

  // 查询该项目的路线图生成是否正在运行
  // 这会在切回项目时恢复生成状态
  const statusResult = await window.electronAPI.getRoadmapStatus(projectId);
  if (statusResult.success && statusResult.data?.isRunning) {
    // 生成正在运行 - 恢复 UI 状态以显示进度
    // 实际进度将由传入事件更新
    store.setGenerationStatus({
      phase: 'analyzing',
      progress: 0,
      message: 'Roadmap generation in progress...'
    });
  } else {
    // 生成未运行 - 重置为 idle
    store.setGenerationStatus({
      phase: 'idle',
      progress: 0,
      message: ''
    });
  }

  const result = await window.electronAPI.getRoadmap(projectId);
  if (result.success && result.data) {
    // 如有需要，将路线图迁移到最新 schema
    const migratedRoadmap = migrateRoadmapIfNeeded(result.data);
    store.setRoadmap(migratedRoadmap);

    // 如果有更改则保存迁移后的路线图
    if (migratedRoadmap !== result.data) {
      window.electronAPI.saveRoadmap(projectId, migratedRoadmap).catch((err) => {
        console.error('[Roadmap] Failed to save migrated roadmap:', err);
      });
    }

    // 如果存在竞品分析，则单独提取并设置
    if (migratedRoadmap.competitorAnalysis) {
      store.setCompetitorAnalysis(migratedRoadmap.competitorAnalysis);
    } else {
      store.setCompetitorAnalysis(null);
    }
  } else {
    store.setRoadmap(null);
    store.setCompetitorAnalysis(null);
  }
}

export function generateRoadmap(
  projectId: string,
  enableCompetitorAnalysis?: boolean,
  refreshCompetitorAnalysis?: boolean
): void {
  // 调试日志
  if (window.DEBUG) {
    console.log('[Roadmap] Starting generation:', { projectId, enableCompetitorAnalysis, refreshCompetitorAnalysis });
  }

  useRoadmapStore.getState().setGenerationStatus({
    phase: 'analyzing',
    progress: 0,
    message: 'Starting roadmap generation...'
  });
  window.electronAPI.generateRoadmap(projectId, enableCompetitorAnalysis, refreshCompetitorAnalysis);
}

export function refreshRoadmap(
  projectId: string,
  enableCompetitorAnalysis?: boolean,
  refreshCompetitorAnalysis?: boolean
): void {
  // 调试日志
  if (window.DEBUG) {
    console.log('[Roadmap] Starting refresh:', { projectId, enableCompetitorAnalysis, refreshCompetitorAnalysis });
  }

  useRoadmapStore.getState().setGenerationStatus({
    phase: 'analyzing',
    progress: 0,
    message: 'Refreshing roadmap...'
  });
  window.electronAPI.refreshRoadmap(projectId, enableCompetitorAnalysis, refreshCompetitorAnalysis);
}

export async function stopRoadmap(projectId: string): Promise<boolean> {
  const store = useRoadmapStore.getState();

  // 调试日志
  if (window.DEBUG) {
    console.log('[Roadmap] Stop requested:', { projectId });
  }

  // 无论后端响应如何，用户请求停止时始终将 UI 状态更新为 'idle'
  // 这可防止进程已结束时 UI 卡在“生成中”状态
  store.setGenerationStatus({
    phase: 'idle',
    progress: 0,
    message: 'Generation stopped'
  });

  const result = await window.electronAPI.stopRoadmap(projectId);

  // 调试日志
  if (window.DEBUG) {
    console.log('[Roadmap] Stop result:', { projectId, success: result.success });
  }

  if (!result.success) {
    // 后端找不到/无法停止该进程（可能已完成/崩溃）
    console.log('[Roadmap] Process already stopped');
  }

  return result.success;
}

// 选择器
export function getFeaturesByPhase(
  roadmap: Roadmap | null,
  phaseId: string
): RoadmapFeature[] {
  if (!roadmap) return [];
  return roadmap.features.filter((f) => f.phaseId === phaseId);
}

export function getFeaturesByPriority(
  roadmap: Roadmap | null,
  priority: string
): RoadmapFeature[] {
  if (!roadmap) return [];
  return roadmap.features.filter((f) => f.priority === priority);
}

export function getFeatureStats(roadmap: Roadmap | null): {
  total: number;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
  byComplexity: Record<string, number>;
} {
  if (!roadmap) {
    return {
      total: 0,
      byPriority: {},
      byStatus: {},
      byComplexity: {}
    };
  }

  const byPriority: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byComplexity: Record<string, number> = {};

  roadmap.features.forEach((feature) => {
    byPriority[feature.priority] = (byPriority[feature.priority] || 0) + 1;
    byStatus[feature.status] = (byStatus[feature.status] || 0) + 1;
    byComplexity[feature.complexity] = (byComplexity[feature.complexity] || 0) + 1;
  });

  return {
    total: roadmap.features.length,
    byPriority,
    byStatus,
    byComplexity
  };
}
