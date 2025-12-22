import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../updater/version-manager', () => ({
  getEffectiveVersion: vi.fn(() => '3.0.0'),
  parseVersionFromTag: vi.fn((tag: string) => tag.replace(/^v/, '')),
  compareVersions: vi.fn((a: string, b: string) => (a === b ? 0 : 1))
}));

describe('Update Checker', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('treats GitHub latest-release 404 as "no releases" (no error)', async () => {
    vi.doMock('../updater/http-client', () => ({
      fetchJson: vi.fn(async () => {
        throw new Error('HTTP 404: {"message":"Not Found"}');
      })
    }));

    const { checkForUpdates } = await import('../updater/update-checker');
    const result = await checkForUpdates();

    expect(result.updateAvailable).toBe(false);
    expect(result.currentVersion).toBe('3.0.0');
    expect(result.latestVersion).toBe('3.0.0');
    expect(result.error).toBeUndefined();
  });
});

