/**
 * Codex CLI config helpers.
 *
 * Purpose: detect provider-specific env_key requirements (e.g. YUNYI_KEY)
 * from a Codex config dir, and source an API key from auth.json when the
 * Electron app environment doesn't include shell-loaded variables.
 */

import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface CodexProviderEnvInfo {
  provider?: string;
  envKey?: string;
  preferredAuthMethod?: string;
}

export interface CodexAuthJson {
  OPENAI_API_KEY?: string;
  api_key?: string;
  apiKey?: string;
  api_base_url?: string;
  access_token?: string;
  refresh_token?: string;
  [key: string]: unknown;
}

function safeReadText(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function expandHomePath(path: string): string {
  if (path && path.startsWith('~')) {
    return path.replace(/^~/, homedir());
  }
  return path;
}

export function configDirLooksConfigured(configDir: string): boolean {
  const dir = expandHomePath(configDir || '');
  if (!dir || !existsSync(dir)) return false;
  return (
    existsSync(join(dir, 'config.toml')) ||
    existsSync(join(dir, 'auth.json')) ||
    existsSync(join(dir, 'settings.json'))
  );
}

export function readAuthJson(configDir: string): CodexAuthJson | null {
  const dir = expandHomePath(configDir || '');
  const authPath = join(dir, 'auth.json');
  const raw = safeReadText(authPath);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CodexAuthJson;
  } catch {
    return null;
  }
}

export function getCredentialFromAuthJson(
  auth: CodexAuthJson | null,
  envKey?: string
): string | undefined {
  if (!auth) return undefined;
  const preferredKey = envKey ? (auth[envKey] as unknown) : undefined;
  const key = (
    (typeof preferredKey === 'string' ? preferredKey : undefined) ||
    auth.OPENAI_API_KEY ||
    auth.api_key ||
    auth.apiKey ||
    (auth.key as string | undefined) ||
    (auth.token as string | undefined)
  ) as string | undefined;

  const trimmed = (key || '').trim();
  return trimmed ? trimmed : undefined;
}

export function getApiKeyFromAuthJson(auth: CodexAuthJson | null): string | undefined {
  return getCredentialFromAuthJson(auth);
}

/**
 * Extremely small TOML reader for the specific keys we care about.
 * - Reads top-level `model_provider = "..."`.
 * - Reads top-level `preferred_auth_method = "apikey"`.
 * - Reads `[model_providers.<provider>] env_key = "..."`.
 */
export function getProviderEnvInfoFromConfigToml(configDir: string): CodexProviderEnvInfo {
  const dir = expandHomePath(configDir || '');
  const configPath = join(dir, 'config.toml');
  const raw = safeReadText(configPath);
  if (!raw) return {};

  const preferredAuthMatch = raw.match(/^\s*preferred_auth_method\s*=\s*"?([A-Za-z0-9_-]+)"?\s*$/m);
  const preferredAuthMethod = preferredAuthMatch?.[1]?.trim();

  const providerMatch = raw.match(/^\s*model_provider\s*=\s*"(.*?)"\s*$/m);
  const provider = providerMatch?.[1]?.trim();
  if (!provider) return preferredAuthMethod ? { preferredAuthMethod } : {};

  // Find the provider section and scan until next section.
  const sectionRe = new RegExp(`^\\s*\\[model_providers\\.${escapeRegExp(provider)}\\]\\s*$`, 'm');
  const sectionMatch = raw.match(sectionRe);
  if (!sectionMatch || sectionMatch.index == null) return { provider, preferredAuthMethod };

  const start = sectionMatch.index + sectionMatch[0].length;
  const after = raw.slice(start);
  const nextSectionIdx = after.search(/^\s*\[/m);
  const sectionBody = nextSectionIdx >= 0 ? after.slice(0, nextSectionIdx) : after;

  const envKeyMatch = sectionBody.match(/^\s*env_key\s*=\s*"(.*?)"\s*$/m);
  const envKey = envKeyMatch?.[1]?.trim();
  return { provider, envKey, preferredAuthMethod };
}

export function configPrefersApiKey(configDir: string): boolean {
  const { preferredAuthMethod } = getProviderEnvInfoFromConfigToml(expandHomePath(configDir || ''));
  return (preferredAuthMethod || '').toLowerCase() === 'apikey';
}

export function buildProviderEnvFromConfig(
  configDir: string,
  existingEnv: Record<string, string | undefined>
): Record<string, string> {
  const dir = expandHomePath(configDir || '');
  if (!configDirLooksConfigured(dir)) return {};

  const { envKey } = getProviderEnvInfoFromConfigToml(dir);
  if (!envKey) return {};

  // Respect existing env (including project/.env) if already set.
  if ((existingEnv[envKey] || '').trim()) return {};

  const authJson = readAuthJson(dir);
  const apiKey = getCredentialFromAuthJson(authJson, envKey);
  if (!apiKey) return {};

  return { [envKey]: apiKey };
}

/**
 * Build a robust environment map from Codex config directory.
 *
 * Supports third-party activators/gateways that store credentials in
 * `~/.codex/auth.json` and configure provider-specific `env_key` in `config.toml`.
 *
 * Returns a minimal set of env vars that help non-shell-launched processes
 * (Electron, Python subprocesses) authenticate reliably.
 */
export function buildAuthEnvFromConfig(
  configDir: string,
  existingEnv: Record<string, string | undefined>
): Record<string, string> {
  const dir = expandHomePath(configDir || '');
  if (!configDirLooksConfigured(dir)) return {};

  const env: Record<string, string> = {};
  const authJson = readAuthJson(dir);

  // 1) Provider-specific env_key (e.g. YUNYI_KEY) when declared by config.toml.
  Object.assign(env, buildProviderEnvFromConfig(dir, existingEnv));

  // 2) OpenAI-compatible API key - some subprocesses/tools expect OPENAI_API_KEY explicitly.
  if (!(existingEnv.OPENAI_API_KEY || '').trim()) {
    const apiKey = getCredentialFromAuthJson(authJson);
    if (apiKey) {
      env.OPENAI_API_KEY = apiKey;
    }
  }

  // 3) OpenAI-compatible base URL for gateway/proxy setups.
  // Codex CLI reads config.toml directly, but SDK clients and other tools may rely on env vars.
  const baseUrl = (typeof authJson?.api_base_url === 'string' ? authJson.api_base_url : '').trim();
  if (baseUrl && !(existingEnv.OPENAI_BASE_URL || '').trim()) {
    env.OPENAI_BASE_URL = baseUrl;
  }
  // Back-compat for some tooling that uses OPENAI_API_BASE.
  if (baseUrl && !(existingEnv.OPENAI_API_BASE || '').trim()) {
    env.OPENAI_API_BASE = baseUrl;
  }

  return env;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
