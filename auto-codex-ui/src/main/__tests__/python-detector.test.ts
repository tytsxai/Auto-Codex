import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  execSync: vi.fn(),
  existsSync: vi.fn(() => true),
}));

vi.mock('child_process', () => ({
  execSync: mocks.execSync,
}));

vi.mock('fs', () => ({
  existsSync: mocks.existsSync,
}));

describe('python-detector', () => {
  beforeEach(() => {
    mocks.execSync.mockReset();
    mocks.existsSync.mockReset();
    mocks.existsSync.mockReturnValue(true);
  });

  it('prefers Python 3.12+ and rejects 3.9', async () => {
    mocks.execSync.mockImplementation((cmd: string) => {
      if (cmd.includes('python3.12 --version')) return Buffer.from('Python 3.12.12');
      if (cmd.includes('python3 --version')) return Buffer.from('Python 3.9.6');
      throw new Error('not found');
    });

    const mod = await import('../python-detector');
    expect(mod.findPythonCommand()).toBe('python3.12');
  });

  it('returns null when no usable Python 3.12+ exists', async () => {
    mocks.execSync.mockImplementation((cmd: string) => {
      if (cmd.includes('--version')) return Buffer.from('Python 3.9.6');
      throw new Error('not found');
    });

    const mod = await import('../python-detector');
    expect(mod.findPythonCommand()).toBeNull();
  });
});
