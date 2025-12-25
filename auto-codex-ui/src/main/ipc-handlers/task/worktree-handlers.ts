import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS, AUTO_BUILD_PATHS } from '../../../shared/constants';
import type { IPCResult, WorktreeStatus, WorktreeDiff, WorktreeDiffFile, WorktreeMergeResult, WorktreeDiscardResult, WorktreeListResult, WorktreeListItem } from '../../../shared/types';
import path from 'path';
import { existsSync, readdirSync, statSync, rmSync } from 'fs';
import { execSync, spawn, spawnSync } from 'child_process';
import { projectStore } from '../../project-store';
import { PythonEnvManager } from '../../python-env-manager';
import { getEffectiveSourcePath } from '../../auto-codex-updater';
import { getProfileEnv } from '../../rate-limit-detector';
import { findTaskAndProject } from './shared';
import { findPythonCommand, parsePythonCommand } from '../../python-detector';
import { atomicWriteFileSync } from '../../utils/atomic-write';

/** Maximum retries for tracking staged changes */
const TRACK_CHANGES_MAX_RETRIES = 2;
/** Timeout for tracking operation in milliseconds */
const TRACK_CHANGES_TIMEOUT_MS = 30000;

/**
 * Result of tracking staged changes
 */
interface TrackChangesResult {
  success: boolean;
  tracked?: number;
  error?: string;
}

/**
 * Track staged changes using the workflow system.
 * This records which files were staged from which task for later review/commit.
 * 
 * Features:
 * - Automatic retry on failure (up to TRACK_CHANGES_MAX_RETRIES times)
 * - Timeout protection to prevent hanging
 * - Detailed error reporting
 * - Uses base64 encoding for safe parameter passing
 */
async function trackStagedChanges(
  pythonEnvManager: PythonEnvManager,
  projectPath: string,
  specName: string,
  taskId: string,
  stagedFiles: string[],
  retryCount: number = 0
): Promise<TrackChangesResult> {
  if (stagedFiles.length === 0) {
    return { success: true, tracked: 0 };
  }

  if (!pythonEnvManager.isEnvReady()) {
    const autoBuildSource = getEffectiveSourcePath();
    if (autoBuildSource) {
      const status = await pythonEnvManager.initialize(autoBuildSource);
      if (!status.ready) {
        const error = 'Python env not ready';
        console.warn('[WORKFLOW] Cannot track changes:', error);
        return { success: false, error };
      }
    } else {
      const error = 'Auto Codex source not found';
      console.warn('[WORKFLOW] Cannot track changes:', error);
      return { success: false, error };
    }
  }

  const sourcePath = getEffectiveSourcePath();
  if (!sourcePath) {
    const error = 'Auto Codex source not found';
    console.warn('[WORKFLOW] Cannot track changes:', error);
    return { success: false, error };
  }

  const pythonPath = pythonEnvManager.getPythonPath() || findPythonCommand() || 'python';
  const [pythonCommand, pythonBaseArgs] = parsePythonCommand(pythonPath);
  const payload = {
    taskId,
    specName,
    files: stagedFiles,
    mergeSource: path.join(projectPath, '.worktrees', specName)
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');

  // Build the Python command to track changes
  const scriptArgs = [
    '-c',
    `
import json
import base64
import os
import sys
sys.path.insert(0, '${sourcePath.replace(/\\/g, '\\\\')}')

from core.workflow import ChangeTracker
from pathlib import Path

project_dir = Path('${projectPath.replace(/\\/g, '\\\\')}')
tracker = ChangeTracker(project_dir)
payload = json.loads(base64.b64decode(os.environ.get('WORKFLOW_TRACK_B64', 'e30=')).decode('utf-8'))

# Track the staged changes
tracker.track_changes(
    task_id=payload.get('taskId', ''),
    spec_name=payload.get('specName', ''),
    files=payload.get('files', []),
    merge_source=payload.get('mergeSource', '')
)

print(json.dumps({'success': True, 'tracked': len(payload.get('files', []))}))
`
  ];

  return new Promise((resolve) => {
    let timeoutId: NodeJS.Timeout | null = null;
    let resolved = false;

    const proc = spawn(pythonCommand, [...pythonBaseArgs, ...scriptArgs], {
      cwd: sourcePath,
      env: {
        ...process.env,
        WORKFLOW_TRACK_B64: payloadB64,
        PYTHONUNBUFFERED: '1',
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1'
      }
    });

    let stdout = '';
    let stderr = '';

    // Set timeout to prevent hanging
    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill('SIGTERM');
        const error = `Tracking operation timed out after ${TRACK_CHANGES_TIMEOUT_MS}ms`;
        console.warn('[WORKFLOW]', error);

        // Retry if we haven't exceeded max retries
        if (retryCount < TRACK_CHANGES_MAX_RETRIES) {
          console.warn(`[WORKFLOW] Retrying... (attempt ${retryCount + 2}/${TRACK_CHANGES_MAX_RETRIES + 1})`);
          trackStagedChanges(pythonEnvManager, projectPath, specName, taskId, stagedFiles, retryCount + 1)
            .then(resolve);
        } else {
          resolve({ success: false, error });
        }
      }
    }, TRACK_CHANGES_TIMEOUT_MS);

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code: number) => {
      if (resolved) return;
      resolved = true;
      if (timeoutId) clearTimeout(timeoutId);

      if (code === 0) {
        try {
          const result = JSON.parse(stdout.trim()) as TrackChangesResult;
          console.warn('[WORKFLOW] Tracked staged changes:', result);
          resolve(result);
        } catch (_e) {
          console.warn('[WORKFLOW] Failed to parse tracking result:', stdout, stderr);
          // Assume success if output is malformed but exit code was 0
          resolve({ success: true, tracked: stagedFiles.length });
        }
      } else {
        const error = stderr || stdout || `Process exited with code ${code}`;
        console.warn('[WORKFLOW] Failed to track changes:', error);

        // Retry on failure
        if (retryCount < TRACK_CHANGES_MAX_RETRIES) {
          console.warn(`[WORKFLOW] Retrying... (attempt ${retryCount + 2}/${TRACK_CHANGES_MAX_RETRIES + 1})`);
          trackStagedChanges(pythonEnvManager, projectPath, specName, taskId, stagedFiles, retryCount + 1)
            .then(resolve);
        } else {
          resolve({ success: false, error });
        }
      }
    });

    proc.on('error', (err: Error) => {
      if (resolved) return;
      resolved = true;
      if (timeoutId) clearTimeout(timeoutId);

      const error = err.message;
      console.warn('[WORKFLOW] Error tracking changes:', error);

      // Retry on error
      if (retryCount < TRACK_CHANGES_MAX_RETRIES) {
        console.warn(`[WORKFLOW] Retrying... (attempt ${retryCount + 2}/${TRACK_CHANGES_MAX_RETRIES + 1})`);
        trackStagedChanges(pythonEnvManager, projectPath, specName, taskId, stagedFiles, retryCount + 1)
          .then(resolve);
      } else {
        resolve({ success: false, error });
      }
    });
  });
}

