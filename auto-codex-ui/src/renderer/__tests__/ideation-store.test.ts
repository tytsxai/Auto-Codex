/**
 * Unit tests for Ideation Store
 * Tests Zustand store for ideation state management
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  useIdeationStore,
  loadIdeation,
  generateIdeation,
  setupIdeationListeners
} from '../stores/ideation-store';
import { DEFAULT_IDEATION_CONFIG, IDEATION_TYPE_LABELS } from '../../shared/constants';
import type { IdeationConfig, IdeationSession, Idea, IdeationType, IdeationStatus } from '../../shared/types';

function createIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: `idea-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: 'code_improvements',
    title: 'Improve error handling',
    description: 'Add missing error boundary',
    rationale: 'Better resilience',
    status: 'draft',
    createdAt: new Date(),
    buildsUpon: [],
    estimatedEffort: 'small',
    affectedFiles: [],
    existingPatterns: [],
    ...overrides
  } as Idea;
}

function createSession(overrides: Partial<IdeationSession> = {}): IdeationSession {
  const config: IdeationConfig = {
    enabledTypes: [...DEFAULT_IDEATION_CONFIG.enabledTypes] as IdeationType[],
    includeRoadmapContext: DEFAULT_IDEATION_CONFIG.includeRoadmapContext,
    includeKanbanContext: DEFAULT_IDEATION_CONFIG.includeKanbanContext,
    maxIdeasPerType: DEFAULT_IDEATION_CONFIG.maxIdeasPerType
  };

  return {
    id: `session-${Date.now()}`,
    projectId: 'project-1',
    config,
    ideas: [],
    projectContext: {
      existingFeatures: [],
      techStack: [],
      plannedFeatures: []
    },
    generatedAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

function createInitialTypeStates(): Record<IdeationType, 'pending'> {
  return Object.keys(IDEATION_TYPE_LABELS).reduce((acc, type) => {
    acc[type as IdeationType] = 'pending';
    return acc;
  }, {} as Record<IdeationType, 'pending'>);
}

describe('Ideation Store', () => {
  let electronAPI: {
    getIdeation: ReturnType<typeof vi.fn>;
    generateIdeation: ReturnType<typeof vi.fn>;
    refreshIdeation: ReturnType<typeof vi.fn>;
    stopIdeation: ReturnType<typeof vi.fn>;
    dismissAllIdeas: ReturnType<typeof vi.fn>;
    archiveIdea: ReturnType<typeof vi.fn>;
    deleteIdea: ReturnType<typeof vi.fn>;
    deleteMultipleIdeas: ReturnType<typeof vi.fn>;
    onIdeationProgress: ReturnType<typeof vi.fn>;
    onIdeationLog: ReturnType<typeof vi.fn>;
    onIdeationTypeComplete: ReturnType<typeof vi.fn>;
    onIdeationTypeFailed: ReturnType<typeof vi.fn>;
    onIdeationComplete: ReturnType<typeof vi.fn>;
    onIdeationError: ReturnType<typeof vi.fn>;
    onIdeationStopped: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    electronAPI = {
      getIdeation: vi.fn(),
      generateIdeation: vi.fn(),
      refreshIdeation: vi.fn(),
      stopIdeation: vi.fn(),
      dismissAllIdeas: vi.fn(),
      archiveIdea: vi.fn(),
      deleteIdea: vi.fn(),
      deleteMultipleIdeas: vi.fn(),
      onIdeationProgress: vi.fn().mockImplementation(() => vi.fn()),
      onIdeationLog: vi.fn().mockImplementation(() => vi.fn()),
      onIdeationTypeComplete: vi.fn().mockImplementation(() => vi.fn()),
      onIdeationTypeFailed: vi.fn().mockImplementation(() => vi.fn()),
      onIdeationComplete: vi.fn().mockImplementation(() => vi.fn()),
      onIdeationError: vi.fn().mockImplementation(() => vi.fn()),
      onIdeationStopped: vi.fn().mockImplementation(() => vi.fn())
    };

    const globalWithWindow = globalThis as unknown as { window?: Window & typeof globalThis };
    if (!globalWithWindow.window) {
      globalWithWindow.window = {} as unknown as Window & typeof globalThis;
    }

    (window as unknown as { electronAPI: typeof electronAPI }).electronAPI = electronAPI;
    (window as Window & { DEBUG?: boolean }).DEBUG = false;

    useIdeationStore.setState({
      session: null,
      generationStatus: { phase: 'idle', progress: 0, message: '' },
      config: {
        enabledTypes: [...DEFAULT_IDEATION_CONFIG.enabledTypes] as IdeationType[],
        includeRoadmapContext: DEFAULT_IDEATION_CONFIG.includeRoadmapContext,
        includeKanbanContext: DEFAULT_IDEATION_CONFIG.includeKanbanContext,
        maxIdeasPerType: DEFAULT_IDEATION_CONFIG.maxIdeasPerType
      },
      logs: [],
      typeStates: createInitialTypeStates(),
      selectedIds: new Set<string>()
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('state management', () => {
    it('sets session and updates idea status', () => {
      const idea = createIdea({ id: 'idea-1', status: 'draft' });
      const session = createSession({ ideas: [idea] });

      useIdeationStore.getState().setSession(session);
      useIdeationStore.getState().updateIdeaStatus('idea-1', 'selected');

      const updated = useIdeationStore.getState().session;
      expect(updated).not.toBeNull();
      expect(updated?.ideas[0].status).toBe('selected');
    });

    it('dismisses an idea and updates generation status', () => {
      const idea = createIdea({ id: 'idea-2', status: 'draft' });
      const session = createSession({ ideas: [idea] });

      useIdeationStore.getState().setSession(session);
      useIdeationStore.getState().dismissIdea('idea-2');
      useIdeationStore.getState().setGenerationStatus({
        phase: 'generating',
        progress: 10,
        message: 'Generating'
      });

      const state = useIdeationStore.getState();
      const dismissed = state.session?.ideas[0];
      expect(dismissed?.status).toBe('dismissed');
      expect(state.generationStatus.phase).toBe('generating');
    });
  });

  describe('loadIdeation (loadSession)', () => {
    it('loads a session when electronAPI succeeds', async () => {
      const session = createSession({ id: 'session-1' });
      electronAPI.getIdeation.mockResolvedValue({ success: true, data: session });

      await loadIdeation('project-1');

      expect(electronAPI.getIdeation).toHaveBeenCalledWith('project-1');
      expect(useIdeationStore.getState().session?.id).toBe('session-1');
    });

    it('clears the session when electronAPI fails', async () => {
      useIdeationStore.getState().setSession(createSession({ id: 'session-existing' }));
      electronAPI.getIdeation.mockResolvedValue({ success: false, data: null });

      await loadIdeation('project-1');

      expect(useIdeationStore.getState().session).toBeNull();
    });
  });

  describe('generateIdeation (generateIdeas)', () => {
    it('clears session, initializes state, and calls electronAPI', () => {
      const config: IdeationConfig = {
        enabledTypes: ['code_improvements', 'documentation_gaps'],
        includeRoadmapContext: false,
        includeKanbanContext: false,
        maxIdeasPerType: 3
      };

      useIdeationStore.setState({
        config,
        logs: ['old log'],
        session: createSession({ id: 'session-old' }),
        selectedIds: new Set(['idea-1'])
      });

      generateIdeation('project-1');

      const state = useIdeationStore.getState();
      expect(electronAPI.generateIdeation).toHaveBeenCalledWith('project-1', config);
      expect(state.session).toBeNull();
      expect(state.logs).toEqual(['Starting ideation generation in parallel...']);
      expect(state.generationStatus.phase).toBe('generating');
      expect(state.generationStatus.message).toContain('2');
      expect(state.typeStates.code_improvements).toBe('generating');
      expect(state.typeStates.documentation_gaps).toBe('generating');
      expect(state.typeStates.security_hardening).toBe('pending');
      expect(state.selectedIds.size).toBe(0);
    });
  });

  describe('error handling', () => {
    it('updates status and logs when onIdeationError fires', () => {
      let onErrorHandler: ((projectId: string, error: string) => void) | null = null;
      electronAPI.onIdeationError.mockImplementation((handler: unknown) => {
        onErrorHandler = handler as (projectId: string, error: string) => void;
        return vi.fn();
      });

      setupIdeationListeners();

      expect(onErrorHandler).not.toBeNull();
      if (!onErrorHandler) {
        throw new Error('Expected onIdeationError handler to be registered');
      }
      (onErrorHandler as unknown as (projectId: string, error: string) => void)('project-1', 'boom');

      const state = useIdeationStore.getState();
      expect(state.generationStatus.phase).toBe('error');
      expect(state.generationStatus.error).toBe('boom');
      expect(state.logs[state.logs.length - 1]).toBe('Error: boom');
    });
  });

  describe('dismissIdea', () => {
    it('marks the target idea as dismissed', () => {
      const idea = createIdea({ id: 'idea-3', status: 'draft' as IdeationStatus });
      const session = createSession({ ideas: [idea] });

      useIdeationStore.getState().setSession(session);
      useIdeationStore.getState().dismissIdea('idea-3');

      const updated = useIdeationStore.getState().session;
      expect(updated?.ideas[0].status).toBe('dismissed');
    });
  });
});
