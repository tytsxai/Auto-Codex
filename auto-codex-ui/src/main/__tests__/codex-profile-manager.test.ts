/**
 * Unit tests for CodexProfileManager
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const mockPaths = {
  userData: '',
  home: ''
};

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return mockPaths.userData;
      if (name === 'home') return mockPaths.home;
      return mockPaths.userData;
    }),
    isPackaged: false
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((value: string) => Buffer.from(`enc:${value}`, 'utf-8')),
    decryptString: vi.fn((value: Buffer) => value.toString('utf-8').replace(/^enc:/, ''))
  }
}));

describe('CodexProfileManager', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'codex-profile-manager-'));
    mockPaths.userData = path.join(tempDir, 'userData');
    mockPaths.home = path.join(tempDir, 'home');
    mkdirSync(mockPaths.userData, { recursive: true });
    mkdirSync(mockPaths.home, { recursive: true });

    process.env.HOME = mockPaths.home;
    process.env.USERPROFILE = mockPaths.home;

    const codexDir = path.join(mockPaths.home, '.codex');
    mkdirSync(codexDir, { recursive: true });
    writeFileSync(path.join(codexDir, 'auth.json'), JSON.stringify({ OPENAI_API_KEY: 'sk-test-1234567890' }));

    vi.resetModules();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('loads credentials on fresh install by reading default config dir', async () => {
    const { CodexProfileManager } = await import('../codex-profile-manager');

    const manager = new CodexProfileManager();
    const settings = manager.getSettings();
    const defaultProfile = settings.profiles.find((p) => p.id === 'default');

    expect(defaultProfile).toBeDefined();
    expect(defaultProfile?.isAuthenticated).toBe(true);
    expect(defaultProfile?.configDir).toContain('.codex');
  });
});
