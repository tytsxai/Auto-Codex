/**
 * Codex Profile Manager
 * Main coordinator for multi-account profile management
 *
 * This class delegates to specialized modules:
 * - token-encryption: OAuth token encryption/decryption
 * - usage-parser: Usage data parsing and reset time calculations
 * - rate-limit-manager: Rate limit event tracking
 * - profile-storage: Disk persistence
 * - profile-scorer: Profile availability scoring and auto-switch logic
 * - profile-utils: Helper utilities
 */

import { app } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type {
  CodexProfile,
  CodexProfileSettings,
  CodexUsageData,
  CodexRateLimitEvent,
  CodexAutoSwitchSettings
} from '../shared/types';

// Module imports
import { encryptToken, decryptToken } from './codex-profile/token-encryption';
import { parseUsageOutput } from './codex-profile/usage-parser';
import {
  recordRateLimitEvent as recordRateLimitEventImpl,
  isProfileRateLimited as isProfileRateLimitedImpl,
  clearRateLimitEvents as clearRateLimitEventsImpl
} from './codex-profile/rate-limit-manager';
import {
  loadProfileStore,
  saveProfileStore,
  ProfileStoreData,
  DEFAULT_AUTO_SWITCH_SETTINGS
} from './codex-profile/profile-storage';
import {
  getBestAvailableProfile,
  shouldProactivelySwitch as shouldProactivelySwitchImpl,
  getProfilesSortedByAvailability as getProfilesSortedByAvailabilityImpl
} from './codex-profile/profile-scorer';
import {
  DEFAULT_CODEX_CONFIG_DIR,
  generateProfileId as generateProfileIdImpl,
  createProfileDirectory as createProfileDirectoryImpl,
  isProfileAuthenticated as isProfileAuthenticatedImpl,
  hasValidToken,
  expandHomePath
} from './codex-profile/profile-utils';

/**
 * Manages Codex profiles for multi-account support.
 * Profiles are stored in the app's userData directory.
 * Each profile points to a separate Codex config directory.
 */
export class CodexProfileManager {
  private storePath: string;
  private data: ProfileStoreData;

  constructor() {
    const configDir = join(app.getPath('userData'), 'config');
    this.storePath = join(configDir, 'codex-profiles.json');

    // Ensure directory exists
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // Load existing data or initialize with default profile
    this.data = this.load();
  }

  /**
   * Load profiles from disk
   */
  private load(): ProfileStoreData {
    const loadedData = loadProfileStore(this.storePath);
    if (loadedData) {
      // Normalize legacy data (e.g., "~" paths) and strip derived fields.
      let changed = false;
      for (const profile of loadedData.profiles) {
        if (profile.configDir) {
          const expanded = expandHomePath(profile.configDir);
          if (expanded !== profile.configDir) {
            profile.configDir = expanded;
            changed = true;
          }
        }
        // Derived at runtime; avoid persisting it if it ever got written.
        if (typeof (profile as { isAuthenticated?: unknown }).isAuthenticated !== 'undefined') {
          delete (profile as { isAuthenticated?: unknown }).isAuthenticated;
          changed = true;
        }
      }

      if (changed) {
        try {
          saveProfileStore(this.storePath, loadedData);
        } catch {
          // Best-effort migration; ignore write errors.
        }
      }
      return loadedData;
    }

    // Return default with a single "Default" profile
    return this.createDefaultData();
  }

  /**
   * Create default profile data
   */
  private createDefaultData(): ProfileStoreData {
    const defaultProfile: CodexProfile = {
      id: 'default',
      name: 'Default',
      configDir: DEFAULT_CODEX_CONFIG_DIR,
      isDefault: true,
      description: 'Default Codex configuration (~/.codex)',
      createdAt: new Date()
    };

    return {
      version: 3,
      profiles: [defaultProfile],
      activeProfileId: 'default',
      autoSwitch: DEFAULT_AUTO_SWITCH_SETTINGS
    };
  }

  /**
   * Save profiles to disk
   */
  private save(): void {
    saveProfileStore(this.storePath, this.data);
  }

  /**
   * Get all profiles and settings
   */
  getSettings(): CodexProfileSettings {
    return {
      // Compute derived auth status at runtime (do not persist).
      profiles: this.data.profiles.map((profile) => ({
        ...profile,
        configDir: profile.configDir ? expandHomePath(profile.configDir) : profile.configDir,
        isAuthenticated: this.hasValidAuth(profile.id),
      })),
      activeProfileId: this.data.activeProfileId,
      autoSwitch: this.data.autoSwitch || DEFAULT_AUTO_SWITCH_SETTINGS
    };
  }

  /**
   * Get auto-switch settings
   */
  getAutoSwitchSettings(): CodexAutoSwitchSettings {
    return this.data.autoSwitch || DEFAULT_AUTO_SWITCH_SETTINGS;
  }

  /**
   * Update auto-switch settings
   */
  updateAutoSwitchSettings(settings: Partial<CodexAutoSwitchSettings>): void {
    this.data.autoSwitch = {
      ...(this.data.autoSwitch || DEFAULT_AUTO_SWITCH_SETTINGS),
      ...settings
    };
    this.save();
  }

