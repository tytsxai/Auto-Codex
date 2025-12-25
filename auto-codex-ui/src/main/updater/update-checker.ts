/**
 * Update checking functionality
 */

import { GITHUB_CONFIG } from './config';
import { fetchJson } from './http-client';
import { getBundledVersion, getEffectiveVersion, parseVersionFromTag, compareVersions } from './version-manager';
import { GitHubRelease, AutoBuildUpdateCheck } from './types';
import { debugLog } from '../../shared/utils/debug-logger';

// Cache for the latest release info (used by download)
let cachedLatestRelease: GitHubRelease | null = null;

/**
 * Get cached release (if available)
 */
export function getCachedRelease(): GitHubRelease | null {
  return cachedLatestRelease;
}

/**
 * Set cached release
 */
export function setCachedRelease(release: GitHubRelease | null): void {
  cachedLatestRelease = release;
}

/**
 * Clear cached release
 */
export function clearCachedRelease(): void {
  cachedLatestRelease = null;
}

/**
 * Check GitHub Releases for the latest version
 */
export async function checkForUpdates(): Promise<AutoBuildUpdateCheck> {
  // Use effective version which accounts for source updates
  const currentVersion = getEffectiveVersion();
  const bundledVersion = getBundledVersion();
  debugLog('[UpdateCheck] Current effective version:', currentVersion);
  debugLog('[UpdateCheck] Bundled app version:', bundledVersion);

  // If source override is ahead of the app, warn and block further source updates.
  if (compareVersions(currentVersion, bundledVersion) > 0) {
    return {
      updateAvailable: false,
      currentVersion,
      latestVersion: currentVersion,
      error: `检测到源代码版本 ${currentVersion} 高于应用版本 ${bundledVersion}，请先更新应用以避免不兼容。`
    };
  }

  try {
    // Fetch latest release from GitHub Releases API
    const releaseUrl = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/releases/latest`;
    const release = await fetchJson<GitHubRelease>(releaseUrl);

    // Cache for download function
    setCachedRelease(release);

    // Parse version from tag (e.g., "v1.2.0" -> "1.2.0")
    const latestVersion = parseVersionFromTag(release.tag_name);
    debugLog('[UpdateCheck] Latest version:', latestVersion);

    // Prevent source updates that are newer than the packaged app.
    // This avoids API/contract drift between the UI and backend source.
    if (compareVersions(latestVersion, bundledVersion) > 0) {
      return {
        updateAvailable: false,
        currentVersion,
        latestVersion,
        error: `需要先更新应用到 ${latestVersion} 或更高版本，才能更新源代码。`
      };
    }

    // Compare versions
    const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;
    debugLog('[UpdateCheck] Update available:', updateAvailable);

    return {
      updateAvailable,
      currentVersion,
      latestVersion,
      releaseNotes: release.body || undefined,
      releaseUrl: release.html_url || undefined
    };
  } catch (error) {
    // Clear cache on error
    clearCachedRelease();
    const message = error instanceof Error ? error.message : String(error);
    debugLog('[UpdateCheck] Error:', message);

    // GitHub returns 404 for `/releases/latest` when no releases exist.
    // Treat that as a normal "no update available" state instead of surfacing a scary error in the UI.
    // Note: a real repo/config error can also 404; in that case this will be quiet, but logs still capture it.
    if (message.startsWith('HTTP 404:')) {
      return {
        updateAvailable: false,
        currentVersion,
        latestVersion: currentVersion
      };
    }

    return {
      updateAvailable: false,
      currentVersion,
      error: message || 'Failed to check for updates'
    };
  }
}
