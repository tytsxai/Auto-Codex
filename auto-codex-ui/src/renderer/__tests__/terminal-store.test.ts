/**
 * Unit tests for Terminal Store
 * Tests Zustand store state management + session restoration
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  useTerminalStore,
  restoreTerminalSessions
} from '../stores/terminal-store';
import { terminalBufferManager } from '../lib/terminal-buffer-manager';
import type { TerminalSession } from '../../shared/types';

vi.mock('uuid', () => {
  let count = 0;
  return {
    v4: () => `uuid-${++count}`
  };
});

const resetBuffers = (): void => {
  for (const id of terminalBufferManager.getAllIds()) {
    terminalBufferManager.dispose(id);
  }
};

const createSession = (overrides: Partial<TerminalSession> = {}): TerminalSession => ({
  id: `term-${Math.random().toString(36).slice(2)}`,
  title: 'Restored Terminal',
  cwd: '/tmp',
  projectPath: '/tmp/project',
  isCodexMode: false,
  outputBuffer: 'hello',
  createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  lastActiveAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  ...overrides
});

describe('Terminal Store', () => {
  let electronAPI: {
    getTerminalSessions: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    resetBuffers();

    electronAPI = {
      getTerminalSessions: vi.fn()
    };

    if (!(globalThis as typeof globalThis & { window?: Window }).window) {
      (globalThis as typeof globalThis & { window: Window }).window = {} as Window;
    }

    (window as Window & { electronAPI: typeof electronAPI }).electronAPI = electronAPI;

    useTerminalStore.setState({
      terminals: [],
      layouts: [],
      activeTerminalId: null,
      maxTerminals: 12,
      hasRestoredSessions: false
    });
  });

  afterEach(() => {
    resetBuffers();
    vi.clearAllMocks();
  });

  describe('state management', () => {
    it('adds terminals and sets active session', () => {
      const created = useTerminalStore.getState().addTerminal('/tmp/project');

      const state = useTerminalStore.getState();
      expect(created).not.toBeNull();
      expect(state.terminals).toHaveLength(1);
      expect(state.activeTerminalId).toBe(created?.id);
      expect(state.terminals[0].cwd).toBe('/tmp/project');
      expect(state.terminals[0].status).toBe('idle');
      expect(state.terminals[0].isCodexMode).toBe(false);
    });

    it('returns null when max terminal count is reached', () => {
      useTerminalStore.setState({ maxTerminals: 1 });

      const first = useTerminalStore.getState().addTerminal('/tmp');
      const second = useTerminalStore.getState().addTerminal('/tmp');

      expect(first).not.toBeNull();
      expect(second).toBeNull();
      expect(useTerminalStore.getState().terminals).toHaveLength(1);
    });

    it('reuses existing external terminal and sets active', () => {
      const initial = useTerminalStore.getState().addExternalTerminal({ id: 'ext-1', title: 'Ext' });
      const reused = useTerminalStore.getState().addExternalTerminal({ id: 'ext-1', title: 'Ignored' });

      const state = useTerminalStore.getState();
      expect(reused?.id).toBe(initial?.id);
      expect(state.terminals).toHaveLength(1);
      expect(state.activeTerminalId).toBe('ext-1');
    });

    it('updates codex mode and status', () => {
      const created = useTerminalStore.getState().addTerminal('/tmp');
      expect(created).not.toBeNull();

      useTerminalStore.getState().setCodexMode(created!.id, true);
      let state = useTerminalStore.getState();
      expect(state.getTerminal(created!.id)?.isCodexMode).toBe(true);
      expect(state.getTerminal(created!.id)?.status).toBe('codex-active');

      useTerminalStore.getState().setCodexMode(created!.id, false);
      state = useTerminalStore.getState();
      expect(state.getTerminal(created!.id)?.isCodexMode).toBe(false);
      expect(state.getTerminal(created!.id)?.status).toBe('running');
    });

    it('removes terminal, disposes buffers, and updates active terminal', () => {
      const first = useTerminalStore.getState().addTerminal('/tmp/one');
      const second = useTerminalStore.getState().addTerminal('/tmp/two');
      terminalBufferManager.set(second!.id, 'buffer');

      useTerminalStore.getState().removeTerminal(second!.id);

      const state = useTerminalStore.getState();
      expect(state.terminals).toHaveLength(1);
      expect(state.activeTerminalId).toBe(first!.id);
      expect(terminalBufferManager.has(second!.id)).toBe(false);
    });

    it('restores terminals and buffers from session data', () => {
      const session = createSession({
        id: 'restored-1',
        outputBuffer: 'restored-output'
      });

      const restored = useTerminalStore.getState().addRestoredTerminal(session);

      const state = useTerminalStore.getState();
      expect(restored.id).toBe('restored-1');
      expect(restored.isRestored).toBe(true);
      expect(state.activeTerminalId).toBe('restored-1');
      expect(terminalBufferManager.get('restored-1')).toBe('restored-output');
    });
  });

  describe('restoreTerminalSessions', () => {
    it('loads sessions, restores buffers, and sets hasRestoredSessions', async () => {
      const sessionA = createSession({ id: 'session-a', outputBuffer: 'buffer-a' });
      const sessionB = createSession({ id: 'session-b', outputBuffer: 'buffer-b' });

      electronAPI.getTerminalSessions.mockResolvedValue({
        success: true,
        data: [sessionA, sessionB]
      });

      await restoreTerminalSessions('/tmp/project');

      const state = useTerminalStore.getState();
      expect(state.terminals).toHaveLength(2);
      expect(state.activeTerminalId).toBe('session-a');
      expect(state.hasRestoredSessions).toBe(true);
      expect(terminalBufferManager.get('session-a')).toBe('buffer-a');
      expect(terminalBufferManager.get('session-b')).toBe('buffer-b');
    });

    it('skips restore when terminals already exist', async () => {
      useTerminalStore.getState().addTerminal('/tmp');

      await restoreTerminalSessions('/tmp/project');

      expect(electronAPI.getTerminalSessions).not.toHaveBeenCalled();
    });

    it('handles IPC errors without throwing', async () => {
      electronAPI.getTerminalSessions.mockRejectedValue(new Error('boom'));

      await restoreTerminalSessions('/tmp/project');

      const state = useTerminalStore.getState();
      expect(state.terminals).toHaveLength(0);
      expect(state.hasRestoredSessions).toBe(false);
    });
  });
});
