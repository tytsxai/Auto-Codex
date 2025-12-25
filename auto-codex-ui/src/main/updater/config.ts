/**
 * Configuration for Auto Codex updater
 */

/**
 * GitHub repository configuration
 */
export const GITHUB_CONFIG = {
  owner: 'tytsxai',
  repo: 'Auto-Codex',
  autoBuildPath: 'auto-codex' // Path within repo where the Python backend lives
} as const;

/**
 * Files and directories to preserve during updates
 */
export const PRESERVE_FILES = ['.env', 'specs'] as const;

/**
 * Files and directories to skip when copying
 */
export const SKIP_FILES = ['__pycache__', '.DS_Store', '.git', 'specs', '.env'] as const;

export const CHECKSUM_ASSET_NAMES = ['SHA256SUMS', 'SHA256SUMS.txt', 'checksums.txt'] as const;

/**
 * Update-related timeouts (in milliseconds)
 */
export const TIMEOUTS = {
  requestTimeout: 10000,
  downloadTimeout: 60000
} as const;
