import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type {
  IPCResult,
  TerminalCreateOptions,
  RateLimitInfo,
  CodexProfile,
  CodexProfileSettings,
  CodexUsageSnapshot
} from '../../shared/types';

/** Type for proactive swap notification events */
interface ProactiveSwapNotification {
  fromProfile: { id: string; name: string };
  toProfile: { id: string; name: string };
  reason: string;
  usageSnapshot: CodexUsageSnapshot;
}

export interface TerminalAPI {
  // Terminal Operations
  createTerminal: (options: TerminalCreateOptions) => Promise<IPCResult>;
  destroyTerminal: (id: string) => Promise<IPCResult>;
  sendTerminalInput: (id: string, data: string) => void;
  resizeTerminal: (id: string, cols: number, rows: number) => void;
  invokeCodexInTerminal: (id: string, cwd?: string) => void;
  generateTerminalName: (command: string, cwd?: string) => Promise<IPCResult<string>>;

  // Terminal Session Management
  getTerminalSessions: (projectPath: string) => Promise<IPCResult<import('../../shared/types').TerminalSession[]>>;
  restoreTerminalSession: (
    session: import('../../shared/types').TerminalSession,
    cols?: number,
    rows?: number
  ) => Promise<IPCResult<import('../../shared/types').TerminalRestoreResult>>;
  clearTerminalSessions: (projectPath: string) => Promise<IPCResult>;
  resumeCodexInTerminal: (id: string, sessionId?: string) => void;
  getTerminalSessionDates: (projectPath?: string) => Promise<IPCResult<import('../../shared/types').SessionDateInfo[]>>;
  getTerminalSessionsForDate: (
    date: string,
    projectPath: string
  ) => Promise<IPCResult<import('../../shared/types').TerminalSession[]>>;
  restoreTerminalSessionsFromDate: (
    date: string,
    projectPath: string,
    cols?: number,
    rows?: number
  ) => Promise<IPCResult<import('../../shared/types').SessionDateRestoreResult>>;

  // Terminal Event Listeners
  onTerminalOutput: (callback: (id: string, data: string) => void) => () => void;
  onTerminalExit: (callback: (id: string, exitCode: number) => void) => () => void;
  onTerminalTitleChange: (callback: (id: string, title: string) => void) => () => void;
  onTerminalCodexSession: (callback: (id: string, sessionId: string) => void) => () => void;
  onTerminalRateLimit: (callback: (info: RateLimitInfo) => void) => () => void;
  onTerminalOAuthToken: (
    callback: (info: { terminalId: string; profileId?: string; email?: string; success: boolean; message?: string; detectedAt: string }) => void
  ) => () => void;
  onCodexProfileLoginTerminal: (
    callback: (info: { terminalId: string; profileId: string; profileName: string; cwd?: string }) => void
  ) => () => void;

  // Codex Profile Management
  getCodexProfiles: () => Promise<IPCResult<CodexProfileSettings>>;
  saveCodexProfile: (profile: CodexProfile) => Promise<IPCResult<CodexProfile>>;
  deleteCodexProfile: (profileId: string) => Promise<IPCResult>;
  renameCodexProfile: (profileId: string, newName: string) => Promise<IPCResult>;
  setActiveCodexProfile: (profileId: string) => Promise<IPCResult>;
  switchCodexProfile: (terminalId: string, profileId: string) => Promise<IPCResult>;
  initializeCodexProfile: (profileId: string) => Promise<IPCResult>;
  setCodexProfileToken: (profileId: string, token: string, email?: string) => Promise<IPCResult>;
  getAutoSwitchSettings: () => Promise<IPCResult<import('../../shared/types').CodexAutoSwitchSettings>>;
  updateAutoSwitchSettings: (settings: Partial<import('../../shared/types').CodexAutoSwitchSettings>) => Promise<IPCResult>;
  fetchCodexUsage: (terminalId: string) => Promise<IPCResult>;
  getBestAvailableProfile: (excludeProfileId?: string) => Promise<IPCResult<import('../../shared/types').CodexProfile | null>>;
  onSDKRateLimit: (callback: (info: import('../../shared/types').SDKRateLimitInfo) => void) => () => void;
  retryWithProfile: (request: import('../../shared/types').RetryWithProfileRequest) => Promise<IPCResult>;

