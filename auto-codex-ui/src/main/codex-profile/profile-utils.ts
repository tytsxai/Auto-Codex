/**
 * Profile Utilities Module
 * Helper functions for profile operations
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, readdirSync, mkdirSync } from 'fs';
import type { CodexProfile } from '../../shared/types';
import {
  configDirLooksConfigured,
  getCredentialFromAuthJson,
  getProviderEnvInfoFromConfigToml,
  readAuthJson
} from './codex-config';

/**
 * Default Codex config directory
 */
export const DEFAULT_CODEX_CONFIG_DIR = join(homedir(), '.codex');

/**
 * Default profiles directory for additional accounts
 */
export const CODEX_PROFILES_DIR = join(homedir(), '.codex-profiles');

/**
 * Generate a unique ID for a new profile
 */
export function generateProfileId(name: string, existingProfiles: CodexProfile[]): string {
  const baseId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let id = baseId;
  let counter = 1;

  while (existingProfiles.some(p => p.id === id)) {
    id = `${baseId}-${counter}`;
    counter++;
  }

  return id;
}

/**
 * Create a new profile directory and initialize it
 */
export async function createProfileDirectory(profileName: string): Promise<string> {
  // Ensure profiles directory exists
  if (!existsSync(CODEX_PROFILES_DIR)) {
    mkdirSync(CODEX_PROFILES_DIR, { recursive: true });
  }

  // Create directory for this profile
  const sanitizedName = profileName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const profileDir = join(CODEX_PROFILES_DIR, sanitizedName);

  if (!existsSync(profileDir)) {
    mkdirSync(profileDir, { recursive: true });
  }

  return profileDir;
}

/**
 * Check if a profile has valid authentication
 * (checks if the config directory has credential files)
 */
export function isProfileAuthenticated(profile: CodexProfile): boolean {
  const configDir = expandHomePath(profile.configDir || '');
  if (!configDir || !existsSync(configDir)) {
    return false;
  }

  const looksLikeToken = (value: unknown): boolean => {
    if (typeof value !== 'string') return false;
    const t = value.trim();
    const normalized = t.toLowerCase().startsWith('bearer ') ? t.slice(7).trim() : t;
    return normalized.length >= 20 && !/\s/.test(normalized);
  };

  const looksLikeUrl = (value: unknown): boolean => {
    if (typeof value !== 'string') return false;
    const t = value.trim().toLowerCase();
    return t.startsWith('http://') || t.startsWith('https://') || t.startsWith('ws://') || t.startsWith('wss://');
  };

  // 1) auth.json (Codex CLI primary credential store for API key / gateway setups)
  const auth = readAuthJson(configDir);
  const providerEnvInfo = getProviderEnvInfoFromConfigToml(configDir);
  const providerEnvKey = providerEnvInfo.envKey;
  const apiKey = getCredentialFromAuthJson(auth, providerEnvKey);
  if (apiKey) return true;
  if (auth && (looksLikeToken(auth.access_token) || looksLikeToken(auth.refresh_token))) {
    return true;
  }
  if (auth) {
    // Some gateways store the API key under a provider-specific key name (e.g. YUNYI_KEY).
    // Treat any {<*key|token*>: <plausible_credential>} as authenticated.
    for (const [key, value] of Object.entries(auth)) {
      if (!/key|token/i.test(key)) continue;
      if (looksLikeUrl(value)) continue;
      if (looksLikeToken(value)) return true;
    }
  }

  // 1.5) config.toml can declare that this profile authenticates via API key.
  // We can't reliably detect env-injected keys for GUI apps, so treat a non-trivial
  // config.toml as "authenticated" to avoid blocking usage.
  if ((providerEnvInfo.preferredAuthMethod || '').toLowerCase() === 'apikey') {
    return true;
  }

  // 2) legacy files (heuristic scan for a plausible token)
  const possibleAuthFiles = [
    join(configDir, 'credentials'),
    join(configDir, 'credentials.json'),
    join(configDir, '.credentials'),
    join(configDir, 'settings.json'),
  ];

  for (const authFile of possibleAuthFiles) {
    if (existsSync(authFile)) {
      try {
        const content = readFileSync(authFile, 'utf-8');
        if (looksLikeToken(content)) return true;
        // If JSON, scan common keys.
        try {
          const parsed = JSON.parse(content) as Record<string, unknown>;
          for (const key of ['token', 'access_token', 'refresh_token', 'OPENAI_API_KEY', 'api_key', 'apiKey']) {
            if (looksLikeToken(parsed[key])) return true;
          }
        } catch {
          // not JSON
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  // 3) Also check if there are any session files (indicates authenticated usage)
  // This avoids false-positives from mere presence of config.toml without creds.
  if (configDirLooksConfigured(configDir)) {
    const projectsDir = join(configDir, 'projects');
    if (existsSync(projectsDir)) {
      try {
        const projects = readdirSync(projectsDir);
        if (projects.length > 0) {
          return true;
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  return false;
}

/**
 * Check if a profile has a valid OAuth token.
 * Token is valid for 1 year from creation.
 */
export function hasValidToken(profile: CodexProfile): boolean {
  if (!profile?.oauthToken) {
    return false;
  }

  // Check if token is expired (1 year validity)
  if (profile.tokenCreatedAt) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (new Date(profile.tokenCreatedAt) < oneYearAgo) {
      console.warn('[ProfileUtils] Token expired for profile:', profile.name);
      return false;
    }
  }

  return true;
}

/**
 * Expand ~ in path to home directory
 */
export function expandHomePath(path: string): string {
  if (path && path.startsWith('~')) {
    const home = homedir();
    return path.replace(/^~/, home);
  }
  return path;
}