  /**
   * Get a specific profile by ID
   */
  getProfile(profileId: string): CodexProfile | undefined {
    return this.data.profiles.find(p => p.id === profileId);
  }

  /**
   * Get the active profile
   */
  getActiveProfile(): CodexProfile {
    const active = this.data.profiles.find(p => p.id === this.data.activeProfileId);
    if (!active) {
      // Fallback to default
      const defaultProfile = this.data.profiles.find(p => p.isDefault);
      if (defaultProfile) {
        return defaultProfile;
      }
      // If somehow no default exists, return first profile
      return this.data.profiles[0];
    }
    return active;
  }

  /**
   * Save or update a profile
   */
  saveProfile(profile: CodexProfile): CodexProfile {
    // Expand ~ in configDir path
    if (profile.configDir) {
      profile.configDir = expandHomePath(profile.configDir);
    }

    const index = this.data.profiles.findIndex(p => p.id === profile.id);

    if (index >= 0) {
      // Update existing
      this.data.profiles[index] = profile;
    } else {
      // Add new
      this.data.profiles.push(profile);
    }

    this.save();
    return profile;
  }

  /**
   * Delete a profile (cannot delete default or last profile)
   */
  deleteProfile(profileId: string): boolean {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return false;
    }

    // Cannot delete default profile
    if (profile.isDefault) {
      console.warn('[CodexProfileManager] Cannot delete default profile');
      return false;
    }

    // Cannot delete if it's the only profile
    if (this.data.profiles.length <= 1) {
      console.warn('[CodexProfileManager] Cannot delete last profile');
      return false;
    }

    // Remove the profile
    this.data.profiles = this.data.profiles.filter(p => p.id !== profileId);

    // If we deleted the active profile, switch to default
    if (this.data.activeProfileId === profileId) {
      const defaultProfile = this.data.profiles.find(p => p.isDefault);
      this.data.activeProfileId = defaultProfile?.id || this.data.profiles[0].id;
    }

