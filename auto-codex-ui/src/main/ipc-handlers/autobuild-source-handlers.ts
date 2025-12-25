import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type { IPCResult } from '../../shared/types';
import path from 'path';
import { existsSync, readFileSync } from 'fs';
import type { AutoBuildSourceUpdateProgress, SourceEnvConfig, SourceEnvCheckResult } from '../../shared/types';
import { checkForUpdates as checkSourceUpdates, downloadAndApplyUpdate, getEffectiveVersion, getEffectiveSourcePath } from '../auto-codex-updater';
import { debugLog } from '../../shared/utils/debug-logger';
import { atomicWriteFileSync } from '../utils/atomic-write';


/**
 * Register all autobuild-source-related IPC handlers
 */
export function registerAutobuildSourceHandlers(
  getMainWindow: () => BrowserWindow | null
): void {
  // ============================================
  // Auto Codex Source Update Operations
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.AUTOBUILD_SOURCE_CHECK,
    async (): Promise<IPCResult<{ updateAvailable: boolean; currentVersion: string; latestVersion?: string; releaseNotes?: string; releaseUrl?: string; error?: string }>> => {
      console.warn('[autobuild-source] Check for updates called');
      debugLog('[IPC] AUTOBUILD_SOURCE_CHECK called');
      try {
        const result = await checkSourceUpdates();
        console.warn('[autobuild-source] Check result:', JSON.stringify(result, null, 2));
        debugLog('[IPC] AUTOBUILD_SOURCE_CHECK result:', result);
        return { success: true, data: result };
      } catch (error) {
        console.error('[autobuild-source] Check error:', error);
        debugLog('[IPC] AUTOBUILD_SOURCE_CHECK error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to check for updates'
        };
      }
    }
  );

  ipcMain.on(
    IPC_CHANNELS.AUTOBUILD_SOURCE_DOWNLOAD,
    () => {
      debugLog('[IPC] Autobuild source download requested');
      const mainWindow = getMainWindow();
      if (!mainWindow) {
        debugLog('[IPC] No main window available, aborting update');
        return;
      }

      // Start download in background
      downloadAndApplyUpdate((progress) => {
        debugLog('[IPC] Update progress:', progress.stage, progress.message);
        mainWindow.webContents.send(
          IPC_CHANNELS.AUTOBUILD_SOURCE_PROGRESS,
          progress
        );
      }).then((result) => {
        if (result.success) {
          debugLog('[IPC] Update completed successfully, version:', result.version);
          mainWindow.webContents.send(
            IPC_CHANNELS.AUTOBUILD_SOURCE_PROGRESS,
            {
              stage: 'complete',
              message: `Updated to version ${result.version}`,
              newVersion: result.version // Include new version for UI refresh
            } as AutoBuildSourceUpdateProgress
          );
        } else {
          debugLog('[IPC] Update failed:', result.error);
          mainWindow.webContents.send(
            IPC_CHANNELS.AUTOBUILD_SOURCE_PROGRESS,
            {
              stage: 'error',
              message: result.error || 'Update failed'
            } as AutoBuildSourceUpdateProgress
          );
        }
      }).catch((error) => {
        debugLog('[IPC] Update error:', error instanceof Error ? error.message : error);
        mainWindow.webContents.send(
          IPC_CHANNELS.AUTOBUILD_SOURCE_PROGRESS,
          {
            stage: 'error',
            message: error instanceof Error ? error.message : 'Update failed'
          } as AutoBuildSourceUpdateProgress
        );
      });

      // Send initial progress
      mainWindow.webContents.send(
        IPC_CHANNELS.AUTOBUILD_SOURCE_PROGRESS,
        {
          stage: 'checking',
          message: 'Starting update...'
        } as AutoBuildSourceUpdateProgress
      );
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AUTOBUILD_SOURCE_VERSION,
    async (): Promise<IPCResult<string>> => {
      try {
        // Use effective version which accounts for source updates
        const version = getEffectiveVersion();
        debugLog('[IPC] Returning effective version:', version);
        return { success: true, data: version };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get version'
        };
      }
    }
  );

  // ============================================
  // Auto Codex Source Environment Operations
  // ============================================

  /**
   * Parse an .env file content into a key-value object
   */
  const parseSourceEnvFile = (content: string): Record<string, string> => {
    const vars: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex).trim();
        let value = trimmed.substring(eqIndex + 1).trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        vars[key] = value;
      }
    }
    return vars;
  };

  ipcMain.handle(
    IPC_CHANNELS.AUTOBUILD_SOURCE_ENV_GET,
    async (): Promise<IPCResult<SourceEnvConfig>> => {
      try {
        const sourcePath = getEffectiveSourcePath();
        if (!sourcePath) {
          return {
            success: true,
            data: {
              hasCodexToken: false,
              envExists: false,
              sourcePath: undefined
            }
          };
        }

        const envPath = path.join(sourcePath, '.env');
        const envExists = existsSync(envPath);

        if (!envExists) {
          return {
            success: true,
            data: {
              hasCodexToken: false,
              envExists: false,
              sourcePath
            }
          };
        }

        const content = readFileSync(envPath, 'utf-8');
        const vars = parseSourceEnvFile(content);
        const hasToken = !!vars['CODEX_CODE_OAUTH_TOKEN'];

        return {
          success: true,
          data: {
            hasCodexToken: hasToken,
            codexOAuthToken: hasToken ? vars['CODEX_CODE_OAUTH_TOKEN'] : undefined,
            envExists: true,
            sourcePath
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get source env'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AUTOBUILD_SOURCE_ENV_UPDATE,
    async (_, config: { codexOAuthToken?: string }): Promise<IPCResult> => {
      try {
        const sourcePath = getEffectiveSourcePath();
        if (!sourcePath) {
          return {
            success: false,
            error: 'Auto-Codex source path not found. Please configure it in App Settings.'
          };
        }

        const envPath = path.join(sourcePath, '.env');

        // Read existing content or start fresh
        let existingContent = '';
        const existingVars: Record<string, string> = {};

        if (existsSync(envPath)) {
          existingContent = readFileSync(envPath, 'utf-8');
          Object.assign(existingVars, parseSourceEnvFile(existingContent));
        }

        // Update the token
        if (config.codexOAuthToken !== undefined) {
          existingVars['CODEX_CODE_OAUTH_TOKEN'] = config.codexOAuthToken;
        }

        // Rebuild the .env file preserving comments and structure
        const lines = existingContent.split('\n');
        const processedKeys = new Set<string>();
        const outputLines: string[] = [];

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) {
            outputLines.push(line);
            continue;
          }

          const eqIndex = trimmed.indexOf('=');
          if (eqIndex > 0) {
            const key = trimmed.substring(0, eqIndex).trim();
            if (key in existingVars) {
              outputLines.push(`${key}=${existingVars[key]}`);
              processedKeys.add(key);
            } else {
              outputLines.push(line);
            }
          } else {
            outputLines.push(line);
          }
        }

        // Add any new keys that weren't in the original file
        for (const [key, value] of Object.entries(existingVars)) {
          if (!processedKeys.has(key)) {
            outputLines.push(`${key}=${value}`);
          }
        }

        atomicWriteFileSync(envPath, outputLines.join('\n'), { encoding: 'utf-8' });

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update source env'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AUTOBUILD_SOURCE_ENV_CHECK_TOKEN,
    async (): Promise<IPCResult<SourceEnvCheckResult>> => {
      try {
        const hasAuthVars = (vars: Record<string, string | undefined>): boolean => {
          const openaiKey = (vars['OPENAI_API_KEY'] || '').trim();
          if (openaiKey) return true;

          const oauthToken = (vars['CODEX_CODE_OAUTH_TOKEN'] || '').trim();
          if (oauthToken) return true;

          const configDir = (vars['CODEX_CONFIG_DIR'] || '').trim();
          if (configDir && existsSync(configDir)) return true;

          return false;
        };

        const hasProcessToken = hasAuthVars(process.env);
        const sourcePath = getEffectiveSourcePath();
        if (!sourcePath) {
          return {
            success: true,
            data: {
              hasToken: hasProcessToken,
              sourcePath: undefined,
              error: hasProcessToken ? undefined : 'Auto-Codex source path not found'
            }
          };
        }

        const envPath = path.join(sourcePath, '.env');
        if (!existsSync(envPath)) {
          return {
            success: true,
            data: {
              hasToken: hasProcessToken,
              sourcePath,
              error: hasProcessToken ? undefined : '.env file does not exist'
            }
          };
        }

        const content = readFileSync(envPath, 'utf-8');
        const vars = parseSourceEnvFile(content);
        const hasToken = hasAuthVars(vars) || hasProcessToken;

        return {
          success: true,
          data: {
            hasToken,
            sourcePath
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to check source token'
        };
      }
    }
  );

}
