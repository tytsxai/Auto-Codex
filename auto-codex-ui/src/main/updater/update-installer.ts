/**
 * Update installation and application
 */

import { createReadStream, existsSync, mkdirSync, rmSync, readdirSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import { app } from 'electron';
import { GITHUB_CONFIG, PRESERVE_FILES, CHECKSUM_ASSET_NAMES } from './config';
import { downloadFile, fetchJson, fetchText } from './http-client';
import { compareVersions, getBundledVersion, parseVersionFromTag } from './version-manager';
import { getUpdateCachePath, getUpdateTargetPath } from './path-resolver';
import { extractTarball, copyDirectoryRecursive, preserveFiles, restoreFiles, cleanTargetDirectory } from './file-operations';
import { getCachedRelease, setCachedRelease, clearCachedRelease } from './update-checker';
import { GitHubRelease, GitHubReleaseAsset, AutoBuildUpdateResult, UpdateProgressCallback, UpdateMetadata } from './types';
import { debugLog } from '../../shared/utils/debug-logger';
import { atomicWriteFileSync } from '../utils/atomic-write';

const allowUnsignedUpdates = (): boolean => process.env.AUTO_CODEX_ALLOW_UNSIGNED_UPDATES === 'true';

const normalizeHash = (value: string): string => value.trim().toLowerCase();

function findChecksumAsset(release: GitHubRelease): GitHubReleaseAsset | null {
  const assets = release.assets || [];
  for (const name of CHECKSUM_ASSET_NAMES) {
    const match = assets.find((asset) => asset.name === name);
    if (match) {
      return match;
    }
  }
  return null;
}

function parseChecksumFile(content: string): Array<{ hash: string; label?: string }> {
  const entries: Array<{ hash: string; label?: string }> = [];
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    let match = trimmed.match(/^([a-fA-F0-9]{64})\s+\*?(.+)?$/);
    if (match) {
      const label = match[2] ? match[2].trim() : undefined;
      entries.push({ hash: normalizeHash(match[1]), label });
      continue;
    }

    match = trimmed.match(/^SHA256\s*\((.+)\)\s*=\s*([a-fA-F0-9]{64})$/i);
    if (match) {
      entries.push({ hash: normalizeHash(match[2]), label: match[1].trim() });
    }
  }

  return entries;
}

async function calculateSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function verifyChecksum(tarballPath: string, release: GitHubRelease): Promise<void> {
  const asset = findChecksumAsset(release);
  if (!asset) {
    if (allowUnsignedUpdates()) {
      debugLog('[Update] Checksum asset not found; proceeding due to AUTO_CODEX_ALLOW_UNSIGNED_UPDATES=true');
      return;
    }
    throw new Error('Checksum file missing in release assets. Upload SHA256SUMS or set AUTO_CODEX_ALLOW_UNSIGNED_UPDATES=true to bypass.');
  }

  const checksumText = await fetchText(asset.browser_download_url);
  const entries = parseChecksumFile(checksumText);
  if (entries.length === 0) {
    throw new Error(`Checksum file ${asset.name} is empty or invalid.`);
  }

  const actual = await calculateSha256(tarballPath);
  const matched = entries.some((entry) => entry.hash === actual);
  if (!matched) {
    throw new Error(`Checksum verification failed for ${asset.name}.`);
  }
}

/**
 * Download and apply the latest auto-codex update from GitHub Releases
 *
 * Note: In production, this updates the bundled source in userData.
 * For packaged apps, we can't modify resourcesPath directly,
 * so we use a "source override" system.
 */
