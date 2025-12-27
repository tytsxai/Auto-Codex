/**
 * Unit tests for Insights Store
 * Tests Zustand store for insights state management
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useInsightsStore,
  loadInsightsSessions,
  loadInsightsSession,
  sendMessage,
  clearSession,
  createTaskFromSuggestion
} from '../stores/insights-store';
import type {
  InsightsSession,
  InsightsSessionSummary,
  InsightsChatMessage,
  InsightsModelConfig
} from '../../shared/types';

const initialStatus = { phase: 'idle' as const, message: '' };

function createMessage(overrides: Partial<InsightsChatMessage> = {}): InsightsChatMessage {
  return {
    id: `msg-${Date.now()}`,
    role: 'user',
    content: 'Hello',
    timestamp: new Date(),
    ...overrides
  };
}

function createSession(overrides: Partial<InsightsSession> = {}): InsightsSession {
  return {
    id: `session-${Date.now()}`,
    projectId: 'project-1',
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

function createSessionSummary(overrides: Partial<InsightsSessionSummary> = {}): InsightsSessionSummary {
  return {
    id: `session-${Date.now()}`,
    projectId: 'project-1',
    title: 'Session Title',
    messageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
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

describe('Insights Store', () => {
  let electronAPI: {
    listInsightsSessions: ReturnType<typeof vi.fn>;
    getInsightsSession: ReturnType<typeof vi.fn>;
    sendInsightsMessage: ReturnType<typeof vi.fn>;
    clearInsightsSession: ReturnType<typeof vi.fn>;
    createTaskFromInsights: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    electronAPI = {
      listInsightsSessions: vi.fn(),
      getInsightsSession: vi.fn(),
      sendInsightsMessage: vi.fn(),
      clearInsightsSession: vi.fn(),
      createTaskFromInsights: vi.fn()
    };

    const globalWithWindow = globalThis as unknown as { window?: Window & typeof globalThis };
    if (!globalWithWindow.window) {
      globalWithWindow.window = {} as unknown as Window & typeof globalThis;
    }

    (window as unknown as { electronAPI: typeof electronAPI }).electronAPI = electronAPI;

    useInsightsStore.setState({
      session: null,
      sessions: [],
      status: initialStatus,
      pendingMessage: '',
      streamingContent: '',
      currentTool: null,
      toolsUsed: [],
      isLoadingSessions: false
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('state management', () => {
    it('sets sessions and status', () => {
      const summaries = [createSessionSummary({ id: 's-1' }), createSessionSummary({ id: 's-2' })];
      useInsightsStore.getState().setSessions(summaries);
      useInsightsStore.getState().setStatus({ phase: 'streaming', message: 'Working' });

      expect(useInsightsStore.getState().sessions).toHaveLength(2);
      expect(useInsightsStore.getState().sessions[0].id).toBe('s-1');
      expect(useInsightsStore.getState().status).toEqual({ phase: 'streaming', message: 'Working' });
    });

    it('creates a new session when adding a first message', () => {
      const message = createMessage({ content: 'First message' });

      useInsightsStore.getState().addMessage(message);

      const session = useInsightsStore.getState().session;
      expect(session).not.toBeNull();
      expect(session?.messages).toHaveLength(1);
      expect(session?.messages[0]).toMatchObject({
        role: 'user',
        content: 'First message'
      });
      expect(session?.createdAt).toBeInstanceOf(Date);
      expect(session?.updatedAt).toBeInstanceOf(Date);
    });

    it('appends messages to an existing session', () => {
      useInsightsStore.setState({
        session: createSession({ messages: [createMessage({ id: 'm-1' })] })
      });

      useInsightsStore.getState().addMessage(createMessage({ id: 'm-2', content: 'Next' }));

      const session = useInsightsStore.getState().session;
      expect(session?.messages).toHaveLength(2);
      expect(session?.messages[1].id).toBe('m-2');
      expect(session?.messages[1].content).toBe('Next');
    });
  });

  describe('loadInsightsSessions', () => {
    it('toggles loading state and sets sessions on success', async () => {
      const deferred = createDeferred<{ success: boolean; data: InsightsSessionSummary[] }>();
      electronAPI.listInsightsSessions.mockReturnValue(deferred.promise);

      const loadPromise = loadInsightsSessions('project-1');
      expect(useInsightsStore.getState().isLoadingSessions).toBe(true);

      deferred.resolve({
        success: true,
        data: [createSessionSummary({ id: 's-1' })]
      });
      await loadPromise;

      expect(electronAPI.listInsightsSessions).toHaveBeenCalledWith('project-1');
      expect(useInsightsStore.getState().sessions).toHaveLength(1);
      expect(useInsightsStore.getState().isLoadingSessions).toBe(false);
    });

    it('clears sessions when load fails', async () => {
      electronAPI.listInsightsSessions.mockResolvedValue({ success: false });
      useInsightsStore.setState({ sessions: [createSessionSummary({ id: 'existing' })] });

      await loadInsightsSessions('project-1');

      expect(useInsightsStore.getState().sessions).toEqual([]);
      expect(useInsightsStore.getState().isLoadingSessions).toBe(false);
    });
  });

  describe('loadInsightsSession', () => {
    it('loads session and refreshes sessions list', async () => {
      const session = createSession({ id: 'session-1' });
      electronAPI.getInsightsSession.mockResolvedValue({ success: true, data: session });
      electronAPI.listInsightsSessions.mockResolvedValue({
        success: true,
        data: [createSessionSummary({ id: 'session-1' })]
      });

      await loadInsightsSession('project-1');

      expect(electronAPI.getInsightsSession).toHaveBeenCalledWith('project-1');
      expect(electronAPI.listInsightsSessions).toHaveBeenCalledWith('project-1');
      expect(useInsightsStore.getState().session?.id).toBe('session-1');
      expect(useInsightsStore.getState().sessions).toHaveLength(1);
    });

    it('clears session when load fails and still refreshes list', async () => {
      electronAPI.getInsightsSession.mockResolvedValue({ success: false });
      electronAPI.listInsightsSessions.mockResolvedValue({ success: true, data: [] });
      useInsightsStore.setState({ session: createSession({ id: 'existing' }) });

      await loadInsightsSession('project-1');

      expect(useInsightsStore.getState().session).toBeNull();
      expect(electronAPI.listInsightsSessions).toHaveBeenCalledWith('project-1');
    });
  });

  describe('sendMessage', () => {
    it('adds user message, resets state, and sends with session model config', () => {
      const modelConfig: InsightsModelConfig = {
        profileId: 'balanced',
        model: 'codex',
        thinkingLevel: 'medium'
      };
      useInsightsStore.setState({
        session: createSession({ modelConfig }),
        pendingMessage: 'pending',
        streamingContent: 'old content',
        toolsUsed: [{ name: 'tool', input: 'input', timestamp: new Date() }]
      });

      sendMessage('project-1', 'Hello');

      const store = useInsightsStore.getState();
      expect(store.pendingMessage).toBe('');
      expect(store.streamingContent).toBe('');
      expect(store.toolsUsed).toEqual([]);
      expect(store.status).toEqual({ phase: 'thinking', message: 'Processing your message...' });
      expect(store.session?.messages).toHaveLength(1);
      expect(store.session?.messages[0]).toMatchObject({ role: 'user', content: 'Hello' });
      expect(electronAPI.sendInsightsMessage).toHaveBeenCalledWith('project-1', 'Hello', modelConfig);
    });

    it('uses provided model config when supplied', () => {
      const overrideConfig: InsightsModelConfig = {
        profileId: 'quick',
        model: 'codex',
        thinkingLevel: 'low'
      };

      sendMessage('project-1', 'Override', overrideConfig);

      expect(electronAPI.sendInsightsMessage).toHaveBeenCalledWith('project-1', 'Override', overrideConfig);
    });
  });

  describe('clearSession', () => {
    it('clears store session and reloads when successful', async () => {
      const refreshedSession = createSession({ id: 'refreshed' });
      electronAPI.clearInsightsSession.mockResolvedValue({ success: true });
      electronAPI.getInsightsSession.mockResolvedValue({ success: true, data: refreshedSession });
      electronAPI.listInsightsSessions.mockResolvedValue({ success: true, data: [] });

      useInsightsStore.setState({
        session: createSession({ id: 'existing' }),
        status: { phase: 'streaming', message: 'Busy' },
        pendingMessage: 'pending'
      });

      await clearSession('project-1');

      expect(electronAPI.clearInsightsSession).toHaveBeenCalledWith('project-1');
      expect(electronAPI.getInsightsSession).toHaveBeenCalledWith('project-1');
      expect(useInsightsStore.getState().session?.id).toBe('refreshed');
    });

    it('does nothing when clear fails', async () => {
      const existingSession = createSession({ id: 'existing' });
      electronAPI.clearInsightsSession.mockResolvedValue({ success: false });
      useInsightsStore.setState({
        session: existingSession,
        status: { phase: 'streaming', message: 'Busy' }
      });

      await clearSession('project-1');

      expect(electronAPI.clearInsightsSession).toHaveBeenCalledWith('project-1');
      expect(electronAPI.getInsightsSession).not.toHaveBeenCalled();
      expect(useInsightsStore.getState().session?.id).toBe('existing');
    });
  });

  describe('createTaskFromSuggestion', () => {
    it('returns task when IPC succeeds', async () => {
      const task = {
        id: '001-task',
        specId: '001-task',
        projectId: 'project-1',
        title: 'Test',
        description: 'Desc',
        status: 'backlog',
        subtasks: [],
        logs: [],
        metadata: { sourceType: 'insights' },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      electronAPI.createTaskFromInsights.mockResolvedValue({ success: true, data: task });

      const result = await createTaskFromSuggestion('project-1', 'Test', 'Desc', { sourceType: 'insights' });

      expect(electronAPI.createTaskFromInsights).toHaveBeenCalledWith('project-1', 'Test', 'Desc', { sourceType: 'insights' });
      expect(result).toEqual(task);
    });

    it('returns null when IPC fails', async () => {
      electronAPI.createTaskFromInsights.mockResolvedValue({ success: false });

      const result = await createTaskFromSuggestion('project-1', 'Test', 'Desc');

      expect(result).toBeNull();
    });
  });
});
