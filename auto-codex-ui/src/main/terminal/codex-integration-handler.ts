/**
 * Codex Integration Handler
 * Manages Codex-specific operations including profile switching, rate limiting, and OAuth token detection
 */

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { IPC_CHANNELS } from '../../shared/constants';
import { getCodexProfileManager } from '../codex-profile-manager';
import * as OutputParser from './output-parser';
import * as SessionHandler from './session-handler';
import { debugLog, debugError } from '../../shared/utils/debug-logger';
import { escapeShellArg, buildCdCommand } from '../../shared/utils/shell-escape';
import type {
  TerminalProcess,
  WindowGetter,
  RateLimitEvent,
  OAuthTokenEvent
} from './types';

const CODEX_TERMINAL_COMMAND =
  'codex --dangerously-bypass-approvals-and-sandbox -m gpt-5.2-codex -c model_reasoning_effort=xhigh -c enable_compaction=true';

/**
 * Handle rate limit detection and profile switching
 */
export function handleRateLimit(
  terminal: TerminalProcess,
  data: string,
  lastNotifiedRateLimitReset: Map<string, string>,
  getWindow: WindowGetter,
  switchProfileCallback: (terminalId: string, profileId: string) => Promise<void>
): void {
  const resetTime = OutputParser.extractRateLimitReset(data);
  if (!resetTime) {
    return;
  }

  const lastNotifiedReset = lastNotifiedRateLimitReset.get(terminal.id);
  if (resetTime === lastNotifiedReset) {
    return;
  }

  lastNotifiedRateLimitReset.set(terminal.id, resetTime);
  console.warn('[CodexIntegration] Rate limit detected, reset:', resetTime);

  const profileManager = getCodexProfileManager();
  const currentProfileId = terminal.codexProfileId || 'default';

  try {
    const rateLimitEvent = profileManager.recordRateLimitEvent(currentProfileId, resetTime);
    console.warn('[CodexIntegration] Recorded rate limit event:', rateLimitEvent.type);
  } catch (err) {
    console.error('[CodexIntegration] Failed to record rate limit event:', err);
  }

  const autoSwitchSettings = profileManager.getAutoSwitchSettings();
  const bestProfile = profileManager.getBestAvailableProfile(currentProfileId);

  const win = getWindow();
  if (win) {
    win.webContents.send(IPC_CHANNELS.TERMINAL_RATE_LIMIT, {
      terminalId: terminal.id,
      resetTime,
      detectedAt: new Date().toISOString(),
      profileId: currentProfileId,
      suggestedProfileId: bestProfile?.id,
      suggestedProfileName: bestProfile?.name,
      autoSwitchEnabled: autoSwitchSettings.autoSwitchOnRateLimit
    } as RateLimitEvent);
  }

  if (autoSwitchSettings.enabled && autoSwitchSettings.autoSwitchOnRateLimit && bestProfile) {
    console.warn('[CodexIntegration] Auto-switching to profile:', bestProfile.name);
    switchProfileCallback(terminal.id, bestProfile.id).then(_result => {
      console.warn('[CodexIntegration] Auto-switch completed');
    }).catch(err => {
      console.error('[CodexIntegration] Auto-switch failed:', err);
    });
  }
}

/**
 * Handle OAuth token detection and auto-save
 */
