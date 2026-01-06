/**
 * PTY Manager Module
 * Handles low-level PTY process creation and lifecycle
 */

import * as pty from '@lydell/node-pty';
import * as os from 'os';
import { existsSync } from 'fs';
import type { TerminalProcess, WindowGetter } from './types';
import { IPC_CHANNELS } from '../../shared/constants';
import { getCodexProfileManager } from '../codex-profile-manager';

/**
 * Windows shell paths for common terminals
 */
const WINDOWS_SHELL_PATHS: string[] = [
  'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
  'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
  'C:\\Program Files\\Git\\bin\\bash.exe',
];

/**
 * Get the best available Windows shell
 */
function getWindowsShell(): string {
  // Try to find a better shell than cmd.exe
  for (const shellPath of WINDOWS_SHELL_PATHS) {
    if (existsSync(shellPath)) {
      return shellPath;
    }
  }
  return process.env.COMSPEC || 'cmd.exe';
}

/**
 * Spawn a new PTY process with appropriate shell and environment
 */
export function spawnPtyProcess(
  cwd: string,
  cols: number,
  rows: number,
  profileEnv?: Record<string, string>
): pty.IPty {
  const shell = process.platform === 'win32'
    ? getWindowsShell()
    : process.env.SHELL || '/bin/zsh';

  const shellArgs = process.platform === 'win32' ? [] : ['-l'];

  console.warn('[PtyManager] Spawning shell:', shell, shellArgs);

  return pty.spawn(shell, shellArgs, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: cwd || os.homedir(),
    env: {
      ...process.env,
      ...profileEnv,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    },
  });
}

/**
 * Setup PTY event handlers for a terminal process
 */
export function setupPtyHandlers(
  terminal: TerminalProcess,
  terminals: Map<string, TerminalProcess>,
  getWindow: WindowGetter,
  onDataCallback: (terminal: TerminalProcess, data: string) => void,
  onExitCallback: (terminal: TerminalProcess) => void
): void {
  const { id, pty: ptyProcess } = terminal;

  // Handle data from terminal
  ptyProcess.onData((data) => {
    // Append to output buffer (limit to 100KB)
    terminal.outputBuffer = (terminal.outputBuffer + data).slice(-100000);

    // Call custom data handler
    onDataCallback(terminal, data);

    // Send to renderer
    const win = getWindow();
    if (win) {
      win.webContents.send(IPC_CHANNELS.TERMINAL_OUTPUT, id, data);
    }
  });

  // Handle terminal exit
  ptyProcess.onExit(({ exitCode }) => {
    console.warn('[PtyManager] Terminal exited:', id, 'code:', exitCode);

    const win = getWindow();
    if (win) {
      win.webContents.send(IPC_CHANNELS.TERMINAL_EXIT, id, exitCode);
    }

    // Call custom exit handler
    onExitCallback(terminal);

    terminals.delete(id);
  });
}

/**
 * Write data to a PTY process
 */
export function writeToPty(terminal: TerminalProcess, data: string): void {
  terminal.pty.write(data);
}

/**
 * Resize a PTY process
 */
export function resizePty(terminal: TerminalProcess, cols: number, rows: number): void {
  terminal.pty.resize(cols, rows);
}

/**
 * Kill a PTY process
 */
export function killPty(terminal: TerminalProcess): void {
  terminal.pty.kill();
}

/**
 * Get the active Codex profile environment variables
 */
export function getActiveProfileEnv(): Record<string, string> {
  const profileManager = getCodexProfileManager();
  return profileManager.getActiveProfileEnv();
}