/**
 * Register worktree management handlers
 */
export function registerWorktreeHandlers(
  pythonEnvManager: PythonEnvManager,
  getMainWindow: () => BrowserWindow | null
): void {
  const runGit = (cwd: string, args: string[]): string => {
    const result = spawnSync('git', args, {
      cwd,
      encoding: 'utf-8',
      windowsHide: true,
      shell: false
    });

    if (result.error) {
      throw result.error;
    }
    if (typeof result.status === 'number' && result.status !== 0) {
      const stderr = (result.stderr || '').toString().trim();
      const stdout = (result.stdout || '').toString().trim();
      throw new Error(stderr || stdout || `git ${args.join(' ')} failed`);
    }

    return (result.stdout || '').toString();
  };

  const getCurrentBranch = (cwd: string): string => runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();

  /**
   * Get the worktree status for a task
   * Per-spec architecture: Each spec has its own worktree at .worktrees/{spec-name}/
   */
  ipcMain.handle(
    IPC_CHANNELS.TASK_WORKTREE_STATUS,
    async (_, taskId: string): Promise<IPCResult<WorktreeStatus>> => {
      try {
        const { task, project } = findTaskAndProject(taskId);
        if (!task || !project) {
          return { success: false, error: 'Task not found' };
        }

        // Per-spec worktree path: .worktrees/{spec-name}/
        const worktreePath = path.join(project.path, '.worktrees', task.specId);

        if (!existsSync(worktreePath)) {
          return {
            success: true,
            data: { exists: false }
          };
        }

        // Get branch info from git
        try {
          // Get current branch in worktree
          const branch = getCurrentBranch(worktreePath);

          // Get base branch - the current branch in the main project (where changes will be merged)
          // This matches the Python merge logic which merges into the user's current branch
          let baseBranch = 'main';
          try {
            baseBranch = getCurrentBranch(project.path);
          } catch {
            baseBranch = 'main';
          }

          // Get commit count
          let commitCount = 0;
          try {
            const countOutput = runGit(worktreePath, ['rev-list', '--count', `${baseBranch}..HEAD`]).trim();
            commitCount = parseInt(countOutput, 10) || 0;
          } catch {
            commitCount = 0;
          }

          // Get diff stats - COMMITTED changes between branches
          let filesChanged = 0;
          let additions = 0;
          let deletions = 0;

          try {
            const diffStat = runGit(worktreePath, ['diff', '--stat', `${baseBranch}...HEAD`]).trim();

            // Parse the summary line (e.g., "3 files changed, 50 insertions(+), 10 deletions(-)")
            const summaryMatch = diffStat.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
            if (summaryMatch) {
              filesChanged = parseInt(summaryMatch[1], 10) || 0;
              additions = parseInt(summaryMatch[2], 10) || 0;
              deletions = parseInt(summaryMatch[3], 10) || 0;
            }
          } catch {
            // Ignore diff errors
          }

          // Also count UNCOMMITTED changes (modified, untracked files)
          try {
            const statusOutput = runGit(worktreePath, ['status', '--porcelain']).trim();
            if (statusOutput) {
              const uncommittedLines = statusOutput.split('\n').filter(line => line.length > 0);
              filesChanged += uncommittedLines.length;

              // Get line-level changes for uncommitted files
              try {
                const uncommittedDiff = runGit(worktreePath, ['diff', '--numstat']).trim();
                for (const line of uncommittedDiff.split('\n')) {
                  const parts = line.split('\t');
                  if (parts.length >= 3) {
                    const add = parseInt(parts[0], 10) || 0;
                    const del = parseInt(parts[1], 10) || 0;
                    additions += add;
                    deletions += del;
                  }
                }
              } catch {
                // Ignore uncommitted diff errors
              }
            }
          } catch {
            // Ignore status errors
          }

          return {
            success: true,
            data: {
              exists: true,
              worktreePath,
              branch,
              baseBranch,
              commitCount,
              filesChanged,
              additions,
              deletions
            }
          };
        } catch (gitError) {
          console.error('Git error getting worktree status:', gitError);
          return {
            success: true,
            data: { exists: true, worktreePath }
          };
        }
      } catch (error) {
        console.error('Failed to get worktree status:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get worktree status'
        };
      }
    }
  );

  /**
   * Get the diff for a task's worktree
   * Per-spec architecture: Each spec has its own worktree at .worktrees/{spec-name}/
   */
  ipcMain.handle(
    IPC_CHANNELS.TASK_WORKTREE_DIFF,
    async (_, taskId: string): Promise<IPCResult<WorktreeDiff>> => {
      try {
        const { task, project } = findTaskAndProject(taskId);
        if (!task || !project) {
          return { success: false, error: 'Task not found' };
        }

        // Per-spec worktree path: .worktrees/{spec-name}/
        const worktreePath = path.join(project.path, '.worktrees', task.specId);

        if (!existsSync(worktreePath)) {
          return { success: false, error: 'No worktree found for this task' };
        }

        // Get base branch - the current branch in the main project (where changes will be merged)
        let baseBranch = 'main';
        try {
          baseBranch = getCurrentBranch(project.path);
        } catch {
          baseBranch = 'main';
        }

        // Get the diff with file stats
        const files: WorktreeDiffFile[] = [];

        try {
          // Get numstat for additions/deletions per file
          const numstat = runGit(worktreePath, ['diff', '--numstat', `${baseBranch}...HEAD`]).trim();

          // Get name-status for file status
          const nameStatus = runGit(worktreePath, ['diff', '--name-status', `${baseBranch}...HEAD`]).trim();

          // Parse name-status to get file statuses
          const statusMap: Record<string, 'added' | 'modified' | 'deleted' | 'renamed'> = {};
          nameStatus.split('\n').filter(Boolean).forEach((line: string) => {
            const [status, ...pathParts] = line.split('\t');
            const filePath = pathParts.join('\t'); // Handle files with tabs in name
            switch (status[0]) {
              case 'A': statusMap[filePath] = 'added'; break;
              case 'M': statusMap[filePath] = 'modified'; break;
              case 'D': statusMap[filePath] = 'deleted'; break;
              case 'R': statusMap[pathParts[1] || filePath] = 'renamed'; break;
              default: statusMap[filePath] = 'modified';
            }
          });

          // Parse numstat for additions/deletions
          numstat.split('\n').filter(Boolean).forEach((line: string) => {
            const [adds, dels, filePath] = line.split('\t');
            files.push({
              path: filePath,
              status: statusMap[filePath] || 'modified',
              additions: parseInt(adds, 10) || 0,
              deletions: parseInt(dels, 10) || 0
            });
          });
        } catch (diffError) {
          console.error('Error getting diff:', diffError);
        }

        // Generate summary
        const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
        const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);
        const summary = `${files.length} files changed, ${totalAdditions} insertions(+), ${totalDeletions} deletions(-)`;

        return {
          success: true,
          data: { files, summary }
        };
      } catch (error) {
        console.error('Failed to get worktree diff:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get worktree diff'
        };
      }
    }
  );

  /**
   * Merge the worktree changes into the main branch
   */
  ipcMain.handle(
    IPC_CHANNELS.TASK_WORKTREE_MERGE,
    async (_, taskId: string, options?: { noCommit?: boolean }): Promise<IPCResult<WorktreeMergeResult>> => {
      // Always log merge operations for debugging
      const debug = (...args: unknown[]) => {
        console.warn('[MERGE DEBUG]', ...args);
      };

      try {
        console.warn('[MERGE] Handler called with taskId:', taskId, 'options:', options);
        debug('Starting merge for taskId:', taskId, 'options:', options);

        // Ensure Python environment is ready
        if (!pythonEnvManager.isEnvReady()) {
          const autoBuildSource = getEffectiveSourcePath();
          if (autoBuildSource) {
            const status = await pythonEnvManager.initialize(autoBuildSource);
            if (!status.ready) {
              return { success: false, error: `Python environment not ready: ${status.error || 'Unknown error'}` };
            }
          } else {
            return { success: false, error: 'Python environment not ready and Auto Codex source not found' };
          }
        }

        const { task, project } = findTaskAndProject(taskId);
        if (!task || !project) {
          debug('Task or project not found');
          return { success: false, error: 'Task not found' };
        }

        debug('Found task:', task.specId, 'project:', project.path);

        // Use run.py --merge to handle the merge
        const sourcePath = getEffectiveSourcePath();
        if (!sourcePath) {
          return { success: false, error: 'Auto Codex source not found' };
        }

        const runScript = path.join(sourcePath, 'run.py');
        const specDir = path.join(project.path, project.autoBuildPath || '.auto-codex', 'specs', task.specId);

        if (!existsSync(specDir)) {
          debug('Spec directory not found:', specDir);
          return { success: false, error: 'Spec directory not found' };
        }

        // Check worktree exists before merge
        const worktreePath = path.join(project.path, '.worktrees', task.specId);
        debug('Worktree path:', worktreePath, 'exists:', existsSync(worktreePath));

        // Check if changes are already staged (for stage-only mode)
        if (options?.noCommit) {
          const stagedResult = spawnSync('git', ['diff', '--staged', '--name-only'], {
            cwd: project.path,
            encoding: 'utf-8'
          });

          if (stagedResult.status === 0 && stagedResult.stdout?.trim()) {
            const stagedFiles = stagedResult.stdout.trim().split('\n');
            debug('Changes already staged:', stagedFiles.length, 'files');
            // Return success - changes are already staged
            return {
              success: true,
              data: {
                success: true,
                merged: false,
                message: `Changes already staged (${stagedFiles.length} files). Review with git diff --staged.`,
                staged: true,
                alreadyStaged: true,
                projectPath: project.path
              }
            };
          }
        }

        // Get git status before merge
        try {
          const gitStatusBefore = execSync('git status --short', { cwd: project.path, encoding: 'utf-8' });
          debug('Git status BEFORE merge in main project:\n', gitStatusBefore || '(clean)');
          const hasUntracked = gitStatusBefore
            .split('\n')
            .some((line) => line.trim().startsWith('??'));
          if (hasUntracked) {
            return {
              success: false,
              error: '工作区存在未跟踪文件，合并可能导致数据丢失。请先清理或提交这些文件后再合并。'
            };
          }
          const gitBranch = execSync('git branch --show-current', { cwd: project.path, encoding: 'utf-8' }).trim();
          debug('Current branch:', gitBranch);
        } catch (e) {
          debug('Failed to get git status before:', e);
        }

        const args = [
          runScript,
          '--spec', task.specId,
          '--project-dir', project.path,
          '--merge'
        ];

        // Add --no-commit flag if requested (stage changes without committing)
        if (options?.noCommit) {
          args.push('--no-commit');
        }

        const pythonPath = pythonEnvManager.getPythonPath() || findPythonCommand() || 'python';
        debug('Running command:', pythonPath, args.join(' '));
        debug('Working directory:', sourcePath);

        // Get profile environment with OAuth token for AI merge resolution
        const profileEnv = getProfileEnv();
        debug('Profile env for merge:', {
          hasOAuthToken: !!profileEnv.CODEX_CODE_OAUTH_TOKEN,
          hasConfigDir: !!profileEnv.CODEX_CONFIG_DIR
        });

        return new Promise((resolve) => {
          const MERGE_TIMEOUT_MS = 120000; // 2 minutes timeout for merge operations
          let timeoutId: NodeJS.Timeout | null = null;
          let resolved = false;

          // Parse Python command to handle space-separated commands like "py -3"
          const [pythonCommand, pythonBaseArgs] = parsePythonCommand(pythonPath);
          const mergeProcess = spawn(pythonCommand, [...pythonBaseArgs, ...args], {
            cwd: sourcePath,
            env: {
              ...process.env,
              ...profileEnv, // Include active Codex profile OAuth token
              PYTHONUNBUFFERED: '1',
              PYTHONIOENCODING: 'utf-8',
              PYTHONUTF8: '1'
            },
            stdio: ['ignore', 'pipe', 'pipe'] // Don't connect stdin to avoid blocking
          });

          let stdout = '';
          let stderr = '';

          // Set up timeout to kill hung processes
          timeoutId = setTimeout(() => {
            if (!resolved) {
              debug('TIMEOUT: Merge process exceeded', MERGE_TIMEOUT_MS, 'ms, killing...');
              resolved = true;
              mergeProcess.kill('SIGTERM');
              // Give it a moment to clean up, then force kill
              setTimeout(() => {
                try {
                  mergeProcess.kill('SIGKILL');
                } catch {
                  // Process may already be dead
                }
              }, 5000);

              // Check if merge might have succeeded before the hang
              // Look for success indicators in the output
              const mayHaveSucceeded = stdout.includes('staged') ||
                stdout.includes('Successfully merged') ||
                stdout.includes('Changes from');

              if (mayHaveSucceeded) {
                debug('TIMEOUT: Process hung but merge may have succeeded based on output');
                const isStageOnly = options?.noCommit === true;
                resolve({
                  success: true,
                  data: {
                    success: true,
                    message: 'Changes staged (process timed out but merge appeared successful)',
                    staged: isStageOnly,
                    projectPath: isStageOnly ? project.path : undefined
                  }
                });
              } else {
                resolve({
                  success: false,
                  error: 'Merge process timed out. Check git status to see if merge completed.'
                });
              }
            }
          }, MERGE_TIMEOUT_MS);

          mergeProcess.stdout.on('data', (data: Buffer) => {
            const chunk = data.toString();
            stdout += chunk;
            debug('STDOUT:', chunk);
          });

          mergeProcess.stderr.on('data', (data: Buffer) => {
            const chunk = data.toString();
            stderr += chunk;
            debug('STDERR:', chunk);
          });

          // Handler for when process exits
          const handleProcessExit = (code: number | null, signal: string | null = null) => {
            if (resolved) return; // Prevent double-resolution
            resolved = true;
            if (timeoutId) clearTimeout(timeoutId);

            debug('Process exited with code:', code, 'signal:', signal);
            debug('Full stdout:', stdout);
            debug('Full stderr:', stderr);

            // Get git status after merge
            try {
              const gitStatusAfter = execSync('git status --short', { cwd: project.path, encoding: 'utf-8' });
              debug('Git status AFTER merge in main project:\n', gitStatusAfter || '(clean)');
              const gitDiffStaged = execSync('git diff --staged --stat', { cwd: project.path, encoding: 'utf-8' });
              debug('Staged changes:\n', gitDiffStaged || '(none)');
            } catch (e) {
              debug('Failed to get git status after:', e);
            }

            if (code === 0) {
              const isStageOnly = options?.noCommit === true;

              // Verify changes were actually staged when stage-only mode is requested
              // This prevents false positives when merge was already committed previously
              let hasActualStagedChanges = false;
              let mergeAlreadyCommitted = false;
              let stagedFilesList: string[] = [];

              if (isStageOnly) {
                try {
                  const gitDiffStaged = execSync('git diff --staged --stat', { cwd: project.path, encoding: 'utf-8' });
                  hasActualStagedChanges = gitDiffStaged.trim().length > 0;
                  debug('Stage-only verification: hasActualStagedChanges:', hasActualStagedChanges);

                  // Get list of staged files for workflow tracking
                  if (hasActualStagedChanges) {
                    try {
                      const stagedFilesOutput = execSync('git diff --staged --name-only', { cwd: project.path, encoding: 'utf-8' });
                      stagedFilesList = stagedFilesOutput.trim().split('\n').filter(f => f.trim());
                      debug('Staged files for tracking:', stagedFilesList.length);
                    } catch (e) {
                      debug('Failed to get staged files list:', e);
                    }
                  }

                  if (!hasActualStagedChanges) {
                    // Check if worktree branch was already merged (merge commit exists)
                    let specBranch = `auto-codex/${task.specId}`;
                    try {
                      specBranch = getCurrentBranch(worktreePath);
                    } catch {
                      // Fall back to default branch naming
                    }
                    try {
                      const mergeCheck = spawnSync('git', ['merge-base', '--is-ancestor', specBranch, 'HEAD'], {
                        cwd: project.path,
                        encoding: 'utf-8',
                        windowsHide: true,
                        shell: false
                      });

                      // Exit code semantics:
                      // 0 => is ancestor (already merged), 1 => not ancestor, 128 => error (e.g., missing ref)
                      mergeAlreadyCommitted = mergeCheck.status === 0;
                      debug('Merge already committed check:', mergeAlreadyCommitted);
                    } catch {
                      // Branch may not exist or other error - assume not merged
                      debug('Could not check merge status, assuming not merged');
                    }
                  }
                } catch (e) {
                  debug('Failed to verify staged changes:', e);
                }
              }

              // Determine actual status based on verification
              let newStatus: string;
              let planStatus: string;
              let message: string;
              let staged: boolean;

              if (isStageOnly && !hasActualStagedChanges && mergeAlreadyCommitted) {
                // Stage-only was requested but merge was already committed previously
                // Mark as done since changes are already in the branch
                newStatus = 'done';
                planStatus = 'completed';
                message = 'Changes were already merged and committed. Task marked as done.';
                staged = false;
                debug('Stage-only requested but merge already committed. Marking as done.');
              } else if (isStageOnly && !hasActualStagedChanges) {
                // Stage-only was requested but no changes to stage (and not committed)
                // This could mean nothing to merge or an error - keep in human_review for investigation
                newStatus = 'human_review';
                planStatus = 'review';
                message = 'No changes to stage. The worktree may have no differences from the current branch.';
                staged = false;
                debug('Stage-only requested but no changes to stage.');
              } else if (isStageOnly) {
                // Stage-only with actual staged changes - expected success case
                newStatus = 'human_review';
                planStatus = 'review';
                message = 'Changes staged in main project. Review with git status and commit when ready.';
                staged = true;
              } else {
                // Full merge (not stage-only)
                newStatus = 'done';
                planStatus = 'completed';
                message = 'Changes merged successfully';
                staged = false;
              }

              debug('Merge result. isStageOnly:', isStageOnly, 'newStatus:', newStatus, 'staged:', staged);

              // Read suggested commit message if staging succeeded
              let suggestedCommitMessage: string | undefined;
              if (staged) {
                const commitMsgPath = path.join(specDir, 'suggested_commit_message.txt');
                try {
                  if (existsSync(commitMsgPath)) {
                    const { readFileSync } = require('fs');
                    suggestedCommitMessage = readFileSync(commitMsgPath, 'utf-8').trim();
                    debug('Read suggested commit message:', suggestedCommitMessage?.substring(0, 100));
                  }
                } catch (e) {
                  debug('Failed to read suggested commit message:', e);
                }
              }

              // Persist the status change to implementation_plan.json
              const planPath = path.join(specDir, AUTO_BUILD_PATHS.IMPLEMENTATION_PLAN);
              try {
                if (existsSync(planPath)) {
                  const { readFileSync } = require('fs');
                  const planContent = readFileSync(planPath, 'utf-8');
                  const plan = JSON.parse(planContent);
                  plan.status = newStatus;
                  plan.planStatus = planStatus;
                  plan.updated_at = new Date().toISOString();
                  if (staged) {
                    plan.stagedAt = new Date().toISOString();
                    plan.stagedInMainProject = true;
                  }
                  atomicWriteFileSync(planPath, JSON.stringify(plan, null, 2), { encoding: 'utf-8' });
                }
              } catch (persistError) {
                console.error('Failed to persist task status:', persistError);
              }

              // Track staged changes using the workflow system (Requirements 1.1, 2.1)
              // This records which files were staged from which task for later review/commit
              if (staged && stagedFilesList.length > 0) {
                debug('Tracking staged changes via workflow system:', stagedFilesList.length, 'files');
                trackStagedChanges(
                  pythonEnvManager,
                  project.path,
                  task.specId,
                  taskId,
                  stagedFilesList
                ).catch(err => {
                  debug('Failed to track staged changes (non-blocking):', err);
                });
              }

              const mainWindow = getMainWindow();
              if (mainWindow) {
                mainWindow.webContents.send(IPC_CHANNELS.TASK_STATUS_CHANGE, taskId, newStatus);
              }

              resolve({
                success: true,
                data: {
                  success: true,
                  message,
                  staged,
                  projectPath: staged ? project.path : undefined,
                  suggestedCommitMessage
                }
              });
            } else {
              // Check if there were conflicts
              const hasConflicts = stdout.includes('conflict') || stderr.includes('conflict');
              debug('Merge failed. hasConflicts:', hasConflicts);

              resolve({
                success: true,
                data: {
                  success: false,
                  message: hasConflicts ? 'Merge conflicts detected' : `Merge failed: ${stderr || stdout}`,
                  conflictFiles: hasConflicts ? [] : undefined
                }
              });
            }
          };

          mergeProcess.on('close', (code: number | null, signal: string | null) => {
            handleProcessExit(code, signal);
          });

          // Also listen to 'exit' event in case 'close' doesn't fire
          mergeProcess.on('exit', (code: number | null, signal: string | null) => {
            // Give close event a chance to fire first with complete output
            setTimeout(() => handleProcessExit(code, signal), 100);
          });

          mergeProcess.on('error', (err: Error) => {
            if (resolved) return;
            resolved = true;
            if (timeoutId) clearTimeout(timeoutId);
            console.error('[MERGE] Process spawn error:', err);
            resolve({
              success: false,
              error: `Failed to run merge: ${err.message}`
            });
          });
        });
      } catch (error) {
        console.error('[MERGE] Exception in merge handler:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to merge worktree'
        };
      }
    }
  );

  /**
   * Preview merge conflicts before actually merging
   * Uses the smart merge system to analyze potential conflicts
   */
  ipcMain.handle(
    IPC_CHANNELS.TASK_WORKTREE_MERGE_PREVIEW,
    async (_, taskId: string): Promise<IPCResult<WorktreeMergeResult>> => {
      console.warn('[IPC] TASK_WORKTREE_MERGE_PREVIEW called with taskId:', taskId);
      try {
        // Ensure Python environment is ready
        if (!pythonEnvManager.isEnvReady()) {
          console.warn('[IPC] Python environment not ready, initializing...');
          const autoBuildSource = getEffectiveSourcePath();
          if (autoBuildSource) {
            const status = await pythonEnvManager.initialize(autoBuildSource);
            if (!status.ready) {
              console.error('[IPC] Python environment failed to initialize:', status.error);
              return { success: false, error: `Python environment not ready: ${status.error || 'Unknown error'}` };
            }
          } else {
            console.error('[IPC] Auto Codex source not found');
            return { success: false, error: 'Python environment not ready and Auto Codex source not found' };
          }
        }

        const { task, project } = findTaskAndProject(taskId);
        if (!task || !project) {
          console.error('[IPC] Task not found:', taskId);
          return { success: false, error: 'Task not found' };
        }
        console.warn('[IPC] Found task:', task.specId, 'project:', project.name);

        // Check for uncommitted changes in the main project
        let hasUncommittedChanges = false;
        let uncommittedFiles: string[] = [];
        try {
          const gitStatus = execSync('git status --porcelain', {
            cwd: project.path,
            encoding: 'utf-8'
          });

          if (gitStatus && gitStatus.trim()) {
            // Parse the status output to get file names
            // Format: XY filename (where X and Y are status chars, then space, then filename)
            uncommittedFiles = gitStatus
              .split('\n')
              .filter(line => line.trim())
              .map(line => line.substring(3).trim()); // Skip 2 status chars + 1 space, trim any trailing whitespace

            hasUncommittedChanges = uncommittedFiles.length > 0;
          }
        } catch (e) {
          console.error('[IPC] Failed to check git status:', e);
        }

        const sourcePath = getEffectiveSourcePath();
        if (!sourcePath) {
          console.error('[IPC] Auto Codex source not found');
          return { success: false, error: 'Auto Codex source not found' };
        }

        const runScript = path.join(sourcePath, 'run.py');
        const args = [
          runScript,
          '--spec', task.specId,
          '--project-dir', project.path,
          '--merge-preview'
        ];

        const pythonPath = pythonEnvManager.getPythonPath() || findPythonCommand() || 'python';
        console.warn('[IPC] Running merge preview:', pythonPath, args.join(' '));

        // Get profile environment for consistency
        const previewProfileEnv = getProfileEnv();

        return new Promise((resolve) => {
          // Parse Python command to handle space-separated commands like "py -3"
          const [pythonCommand, pythonBaseArgs] = parsePythonCommand(pythonPath);
          const previewProcess = spawn(pythonCommand, [...pythonBaseArgs, ...args], {
            cwd: sourcePath,
            env: { ...process.env, ...previewProfileEnv, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', DEBUG: 'true' }
          });

          let stdout = '';
          let stderr = '';

          previewProcess.stdout.on('data', (data: Buffer) => {
            const chunk = data.toString();
            stdout += chunk;
            console.warn('[IPC] merge-preview stdout:', chunk);
          });

          previewProcess.stderr.on('data', (data: Buffer) => {
            const chunk = data.toString();
            stderr += chunk;
            console.warn('[IPC] merge-preview stderr:', chunk);
          });

          previewProcess.on('close', (code: number) => {
            console.warn('[IPC] merge-preview process exited with code:', code);
            if (code === 0) {
              try {
                // Parse JSON output from Python
                const result = JSON.parse(stdout.trim());
                console.warn('[IPC] merge-preview result:', JSON.stringify(result, null, 2));
                resolve({
                  success: true,
                  data: {
                    success: result.success,
                    message: result.error || 'Preview completed',
                    preview: {
                      files: result.files || [],
                      conflicts: result.conflicts || [],
                      summary: result.summary || {
                        totalFiles: 0,
                        conflictFiles: 0,
                        totalConflicts: 0,
                        autoMergeable: 0,
                        hasGitConflicts: false
                      },
                      gitConflicts: result.gitConflicts || null,
                      // Include uncommitted changes info for the frontend
                      uncommittedChanges: hasUncommittedChanges ? {
                        hasChanges: true,
                        files: uncommittedFiles,
                        count: uncommittedFiles.length
                      } : null
                    }
                  }
                });
              } catch (parseError) {
                console.error('[IPC] Failed to parse preview result:', parseError);
                console.error('[IPC] stdout:', stdout);
                console.error('[IPC] stderr:', stderr);
                resolve({
                  success: false,
                  error: `Failed to parse preview result: ${stderr || stdout}`
                });
              }
            } else {
              console.error('[IPC] Preview failed with exit code:', code);
              console.error('[IPC] stderr:', stderr);
              console.error('[IPC] stdout:', stdout);
              resolve({
                success: false,
                error: `Preview failed: ${stderr || stdout}`
              });
            }
          });

          previewProcess.on('error', (err: Error) => {
            console.error('[IPC] merge-preview spawn error:', err);
            resolve({
              success: false,
              error: `Failed to run preview: ${err.message}`
            });
          });
        });
      } catch (error) {
        console.error('[IPC] TASK_WORKTREE_MERGE_PREVIEW error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to preview merge'
        };
      }
    }
  );

  /**
   * Discard the worktree changes
   * Per-spec architecture: Each spec has its own worktree at .worktrees/{spec-name}/
   */
  ipcMain.handle(
    IPC_CHANNELS.TASK_WORKTREE_DISCARD,
    async (_, taskId: string): Promise<IPCResult<WorktreeDiscardResult>> => {
      try {
        const { task, project } = findTaskAndProject(taskId);
        if (!task || !project) {
          return { success: false, error: 'Task not found' };
        }

        // Per-spec worktree path: .worktrees/{spec-name}/
        const worktreePath = path.join(project.path, '.worktrees', task.specId);

        if (!existsSync(worktreePath)) {
          return {
            success: true,
            data: {
              success: true,
              message: 'No worktree to discard'
            }
          };
        }

        try {
          // Get the branch name before removing
          const branch = getCurrentBranch(worktreePath);

          // Remove the worktree
          const removeResult = spawnSync('git', ['worktree', 'remove', '--force', worktreePath], {
            cwd: project.path,
            encoding: 'utf-8',
            windowsHide: true,
            shell: false
          });
          if (removeResult.status !== 0) {
            throw new Error((removeResult.stderr || removeResult.stdout || 'Failed to remove worktree').toString());
          }

          // Delete the branch
          try {
            const deleteBranchResult = spawnSync('git', ['branch', '-D', branch], {
              cwd: project.path,
              encoding: 'utf-8',
              windowsHide: true,
              shell: false
            });
            if (deleteBranchResult.status !== 0) {
              throw new Error((deleteBranchResult.stderr || deleteBranchResult.stdout || 'Failed to delete branch').toString());
            }
          } catch {
            // Branch might already be deleted or not exist
          }

          const mainWindow = getMainWindow();
          if (mainWindow) {
            mainWindow.webContents.send(IPC_CHANNELS.TASK_STATUS_CHANGE, taskId, 'backlog');
          }

          return {
            success: true,
            data: {
              success: true,
              message: 'Worktree discarded successfully'
            }
          };
        } catch (gitError) {
          console.error('Git error discarding worktree:', gitError);
          return {
            success: false,
            error: `Failed to discard worktree: ${gitError instanceof Error ? gitError.message : 'Unknown error'}`
          };
        }
      } catch (error) {
        console.error('Failed to discard worktree:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to discard worktree'
        };
      }
    }
  );

  /**
   * Delete a worktree directly by specName (for orphaned worktrees without matching tasks)
   */
  ipcMain.handle(
    IPC_CHANNELS.TASK_WORKTREE_DELETE_DIRECT,
    async (_, specName: string): Promise<IPCResult<WorktreeDiscardResult>> => {
      try {
        // Find the project that contains this worktree
        const projects = projectStore.getProjects();
        let targetProject: typeof projects[number] | undefined;
        let worktreePath: string | undefined;

        for (const project of projects) {
          const potentialPath = path.join(project.path, '.worktrees', specName);
          if (existsSync(potentialPath)) {
            targetProject = project;
            worktreePath = potentialPath;
            break;
          }
        }

        if (!targetProject || !worktreePath) {
          return {
            success: false,
            error: `Worktree not found: ${specName}`
          };
        }

        // Remove the worktree using git worktree remove
        try {
          runGit(targetProject.path, ['worktree', 'remove', worktreePath, '--force']);
        } catch (gitError) {
          // If git worktree remove fails, try removing the directory directly
          console.warn('git worktree remove failed, removing directory directly:', gitError);
          rmSync(worktreePath, { recursive: true, force: true });
        }

        // Prune worktree metadata
        try {
          runGit(targetProject.path, ['worktree', 'prune']);
        } catch {
          // Ignore prune errors
        }

        return {
          success: true,
          data: {
            success: true,
            message: `Worktree ${specName} deleted successfully`
          }
        };
      } catch (error) {
        console.error('Failed to delete worktree:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete worktree'
        };
      }
    }
  );

  /**
   * List all spec worktrees for a project
   * Per-spec architecture: Each spec has its own worktree at .worktrees/{spec-name}/
   */
  ipcMain.handle(
    IPC_CHANNELS.TASK_LIST_WORKTREES,
    async (_, projectId: string): Promise<IPCResult<WorktreeListResult>> => {
      try {
        const project = projectStore.getProject(projectId);
        if (!project) {
          return { success: false, error: 'Project not found' };
        }

        // Clean up stale/prunable worktree metadata so future worktree operations don't fail.
        // This is safe: it only removes admin data for missing worktrees.
        try {
          runGit(project.path, ['worktree', 'prune']);
        } catch (pruneError) {
          console.warn(
            'Failed to prune worktrees (continuing):',
            pruneError instanceof Error ? pruneError.message : pruneError
          );
        }

        const worktreesDir = path.join(project.path, '.worktrees');
        const worktrees: WorktreeListItem[] = [];

        if (!existsSync(worktreesDir)) {
          return { success: true, data: { worktrees } };
        }

        // Get all directories in .worktrees
        const entries = readdirSync(worktreesDir);
        for (const entry of entries) {
          const entryPath = path.join(worktreesDir, entry);
          let stat;
          try {
            stat = statSync(entryPath);
          } catch {
            // Entry may have been removed between readdir and stat
            continue;
          }

          // Skip worker directories and non-directories
          if (!stat.isDirectory() || entry.startsWith('worker-')) {
            continue;
          }

          try {
            // Get branch info
            const branch = getCurrentBranch(entryPath);

            // Get base branch - the current branch in the main project (where changes will be merged)
            let baseBranch = 'main';
            try {
              baseBranch = getCurrentBranch(project.path);
            } catch {
              baseBranch = 'main';
            }

            // Get commit count
            let commitCount = 0;
            try {
              const countOutput = runGit(entryPath, ['rev-list', '--count', `${baseBranch}..HEAD`]).trim();
              commitCount = parseInt(countOutput, 10) || 0;
            } catch {
              commitCount = 0;
            }

            // Get diff stats - COMMITTED changes between branches
            let filesChanged = 0;
            let additions = 0;
            let deletions = 0;

            try {
              const diffStat = runGit(entryPath, ['diff', '--shortstat', `${baseBranch}...HEAD`]).trim();

              const filesMatch = diffStat.match(/(\d+) files? changed/);
              const addMatch = diffStat.match(/(\d+) insertions?/);
              const delMatch = diffStat.match(/(\d+) deletions?/);

              if (filesMatch) filesChanged = parseInt(filesMatch[1], 10) || 0;
              if (addMatch) additions = parseInt(addMatch[1], 10) || 0;
              if (delMatch) deletions = parseInt(delMatch[1], 10) || 0;
            } catch {
              // Ignore diff errors
            }

            // Also count UNCOMMITTED changes (modified, untracked files)
            try {
              const statusOutput = runGit(entryPath, ['status', '--porcelain']).trim();
              if (statusOutput) {
                const uncommittedLines = statusOutput.split('\n').filter(line => line.length > 0);
                filesChanged += uncommittedLines.length;

                // Get line-level changes for uncommitted files
                try {
                  const uncommittedDiff = runGit(entryPath, ['diff', '--numstat']).trim();
                  for (const line of uncommittedDiff.split('\n')) {
                    const parts = line.split('\t');
                    if (parts.length >= 3) {
                      const add = parseInt(parts[0], 10) || 0;
                      const del = parseInt(parts[1], 10) || 0;
                      additions += add;
                      deletions += del;
                    }
                  }
                } catch {
                  // Ignore uncommitted diff errors
                }
              }
            } catch {
              // Ignore status errors
            }

            // Get last commit date for stale detection
            let lastCommitDate: string | undefined;
            let daysSinceLastActivity: number | undefined;
            try {
              const lastCommitOutput = runGit(entryPath, ['log', '-1', '--format=%cI']).trim();
              if (lastCommitOutput) {
                lastCommitDate = lastCommitOutput;
                const lastCommitTime = new Date(lastCommitOutput).getTime();
                const now = Date.now();
                daysSinceLastActivity = Math.floor((now - lastCommitTime) / (1000 * 60 * 60 * 24));
              }
            } catch {
              // Ignore date errors - worktree may have no commits
            } worktrees.push({
              specName: entry,
              path: entryPath,
              branch,
              baseBranch,
              commitCount,
              filesChanged,
              additions,
              deletions,
              lastCommitDate,
              daysSinceLastActivity,
              isStale: daysSinceLastActivity !== undefined && daysSinceLastActivity > 7
            });
          } catch (gitError) {
            console.error(`Error getting info for worktree ${entry}:`, gitError);
            // Skip this worktree if we can't get git info
          }
        }

        // Identify stale worktrees (older than 7 days by default)
        const staleWorktrees = worktrees.filter(w => w.isStale);

        return {
          success: true,
          data: {
            worktrees,
            staleWorktrees: staleWorktrees.length > 0 ? staleWorktrees : undefined,
            staleCount: staleWorktrees.length
          }
        };
      } catch (error) {
        console.error('Failed to list worktrees:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to list worktrees'
        };
      }
    }
  );
}
