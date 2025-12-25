/**
 * Version management utilities
 */

import { app } from 'electron';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import type { UpdateMetadata } from './types';

/**
 * Get the current app/framework version from package.json
 *
 * Uses app.getVersion() (from package.json) as the base version.
 */
export function getBundledVersion(): string {
  return app.getVersion();
}

/**
 * Get the effective version - accounts for source updates
 *
 * Returns the updated source version if an update has been applied,
 * otherwise returns the bundled version.
 */
export function getEffectiveVersion(): string {
  const isDebug = process.env.DEBUG === 'true';

  // Build list of paths to check for update metadata
  const metadataPaths: string[] = [];

  if (app.isPackaged) {
    // Production: check userData override path
    metadataPaths.push(
      path.join(app.getPath('userData'), 'auto-codex-source', '.update-metadata.json')
    );
  } else {
    // Development: check the actual source paths where updates are written
    const possibleSourcePaths = [
      path.join(app.getAppPath(), '..', 'auto-codex'),
      path.join(app.getAppPath(), '..', '..', 'auto-codex'),
      path.join(process.cwd(), 'auto-codex'),
      path.join(process.cwd(), '..', 'auto-codex')
    ];

    for (const sourcePath of possibleSourcePaths) {
      metadataPaths.push(path.join(sourcePath, '.update-metadata.json'));
    }
  }

  if (isDebug) {
    console.warn('[Version] Checking metadata paths:', metadataPaths);
  }

  // Check each path for metadata
  for (const metadataPath of metadataPaths) {
    const exists = existsSync(metadataPath);
    if (isDebug) {
      console.warn(`[Version] Checking ${metadataPath}: ${exists ? 'EXISTS' : 'not found'}`);
    }
    if (exists) {
      try {
        const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8')) as UpdateMetadata;
        if (metadata.version) {
          if (isDebug) {
            console.warn(`[Version] Found metadata version: ${metadata.version}`);
          }
          return metadata.version;
        }
      } catch (e) {
        if (isDebug) {
          console.warn(`[Version] Error reading metadata: ${e}`);
        }
        // Continue to next path
      }
    }
  }

  const bundledVersion = app.getVersion();
  if (isDebug) {
    console.warn(`[Version] No metadata found, using bundled version: ${bundledVersion}`);
  }
  return bundledVersion;
}

/**
 * Parse version from GitHub release tag
 * Handles tags like "v1.2.0", "1.2.0", "v1.2.0-beta"
 */
export function parseVersionFromTag(tag: string): string {
  // Remove leading 'v' if present
  return tag.trim().replace(/^v/, '');
}

type Semver = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
};

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/, '').split('+')[0] || '0.0.0';
}

function parseSemver(version: string): Semver | null {
  const normalized = normalizeVersion(version);
  const [core, pre = ''] = normalized.split('-', 2);
  const parts = core.split('.');

  const major = Number(parts[0] ?? 0);
  const minor = Number(parts[1] ?? 0);
  const patch = Number(parts[2] ?? 0);

  if ([major, minor, patch].some((n) => Number.isNaN(n))) {
    return null;
  }

  const prerelease = pre ? pre.split('.').filter(Boolean) : [];
  return { major, minor, patch, prerelease };
}

function comparePrerelease(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;

  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i++) {
    const ai = a[i];
    const bi = b[i];
    if (ai === undefined) return -1;
    if (bi === undefined) return 1;

    const aNum = /^\d+$/.test(ai) ? Number(ai) : null;
    const bNum = /^\d+$/.test(bi) ? Number(bi) : null;

    if (aNum !== null && bNum !== null) {
      if (aNum > bNum) return 1;
      if (aNum < bNum) return -1;
      continue;
    }

    if (aNum !== null && bNum === null) return -1;
    if (aNum === null && bNum !== null) return 1;

    if (ai > bi) return 1;
    if (ai < bi) return -1;
  }

  return 0;
}

/**
 * Compare semantic versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
export function compareVersions(a: string, b: string): number {
  const semA = parseSemver(a);
  const semB = parseSemver(b);

  if (semA && semB) {
    if (semA.major !== semB.major) return semA.major > semB.major ? 1 : -1;
    if (semA.minor !== semB.minor) return semA.minor > semB.minor ? 1 : -1;
    if (semA.patch !== semB.patch) return semA.patch > semB.patch ? 1 : -1;
    return comparePrerelease(semA.prerelease, semB.prerelease);
  }

  // Fallback to legacy numeric comparison if parsing fails
  const partsA = normalizeVersion(a).split('.').map((part) => Number(part));
  const partsB = normalizeVersion(b).split('.').map((part) => Number(part));

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;

    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }

  return 0;
}
