import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const execFileSyncMock = vi.fn();

vi.mock('child_process', () => ({
  execFileSync: (...args: unknown[]) => execFileSyncMock(...args),
  spawn: vi.fn()
}));

describe('ReleaseService merge safety', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when merge status cannot be proven', async () => {
    execFileSyncMock.mockImplementation((cmd: string, args: string[]) => {
      if (cmd !== 'git') {
        throw new Error('unexpected command');
      }

      if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref' && args[2] === 'HEAD') {
        return 'feature/spec-1';
      }

      if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref' && args[2] === 'origin/HEAD') {
        return 'origin/main';
      }

      if (args[0] === 'log' && args[2] === '--oneline') {
        throw new Error('log compare failed');
      }

      if (args[0] === 'merge-base' && args[1] === '--is-ancestor') {
        throw new Error('ancestor check failed');
      }

      throw new Error(`unexpected git args: ${args.join(' ')}`);
    });

    const { ReleaseService } = await import('../release-service');
    const service = new ReleaseService();

    const merged = await (
      service as unknown as {
        isWorktreeMerged: (projectPath: string, worktreePath: string) => Promise<boolean>;
      }
    ).isWorktreeMerged('/tmp/project', '/tmp/worktree');

    expect(merged).toBe(false);
  });

  it('returns true when ancestry fallback proves branch merged', async () => {
    execFileSyncMock.mockImplementation((cmd: string, args: string[]) => {
      if (cmd !== 'git') {
        throw new Error('unexpected command');
      }

      if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref' && args[2] === 'HEAD') {
        return 'feature/spec-1';
      }

      if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref' && args[2] === 'origin/HEAD') {
        return 'origin/main';
      }

      if (args[0] === 'log' && args[2] === '--oneline') {
        throw new Error('log compare failed');
      }

      if (args[0] === 'merge-base' && args[1] === '--is-ancestor') {
        return '';
      }

      throw new Error(`unexpected git args: ${args.join(' ')}`);
    });

    const { ReleaseService } = await import('../release-service');
    const service = new ReleaseService();

    const merged = await (
      service as unknown as {
        isWorktreeMerged: (projectPath: string, worktreePath: string) => Promise<boolean>;
      }
    ).isWorktreeMerged('/tmp/project', '/tmp/worktree');

    expect(merged).toBe(true);
  });
});
