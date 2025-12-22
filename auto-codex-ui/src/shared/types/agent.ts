/**
 * Agent-related types (Codex profiles and authentication)
 */

// ============================================
// Codex Profile Types (Multi-Account Support)
// ============================================

/**
 * Usage data parsed from Codex Code's /usage command
 */
export interface CodexUsageData {
  /** Session usage percentage (0-100) */
  sessionUsagePercent: number;
  /** When the session limit resets (ISO string or description like "11:59pm") */
  sessionResetTime: string;
  /** Weekly usage percentage across all models (0-100) */
  weeklyUsagePercent: number;
  /** When the weekly limit resets (ISO string or description) */
  weeklyResetTime: string;
  /** Weekly model-specific usage percentage (0-100), if applicable */
  opusUsagePercent?: number;
  /** When this usage data was last updated */
  lastUpdated: Date;
}

/**
 * Real-time usage snapshot for proactive monitoring
 * Returned from API or CLI usage check
 */
export interface CodexUsageSnapshot {
  /** Session usage percentage (0-100) */
  sessionPercent: number;
  /** Weekly usage percentage (0-100) */
  weeklyPercent: number;
  /** When the session limit resets (human-readable or ISO) */
  sessionResetTime?: string;
  /** When the weekly limit resets (human-readable or ISO) */
  weeklyResetTime?: string;
  /** Profile ID this snapshot belongs to */
  profileId: string;
  /** Profile name for display */
  profileName: string;
  /** When this snapshot was captured */
  fetchedAt: Date;
  /** Which limit is closest to threshold ('session' or 'weekly') */
  limitType?: 'session' | 'weekly';
}

/**
 * Rate limit event recorded for a profile
 */
export interface CodexRateLimitEvent {
  /** Type of limit hit: 'session' or 'weekly' */
  type: 'session' | 'weekly';
  /** When the limit was hit */
  hitAt: Date;
  /** When it's expected to reset */
  resetAt: Date;
  /** The reset time string from Codex (e.g., "Dec 17 at 6am") */
  resetTimeString: string;
}

/**
 * A Codex Code subscription profile for multi-account support.
 * Profiles store OAuth tokens for instant switching without browser re-auth.
 */
export interface CodexProfile {
  id: string;
  name: string;
  /**
   * OAuth token (sk-ant-oat01-...) for this profile.
   * When set, CODEX_CODE_OAUTH_TOKEN env var is used instead of config dir.
   * Token is valid for 1 year from creation.
   */
  oauthToken?: string;
  /** Email address associated with this profile (for display) */
  email?: string;
  /** When the OAuth token was created (for expiry tracking - 1 year validity) */
  tokenCreatedAt?: Date;
  /**
   * Path to the Codex config directory (e.g., ~/.codex or ~/.codex-profiles/work)
   * @deprecated Use oauthToken instead for reliable multi-profile switching
   */
  configDir?: string;
  /** Whether this is the default profile (uses ~/.codex) */
  isDefault: boolean;
  /** Optional description/notes for this profile */
  description?: string;
  /** When the profile was created */
  createdAt: Date;
  /** Last time this profile was used */
  lastUsedAt?: Date;
  /** Current usage data from /usage command */
  usage?: CodexUsageData;
  /** Recent rate limit events for this profile */
  rateLimitEvents?: CodexRateLimitEvent[];
}

/**
 * Settings for Codex profile management
 */
export interface CodexProfileSettings {
  /** All configured Codex profiles */
  profiles: CodexProfile[];
  /** ID of the currently active profile */
  activeProfileId: string;
  /** Auto-switch settings */
  autoSwitch?: CodexAutoSwitchSettings;
}

/**
 * Settings for automatic profile switching
 */
export interface CodexAutoSwitchSettings {
  /** Master toggle - enables all auto-switch features */
  enabled: boolean;

  // Proactive monitoring settings
  /** Enable proactive monitoring and swapping before hitting limits */
  proactiveSwapEnabled: boolean;
  /** Interval (ms) to check usage (default: 30000 = 30s, 0 = disabled) */
  usageCheckInterval: number;

  // Threshold settings
  /** Session usage threshold (0-100) to trigger proactive switch (default: 95) */
  sessionThreshold: number;
  /** Weekly usage threshold (0-100) to trigger proactive switch (default: 99) */
  weeklyThreshold: number;

  // Reactive recovery
  /** Whether to automatically switch on unexpected rate limit (vs. prompting user) */
  autoSwitchOnRateLimit: boolean;
}

export interface CodexAuthResult {
  success: boolean;
  authenticated: boolean;
  error?: string;
}
