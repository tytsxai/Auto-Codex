import { describe, it, expect, vi, beforeEach } from 'vitest';

const handlers = new Map<string, Function>();

const mockIpcMain = {
  handle: vi.fn((channel: string, handler: Function) => {
    handlers.set(channel, handler);
  }),
  on: vi.fn()
};

const releaseListeners = new Map<string, Function[]>();

const mockProjectStore = {
  getProject: vi.fn(),
  getTasks: vi.fn()
};

const mockReleaseService = {
  runPreflightChecks: vi.fn(),
  on: vi.fn((eventName: string, callback: Function) => {
    const existing = releaseListeners.get(eventName) || [];
    existing.push(callback);
    releaseListeners.set(eventName, existing);
  }),
  createRelease: vi.fn()
};

const mockChangelogService = {
  suggestVersionFromCommits: vi.fn()
};

const mockExecFileSync = vi.fn();
const mockExecSync = vi.fn();

vi.mock('electron', () => ({
  ipcMain: mockIpcMain
}));

vi.mock('child_process', () => ({
  execFileSync: mockExecFileSync,
  execSync: mockExecSync
}));

vi.mock('../../../../shared/constants', async () => {
  const actual = await vi.importActual<typeof import('../../../../shared/constants')>('../../../../shared/constants');
  return actual;
});

vi.mock('../../../project-store', () => ({
  projectStore: mockProjectStore
}));

vi.mock('../../../release-service', () => ({
  releaseService: mockReleaseService
}));

vi.mock('../../../changelog-service', () => ({
  changelogService: mockChangelogService
}));

describe('GitHub release handlers preflight gate', () => {
  beforeEach(async () => {
    handlers.clear();
    releaseListeners.clear();
    vi.clearAllMocks();
    delete process.env.AUTO_CODEX_SKIP_RELEASE_PREFLIGHT;

    const { registerCreateRelease, registerReleaseHandlers } = await import('../release-handlers');
    registerCreateRelease();
    registerReleaseHandlers(() => ({
      webContents: {
        send: vi.fn()
      }
    }) as unknown as import('electron').BrowserWindow);
  });

  it('registers release event bridge once', async () => {
    expect(mockReleaseService.on).toHaveBeenCalledWith('release-progress', expect.any(Function));
    expect(mockReleaseService.on).toHaveBeenCalledWith('release-complete', expect.any(Function));
    expect(mockReleaseService.on).toHaveBeenCalledWith('release-error', expect.any(Function));
  });

  it('blocks release when preflight fails', async () => {
    const { IPC_CHANNELS } = await import('../../../../shared/constants');

    const handler = handlers.get(IPC_CHANNELS.GITHUB_CREATE_RELEASE);
    expect(handler).toBeTypeOf('function');

    mockProjectStore.getProject.mockReturnValue({ id: 'p1', path: '/tmp/project' });
    mockProjectStore.getTasks.mockReturnValue([{ id: 't1' }]);
    mockReleaseService.runPreflightChecks.mockResolvedValue({
      canRelease: false,
      checks: {
        gitClean: { passed: false, message: 'dirty' },
        commitsPushed: { passed: true, message: 'ok' },
        tagAvailable: { passed: true, message: 'ok' },
        githubConnected: { passed: true, message: 'ok' },
        worktreesMerged: { passed: true, message: 'ok', unmergedWorktrees: [] }
      },
      blockers: ['Uncommitted changes: 1 file(s)']
    });

    const result = await handler?.({}, 'p1', 'v1.2.3', 'notes', {});

    expect(result).toEqual({
      success: false,
      error: 'Release blocked by preflight checks: Uncommitted changes: 1 file(s)'
    });
    expect(mockExecSync).not.toHaveBeenCalled();
    expect(mockExecFileSync).not.toHaveBeenCalled();
    expect(mockReleaseService.runPreflightChecks).toHaveBeenCalledWith(
      '/tmp/project',
      '1.2.3',
      [{ id: 't1' }]
    );
  });

  it('allows release when preflight passes', async () => {
    const { IPC_CHANNELS } = await import('../../../../shared/constants');

    const handler = handlers.get(IPC_CHANNELS.GITHUB_CREATE_RELEASE);
    expect(handler).toBeTypeOf('function');

    mockProjectStore.getProject.mockReturnValue({ id: 'p1', path: '/tmp/project' });
    mockProjectStore.getTasks.mockReturnValue([]);
    mockReleaseService.runPreflightChecks.mockResolvedValue({
      canRelease: true,
      checks: {
        gitClean: { passed: true, message: 'ok' },
        commitsPushed: { passed: true, message: 'ok' },
        tagAvailable: { passed: true, message: 'ok' },
        githubConnected: { passed: true, message: 'ok' },
        worktreesMerged: { passed: true, message: 'ok', unmergedWorktrees: [] }
      },
      blockers: []
    });

    mockExecSync.mockReturnValue('/usr/bin/gh');
    mockExecFileSync.mockReturnValue('https://github.com/org/repo/releases/tag/v1.2.3');

    const result = await handler?.({}, 'p1', '1.2.3', 'notes', { draft: true });

    expect(result).toEqual({
      success: true,
      data: { url: 'https://github.com/org/repo/releases/tag/v1.2.3' }
    });
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'gh',
      ['release', 'create', 'v1.2.3', '--title', 'v1.2.3', '--notes', 'notes', '--draft'],
      expect.objectContaining({ cwd: '/tmp/project' })
    );
  });

  it('can bypass preflight via env override', async () => {
    process.env.AUTO_CODEX_SKIP_RELEASE_PREFLIGHT = 'true';

    const { IPC_CHANNELS } = await import('../../../../shared/constants');
    const handler = handlers.get(IPC_CHANNELS.GITHUB_CREATE_RELEASE);
    expect(handler).toBeTypeOf('function');

    mockProjectStore.getProject.mockReturnValue({ id: 'p1', path: '/tmp/project' });
    mockExecSync.mockReturnValue('/usr/bin/gh');
    mockExecFileSync.mockReturnValue('https://github.com/org/repo/releases/tag/v1.2.3');

    const result = await handler?.({}, 'p1', '1.2.3', 'notes', {});

    expect(result?.success).toBe(true);
    expect(mockReleaseService.runPreflightChecks).not.toHaveBeenCalled();
  });
});
