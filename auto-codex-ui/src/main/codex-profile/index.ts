/**
 * Codex Profile Module
 * Central export point for all profile management functionality
 */

// Core types
export type {
  CodexProfile,
  CodexProfileSettings,
  CodexUsageData,
  CodexRateLimitEvent,
  CodexAutoSwitchSettings
} from './types';

// Token encryption utilities
export { encryptToken, decryptToken, isTokenEncrypted } from './token-encryption';

// Usage parsing utilities
export { parseUsageOutput, parseResetTime, classifyRateLimitType } from './usage-parser';

// Rate limit management
export {
  recordRateLimitEvent,
  isProfileRateLimited,
  clearRateLimitEvents
} from './rate-limit-manager';

// Storage utilities
export {
  loadProfileStore,
  saveProfileStore,
  DEFAULT_AUTO_SWITCH_SETTINGS,
  STORE_VERSION
} from './profile-storage';
export type { ProfileStoreData } from './profile-storage';

// Profile scoring and auto-switch
export {
  getBestAvailableProfile,
  shouldProactivelySwitch,
  getProfilesSortedByAvailability
} from './profile-scorer';

// Profile utilities
export {
  DEFAULT_CODEX_CONFIG_DIR,
  CODEX_PROFILES_DIR,
  generateProfileId,
  createProfileDirectory,
  isProfileAuthenticated,
  hasValidToken,
  expandHomePath
} from './profile-utils';

// Codex config helpers
export type { CodexProviderEnvInfo, CodexAuthJson } from './codex-config';
export {
  configDirLooksConfigured,
  readAuthJson,
  getApiKeyFromAuthJson,
  getProviderEnvInfoFromConfigToml,
  configPrefersApiKey,
  buildProviderEnvFromConfig,
  buildAuthEnvFromConfig
} from './codex-config';

// Usage monitoring (proactive account switching)
export { UsageMonitor, getUsageMonitor } from './usage-monitor';
