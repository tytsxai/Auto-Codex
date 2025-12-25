import { useEffect, useState, useCallback, useRef } from 'react';
import {
  useIdeationStore,
  loadIdeation,
  generateIdeation,
  refreshIdeation,
  stopIdeation,
  appendIdeation,
  dismissAllIdeasForProject,
  deleteMultipleIdeasForProject,
  getIdeasByType,
  getActiveIdeas,
  getArchivedIdeas,
  getIdeationSummary,
  setupIdeationListeners,
  areAllTypesComplete
} from '../../../stores/ideation-store';
import { loadTasks } from '../../../stores/task-store';
// Token check disabled - backend handles authentication via .env
// import { useCodexTokenCheck } from '../../EnvConfigModal';
import type { Idea, IdeationType } from '../../../../shared/types';
import { ALL_IDEATION_TYPES } from '../constants';

interface UseIdeationOptions {
  onGoToTask?: (taskId: string) => void;
}

export function useIdeation(projectId: string, options: UseIdeationOptions = {}) {
  const { onGoToTask } = options;
  const session = useIdeationStore((state) => state.session);
  const generationStatus = useIdeationStore((state) => state.generationStatus);
  const config = useIdeationStore((state) => state.config);
  const setConfig = useIdeationStore((state) => state.setConfig);
  const logs = useIdeationStore((state) => state.logs);
  const typeStates = useIdeationStore((state) => state.typeStates);
  const selectedIds = useIdeationStore((state) => state.selectedIds);
  const toggleSelectIdea = useIdeationStore((state) => state.toggleSelectIdea);
  const selectAllIdeas = useIdeationStore((state) => state.selectAllIdeas);
  const clearSelection = useIdeationStore((state) => state.clearSelection);

  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showEnvConfigModal, setShowEnvConfigModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'generate' | 'refresh' | 'append' | null>(null);
  const [showAddMoreDialog, setShowAddMoreDialog] = useState(false);
  const [typesToAdd, setTypesToAdd] = useState<IdeationType[]>([]);

  // Token check disabled - backend handles authentication via .env
  // const { hasToken, isLoading: isCheckingToken, checkToken } = useCodexTokenCheck();
  const hasToken: boolean = true;
  const isCheckingToken: boolean = false;

  // Set up IPC listeners and load ideation on mount
  useEffect(() => {
    const cleanup = setupIdeationListeners();
    loadIdeation(projectId);
    return cleanup;
  }, [projectId]);

  // State recovery: Check for orphaned generation states on mount
  // This handles cases where the backend process crashed or the user navigated away
  // Requirements: 5.2, 5.3
  useEffect(() => {
    const { generationStatus, typeStates, config } = useIdeationStore.getState();

    // If status is 'generating' but all types are complete, we have an orphaned state
    if (generationStatus.phase === 'generating') {
      const allComplete = areAllTypesComplete(typeStates, config.enabledTypes);

      if (allComplete) {
        // All types finished but phase wasn't updated - recover to 'complete'
        if (window.DEBUG) {
          console.warn('[Ideation] Recovering orphaned state: all types complete but phase was generating');
        }
        useIdeationStore.getState().setGenerationStatus({
          phase: 'complete',
          progress: 100,
          message: 'Ideation complete'
        });
      } else {
        // Check if there are any ideas in the session - if so, some work was done
        // but the process may have crashed. Check if any types are still 'generating'
        const hasGeneratingTypes = config.enabledTypes.some(
          type => typeStates[type] === 'generating'
        );

        if (!hasGeneratingTypes) {
          // No types are actively generating, but not all are complete
          // This means the process likely crashed - reset to idle
          if (window.DEBUG) {
            console.warn('[Ideation] Recovering orphaned state: no active generation, resetting to idle');
          }
          useIdeationStore.getState().setGenerationStatus({
            phase: 'idle',
            progress: 0,
            message: 'Generation was interrupted'
          });
        }
        // If there are still generating types, leave the state as-is
        // The backend might still be running
      }
    }
  }, [projectId]);

  // Active state sync: Monitor for stuck generation states
  // This handles cases where ideas are added but typeStates/generationStatus aren't updated
  // Uses a debounce to avoid excessive state updates
  const lastSyncCheckRef = useRef<number>(0);
  useEffect(() => {
    // Only check if we're in generating phase
    if (generationStatus.phase !== 'generating') return;
    if (!session || session.ideas.length === 0) return;

    // Debounce: only check every 2 seconds
    const now = Date.now();
    if (now - lastSyncCheckRef.current < 2000) return;
    lastSyncCheckRef.current = now;

    // Get idea types that exist in the session
    const ideasByType = new Map<IdeationType, number>();
    session.ideas.forEach(idea => {
      ideasByType.set(idea.type, (ideasByType.get(idea.type) || 0) + 1);
    });

    // Check if there are ideas for types that are still marked as 'generating'
    let needsRecovery = false;
    const stuckTypes: IdeationType[] = [];
    config.enabledTypes.forEach(type => {
      const hasIdeas = ideasByType.has(type) && (ideasByType.get(type) || 0) > 0;
      const isStillGenerating = typeStates[type] === 'generating';
      if (hasIdeas && isStillGenerating) {
        stuckTypes.push(type);
        needsRecovery = true;
      }
    });

    if (needsRecovery && stuckTypes.length > 0) {
      if (window.DEBUG) {
        console.warn('[Ideation] Active sync: fixing stuck typeStates for:', stuckTypes);
      }
      // Fix the stuck types
      stuckTypes.forEach(type => {
        useIdeationStore.getState().setTypeState(type, 'completed');
      });

      // Check if all types are now complete
      const updatedTypeStates = useIdeationStore.getState().typeStates;
      const allComplete = areAllTypesComplete(updatedTypeStates, config.enabledTypes);
      if (allComplete) {
        useIdeationStore.getState().setGenerationStatus({
          phase: 'complete',
          progress: 100,
          message: 'Ideation complete'
        });
        useIdeationStore.getState().addLog('✓ Generation completed (recovered from stuck state)');
      }
    }
  }, [session, generationStatus.phase, typeStates, config.enabledTypes]);

  const handleGenerate = async () => {
    generateIdeation(projectId);
  };

  const handleRefresh = async () => {
    refreshIdeation(projectId);
  };

  const handleStop = async () => {
    await stopIdeation(projectId);
  };

  const handleDismissAll = async () => {
    await dismissAllIdeasForProject(projectId);
  };

  const handleEnvConfigured = () => {
    // checkToken() removed - backend handles authentication
    if (pendingAction === 'generate') {
      generateIdeation(projectId);
    } else if (pendingAction === 'refresh') {
      refreshIdeation(projectId);
    } else if (pendingAction === 'append' && typesToAdd.length > 0) {
      appendIdeation(projectId, typesToAdd);
      setTypesToAdd([]);
    }
    setPendingAction(null);
  };

  const getAvailableTypesToAdd = (): IdeationType[] => {
    if (!session) return ALL_IDEATION_TYPES;
    const existingTypes = new Set(session.ideas.map((idea) => idea.type));
    return ALL_IDEATION_TYPES.filter((type) => !existingTypes.has(type));
  };

  const handleAddMoreIdeas = () => {
    if (typesToAdd.length === 0) return;

    appendIdeation(projectId, typesToAdd);
    setTypesToAdd([]);
    setShowAddMoreDialog(false);
  };

  const toggleTypeToAdd = (type: IdeationType) => {
    setTypesToAdd((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleConvertToTask = async (idea: Idea) => {
    const result = await window.electronAPI.convertIdeaToTask(projectId, idea.id);
    if (result.success && result.data) {
      // Store the taskId on the idea so we can navigate to it later
      useIdeationStore.getState().setIdeaTaskId(idea.id, result.data.id);
      loadTasks(projectId);
    }
  };

  const handleGoToTask = useCallback(
    (taskId: string) => {
      if (onGoToTask) {
        onGoToTask(taskId);
      }
    },
    [onGoToTask]
  );

  const handleDismiss = async (idea: Idea) => {
    const result = await window.electronAPI.dismissIdea(projectId, idea.id);
    if (result.success) {
      useIdeationStore.getState().dismissIdea(idea.id);
    }
  };

  const toggleIdeationType = (type: IdeationType) => {
    const currentTypes = config.enabledTypes;
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter((t) => t !== type)
      : [...currentTypes, type];

    if (newTypes.length > 0) {
      setConfig({ enabledTypes: newTypes });
    }
  };

  const handleDeleteSelected = useCallback(async () => {
    // Get fresh selectedIds from store to avoid stale closure
    const currentSelectedIds = useIdeationStore.getState().selectedIds;
    if (currentSelectedIds.size === 0) return;
    await deleteMultipleIdeasForProject(projectId, Array.from(currentSelectedIds));
  }, [projectId]);

  const handleSelectAll = useCallback((ideas: Idea[]) => {
    selectAllIdeas(ideas.map(idea => idea.id));
  }, [selectAllIdeas]);

  const summary = getIdeationSummary(session);
  const archivedIdeas = getArchivedIdeas(session);

  // Filter ideas based on visibility settings
  const getFilteredIdeas = useCallback(() => {
    if (!session) return [];
    let ideas = session.ideas;

    // Start with base filtering (exclude dismissed and archived by default)
    if (!showDismissed && !showArchived) {
      ideas = getActiveIdeas(session);
    } else if (showDismissed && !showArchived) {
      // Show dismissed but not archived
      ideas = ideas.filter(idea => idea.status !== 'archived');
    } else if (!showDismissed && showArchived) {
      // Show archived but not dismissed
      ideas = ideas.filter(idea => idea.status !== 'dismissed');
    }
    // If both are true, show all

    return ideas;
  }, [session, showDismissed, showArchived]);

  const activeIdeas = getFilteredIdeas();

  return {
    // State
    session,
    generationStatus,
    config,
    logs,
    typeStates,
    selectedIdea,
    activeTab,
    showConfigDialog,
    showDismissed,
    showArchived,
    showEnvConfigModal,
    showAddMoreDialog,
    typesToAdd,
    hasToken,
    isCheckingToken,
    summary,
    activeIdeas,
    archivedIdeas,
    selectedIds,

    // Actions
    setSelectedIdea,
    setActiveTab,
    setShowConfigDialog,
    setShowDismissed,
    setShowArchived,
    setShowEnvConfigModal,
    setShowAddMoreDialog,
    setTypesToAdd,
    setConfig,
    handleGenerate,
    handleRefresh,
    handleStop,
    handleDismissAll,
    handleDeleteSelected,
    handleSelectAll,
    handleEnvConfigured,
    getAvailableTypesToAdd,
    handleAddMoreIdeas,
    toggleTypeToAdd,
    handleConvertToTask,
    handleGoToTask,
    handleDismiss,
    toggleIdeationType,
    toggleSelectIdea,
    clearSelection,

    // Helper functions
    getIdeasByType: (type: IdeationType) => getIdeasByType(session, type)
  };
}
