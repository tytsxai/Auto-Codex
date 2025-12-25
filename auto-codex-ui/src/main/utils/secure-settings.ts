import { safeStorage } from 'electron';
import { readFileSync, existsSync } from 'fs';
import { DEFAULT_APP_SETTINGS } from '../../shared/constants';
import type { AppSettings } from '../../shared/types';
import { decryptToken, encryptToken, isTokenEncrypted, isInsecureTokenStorageAllowed } from '../codex-profile/token-encryption';

export const SENSITIVE_SETTINGS_FIELDS = [
  'globalCodexOAuthToken',
  'globalOpenAIApiKey',
  'globalAnthropicApiKey',
  'globalGoogleApiKey',
  'globalGroqApiKey'
] as const satisfies ReadonlyArray<keyof AppSettings>;

type SensitiveSettingsField = typeof SENSITIVE_SETTINGS_FIELDS[number];

export interface SecureSettingsLoadResult {
  settings: AppSettings;
  rawSettings: AppSettings;
  hadPlaintextSecrets: boolean;
  hadEncryptedSecrets: boolean;
  requiresReauth: boolean;
}

export function loadSettingsWithDecryptedSecrets(settingsPath: string): SecureSettingsLoadResult {
  let settings: AppSettings = { ...DEFAULT_APP_SETTINGS };
  let rawSettings: AppSettings = { ...DEFAULT_APP_SETTINGS };
  let hadPlaintextSecrets = false;
  let hadEncryptedSecrets = false;
  let requiresReauth = false;

  if (existsSync(settingsPath)) {
    try {
      const content = readFileSync(settingsPath, 'utf-8');
      settings = { ...settings, ...JSON.parse(content) };
      rawSettings = { ...settings };
    } catch {
      settings = { ...DEFAULT_APP_SETTINGS };
      rawSettings = { ...DEFAULT_APP_SETTINGS };
    }
  }

  const encryptionAvailable = safeStorage.isEncryptionAvailable();
  const allowInsecure = isInsecureTokenStorageAllowed();

  for (const field of SENSITIVE_SETTINGS_FIELDS) {
    const value = settings[field];
    if (!value) continue;

    if (isTokenEncrypted(value)) {
      hadEncryptedSecrets = true;
      if (encryptionAvailable) {
        const decrypted = decryptToken(value);
        if (decrypted) {
          settings[field] = decrypted as AppSettings[SensitiveSettingsField];
        } else {
          settings[field] = undefined;
          requiresReauth = true;
        }
      } else {
        settings[field] = undefined;
        requiresReauth = true;
      }
      continue;
    }

    hadPlaintextSecrets = true;
    if (encryptionAvailable || !allowInsecure) {
      settings[field] = undefined;
      requiresReauth = true;
    }
  }

  return {
    settings,
    rawSettings,
    hadPlaintextSecrets,
    hadEncryptedSecrets,
    requiresReauth
  };
}

export interface SecureSettingsSaveResult {
  settings: AppSettings;
  wrotePlaintext: boolean;
  blockedSecrets: boolean;
}

export function prepareSettingsForSave(settings: AppSettings): SecureSettingsSaveResult {
  const nextSettings: AppSettings = { ...settings };
  let wrotePlaintext = false;
  let blockedSecrets = false;

  for (const field of SENSITIVE_SETTINGS_FIELDS) {
    const value = nextSettings[field];
    if (!value) continue;

    if (isTokenEncrypted(value)) {
      continue;
    }

    const encrypted = encryptToken(value);
    if (!encrypted) {
      nextSettings[field] = undefined;
      blockedSecrets = true;
      continue;
    }

    nextSettings[field] = encrypted as AppSettings[SensitiveSettingsField];
    if (!isTokenEncrypted(encrypted)) {
      wrotePlaintext = true;
    }
  }

  return { settings: nextSettings, wrotePlaintext, blockedSecrets };
}