export function handleOAuthToken(
  terminal: TerminalProcess,
  data: string,
  getWindow: WindowGetter
): void {
  const token = OutputParser.extractOAuthToken(data);
  if (!token) {
    return;
  }

  console.warn('[CodexIntegration] OAuth token detected, length:', token.length);

  const email = OutputParser.extractEmail(terminal.outputBuffer);
  // Match both custom profiles (profile-123456) and the default profile
  const profileIdMatch = terminal.id.match(/codex-login-(profile-\d+|default)-/);

  if (profileIdMatch) {
    // Save to specific profile (profile login terminal)
    const profileId = profileIdMatch[1];
    const profileManager = getCodexProfileManager();
    const success = profileManager.setProfileToken(profileId, token, email || undefined);

    if (success) {
      console.warn('[CodexIntegration] OAuth token auto-saved to profile:', profileId);

      const win = getWindow();
      if (win) {
        win.webContents.send(IPC_CHANNELS.TERMINAL_OAUTH_TOKEN, {
          terminalId: terminal.id,
          profileId,
          email,
          success: true,
          detectedAt: new Date().toISOString()
        } as OAuthTokenEvent);
      }
    } else {
      console.error('[CodexIntegration] Failed to save OAuth token to profile:', profileId);
    }
  } else {
    // No profile-specific terminal, save to active profile (GitHub OAuth flow, etc.)
    console.warn('[CodexIntegration] OAuth token detected in non-profile terminal, saving to active profile');
    const profileManager = getCodexProfileManager();
    const activeProfile = profileManager.getActiveProfile();

    // Defensive null check for active profile
    if (!activeProfile) {
      console.error('[CodexIntegration] Failed to save OAuth token: no active profile found');
      const win = getWindow();
      if (win) {
        win.webContents.send(IPC_CHANNELS.TERMINAL_OAUTH_TOKEN, {
          terminalId: terminal.id,
          profileId: undefined,
          email,
          success: false,
          message: 'No active profile found',
          detectedAt: new Date().toISOString()
        } as OAuthTokenEvent);
      }
      return;
    }

    const success = profileManager.setProfileToken(activeProfile.id, token, email || undefined);

    if (success) {
      console.warn('[CodexIntegration] OAuth token auto-saved to active profile:', activeProfile.name);

      const win = getWindow();
      if (win) {
        win.webContents.send(IPC_CHANNELS.TERMINAL_OAUTH_TOKEN, {
          terminalId: terminal.id,
          profileId: activeProfile.id,
          email,
          success: true,
          detectedAt: new Date().toISOString()
        } as OAuthTokenEvent);
      }
    } else {
      console.error('[CodexIntegration] Failed to save OAuth token to active profile:', activeProfile.name);
      const win = getWindow();
      if (win) {
        win.webContents.send(IPC_CHANNELS.TERMINAL_OAUTH_TOKEN, {
          terminalId: terminal.id,
          profileId: activeProfile?.id,
          email,
          success: false,
          message: 'Failed to save token to active profile',
          detectedAt: new Date().toISOString()
        } as OAuthTokenEvent);
      }
    }
  }
}

/**
 * Handle Codex session ID capture
 */
export function handleCodexSessionId(
  terminal: TerminalProcess,
  sessionId: string,
  getWindow: WindowGetter
): void {
  terminal.codexSessionId = sessionId;
  console.warn('[CodexIntegration] Captured Codex session ID:', sessionId);

  if (terminal.projectPath) {
    SessionHandler.updateCodexSessionId(terminal.projectPath, terminal.id, sessionId);
  }

  const win = getWindow();
  if (win) {
    win.webContents.send(IPC_CHANNELS.TERMINAL_CODEX_SESSION, terminal.id, sessionId);
  }
}

/**
 * Invoke Codex with optional profile override
 */
