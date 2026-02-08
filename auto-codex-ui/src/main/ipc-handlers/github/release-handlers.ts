/**
 * GitHub release creation IPC handlers
 */

import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { execFileSync, execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { IPC_CHANNELS } from '../../../shared/constants';
import type {
  IPCResult,
  GitCommit,
  VersionSuggestion,
  ReleasePreflightStatus
} from '../../../shared/types';
import { projectStore } from '../../project-store';
import { changelogService } from '../../changelog-service';
import { releaseService } from '../../release-service';
import type { ReleaseOptions } from './types';

function isTrue(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return /^(true|1|yes|on)$/i.test(value.trim());
}

function normalizeVersion(version: string): string {
  return version.replace(/^v/i, '');
}

function shouldSkipReleasePreflight(): boolean {
  return isTrue(process.env.AUTO_CODEX_SKIP_RELEASE_PREFLIGHT);
}

function formatPreflightError(status: ReleasePreflightStatus): string {
  if (status.blockers.length === 0) {
    return 'Release blocked by preflight checks.';
  }

  const maxItems = 3;
  const preview = status.blockers.slice(0, maxItems).join('; ');
  const remaining = status.blockers.length - maxItems;

  if (remaining > 0) {
    return `Release blocked by preflight checks: ${preview} (and ${remaining} more)`;
  }

  return `Release blocked by preflight checks: ${preview}`;
}

function resolveMainBranch(project: { settings?: { mainBranch?: string } }): string {
  const configured = project.settings?.mainBranch;
  if (configured && configured.trim()) {
    return configured.trim();
  }
  return 'main';
}

let releaseEventBridgeInitialized = false;

function setupReleaseEventBridge(getMainWindow: () => BrowserWindow | null): void {
  if (releaseEventBridgeInitialized) {
    return;
  }

  releaseService.on('release-progress', (projectId: string, progress: import('../../../shared/types').ReleaseProgress) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send(IPC_CHANNELS.RELEASE_PROGRESS, projectId, progress);
    }
  });

  releaseService.on('release-complete', (projectId: string, result: import('../../../shared/types').CreateReleaseResult) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send(IPC_CHANNELS.RELEASE_COMPLETE, projectId, result);
    }
  });

  releaseService.on('release-error', (projectId: string, error: string) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send(IPC_CHANNELS.RELEASE_ERROR, projectId, error);
    }
  });

  releaseEventBridgeInitialized = true;
}

/**
 * Check if gh CLI is installed
 */
function checkGhCli(): { installed: boolean; error?: string } {
  try {
    const checkCmd = process.platform === 'win32' ? 'where gh' : 'which gh';
    execSync(checkCmd, { encoding: 'utf-8', stdio: 'pipe' });
    return { installed: true };
  } catch {
    return {
      installed: false,
      error: 'GitHub CLI (gh) not found. Please install it: https://cli.github.com/'
    };
  }
}

/**
 * Check if user is authenticated with gh CLI
 */
function checkGhAuth(projectPath: string): { authenticated: boolean; error?: string } {
  try {
    execSync('gh auth status', { cwd: projectPath, encoding: 'utf-8', stdio: 'pipe' });
    return { authenticated: true };
  } catch {
    return {
      authenticated: false,
      error: 'Not authenticated with GitHub. Run "gh auth login" in terminal first.'
    };
  }
}

/**
 * Build gh release command arguments
 */
function buildReleaseArgs(version: string, releaseNotes: string, options?: ReleaseOptions): string[] {
  const tag = version.startsWith('v') ? version : `v${version}`;
  const args = ['release', 'create', tag, '--title', tag, '--notes', releaseNotes];

  if (options?.draft) {
    args.push('--draft');
  }
  if (options?.prerelease) {
    args.push('--prerelease');
  }

  return args;
}

/**
 * Create a GitHub release using gh CLI
 */
export function registerCreateRelease(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_CREATE_RELEASE,
    async (
      _,
      projectId: string,
      version: string,
      releaseNotes: string,
      options?: ReleaseOptions
    ): Promise<IPCResult<{ url: string }>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const normalizedVersion = normalizeVersion(version);

      if (!shouldSkipReleasePreflight()) {
        try {
          const tasks = projectStore.getTasks(projectId);
          const preflight = await releaseService.runPreflightChecks(
            project.path,
            normalizedVersion,
            tasks
          );
          if (!preflight.canRelease) {
            return {
              success: false,
              error: formatPreflightError(preflight)
            };
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: `Release preflight failed: ${message}`
          };
        }
      }

      // Check if gh CLI is available
      const cliCheck = checkGhCli();
      if (!cliCheck.installed) {
        return { success: false, error: cliCheck.error };
      }

      // Check if user is authenticated
      const authCheck = checkGhAuth(project.path);
      if (!authCheck.authenticated) {
        return { success: false, error: authCheck.error };
      }

      try {
        // Build and execute release command
        const args = buildReleaseArgs(normalizedVersion, releaseNotes, options);
        const output = execFileSync('gh', args, {
          cwd: project.path,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'pipe']
        }).trim();

        // Output is typically the release URL
        const tag = `v${normalizedVersion}`;
        const releaseUrl = output || `https://github.com/releases/tag/${tag}`;

        return {
          success: true,
          data: { url: releaseUrl }
        };
      } catch (error) {
        // Extract error message from stderr if available
        const errorMsg = error instanceof Error ? error.message : 'Failed to create release';
        if (error && typeof error === 'object' && 'stderr' in error) {
          return { success: false, error: String(error.stderr) || errorMsg };
        }
        return { success: false, error: errorMsg };
      }
    }
  );
}

/**
 * Release workflow handlers that use releaseService preflight + progress events.
 */
