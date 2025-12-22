import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { TerminalSession } from '../../shared/types';
import { terminalBufferManager } from '../lib/terminal-buffer-manager';
import { debugLog, debugError } from '../../shared/utils/debug-logger';

export type TerminalStatus = 'idle' | 'running' | 'claude-active' | 'exited';

export interface Terminal {
  id: string;
  title: string;
  status: TerminalStatus;
  cwd: string;
  createdAt: Date;
  isClaudeMode: boolean;
  claudeSessionId?: string;  // 用于恢复的 Claude Code 会话 ID
  // outputBuffer 已移除 - 现在由 terminalBufferManager 单例管理
  isRestored?: boolean;  // 该终端是否从已保存的会话恢复
  associatedTaskId?: string;  // 与此终端关联的任务 ID（用于加载上下文）
}

interface TerminalLayout {
  id: string;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

interface TerminalState {
  terminals: Terminal[];
  layouts: TerminalLayout[];
  activeTerminalId: string | null;
  maxTerminals: number;
  hasRestoredSessions: boolean;  // 跟踪该项目是否已恢复会话

  // 操作
  addTerminal: (cwd?: string) => Terminal | null;
  addRestoredTerminal: (session: TerminalSession) => Terminal;
  removeTerminal: (id: string) => void;
  updateTerminal: (id: string, updates: Partial<Terminal>) => void;
  setActiveTerminal: (id: string | null) => void;
  setTerminalStatus: (id: string, status: TerminalStatus) => void;
  setClaudeMode: (id: string, isClaudeMode: boolean) => void;
  setClaudeSessionId: (id: string, sessionId: string) => void;
  setAssociatedTask: (id: string, taskId: string | undefined) => void;
  appendOutput: (id: string, data: string) => void;
  clearOutputBuffer: (id: string) => void;
  clearAllTerminals: () => void;
  setHasRestoredSessions: (value: boolean) => void;

  // 选择器
  getTerminal: (id: string) => Terminal | undefined;
  getActiveTerminal: () => Terminal | undefined;
  canAddTerminal: () => boolean;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  terminals: [],
  layouts: [],
  activeTerminalId: null,
  maxTerminals: 12,
  hasRestoredSessions: false,

  addTerminal: (cwd?: string) => {
    const state = get();
    if (state.terminals.length >= state.maxTerminals) {
      return null;
    }

    const newTerminal: Terminal = {
      id: uuid(),
      title: `Terminal ${state.terminals.length + 1}`,
      status: 'idle',
      cwd: cwd || process.env.HOME || '~',
      createdAt: new Date(),
      isClaudeMode: false,
      // outputBuffer 已移除 - 由 terminalBufferManager 管理
    };

    set((state) => ({
      terminals: [...state.terminals, newTerminal],
      activeTerminalId: newTerminal.id,
    }));

    return newTerminal;
  },

  addRestoredTerminal: (session: TerminalSession) => {
    const state = get();

    // 检查终端是否已存在
    const existingTerminal = state.terminals.find(t => t.id === session.id);
    if (existingTerminal) {
      return existingTerminal;
    }

    const restoredTerminal: Terminal = {
      id: session.id,
      title: session.title,
      status: 'idle',  // 当 PTY 创建后会更新为 'running'
      cwd: session.cwd,
      createdAt: new Date(session.createdAt),
      isClaudeMode: session.isClaudeMode,
      claudeSessionId: session.claudeSessionId,
      // outputBuffer 现在存储在 terminalBufferManager 中
      isRestored: true,
    };

    // 将缓冲区恢复到缓冲区管理器
    if (session.outputBuffer) {
      terminalBufferManager.set(session.id, session.outputBuffer);
    }

    set((state) => ({
      terminals: [...state.terminals, restoredTerminal],
      activeTerminalId: state.activeTerminalId || restoredTerminal.id,
    }));

    return restoredTerminal;
  },

  removeTerminal: (id: string) => {
    // 清理缓冲区管理器
    terminalBufferManager.dispose(id);

    set((state) => {
      const newTerminals = state.terminals.filter((t) => t.id !== id);
      const newActiveId = state.activeTerminalId === id
        ? (newTerminals.length > 0 ? newTerminals[newTerminals.length - 1].id : null)
        : state.activeTerminalId;

      return {
        terminals: newTerminals,
        activeTerminalId: newActiveId,
      };
    });
  },

  updateTerminal: (id: string, updates: Partial<Terminal>) => {
    set((state) => ({
      terminals: state.terminals.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }));
  },

  setActiveTerminal: (id: string | null) => {
    set({ activeTerminalId: id });
  },

  setTerminalStatus: (id: string, status: TerminalStatus) => {
    set((state) => ({
      terminals: state.terminals.map((t) =>
        t.id === id ? { ...t, status } : t
      ),
    }));
  },

  setClaudeMode: (id: string, isClaudeMode: boolean) => {
    set((state) => ({
      terminals: state.terminals.map((t) =>
        t.id === id
          ? { ...t, isClaudeMode, status: isClaudeMode ? 'claude-active' : 'running' }
          : t
      ),
    }));
  },

  setClaudeSessionId: (id: string, sessionId: string) => {
    set((state) => ({
      terminals: state.terminals.map((t) =>
        t.id === id ? { ...t, claudeSessionId: sessionId } : t
      ),
    }));
  },

  setAssociatedTask: (id: string, taskId: string | undefined) => {
    set((state) => ({
      terminals: state.terminals.map((t) =>
        t.id === id ? { ...t, associatedTaskId: taskId } : t
      ),
    }));
  },

  // 已弃用：请直接使用 terminalBufferManager.append()
  // 为兼容保留，但不会触发 React 重新渲染
  appendOutput: (id: string, data: string) => {
    terminalBufferManager.append(id, data);
    // 不更新 React 状态 - 这是关键的性能提升！
  },

  // 已弃用：请直接使用 terminalBufferManager.clear()
  clearOutputBuffer: (id: string) => {
    terminalBufferManager.clear(id);
  },

  clearAllTerminals: () => {
    set({ terminals: [], activeTerminalId: null, hasRestoredSessions: false });
  },

  setHasRestoredSessions: (value: boolean) => {
    set({ hasRestoredSessions: value });
  },

  getTerminal: (id: string) => {
    return get().terminals.find((t) => t.id === id);
  },

  getActiveTerminal: () => {
    const state = get();
    return state.terminals.find((t) => t.id === state.activeTerminalId);
  },

  canAddTerminal: () => {
    const state = get();
    return state.terminals.length < state.maxTerminals;
  },
}));

/**
 * 从持久化存储中恢复项目的终端会话
 */
export async function restoreTerminalSessions(projectPath: string): Promise<void> {
  const store = useTerminalStore.getState();

  // 如果已经有终端则不恢复（用户可能已手动打开）
  if (store.terminals.length > 0) {
    debugLog('[TerminalStore] Terminals already exist, skipping session restore');
    return;
  }

  try {
    const result = await window.electronAPI.getTerminalSessions(projectPath);
    if (!result.success || !result.data || result.data.length === 0) {
      return;
    }

    // 将终端添加到 store（它们会在 TerminalGrid 组件中创建）
    for (const session of result.data) {
      store.addRestoredTerminal(session);
    }

    store.setHasRestoredSessions(true);
  } catch (error) {
    debugError('[TerminalStore] Error restoring sessions:', error);
  }
}