    this.save();
    return true;
  }

  /**
   * Rename a profile
   */
  renameProfile(profileId: string, newName: string): boolean {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return false;
    }

    // Cannot rename to empty name
    if (!newName.trim()) {
      console.warn('[CodexProfileManager] Cannot rename to empty name');
      return false;
    }

    profile.name = newName.trim();
    this.save();
    console.warn('[CodexProfileManager] Renamed profile:', profileId, 'to:', newName);
    return true;
  }

  /**
   * Set the active profile
   */
  setActiveProfile(profileId: string): boolean {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return false;
    }

    this.data.activeProfileId = profileId;
    profile.lastUsedAt = new Date();
    this.save();
    return true;
  }

  /**
   * Update last used timestamp for a profile
   */
  markProfileUsed(profileId: string): void {
    const profile = this.getProfile(profileId);
    if (profile) {
      profile.lastUsedAt = new Date();
      this.save();
    }
  }

  /**
   * Get the OAuth token for the active profile (decrypted).
   * Returns undefined if no token is set (profile needs authentication).
   */
  getActiveProfileToken(): string | undefined {
    const profile = this.getActiveProfile();
    if (!profile?.oauthToken) {
      return undefined;
    }
    // Decrypt the token before returning
    return decryptToken(profile.oauthToken);
  }

  /**
   * Get the decrypted OAuth token for a specific profile.
   */
  getProfileToken(profileId: string): string | undefined {
    const profile = this.getProfile(profileId);
    if (!profile?.oauthToken) {
      return undefined;
    }
    return decryptToken(profile.oauthToken);
  }

  /**
   * Set the OAuth token for a profile (encrypted storage).
   * Used when capturing token from Codex auth output.
   */
  setProfileToken(profileId: string, token: string, email?: string): boolean {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return false;
    }

    // Encrypt the token before storing
    profile.oauthToken = encryptToken(token);
    profile.tokenCreatedAt = new Date();
    if (email) {
      profile.email = email;
    }

    // Clear any rate limit events since this might be a new account
    profile.rateLimitEvents = [];

    this.save();

    const isEncrypted = profile.oauthToken.startsWith('enc:');
    console.warn('[CodexProfileManager] Set OAuth token for profile:', profile.name, {
      email: email || '(not captured)',
      encrypted: isEncrypted,
      tokenLength: token.length
    });
    return true;
  }

  /**
   * Check if a profile has a valid OAuth token.
   * Token is valid for 1 year from creation.
   */
  hasValidToken(profileId: string): boolean {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return false;
    }
    return hasValidToken(profile);
  }

  /**
   * Get environment variables for spawning processes with the active profile.
   * Returns { CODEX_CODE_OAUTH_TOKEN: token } if token is available (decrypted).
   */
  getActiveProfileEnv(): Record<string, string> {
    const profile = this.getActiveProfile();
    const env: Record<string, string> = {};

    if (profile?.oauthToken) {
      // Decrypt the token before putting in environment
      const decryptedToken = decryptToken(profile.oauthToken);
      if (decryptedToken) {
        env.CODEX_CODE_OAUTH_TOKEN = decryptedToken;
        console.warn('[CodexProfileManager] Using OAuth token for profile:', profile.name);
      } else {
        console.warn('[CodexProfileManager] Failed to decrypt token for profile:', profile.name);
      }
    } else if (profile?.configDir && !profile.isDefault) {
      // Fallback to configDir for backward compatibility
      env.CODEX_CONFIG_DIR = profile.configDir;
      console.warn('[CodexProfileManager] Using configDir for profile:', profile.name);
    }

    return env;
  }

  /**
   * Update usage data for a profile (parsed from /usage output)
   */
  updateProfileUsage(profileId: string, usageOutput: string): CodexUsageData | null {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return null;
    }

    const usage = parseUsageOutput(usageOutput);
    profile.usage = usage;
    this.save();

    console.warn('[CodexProfileManager] Updated usage for', profile.name, ':', usage);
    return usage;
  }

  /**
   * Record a rate limit event for a profile
   */
  recordRateLimitEvent(profileId: string, resetTimeStr: string): CodexRateLimitEvent {
    const profile = this.getProfile(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const event = recordRateLimitEventImpl(profile, resetTimeStr);
    this.save();

    console.warn('[CodexProfileManager] Recorded rate limit event for', profile.name, ':', event);
    return event;
  }

  /**
   * Check if a profile is currently rate-limited
   */
  isProfileRateLimited(profileId: string): { limited: boolean; type?: 'session' | 'weekly'; resetAt?: Date } {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return { limited: false };
    }
    return isProfileRateLimitedImpl(profile);
  }

  /**
   * Get the best profile to switch to based on usage and rate limit status
   * Returns null if no good alternative is available
   */
  getBestAvailableProfile(excludeProfileId?: string): CodexProfile | null {
    const settings = this.getAutoSwitchSettings();
    return getBestAvailableProfile(this.data.profiles, settings, excludeProfileId);
  }

  /**
   * Determine if we should proactively switch profiles based on current usage
   */
  shouldProactivelySwitch(profileId: string): { shouldSwitch: boolean; reason?: string; suggestedProfile?: CodexProfile } {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return { shouldSwitch: false };
    }

    const settings = this.getAutoSwitchSettings();
    return shouldProactivelySwitchImpl(profile, this.data.profiles, settings);
  }

  /**
   * Generate a unique ID for a new profile
   */
  generateProfileId(name: string): string {
    return generateProfileIdImpl(name, this.data.profiles);
  }

  /**
   * Create a new profile directory and initialize it
   */
  async createProfileDirectory(profileName: string): Promise<string> {
    return createProfileDirectoryImpl(profileName);
  }

  /**
   * Check if a profile has valid authentication
   * (checks if the config directory has credential files)
   */
  isProfileAuthenticated(profile: CodexProfile): boolean {
    return isProfileAuthenticatedImpl(profile);
  }

  /**
   * Check if a profile has valid authentication for starting tasks.
   * A profile is considered authenticated if:
   * 1) It has a valid OAuth token (not expired), OR
   * 2) It has an authenticated configDir (credential files exist)
   *
   * @param profileId - Optional profile ID to check. If not provided, checks active profile.
   * @returns true if the profile can authenticate, false otherwise
   */
  hasValidAuth(profileId?: string): boolean {
    const profile = profileId ? this.getProfile(profileId) : this.getActiveProfile();
    if (!profile) {
      return false;
    }

    // Check 1: Profile has a valid OAuth token
    if (hasValidToken(profile)) {
      return true;
    }

    // Check 2 & 3: Profile has authenticated configDir (works for both default and non-default)
    if (this.isProfileAuthenticated(profile)) {
      return true;
    }

    return false;
  }

  /**
   * Get environment variables for invoking Codex with a specific profile
   */
  getProfileEnv(profileId: string): Record<string, string> {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return {};
    }

    // Only set CODEX_CONFIG_DIR if not using default
    if (profile.isDefault) {
      return {};
    }

    // Only set CODEX_CONFIG_DIR if configDir is defined
    if (!profile.configDir) {
      return {};
    }

    return {
      CODEX_CONFIG_DIR: expandHomePath(profile.configDir)
    };
  }

  /**
   * Clear rate limit events for a profile (e.g., when they've reset)
   */
  clearRateLimitEvents(profileId: string): void {
    const profile = this.getProfile(profileId);
    if (profile) {
      clearRateLimitEventsImpl(profile);
      this.save();
    }
  }

  /**
   * Get profiles sorted by availability (best first)
   */
  getProfilesSortedByAvailability(): CodexProfile[] {
    return getProfilesSortedByAvailabilityImpl(this.data.profiles);
  }
}

// Singleton instance
let profileManager: CodexProfileManager | null = null;

/**
 * Get the singleton Codex profile manager instance
 */
export function getCodexProfileManager(): CodexProfileManager {
  if (!profileManager) {
    profileManager = new CodexProfileManager();
  }
  return profileManager;
}
