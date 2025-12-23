/**
 * Workflow Handlers
 * =================
 *
 * IPC handlers for the smart worktree workflow system.
 * Provides staging, review, and commit operations.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type {
  IPCResult,
  StageWorktreeRequest,
  CommitChangesRequest,
  DiscardChangesRequest,
  StagedChange,
  StageResult,
  WorktreeHealthStatus,
  ConflictRisk,
  ReviewReport,
  CommitResult,
  MergeOrderSuggestion
} from '../../shared/types';
import { spawn } from 'child_process';
import path from 'path';
import { projectStore } from '../project-store';
import { PythonEnvManager } from '../python-env-manager';
import { getEffectiveSourcePath } from '../auto-codex-updater';
import { findPythonCommand, parsePythonCommand } from '../python-detector';

/**
 * Run a Python workflow command and return JSON result
 */
async function runWorkflowCommand(
  pythonEnvManager: PythonEnvManager,
  projectPath: string,
  command: string,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  // Ensure Python environment is ready
  if (!pythonEnvManager.isEnvReady()) {
    const autoBuildSource = getEffectiveSourcePath();
    if (autoBuildSource) {
      const status = await pythonEnvManager.initialize(autoBuildSource);
      if (!status.ready) {
        throw new Error(`Python environment not ready: ${status.error || 'Unknown error'}`);
      }
    } else {
      throw new Error('Python environment not ready and Auto Codex source not found');
    }
  }

  const sourcePath = getEffectiveSourcePath();
  if (!sourcePath) {
    throw new Error('Auto Codex source not found');
  }

  const pythonPath = pythonEnvManager.getPythonPath() || findPythonCommand() || 'python';
  const [pythonCommand, pythonBaseArgs] = parsePythonCommand(pythonPath);

  // Build the Python command
  const scriptArgs = [
    '-c',
    `
import json
import sys
import asyncio
sys.path.insert(0, '${sourcePath.replace(/\\/g, '\\\\')}')

from auto_codex.core.workflow import (
    WorkflowManager, ChangeTracker, CommitManager, AIReviewer, WorkflowSettings
)
from pathlib import Path

project_dir = Path('${projectPath.replace(/\\/g, '\\\\')}')
args = json.loads('${JSON.stringify(args).replace(/'/g, "\\'")}')
command = '${command}'

async def main():
    manager = WorkflowManager(project_dir)
    tracker = manager.change_tracker
    commit_mgr = CommitManager(project_dir, tracker)
    reviewer = AIReviewer(project_dir, tracker)

    result = None

    if command == 'stage_worktree':
        result = manager.stage_worktree(
            spec_name=args.get('specName'),
            task_id=args.get('taskId'),
            auto_cleanup=args.get('autoCleanup')
        )
        result = result.to_dict()

    elif command == 'get_staged_changes':
        changes = tracker.get_all_staged()
        result = [c.to_dict() for c in changes]

    elif command == 'commit_all':
        result = commit_mgr.commit_all(args.get('message', 'chore: update'))
        result = result.to_dict()

    elif command == 'commit_by_task':
        results = commit_mgr.commit_by_task(args.get('taskMessages'))
        result = [r.to_dict() for r in results]

    elif command == 'commit_partial':
        result = commit_mgr.commit_partial(
            files=args.get('selectedFiles', []),
            message=args.get('message', 'chore: update')
        )
        result = result.to_dict()

    elif command == 'discard_all':
        success = commit_mgr.discard_all(args.get('restoreWorktrees', False))
        result = {'success': success}

    elif command == 'get_health_status':
        status = manager.get_health_status()
        result = status.to_dict()

    elif command == 'get_conflict_risks':
        risks = manager.get_conflict_risks()
        result = [r.to_dict() for r in risks]

    elif command == 'get_merge_order':
        order = manager.suggest_merge_order()
        risks = manager.get_conflict_risks()
        result = {
            'order': order,
            'reason': 'Sorted by conflict count (fewer first), then by age (older first)',
            'conflictGroups': [r.to_dict() for r in risks]
        }

    elif command == 'ai_review':
        report = await reviewer.review_staged_changes()
        result = report.to_dict()

    elif command == 'cleanup_stale':
        cleaned = manager.cleanup_stale_worktrees(args.get('days'))
        result = {'cleaned': cleaned}

    elif command == 'generate_commit_message':
        changes = tracker.get_all_staged()
        message = reviewer.generate_commit_message(changes, args.get('mode', 'all'))
        result = {'message': message}

    else:
        result = {'error': f'Unknown command: {command}'}

    print(json.dumps(result, ensure_ascii=False))

asyncio.run(main())
`
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn(pythonCommand, [...pythonBaseArgs, ...scriptArgs], {
      cwd: sourcePath,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1'
      }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code: number) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (e) {
          reject(new Error(`Failed to parse output: ${stdout}\nStderr: ${stderr}`));
        }
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
      }
    });

    proc.on('error', (err: Error) => {
      reject(err);
    });
  });
}

