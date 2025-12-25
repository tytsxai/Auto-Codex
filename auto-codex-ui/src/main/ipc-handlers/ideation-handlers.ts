/**
 * Ideation IPC handlers registration
 *
 * This module serves as the entry point for all ideation-related IPC handlers.
 * The actual handler implementations are organized in the ./ideation/ subdirectory:
 *
 * - session-manager.ts: CRUD operations for ideation sessions
 * - idea-manager.ts: Individual idea operations (update, dismiss, etc.)
 * - generation-handlers.ts: Start/stop ideation generation
 * - task-converter.ts: Convert ideas to tasks
 * - transformers.ts: Data transformation utilities (snake_case to camelCase)
 * - file-utils.ts: File system operations
 */

import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type { AgentManager } from '../agent';
import type { PythonEnvManager } from '../python-env-manager';
import { getAutoBuildSourcePath } from './context/utils';
import {
  getIdeationSession,
  updateIdeaStatus,
  dismissIdea,
  dismissAllIdeas,
  archiveIdea,
  deleteIdea,
  deleteMultipleIdeas,
  startIdeationGeneration,
  refreshIdeationSession,
  stopIdeationGeneration,
  convertIdeaToTask
} from './ideation';

/**
 * Register all ideation-related IPC handlers
 */
export function registerIdeationHandlers(
  agentManager: AgentManager,
  pythonEnvManager: PythonEnvManager,
  getMainWindow: () => BrowserWindow | null
): void {
  // Session management
  ipcMain.handle(
    IPC_CHANNELS.IDEATION_GET,
    getIdeationSession
  );

  // Idea operations
  ipcMain.handle(
    IPC_CHANNELS.IDEATION_UPDATE_IDEA,
    updateIdeaStatus
  );

  ipcMain.handle(
    IPC_CHANNELS.IDEATION_DISMISS,
    dismissIdea
  );

  ipcMain.handle(
    IPC_CHANNELS.IDEATION_DISMISS_ALL,
    dismissAllIdeas
  );

  ipcMain.handle(
    IPC_CHANNELS.IDEATION_ARCHIVE,
    archiveIdea
  );

  ipcMain.handle(
    IPC_CHANNELS.IDEATION_DELETE,
    deleteIdea
  );

  ipcMain.handle(
    IPC_CHANNELS.IDEATION_DELETE_MULTIPLE,
    deleteMultipleIdeas
  );

  // Generation operations
  ipcMain.on(
    IPC_CHANNELS.IDEATION_GENERATE,
    async (event, projectId, config) => {
      const mainWindow = getMainWindow();
      const autoBuildSource = getAutoBuildSourcePath();
      if (!autoBuildSource) {
        if (mainWindow) {
          mainWindow.webContents.send(IPC_CHANNELS.IDEATION_ERROR, projectId, '未找到 Auto Codex 源码');
        }
        return;
      }

      if (!pythonEnvManager.isEnvReady()) {
        const status = await pythonEnvManager.initialize(autoBuildSource);
        if (!status.ready || !status.pythonPath) {
          if (mainWindow) {
            mainWindow.webContents.send(IPC_CHANNELS.IDEATION_ERROR, projectId, status.error || 'Python environment not ready');
          }
          return;
        }
        agentManager.configure(status.pythonPath, autoBuildSource);
      } else {
        const pythonPath = pythonEnvManager.getPythonPath();
        if (pythonPath) {
          agentManager.configure(pythonPath, autoBuildSource);
        }
      }

      startIdeationGeneration(event, projectId, config, agentManager, getMainWindow());
    }
  );

  ipcMain.on(
    IPC_CHANNELS.IDEATION_REFRESH,
    async (event, projectId, config) => {
      const mainWindow = getMainWindow();
      const autoBuildSource = getAutoBuildSourcePath();
      if (!autoBuildSource) {
        if (mainWindow) {
          mainWindow.webContents.send(IPC_CHANNELS.IDEATION_ERROR, projectId, '未找到 Auto Codex 源码');
        }
        return;
      }

      if (!pythonEnvManager.isEnvReady()) {
        const status = await pythonEnvManager.initialize(autoBuildSource);
        if (!status.ready || !status.pythonPath) {
          if (mainWindow) {
            mainWindow.webContents.send(IPC_CHANNELS.IDEATION_ERROR, projectId, status.error || 'Python environment not ready');
          }
          return;
        }
        agentManager.configure(status.pythonPath, autoBuildSource);
      } else {
        const pythonPath = pythonEnvManager.getPythonPath();
        if (pythonPath) {
          agentManager.configure(pythonPath, autoBuildSource);
        }
      }

      refreshIdeationSession(event, projectId, config, agentManager, getMainWindow());
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.IDEATION_STOP,
    (event, projectId) =>
      stopIdeationGeneration(event, projectId, agentManager, getMainWindow())
  );

  // Task conversion
  ipcMain.handle(
    IPC_CHANNELS.IDEATION_CONVERT_TO_TASK,
    convertIdeaToTask
  );
}
