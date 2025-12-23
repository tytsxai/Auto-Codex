import { app } from 'electron';
import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { getEffectiveSourcePath } from '../../updater/path-resolver';
import { loadSettingsWithDecryptedSecrets } from '../../utils/secure-settings';

export interface EnvironmentVars {
  [key: string]: string;
}

export interface GlobalSettings {
  autoBuildPath?: string;
  globalOpenAIApiKey?: string;
}

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function isValidAutoBuildSourcePath(candidatePath: string | undefined): candidatePath is string {
  if (!candidatePath || !existsSync(candidatePath)) return false;
  // Prefer analyzer.py (used directly), fall back to requirements.txt marker.
  return (
    existsSync(path.join(candidatePath, 'analyzer.py')) ||
    existsSync(path.join(candidatePath, 'requirements.txt'))
  );
}

/**
 * Get the auto-build source path from settings
 */
export function getAutoBuildSourcePath(): string | null {
  if (existsSync(settingsPath)) {
    try {
      const content = readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(content);
      if (isValidAutoBuildSourcePath(settings.autoBuildPath)) {
        return settings.autoBuildPath;
      }
    } catch {
      // Fall through to null
    }
  }

  // Fallback: use bundled/updated source path resolution (works in dev + packaged apps)
  const effectiveSource = getEffectiveSourcePath();
  if (isValidAutoBuildSourcePath(effectiveSource)) {
    return effectiveSource;
  }

  // Last resort: try repo-relative locations (useful when launched with unexpected cwd)
  const repoRelativeCandidates = [
    path.resolve(process.cwd(), 'auto-codex'),
    path.resolve(process.cwd(), '..', 'auto-codex')
  ];
  for (const candidate of repoRelativeCandidates) {
    if (isValidAutoBuildSourcePath(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Parse .env file content into key-value pairs
 * Handles both Unix and Windows line endings
 */
export function parseEnvFile(envContent: string): EnvironmentVars {
  const vars: EnvironmentVars = {};

  for (const line of envContent.split(/\r?\n/)) {
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
}

/**
 * Load environment variables from project .env file
 */
export function loadProjectEnvVars(projectPath: string, autoBuildPath?: string): EnvironmentVars {
  if (!autoBuildPath) {
    return {};
  }

  const projectEnvPath = path.join(projectPath, autoBuildPath, '.env');
  if (!existsSync(projectEnvPath)) {
    return {};
  }

  try {
    const envContent = readFileSync(projectEnvPath, 'utf-8');
    return parseEnvFile(envContent);
  } catch {
    return {};
  }
}

/**
 * Load global settings from user data directory
 */
export function loadGlobalSettings(): GlobalSettings {
  if (!existsSync(settingsPath)) {
    return {};
  }

  return loadSettingsWithDecryptedSecrets(settingsPath).settings;
}

/**
 * Check if Graphiti is enabled in project or global environment
 */
export function isGraphitiEnabled(projectEnvVars: EnvironmentVars): boolean {
  return (
    projectEnvVars['GRAPHITI_ENABLED']?.toLowerCase() === 'true' ||
    process.env.GRAPHITI_ENABLED?.toLowerCase() === 'true'
  );
}

/**
 * Check if OpenAI API key is available
 * Priority: project .env > global settings > process.env
 */
export function hasOpenAIKey(projectEnvVars: EnvironmentVars, globalSettings: GlobalSettings): boolean {
  return !!(
    projectEnvVars['OPENAI_API_KEY'] ||
    globalSettings.globalOpenAIApiKey ||
    process.env.OPENAI_API_KEY
  );
}

/**
 * Get Graphiti connection details
 */
export interface GraphitiConnectionDetails {
  host: string;
  port: number;
  database: string;
}

export function getGraphitiConnectionDetails(projectEnvVars: EnvironmentVars): GraphitiConnectionDetails {
  const host = projectEnvVars['GRAPHITI_FALKORDB_HOST'] ||
               process.env.GRAPHITI_FALKORDB_HOST ||
               'localhost';

  const port = parseInt(
    projectEnvVars['GRAPHITI_FALKORDB_PORT'] ||
    process.env.GRAPHITI_FALKORDB_PORT ||
    '6380',
    10
  );

  const database = projectEnvVars['GRAPHITI_DATABASE'] ||
                   process.env.GRAPHITI_DATABASE ||
                   'auto_codex_memory';

  return { host, port, database };
}