export function invokeCodex(
  terminal: TerminalProcess,
  cwd: string | undefined,
  profileId: string | undefined,
  getWindow: WindowGetter,
  onSessionCapture: (terminalId: string, projectPath: string, startTime: number) => void
): void {
  debugLog('[CodexIntegration:invokeCodex] ========== INVOKE CODEX START ==========');
  debugLog('[CodexIntegration:invokeCodex] Terminal ID:', terminal.id);
  debugLog('[CodexIntegration:invokeCodex] Requested profile ID:', profileId);
  debugLog('[CodexIntegration:invokeCodex] CWD:', cwd);

  terminal.isCodexMode = true;
  terminal.codexSessionId = undefined;

  const startTime = Date.now();
  const projectPath = cwd || terminal.projectPath || terminal.cwd;

  const profileManager = getCodexProfileManager();
  const activeProfile = profileId
    ? profileManager.getProfile(profileId)
    : profileManager.getActiveProfile();

  const previousProfileId = terminal.codexProfileId;
  terminal.codexProfileId = activeProfile?.id;

  debugLog('[CodexIntegration:invokeCodex] Profile resolution:', {
    previousProfileId,
    newProfileId: activeProfile?.id,
    profileName: activeProfile?.name,
    hasOAuthToken: !!activeProfile?.oauthToken,
    isDefault: activeProfile?.isDefault
  });

  // Use safe shell escaping to prevent command injection
  const cwdCommand = buildCdCommand(cwd);
  const needsEnvOverride = profileId && profileId !== previousProfileId;

  debugLog('[CodexIntegration:invokeCodex] Environment override check:', {
    profileIdProvided: !!profileId,
    previousProfileId,
    needsEnvOverride
  });

  if (needsEnvOverride && activeProfile && !activeProfile.isDefault) {
    const token = profileManager.getProfileToken(activeProfile.id);
    debugLog('[CodexIntegration:invokeCodex] Token retrieval:', {
      hasToken: !!token,
      tokenLength: token?.length
    });

    if (token) {
      const tempFile = path.join(os.tmpdir(), `.codex-token-${Date.now()}`);
      debugLog('[CodexIntegration:invokeCodex] Writing token to temp file:', tempFile);
      fs.writeFileSync(tempFile, `export CODEX_CODE_OAUTH_TOKEN="${token}"\n`, { mode: 0o600 });

      // Clear terminal and run command without adding to shell history:
      // - HISTFILE= disables history file writing for the current command
      // - HISTCONTROL=ignorespace causes commands starting with space to be ignored
      // - Leading space ensures the command is ignored even if HISTCONTROL was already set
      // - Uses subshell (...) to isolate environment changes
      // This prevents temp file paths from appearing in shell history
      const command = `clear && ${cwdCommand} HISTFILE= HISTCONTROL=ignorespace bash -c 'source "${tempFile}" && rm -f "${tempFile}" && exec ${CODEX_TERMINAL_COMMAND}'\r`;
      debugLog('[CodexIntegration:invokeCodex] Executing command (temp file method, history-safe)');
      terminal.pty.write(command);
      debugLog('[CodexIntegration:invokeCodex] ========== INVOKE CODEX COMPLETE (temp file) ==========');
      return;
    } else if (activeProfile.configDir) {
      // Clear terminal and run command without adding to shell history:
      // Same history-disabling technique as temp file method above
      // SECURITY: Use escapeShellArg for configDir to prevent command injection
      // Set CODEX_CONFIG_DIR as env var before bash -c to avoid embedding user input in the command string
      const escapedConfigDir = escapeShellArg(activeProfile.configDir);
      const command = `clear && ${cwdCommand}HISTFILE= HISTCONTROL=ignorespace CODEX_CONFIG_DIR=${escapedConfigDir} bash -c 'exec ${CODEX_TERMINAL_COMMAND}'\r`;
      debugLog('[CodexIntegration:invokeCodex] Executing command (configDir method, history-safe)');
      terminal.pty.write(command);
      debugLog('[CodexIntegration:invokeCodex] ========== INVOKE CODEX COMPLETE (configDir) ==========');
      return;
    } else {
      debugLog('[CodexIntegration:invokeCodex] WARNING: No token or configDir available for non-default profile');
    }
  }

  if (activeProfile && !activeProfile.isDefault) {
    debugLog('[CodexIntegration:invokeCodex] Using terminal environment for non-default profile:', activeProfile.name);
  }

  const command = `${cwdCommand}${CODEX_TERMINAL_COMMAND}\r`;
  debugLog('[CodexIntegration:invokeCodex] Executing command (default method):', command);
  terminal.pty.write(command);

  if (activeProfile) {
    profileManager.markProfileUsed(activeProfile.id);
  }

  const win = getWindow();
  if (win) {
    const title = activeProfile && !activeProfile.isDefault
      ? `Codex (${activeProfile.name})`
      : 'Codex';
    win.webContents.send(IPC_CHANNELS.TERMINAL_TITLE_CHANGE, terminal.id, title);
  }

  if (terminal.projectPath) {
    SessionHandler.persistSession(terminal);
  }

  if (projectPath) {
    onSessionCapture(terminal.id, projectPath, startTime);
  }

  debugLog('[CodexIntegration:invokeCodex] ========== INVOKE CODEX COMPLETE (default) ==========');
}

/**
 * Resume Codex with optional session ID
 */
export function resumeCodex(
  terminal: TerminalProcess,
  sessionId: string | undefined,
  getWindow: WindowGetter
): void {
  terminal.isCodexMode = true;

  let command: string;
  if (sessionId) {
    // SECURITY: Escape sessionId to prevent command injection
    command = `${CODEX_TERMINAL_COMMAND} --resume ${escapeShellArg(sessionId)}`;
    terminal.codexSessionId = sessionId;
  } else {
    command = `${CODEX_TERMINAL_COMMAND} --continue`;
  }

  terminal.pty.write(`${command}\r`);

  const win = getWindow();
  if (win) {
    win.webContents.send(IPC_CHANNELS.TERMINAL_TITLE_CHANGE, terminal.id, 'Codex');
  }
}