/**
 * Register workflow handlers
 */
export function registerWorkflowHandlers(
  pythonEnvManager: PythonEnvManager,
  getMainWindow: () => BrowserWindow | null
): void {
  // Get current project path helper
  const getProjectPath = (): string | null => {
    const projects = projectStore.getProjects();
    if (projects.length > 0) {
      return projects[0].path;
    }
    return null;
  };

  /**
   * Stage worktree changes to main repository
   */
  ipcMain.handle(
    IPC_CHANNELS.WORKFLOW_STAGE_WORKTREE,
    async (_, request: StageWorktreeRequest): Promise<IPCResult<StageResult>> => {
      try {
        const projectPath = getProjectPath();
        if (!projectPath) {
          return { success: false, error: 'No project found' };
        }

        const result = await runWorkflowCommand(
          pythonEnvManager,
          projectPath,
          'stage_worktree',
          { ...request }
        ) as StageResult;

        return { success: true, data: result };
      } catch (error) {
        console.error('Failed to stage worktree:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to stage worktree'
        };
      }
    }
  );

  /**
   * Get all staged changes
   */
  ipcMain.handle(
    IPC_CHANNELS.WORKFLOW_GET_STAGED_CHANGES,
    async (): Promise<IPCResult<StagedChange[]>> => {
      try {
        const projectPath = getProjectPath();
        if (!projectPath) {
          return { success: false, error: 'No project found' };
        }

        const result = await runWorkflowCommand(
          pythonEnvManager,
          projectPath,
          'get_staged_changes'
        ) as StagedChange[];

        return { success: true, data: result };
      } catch (error) {
        console.error('Failed to get staged changes:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get staged changes'
        };
      }
    }
  );

  /**
   * Commit staged changes
   */
  ipcMain.handle(
    IPC_CHANNELS.WORKFLOW_COMMIT_CHANGES,
    async (_, request: CommitChangesRequest): Promise<IPCResult<CommitResult | CommitResult[]>> => {
      try {
        const projectPath = getProjectPath();
        if (!projectPath) {
          return { success: false, error: 'No project found' };
        }

        let command: string;
        const args: Record<string, unknown> = {};

        switch (request.mode) {
          case 'all':
            command = 'commit_all';
            args.message = request.message;
            break;
          case 'by_task':
            command = 'commit_by_task';
            args.taskMessages = request.taskMessages;
            break;
          case 'partial':
            command = 'commit_partial';
            args.selectedFiles = request.selectedFiles;
            args.message = request.message;
            break;
          default:
            return { success: false, error: `Unknown commit mode: ${request.mode}` };
        }

        const result = await runWorkflowCommand(
          pythonEnvManager,
          projectPath,
          command,
          args
        );

        return { success: true, data: result as CommitResult | CommitResult[] };
      } catch (error) {
        console.error('Failed to commit changes:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to commit changes'
        };
      }
    }
  );

  /**
   * Discard all staged changes
   */
  ipcMain.handle(
    IPC_CHANNELS.WORKFLOW_DISCARD_CHANGES,
    async (_, request: DiscardChangesRequest): Promise<IPCResult<{ success: boolean }>> => {
      try {
        const projectPath = getProjectPath();
        if (!projectPath) {
          return { success: false, error: 'No project found' };
        }

        const result = await runWorkflowCommand(
          pythonEnvManager,
          projectPath,
          'discard_all',
          { ...request }
        ) as { success: boolean };

        return { success: true, data: result };
      } catch (error) {
        console.error('Failed to discard changes:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to discard changes'
        };
      }
    }
  );

  /**
   * Get worktree health status
   */
  ipcMain.handle(
    IPC_CHANNELS.WORKFLOW_GET_HEALTH_STATUS,
    async (): Promise<IPCResult<WorktreeHealthStatus>> => {
      try {
        const projectPath = getProjectPath();
        if (!projectPath) {
          return { success: false, error: 'No project found' };
        }

        const result = await runWorkflowCommand(
          pythonEnvManager,
          projectPath,
          'get_health_status'
        ) as WorktreeHealthStatus;

        return { success: true, data: result };
      } catch (error) {
        console.error('Failed to get health status:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get health status'
        };
      }
    }
  );

  /**
   * Get conflict risks between worktrees
   */
  ipcMain.handle(
    IPC_CHANNELS.WORKFLOW_GET_CONFLICT_RISKS,
    async (): Promise<IPCResult<ConflictRisk[]>> => {
      try {
        const projectPath = getProjectPath();
        if (!projectPath) {
          return { success: false, error: 'No project found' };
        }

        const result = await runWorkflowCommand(
          pythonEnvManager,
          projectPath,
          'get_conflict_risks'
        ) as ConflictRisk[];

        return { success: true, data: result };
      } catch (error) {
        console.error('Failed to get conflict risks:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get conflict risks'
        };
      }
    }
  );

  /**
   * Get suggested merge order
   */
  ipcMain.handle(
    IPC_CHANNELS.WORKFLOW_GET_MERGE_ORDER,
    async (): Promise<IPCResult<MergeOrderSuggestion>> => {
      try {
        const projectPath = getProjectPath();
        if (!projectPath) {
          return { success: false, error: 'No project found' };
        }

        const result = await runWorkflowCommand(
          pythonEnvManager,
          projectPath,
          'get_merge_order'
        ) as MergeOrderSuggestion;

        return { success: true, data: result };
      } catch (error) {
        console.error('Failed to get merge order:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get merge order'
        };
      }
    }
  );

  /**
   * Run AI review on staged changes
   */
  ipcMain.handle(
    IPC_CHANNELS.WORKFLOW_AI_REVIEW,
    async (): Promise<IPCResult<ReviewReport>> => {
      try {
        const projectPath = getProjectPath();
        if (!projectPath) {
          return { success: false, error: 'No project found' };
        }

        const result = await runWorkflowCommand(
          pythonEnvManager,
          projectPath,
          'ai_review'
        ) as ReviewReport;

        return { success: true, data: result };
      } catch (error) {
        console.error('Failed to run AI review:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to run AI review'
        };
      }
    }
  );

  /**
   * Cleanup stale worktrees
   */
  ipcMain.handle(
    IPC_CHANNELS.WORKFLOW_CLEANUP_STALE,
    async (_, days?: number): Promise<IPCResult<{ cleaned: string[] }>> => {
      try {
        const projectPath = getProjectPath();
        if (!projectPath) {
          return { success: false, error: 'No project found' };
        }

        const result = await runWorkflowCommand(
          pythonEnvManager,
          projectPath,
          'cleanup_stale',
          { days }
        ) as { cleaned: string[] };

        return { success: true, data: result };
      } catch (error) {
        console.error('Failed to cleanup stale worktrees:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to cleanup stale worktrees'
        };
      }
    }
  );

  /**
   * Generate commit message
   */
  ipcMain.handle(
    IPC_CHANNELS.WORKFLOW_GENERATE_COMMIT_MESSAGE,
    async (_, mode: string): Promise<IPCResult<{ message: string }>> => {
      try {
        const projectPath = getProjectPath();
        if (!projectPath) {
          return { success: false, error: 'No project found' };
        }

        const result = await runWorkflowCommand(
          pythonEnvManager,
          projectPath,
          'generate_commit_message',
          { mode }
        ) as { message: string };

        return { success: true, data: result };
      } catch (error) {
        console.error('Failed to generate commit message:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to generate commit message'
        };
      }
    }
  );

  console.warn('[IPC] Workflow handlers registered');
}