export function registerReleaseWorkflowHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.RELEASE_GET_VERSIONS,
    async (_, projectId: string): Promise<IPCResult<import('../../../shared/types').ReleaseableVersion[]>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      try {
        const tasks = projectStore.getTasks(projectId);
        const versions = await releaseService.getReleaseableVersions(project.path, tasks);
        return { success: true, data: versions };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get release versions'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.RELEASE_PREFLIGHT,
    async (_, projectId: string, version: string): Promise<IPCResult<ReleasePreflightStatus>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      try {
        const tasks = projectStore.getTasks(projectId);
        const status = await releaseService.runPreflightChecks(
          project.path,
          normalizeVersion(version),
          tasks
        );
        return { success: true, data: status };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to run release preflight'
        };
      }
    }
  );

  const runReleaseCreate = async (
    request: import('../../../shared/types').CreateReleaseRequest
  ): Promise<IPCResult> => {
      const project = projectStore.getProject(request.projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      try {
        const normalizedVersion = normalizeVersion(request.version);
        const tasks = projectStore.getTasks(request.projectId);

        if (!shouldSkipReleasePreflight()) {
          const preflight = await releaseService.runPreflightChecks(
            project.path,
            normalizedVersion,
            tasks
          );
          if (!preflight.canRelease) {
            const error = formatPreflightError(preflight);
            releaseService.emitReleaseError(request.projectId, error);
            return { success: false, error };
          }
        }

        const result = await releaseService.createRelease(project.path, {
          ...request,
          version: normalizedVersion,
          mainBranch: request.mainBranch || resolveMainBranch(project)
        });

        if (result.success) {
          releaseService.emitReleaseComplete(request.projectId, result);
          return { success: true, data: result };
        }

        const error = result.error || 'Release failed';
        releaseService.emitReleaseError(request.projectId, error);
        return { success: false, error };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Release failed';
        releaseService.emitReleaseError(request.projectId, message);
        return { success: false, error: message };
      }
  };

  ipcMain.on(
    IPC_CHANNELS.RELEASE_CREATE,
    (_, request: import('../../../shared/types').CreateReleaseRequest) => {
      void runReleaseCreate(request);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.RELEASE_CREATE,
    async (_, request: import('../../../shared/types').CreateReleaseRequest): Promise<IPCResult> => {
      return runReleaseCreate(request);
    }
  );
}

/**
 * Get the latest git tag in the repository
 */
function getLatestTag(projectPath: string): string | null {
  try {
    const tag = execFileSync('git', ['describe', '--tags', '--abbrev=0'], {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return tag || null;
  } catch {
    return null;
  }
}

/**
 * Get commits since a specific tag (or all commits if no tag)
 */
function getCommitsSinceTag(projectPath: string, tag: string | null): GitCommit[] {
  try {
    const range = tag ? `${tag}..HEAD` : 'HEAD';
    const format = '%H|%s|%an|%ae|%aI';
    const output = execFileSync(
      'git',
      ['log', range, `--pretty=format:${format}`],
      { cwd: projectPath, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim();

    if (!output) return [];

    return output.split('\n').map(line => {
      const [fullHash, subject, authorName, authorEmail, date] = line.split('|');
      return {
        hash: fullHash.substring(0, 7),
        fullHash,
        subject,
        author: authorName,
        authorEmail,
        date
      };
    });
  } catch {
    return [];
  }
}

/**
 * Get current version from package.json
 */
function getCurrentVersion(projectPath: string): string {
  try {
    const pkgPath = path.join(projectPath, 'package.json');
    if (!existsSync(pkgPath)) {
      return '0.0.0';
    }
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Suggest version for release using AI analysis of commits
 */
export function registerSuggestVersion(): void {
  ipcMain.handle(
    IPC_CHANNELS.RELEASE_SUGGEST_VERSION,
    async (_, projectId: string): Promise<IPCResult<VersionSuggestion>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      try {
        // Get current version from package.json
        const currentVersion = getCurrentVersion(project.path);

        // Get latest tag
        const latestTag = getLatestTag(project.path);

        // Get commits since last tag
        const commits = getCommitsSinceTag(project.path, latestTag);

        if (commits.length === 0) {
          // No commits since last release, suggest patch bump
          const [major, minor, patch] = currentVersion.split('.').map(Number);
          return {
            success: true,
            data: {
              suggestedVersion: `${major}.${minor}.${patch + 1}`,
              currentVersion,
              bumpType: 'patch',
              reason: 'No new commits since last release',
              commitCount: 0
            }
          };
        }

        // Use AI to analyze commits and suggest version
        const suggestion = await changelogService.suggestVersionFromCommits(
          project.path,
          commits,
          currentVersion
        );

        return {
          success: true,
          data: {
            suggestedVersion: suggestion.version,
            currentVersion,
            bumpType: suggestion.reason.includes('breaking') ? 'major' :
                      suggestion.reason.includes('feature') || suggestion.reason.includes('minor') ? 'minor' : 'patch',
            reason: suggestion.reason,
            commitCount: commits.length
          }
        };
      } catch (_error) {
        // Fallback to patch bump on error
        const currentVersion = getCurrentVersion(project.path);
        const [major, minor, patch] = currentVersion.split('.').map(Number);

        return {
          success: true,
          data: {
            suggestedVersion: `${major}.${minor}.${patch + 1}`,
            currentVersion,
            bumpType: 'patch',
            reason: 'Fallback suggestion (AI analysis unavailable)',
            commitCount: 0
          }
        };
      }
    }
  );
}

/**
 * Register all release-related handlers
 */
export function registerReleaseHandlers(getMainWindow: () => BrowserWindow | null): void {
  setupReleaseEventBridge(getMainWindow);
  registerReleaseWorkflowHandlers();
  registerCreateRelease();
  registerSuggestVersion();
}