/**
 * Configuration for waiting for Codex to exit
 */
interface WaitForExitConfig {
  /** Maximum time to wait for Codex to exit (ms) */
  timeout?: number;
  /** Interval between checks (ms) */
  pollInterval?: number;
}

/**
 * Result of waiting for Codex to exit
 */
interface WaitForExitResult {
  /** Whether Codex exited successfully */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Whether the operation timed out */
  timedOut?: boolean;
}

/**
 * Shell prompt patterns that indicate Codex has exited and shell is ready
 * These patterns match common shell prompts across bash, zsh, fish, etc.
 */
const SHELL_PROMPT_PATTERNS = [
  /[$%#>❯]\s*$/m,                    // Common prompt endings: $, %, #, >, ❯
  /\w+@[\w.-]+[:\s]/,                // user@hostname: format
  /^\s*\S+\s*[$%#>❯]\s*$/m,          // hostname/path followed by prompt char
  /\(.*\)\s*[$%#>❯]\s*$/m,           // (venv) or (branch) followed by prompt
];

/**
 * Wait for Codex to exit by monitoring terminal output for shell prompt
 *
 * Instead of using fixed delays, this monitors the terminal's outputBuffer
 * for patterns indicating that Codex has exited and the shell prompt is visible.
 */
async function waitForCodexExit(
  terminal: TerminalProcess,
  config: WaitForExitConfig = {}
): Promise<WaitForExitResult> {
  const { timeout = 5000, pollInterval = 100 } = config;

  debugLog('[CodexIntegration:waitForCodexExit] Waiting for Codex to exit...');
  debugLog('[CodexIntegration:waitForCodexExit] Config:', { timeout, pollInterval });

  // Capture current buffer length to detect new output
  const initialBufferLength = terminal.outputBuffer.length;
  const startTime = Date.now();

  return new Promise((resolve) => {
    const checkForPrompt = () => {
      const elapsed = Date.now() - startTime;

      // Check for timeout
      if (elapsed >= timeout) {
        console.warn('[CodexIntegration:waitForCodexExit] Timeout waiting for Codex to exit after', timeout, 'ms');
        debugLog('[CodexIntegration:waitForCodexExit] Timeout reached, Codex may not have exited cleanly');
        resolve({
          success: false,
          error: `Timeout waiting for Codex to exit after ${timeout}ms`,
          timedOut: true
        });
        return;
      }

      // Get new output since we started waiting
      const newOutput = terminal.outputBuffer.slice(initialBufferLength);

      // Check if we can see a shell prompt in the new output
      for (const pattern of SHELL_PROMPT_PATTERNS) {
        if (pattern.test(newOutput)) {
          debugLog('[CodexIntegration:waitForCodexExit] Shell prompt detected after', elapsed, 'ms');
          debugLog('[CodexIntegration:waitForCodexExit] Matched pattern:', pattern.toString());
          resolve({ success: true });
          return;
        }
      }

      // Also check if isCodexMode was cleared (set by other handlers)
      if (!terminal.isCodexMode) {
        debugLog('[CodexIntegration:waitForCodexExit] isCodexMode flag cleared after', elapsed, 'ms');
        resolve({ success: true });
        return;
      }

      // Continue polling
      setTimeout(checkForPrompt, pollInterval);
    };

    // Start checking
    checkForPrompt();
  });
}

/**
 * Switch terminal to a different Codex profile
 */
export async function switchCodexProfile(
  terminal: TerminalProcess,
  profileId: string,
  getWindow: WindowGetter,
  invokeCodexCallback: (terminalId: string, cwd: string | undefined, profileId: string) => void,
  clearRateLimitCallback: (terminalId: string) => void
): Promise<{ success: boolean; error?: string }> {
  // Always-on tracing
  console.warn('[CodexIntegration:switchCodexProfile] Called for terminal:', terminal.id, '| profileId:', profileId);
  console.warn('[CodexIntegration:switchCodexProfile] Terminal state: isCodexMode=', terminal.isCodexMode);

  debugLog('[CodexIntegration:switchCodexProfile] ========== SWITCH PROFILE START ==========');
  debugLog('[CodexIntegration:switchCodexProfile] Terminal ID:', terminal.id);
  debugLog('[CodexIntegration:switchCodexProfile] Target profile ID:', profileId);
  debugLog('[CodexIntegration:switchCodexProfile] Terminal state:', {
    isCodexMode: terminal.isCodexMode,
    currentProfileId: terminal.codexProfileId,
    codexSessionId: terminal.codexSessionId,
    projectPath: terminal.projectPath,
    cwd: terminal.cwd
  });

  const profileManager = getCodexProfileManager();
  const profile = profileManager.getProfile(profileId);

  console.warn('[CodexIntegration:switchCodexProfile] Profile found:', profile?.name || 'NOT FOUND');
  debugLog('[CodexIntegration:switchCodexProfile] Target profile:', profile ? {
    id: profile.id,
    name: profile.name,
    hasOAuthToken: !!profile.oauthToken,
    isDefault: profile.isDefault
  } : 'NOT FOUND');

  if (!profile) {
    console.error('[CodexIntegration:switchCodexProfile] Profile not found, aborting');
    debugError('[CodexIntegration:switchCodexProfile] Profile not found, aborting');
    return { success: false, error: 'Profile not found' };
  }

  console.warn('[CodexIntegration:switchCodexProfile] Switching to profile:', profile.name);
  debugLog('[CodexIntegration:switchCodexProfile] Switching to Codex profile:', profile.name);

  if (terminal.isCodexMode) {
    console.warn('[CodexIntegration:switchCodexProfile] Sending exit commands (Ctrl+C, /exit)');
    debugLog('[CodexIntegration:switchCodexProfile] Terminal is in Codex mode, sending exit commands');

    // Send Ctrl+C to interrupt any ongoing operation
    debugLog('[CodexIntegration:switchCodexProfile] Sending Ctrl+C (\\x03)');
    terminal.pty.write('\x03');

    // Wait briefly for Ctrl+C to take effect before sending /exit
    await new Promise(resolve => setTimeout(resolve, 100));

    // Send /exit command
    debugLog('[CodexIntegration:switchCodexProfile] Sending /exit command');
    terminal.pty.write('/exit\r');

    // Wait for Codex to actually exit by monitoring for shell prompt
    const exitResult = await waitForCodexExit(terminal, { timeout: 5000, pollInterval: 100 });

    if (exitResult.timedOut) {
      console.warn('[CodexIntegration:switchCodexProfile] Timed out waiting for Codex to exit, proceeding with caution');
      debugLog('[CodexIntegration:switchCodexProfile] Exit timeout - terminal may be in inconsistent state');

      // Even on timeout, we'll try to proceed but log the warning
      // The alternative would be to abort, but that could leave users stuck
      // If this becomes a problem, we could add retry logic or abort option
    } else if (!exitResult.success) {
      console.error('[CodexIntegration:switchCodexProfile] Failed to exit Codex:', exitResult.error);
      debugError('[CodexIntegration:switchCodexProfile] Exit failed:', exitResult.error);
      // Continue anyway - the /exit command was sent
    } else {
      console.warn('[CodexIntegration:switchCodexProfile] Codex exited successfully');
      debugLog('[CodexIntegration:switchCodexProfile] Codex exited, ready to switch profile');
    }
  } else {
    console.warn('[CodexIntegration:switchCodexProfile] NOT in Codex mode, skipping exit commands');
    debugLog('[CodexIntegration:switchCodexProfile] Terminal NOT in Codex mode, skipping exit commands');
  }

  debugLog('[CodexIntegration:switchCodexProfile] Clearing rate limit state for terminal');
  clearRateLimitCallback(terminal.id);

  const projectPath = terminal.projectPath || terminal.cwd;
  console.warn('[CodexIntegration:switchCodexProfile] Invoking Codex with profile:', profileId, '| cwd:', projectPath);
  debugLog('[CodexIntegration:switchCodexProfile] Invoking Codex with new profile:', {
    terminalId: terminal.id,
    projectPath,
    profileId
  });
  invokeCodexCallback(terminal.id, projectPath, profileId);

  debugLog('[CodexIntegration:switchCodexProfile] Setting active profile in profile manager');
  profileManager.setActiveProfile(profileId);

  console.warn('[CodexIntegration:switchCodexProfile] COMPLETE');
  debugLog('[CodexIntegration:switchCodexProfile] ========== SWITCH PROFILE COMPLETE ==========');
  return { success: true };
}
