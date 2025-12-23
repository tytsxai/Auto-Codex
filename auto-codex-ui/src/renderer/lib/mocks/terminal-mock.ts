/**
 * Mock implementation for terminal operations
 */

export const terminalMock = {
  createTerminal: async () => {
    console.warn('[Browser Mock] createTerminal called');
    return { success: true };
  },

  destroyTerminal: async () => {
    console.warn('[Browser Mock] destroyTerminal called');
    return { success: true };
  },

  sendTerminalInput: () => {
    console.warn('[Browser Mock] sendTerminalInput called');
  },

  resizeTerminal: () => {
    console.warn('[Browser Mock] resizeTerminal called');
  },

  invokeCodexInTerminal: () => {
    console.warn('[Browser Mock] invokeCodexInTerminal called');
  },

  generateTerminalName: async () => ({
    success: true,
    data: 'Mock Terminal'
  }),

  // Terminal session management
  getTerminalSessions: async () => ({
    success: true,
    data: []
  }),

  restoreTerminalSession: async () => ({
    success: true,
    data: {
      success: true,
      terminalId: 'restored-terminal'
    }
  }),

  clearTerminalSessions: async () => ({ success: true }),

  resumeCodexInTerminal: () => {
    console.warn('[Browser Mock] resumeCodexInTerminal called');
  },

  getTerminalSessionDates: async () => ({
    success: true,
    data: []
  }),

  getTerminalSessionsForDate: async () => ({
    success: true,
    data: []
  }),

  restoreTerminalSessionsFromDate: async () => ({
    success: true,
    data: {
      restored: 0,
      failed: 0,
      sessions: []
    }
  }),

  saveTerminalBuffer: async () => {},

  // Terminal Event Listeners (no-op in browser)
  onTerminalOutput: () => () => {},
  onTerminalExit: () => () => {},
  onTerminalTitleChange: () => () => {},
  onTerminalCodexSession: () => () => {},
  onTerminalRateLimit: () => () => {},
  onTerminalOAuthToken: () => () => {},
  onCodexProfileLoginTerminal: () => () => {}
};