  // Usage Monitoring (Proactive Account Switching)
  requestUsageUpdate: () => Promise<IPCResult<import('../../shared/types').CodexUsageSnapshot | null>>;
  onUsageUpdated: (callback: (usage: import('../../shared/types').CodexUsageSnapshot) => void) => () => void;
  onProactiveSwapNotification: (callback: (notification: ProactiveSwapNotification) => void) => () => void;
}

export const createTerminalAPI = (): TerminalAPI => ({
  // Terminal Operations
  createTerminal: (options: TerminalCreateOptions): Promise<IPCResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CREATE, options),

  destroyTerminal: (id: string): Promise<IPCResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_DESTROY, id),

  sendTerminalInput: (id: string, data: string): void =>
    ipcRenderer.send(IPC_CHANNELS.TERMINAL_INPUT, id, data),

  resizeTerminal: (id: string, cols: number, rows: number): void =>
    ipcRenderer.send(IPC_CHANNELS.TERMINAL_RESIZE, id, cols, rows),

  invokeCodexInTerminal: (id: string, cwd?: string): void =>
    ipcRenderer.send(IPC_CHANNELS.TERMINAL_INVOKE_CODEX, id, cwd),

  generateTerminalName: (command: string, cwd?: string): Promise<IPCResult<string>> =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_GENERATE_NAME, command, cwd),

  // Terminal Session Management
  getTerminalSessions: (projectPath: string): Promise<IPCResult<import('../../shared/types').TerminalSession[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_GET_SESSIONS, projectPath),

  restoreTerminalSession: (
    session: import('../../shared/types').TerminalSession,
    cols?: number,
    rows?: number
  ): Promise<IPCResult<import('../../shared/types').TerminalRestoreResult>> =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_RESTORE_SESSION, session, cols, rows),

  clearTerminalSessions: (projectPath: string): Promise<IPCResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CLEAR_SESSIONS, projectPath),

  resumeCodexInTerminal: (id: string, sessionId?: string): void =>
    ipcRenderer.send(IPC_CHANNELS.TERMINAL_RESUME_CODEX, id, sessionId),

  getTerminalSessionDates: (projectPath?: string): Promise<IPCResult<import('../../shared/types').SessionDateInfo[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_GET_SESSION_DATES, projectPath),

  getTerminalSessionsForDate: (
    date: string,
    projectPath: string
  ): Promise<IPCResult<import('../../shared/types').TerminalSession[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_GET_SESSIONS_FOR_DATE, date, projectPath),

  restoreTerminalSessionsFromDate: (
    date: string,
    projectPath: string,
    cols?: number,
    rows?: number
  ): Promise<IPCResult<import('../../shared/types').SessionDateRestoreResult>> =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_RESTORE_FROM_DATE, date, projectPath, cols, rows),

  // Terminal Event Listeners
  onTerminalOutput: (
    callback: (id: string, data: string) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      id: string,
      data: string
    ): void => {
      callback(id, data);
    };
    ipcRenderer.on(IPC_CHANNELS.TERMINAL_OUTPUT, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_OUTPUT, handler);
    };
  },

  onTerminalExit: (
    callback: (id: string, exitCode: number) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      id: string,
      exitCode: number
    ): void => {
      callback(id, exitCode);
    };
    ipcRenderer.on(IPC_CHANNELS.TERMINAL_EXIT, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_EXIT, handler);
    };
  },

  onTerminalTitleChange: (
    callback: (id: string, title: string) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      id: string,
      title: string
    ): void => {
      callback(id, title);
    };
    ipcRenderer.on(IPC_CHANNELS.TERMINAL_TITLE_CHANGE, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_TITLE_CHANGE, handler);
    };
  },

  onTerminalCodexSession: (
    callback: (id: string, sessionId: string) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      id: string,
      sessionId: string
    ): void => {
      callback(id, sessionId);
    };
    ipcRenderer.on(IPC_CHANNELS.TERMINAL_CODEX_SESSION, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_CODEX_SESSION, handler);
    };
  },

  onTerminalRateLimit: (
    callback: (info: RateLimitInfo) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      info: RateLimitInfo
    ): void => {
      callback(info);
    };
    ipcRenderer.on(IPC_CHANNELS.TERMINAL_RATE_LIMIT, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_RATE_LIMIT, handler);
    };
  },

  onTerminalOAuthToken: (
    callback: (info: { terminalId: string; profileId?: string; email?: string; success: boolean; message?: string; detectedAt: string }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      info: { terminalId: string; profileId?: string; email?: string; success: boolean; message?: string; detectedAt: string }
    ): void => {
      callback(info);
    };
    ipcRenderer.on(IPC_CHANNELS.TERMINAL_OAUTH_TOKEN, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_OAUTH_TOKEN, handler);
    };
  },

  onCodexProfileLoginTerminal: (
    callback: (info: { terminalId: string; profileId: string; profileName: string; cwd?: string }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      info: { terminalId: string; profileId: string; profileName: string; cwd?: string }
    ): void => {
      callback(info);
    };
    ipcRenderer.on(IPC_CHANNELS.CODEX_PROFILE_LOGIN_TERMINAL, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.CODEX_PROFILE_LOGIN_TERMINAL, handler);
    };
  },

  // Codex Profile Management
  getCodexProfiles: (): Promise<IPCResult<CodexProfileSettings>> =>
    ipcRenderer.invoke(IPC_CHANNELS.CODEX_PROFILES_GET),

  saveCodexProfile: (profile: CodexProfile): Promise<IPCResult<CodexProfile>> =>
    ipcRenderer.invoke(IPC_CHANNELS.CODEX_PROFILE_SAVE, profile),

  deleteCodexProfile: (profileId: string): Promise<IPCResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.CODEX_PROFILE_DELETE, profileId),

  renameCodexProfile: (profileId: string, newName: string): Promise<IPCResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.CODEX_PROFILE_RENAME, profileId, newName),

  setActiveCodexProfile: (profileId: string): Promise<IPCResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.CODEX_PROFILE_SET_ACTIVE, profileId),

  switchCodexProfile: (terminalId: string, profileId: string): Promise<IPCResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.CODEX_PROFILE_SWITCH, terminalId, profileId),

  initializeCodexProfile: (profileId: string): Promise<IPCResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.CODEX_PROFILE_INITIALIZE, profileId),

  setCodexProfileToken: (profileId: string, token: string, email?: string): Promise<IPCResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.CODEX_PROFILE_SET_TOKEN, profileId, token, email),

  getAutoSwitchSettings: (): Promise<IPCResult<import('../../shared/types').CodexAutoSwitchSettings>> =>
    ipcRenderer.invoke(IPC_CHANNELS.CODEX_PROFILE_AUTO_SWITCH_SETTINGS),

  updateAutoSwitchSettings: (settings: Partial<import('../../shared/types').CodexAutoSwitchSettings>): Promise<IPCResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.CODEX_PROFILE_UPDATE_AUTO_SWITCH, settings),

  fetchCodexUsage: (terminalId: string): Promise<IPCResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.CODEX_PROFILE_FETCH_USAGE, terminalId),

  getBestAvailableProfile: (excludeProfileId?: string): Promise<IPCResult<import('../../shared/types').CodexProfile | null>> =>
    ipcRenderer.invoke(IPC_CHANNELS.CODEX_PROFILE_GET_BEST_PROFILE, excludeProfileId),

  onSDKRateLimit: (
    callback: (info: import('../../shared/types').SDKRateLimitInfo) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      info: import('../../shared/types').SDKRateLimitInfo
    ): void => {
      callback(info);
    };
    ipcRenderer.on(IPC_CHANNELS.CODEX_SDK_RATE_LIMIT, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.CODEX_SDK_RATE_LIMIT, handler);
    };
  },

  retryWithProfile: (request: import('../../shared/types').RetryWithProfileRequest): Promise<IPCResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.CODEX_RETRY_WITH_PROFILE, request),

  // Usage Monitoring (Proactive Account Switching)
  requestUsageUpdate: (): Promise<IPCResult<import('../../shared/types').CodexUsageSnapshot | null>> =>
    ipcRenderer.invoke(IPC_CHANNELS.USAGE_REQUEST),

  onUsageUpdated: (
    callback: (usage: import('../../shared/types').CodexUsageSnapshot) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      usage: import('../../shared/types').CodexUsageSnapshot
    ): void => {
      callback(usage);
    };
    ipcRenderer.on(IPC_CHANNELS.USAGE_UPDATED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.USAGE_UPDATED, handler);
    };
  },

  onProactiveSwapNotification: (
    callback: (notification: ProactiveSwapNotification) => void
  ): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, notification: ProactiveSwapNotification): void => {
      callback(notification);
    };
    ipcRenderer.on(IPC_CHANNELS.PROACTIVE_SWAP_NOTIFICATION, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.PROACTIVE_SWAP_NOTIFICATION, handler);
    };
  }
});
