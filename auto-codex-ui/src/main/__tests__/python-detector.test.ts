import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  execFileSync: vi.fn(),
  existsSync: vi.fn(() => true),
}));

vi.mock('child_process', () => ({
  execFileSync: mocks.execFileSync,
}));

vi.mock('fs', () => ({
  existsSync: mocks.existsSync,
}));

describe('python-detector', () => {
  beforeEach(() => {
    mocks.execFileSync.mockReset();
    mocks.existsSync.mockReset();
    mocks.existsSync.mockReturnValue(true);
  });

  it('prefers Python 3.12+ and rejects 3.9', async () => {
    mocks.execFileSync.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'python3.12' && args.includes('--version')) return 'Python 3.12.12';
      if (cmd === 'python3' && args.includes('--version')) return 'Python 3.9.6';
      throw new Error('not found');
    });

    const mod = await import('../python-detector');
    expect(mod.findPythonCommand()).toBe('python3.12');
  });

  it('returns null when no usable Python 3.12+ exists', async () => {
    mocks.execFileSync.mockImplementation((cmd: string, args: string[]) => {
      if (args.includes('--version')) return 'Python 3.9.6';
      throw new Error('not found');
    });

    const mod = await import('../python-detector');
    expect(mod.findPythonCommand()).toBeNull();
  });
});