export async function downloadAndApplyUpdate(
  onProgress?: UpdateProgressCallback
): Promise<AutoBuildUpdateResult> {
  const cachePath = getUpdateCachePath();
  const backupPath = path.join(cachePath, 'backup');
  let backupCreated = false;
  let tarballPath: string | null = null;
  let extractPath: string | null = null;

  debugLog('[Update] Starting update process...');
  debugLog('[Update] Cache path:', cachePath);

  try {
    onProgress?.({
      stage: 'checking',
      message: 'Fetching release info...'
    });

    // Ensure cache directory exists
    if (!existsSync(cachePath)) {
      mkdirSync(cachePath, { recursive: true });
      debugLog('[Update] Created cache directory');
    }

    // Get release info (use cache or fetch fresh)
    let release = getCachedRelease();
    if (!release) {
      const releaseUrl = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/releases/latest`;
      debugLog('[Update] Fetching release info from:', releaseUrl);
      release = await fetchJson<GitHubRelease>(releaseUrl);
      setCachedRelease(release);
    } else {
      debugLog('[Update] Using cached release info');
    }

    // Use explicit tag reference URL to avoid HTTP 300 when branch/tag names collide
    // See: https://github.com/tytsxai/Auto-Codex/issues/78
    const tarballUrl = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/tarball/refs/tags/${release.tag_name}`;
    const releaseVersion = parseVersionFromTag(release.tag_name);
    const bundledVersion = getBundledVersion();
    debugLog('[Update] Release version:', releaseVersion);
    debugLog('[Update] Bundled app version:', bundledVersion);
    debugLog('[Update] Tarball URL:', tarballUrl);

    if (compareVersions(releaseVersion, bundledVersion) > 0) {
      throw new Error(`请先更新应用到 ${releaseVersion} 或更高版本，再更新源代码。`);
    }

    tarballPath = path.join(cachePath, 'auto-codex-update.tar.gz');
    extractPath = path.join(cachePath, 'extracted');

    // Clean up previous extraction
    if (existsSync(extractPath)) {
      rmSync(extractPath, { recursive: true, force: true });
    }
    mkdirSync(extractPath, { recursive: true });

    onProgress?.({
      stage: 'downloading',
      percent: 0,
      message: 'Downloading update...'
    });

    debugLog('[Update] Starting download to:', tarballPath);

    // Download the tarball
    await downloadFile(tarballUrl, tarballPath, (percent) => {
      onProgress?.({
        stage: 'downloading',
        percent,
        message: `Downloading... ${percent}%`
      });
    });

    debugLog('[Update] Download complete');

    onProgress?.({
      stage: 'checking',
      message: 'Verifying update integrity...'
    });

    debugLog('[Update] Verifying update checksum');
    await verifyChecksum(tarballPath, release);
    debugLog('[Update] Checksum verification passed');

    onProgress?.({
      stage: 'extracting',
      message: 'Extracting update...'
    });

    debugLog('[Update] Extracting to:', extractPath);

    // Extract the tarball
    await extractTarball(tarballPath, extractPath);

    debugLog('[Update] Extraction complete');

    // Find the auto-codex folder in extracted content
    // GitHub tarballs have a root folder like "owner-repo-hash/"
    const extractedDirs = readdirSync(extractPath);
    if (extractedDirs.length === 0) {
      throw new Error('Empty tarball');
    }

    const rootDir = path.join(extractPath, extractedDirs[0]);
    const autoBuildSource = path.join(rootDir, GITHUB_CONFIG.autoBuildPath);

    if (!existsSync(autoBuildSource)) {
      throw new Error(`${GITHUB_CONFIG.autoBuildPath} folder not found in download`);
    }

    // Determine where to install the update
    const targetPath = getUpdateTargetPath();
    debugLog('[Update] Target install path:', targetPath);

    // Backup existing source (always, for rollback safety)
    if (existsSync(targetPath)) {
      if (existsSync(backupPath)) {
        rmSync(backupPath, { recursive: true, force: true });
      }
      debugLog('[Update] Creating backup at:', backupPath);
      copyDirectoryRecursive(targetPath, backupPath);
      backupCreated = true;
    }

    try {
      // Apply the update
      debugLog('[Update] Applying update...');
      await applyUpdate(targetPath, autoBuildSource);
      debugLog('[Update] Update applied successfully');
    } catch (applyError) {
      debugLog('[Update] Apply failed, attempting rollback...');
      if (backupCreated && existsSync(backupPath)) {
        try {
          restoreBackup(targetPath, backupPath);
          debugLog('[Update] Rollback complete');
        } catch (rollbackError) {
          debugLog('[Update] Rollback failed:', rollbackError);
        }
      }
      throw applyError;
    }

    // Write update metadata
    const metadata: UpdateMetadata = {
      version: releaseVersion,
      updatedAt: new Date().toISOString(),
      source: 'github-release',
      releaseTag: release.tag_name,
      releaseName: release.name
    };
    writeUpdateMetadata(targetPath, metadata);

    // Clear the cache after successful update
    clearCachedRelease();

    // Cleanup
    rmSync(tarballPath, { force: true });
    rmSync(extractPath, { recursive: true, force: true });

    onProgress?.({
      stage: 'complete',
      message: `Updated to version ${releaseVersion}`
    });

    debugLog('[Update] ============================================');
    debugLog('[Update] UPDATE SUCCESSFUL');
    debugLog('[Update] New version:', releaseVersion);
    debugLog('[Update] Target path:', targetPath);
    debugLog('[Update] ============================================');

    return {
      success: true,
      version: releaseVersion
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Update failed';
    debugLog('[Update] ============================================');
    debugLog('[Update] UPDATE FAILED');
    debugLog('[Update] Error:', errorMessage);
    debugLog('[Update] ============================================');

    // Best-effort cleanup of temp files
    try {
      if (tarballPath && existsSync(tarballPath)) {
        rmSync(tarballPath, { force: true });
      }
      if (extractPath && existsSync(extractPath)) {
        rmSync(extractPath, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup failures
    }

    onProgress?.({
      stage: 'error',
      message: errorMessage
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Apply update to target directory
 */
async function applyUpdate(targetPath: string, sourcePath: string): Promise<void> {
  if (existsSync(targetPath)) {
    // Preserve important files
    const preservedContent = preserveFiles(targetPath, PRESERVE_FILES);

    // Clean target but preserve certain files
    cleanTargetDirectory(targetPath, PRESERVE_FILES);

    // Copy new files
    copyDirectoryRecursive(sourcePath, targetPath, true);

    // Restore preserved files that might have been overwritten
    restoreFiles(targetPath, preservedContent);
  } else {
    mkdirSync(targetPath, { recursive: true });
    copyDirectoryRecursive(sourcePath, targetPath, false);
  }
}

/**
 * Write update metadata to disk
 */
function writeUpdateMetadata(targetPath: string, metadata: UpdateMetadata): void {
  const metadataPath = path.join(targetPath, '.update-metadata.json');
  atomicWriteFileSync(metadataPath, JSON.stringify(metadata, null, 2), { encoding: 'utf-8' });
}

/**
 * Restore from a backup directory after a failed update.
 * Keeps preserved files (like .env/specs) intact.
 */
function restoreBackup(targetPath: string, backupPath: string): void {
  if (!existsSync(backupPath)) {
    return;
  }

  if (!existsSync(targetPath)) {
    mkdirSync(targetPath, { recursive: true });
  }

  cleanTargetDirectory(targetPath, PRESERVE_FILES);
  copyDirectoryRecursive(backupPath, targetPath, false);
}
