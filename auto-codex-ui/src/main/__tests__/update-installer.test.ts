import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGetPath = vi.fn((name: string) => {
  if (name === 'userData') return '/tmp/autocodex-tests-userdata';
  return '/tmp';
});

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: vi.fn(() => '/tmp/app'),
    getPath: mockGetPath
  }
}));

const mockRmSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockExistsSync = vi.fn((p: string) => p.includes('/tmp/source'));
const mockReaddirSync = vi.fn((p: string) => {
  if (p.endsWith('/extracted')) {
    return ['owner-Auto-Codex-hash'];
  }
  return [];
});

vi.mock('fs', () => ({
  createReadStream: vi.fn(),
  existsSync: (p: string) => mockExistsSync(p),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  rmSync: (...args: unknown[]) => mockRmSync(...args),
  readdirSync: (p: string) => mockReaddirSync(p)
}));

const mockDownloadFile = vi.fn(async () => undefined);
const mockFetchJson = vi.fn(async () => ({
  tag_name: 'v3.0.0',
  name: 'v3.0.0',
  body: '',
  html_url: 'https://example.com/release',
  tarball_url: 'https://example.com/tarball',
  published_at: '2025-01-01T00:00:00.000Z',
  prerelease: false,
  draft: false,
  assets: []
}));

vi.mock('../updater/http-client', () => ({
  downloadFile: mockDownloadFile,
  fetchJson: mockFetchJson,
  fetchText: vi.fn(async () => 'a'.repeat(64) + '  auto-codex-update.tar.gz\n')
}));

const mockExtractTarball = vi.fn(async () => undefined);
const mockCopyDirectoryRecursive = vi.fn();
const mockPreserveFiles = vi.fn(() => ({}));
const mockRestoreFiles = vi.fn();
const mockCleanTargetDirectory = vi.fn();

vi.mock('../updater/file-operations', () => ({
  extractTarball: mockExtractTarball,
  copyDirectoryRecursive: mockCopyDirectoryRecursive,
  preserveFiles: mockPreserveFiles,
  restoreFiles: mockRestoreFiles,
  cleanTargetDirectory: mockCleanTargetDirectory
}));

const mockGetCachedRelease = vi.fn(() => null);
const mockSetCachedRelease = vi.fn();
const mockClearCachedRelease = vi.fn();

vi.mock('../updater/update-checker', () => ({
  getCachedRelease: () => mockGetCachedRelease(),
  setCachedRelease: mockSetCachedRelease,
  clearCachedRelease: () => mockClearCachedRelease()
}));

vi.mock('../updater/version-manager', () => ({
  compareVersions: vi.fn(() => 0),
  getBundledVersion: vi.fn(() => '3.0.0'),
  parseVersionFromTag: vi.fn((tag: string) => tag.replace(/^v/, ''))
}));

vi.mock('../utils/atomic-write', () => ({
  atomicWriteFileSync: vi.fn()
}));

describe('downloadAndApplyUpdate rollback', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockExistsSync.mockImplementation((p: string) =>
      p.includes('/tmp/source') ||
      p.includes('/tmp/autocodex-tests-userdata') ||
      p.includes('/tmp/auto-codex')
    );
    mockCopyDirectoryRecursive.mockImplementation(() => undefined);
  });

  afterEach(() => {
    delete process.env.AUTO_CODEX_ALLOW_UNSIGNED_UPDATES;
  });

  it('restores backup when applying update fails after backup creation', async () => {
    process.env.AUTO_CODEX_ALLOW_UNSIGNED_UPDATES = 'true';

    let copyCallCount = 0;
    mockCopyDirectoryRecursive.mockImplementation(() => {
      copyCallCount += 1;
      if (copyCallCount === 2) {
        throw new Error('copy failed while applying update');
      }
    });

    const { downloadAndApplyUpdate } = await import('../updater/update-installer');

    const result = await downloadAndApplyUpdate();

    expect(result.success).toBe(false);
    expect(result.error).toContain('copy failed while applying update');

    // 1st copy: create backup, 2nd copy: apply update (fails), 3rd copy: rollback restore
    expect(mockCopyDirectoryRecursive).toHaveBeenCalledTimes(3);
    expect(mockCleanTargetDirectory).toHaveBeenCalledTimes(2);
    expect(mockClearCachedRelease).not.toHaveBeenCalled();
  });
});
