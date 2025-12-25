/**
 * Unit tests for Release Store
 * Tests Zustand store for release state management
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useReleaseStore,
  loadReleaseableVersions,
  runPreflightCheck,
  createRelease,
  getUnreleasedVersions,
  getSelectedVersionInfo
} from '../stores/release-store';
import type {
  ReleaseableVersion,
  ReleasePreflightStatus,
  CreateReleaseResult,
  ReleaseProgress
} from '../../shared/types';

const initialState = {
  releaseableVersions: [],
  isLoadingVersions: false,
  selectedVersion: null,
  preflightStatus: null,
  isRunningPreflight: false,
  createAsDraft: false,
  markAsPrerelease: false,
  releaseProgress: null,
  isCreatingRelease: false,
  lastReleaseResult: null,
  error: null
};

function createVersion(overrides: Partial<ReleaseableVersion> = {}): ReleaseableVersion {
  return {
    version: '1.0.0',
    tagName: 'v1.0.0',
    date: '2024-01-01',
    content: 'Changes',
    taskSpecIds: ['task-1'],
    isReleased: false,
    ...overrides
  };
}

function createPreflightStatus(overrides: Partial<ReleasePreflightStatus> = {}): ReleasePreflightStatus {
  return {
    canRelease: true,
    checks: {
      gitClean: { passed: true, message: 'clean' },
      commitsPushed: { passed: true, message: 'pushed' },
      tagAvailable: { passed: true, message: 'available' },
      githubConnected: { passed: true, message: 'connected' },
      worktreesMerged: { passed: true, message: 'merged' }
    },
    blockers: [],
    ...overrides
  };
}

describe('Release Store', () => {
  let electronAPI: {
    getReleaseableVersions: ReturnType<typeof vi.fn>;
    runReleasePreflightCheck: ReturnType<typeof vi.fn>;
    createRelease: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    electronAPI = {
      getReleaseableVersions: vi.fn(),
      runReleasePreflightCheck: vi.fn(),
      createRelease: vi.fn()
    };

    if (!(globalThis as typeof globalThis & { window?: Window }).window) {
      (globalThis as typeof globalThis & { window: Window }).window = {} as Window;
    }

    (window as Window & { electronAPI: typeof electronAPI }).electronAPI = electronAPI;
    useReleaseStore.setState({ ...initialState });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('state management', () => {
    it('sets selected version and clears preflight/error', () => {
      useReleaseStore.setState({ preflightStatus: createPreflightStatus(), error: 'Old error' });

      useReleaseStore.getState().setSelectedVersion('2.0.0');

      const state = useReleaseStore.getState();
      expect(state.selectedVersion).toBe('2.0.0');
      expect(state.preflightStatus).toBeNull();
      expect(state.error).toBeNull();
    });

    it('resets to initial state', () => {
      useReleaseStore.setState({
        releaseableVersions: [createVersion()],
        selectedVersion: '1.0.0',
        preflightStatus: createPreflightStatus(),
        isRunningPreflight: true,
        createAsDraft: true,
        markAsPrerelease: true,
        releaseProgress: { stage: 'checking', progress: 50, message: 'halfway' } as ReleaseProgress,
        isCreatingRelease: true,
        lastReleaseResult: { success: false, error: 'nope' } as CreateReleaseResult,
        error: 'Problem'
      });

      useReleaseStore.getState().reset();

      expect(useReleaseStore.getState()).toMatchObject(initialState);
    });
  });

  describe('selectors', () => {
    it('returns unreleased versions and selected version info', () => {
      const unreleased = createVersion({ version: '1.2.0', isReleased: false });
      const released = createVersion({ version: '1.1.0', isReleased: true });
      useReleaseStore.setState({
        releaseableVersions: [released, unreleased],
        selectedVersion: '1.2.0'
      });

      expect(getUnreleasedVersions()).toEqual([unreleased]);
      expect(getSelectedVersionInfo()).toEqual(unreleased);
    });
  });

  describe('loadReleaseableVersions', () => {
    it('loads versions and auto-selects first unreleased', async () => {
      const released = createVersion({ version: '1.0.0', isReleased: true });
      const unreleased = createVersion({ version: '1.1.0', isReleased: false });
      electronAPI.getReleaseableVersions.mockResolvedValue({
        success: true,
        data: [released, unreleased]
      });

      await loadReleaseableVersions('project-1');

      const state = useReleaseStore.getState();
      expect(electronAPI.getReleaseableVersions).toHaveBeenCalledWith('project-1');
      expect(state.releaseableVersions).toHaveLength(2);
      expect(state.selectedVersion).toBe('1.1.0');
      expect(state.isLoadingVersions).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error when IPC returns failure', async () => {
      electronAPI.getReleaseableVersions.mockResolvedValue({
        success: false,
        error: 'Load failed'
      });

      await loadReleaseableVersions('project-1');

      const state = useReleaseStore.getState();
      expect(state.error).toBe('Load failed');
      expect(state.isLoadingVersions).toBe(false);
    });

    it('sets error when IPC throws', async () => {
      electronAPI.getReleaseableVersions.mockRejectedValue(new Error('Boom'));

      await loadReleaseableVersions('project-1');

      const state = useReleaseStore.getState();
      expect(state.error).toBe('Boom');
      expect(state.isLoadingVersions).toBe(false);
    });
  });

  describe('runPreflightCheck', () => {
    it('sets error when no version selected', async () => {
      await runPreflightCheck('project-1');

      const state = useReleaseStore.getState();
      expect(state.error).toBe('No version selected');
      expect(electronAPI.runReleasePreflightCheck).not.toHaveBeenCalled();
    });

    it('stores preflight status on success', async () => {
      const status = createPreflightStatus({ canRelease: false, blockers: ['Missing tag'] });
      useReleaseStore.setState({ selectedVersion: '1.0.0' });
      electronAPI.runReleasePreflightCheck.mockResolvedValue({ success: true, data: status });

      await runPreflightCheck('project-1');

      const state = useReleaseStore.getState();
      expect(electronAPI.runReleasePreflightCheck).toHaveBeenCalledWith('project-1', '1.0.0');
      expect(state.preflightStatus).toEqual(status);
      expect(state.isRunningPreflight).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error when IPC returns failure', async () => {
      useReleaseStore.setState({ selectedVersion: '1.0.0' });
      electronAPI.runReleasePreflightCheck.mockResolvedValue({ success: false, error: 'Denied' });

      await runPreflightCheck('project-1');

      const state = useReleaseStore.getState();
      expect(state.error).toBe('Denied');
      expect(state.isRunningPreflight).toBe(false);
    });

    it('sets error when IPC throws', async () => {
      useReleaseStore.setState({ selectedVersion: '1.0.0' });
      electronAPI.runReleasePreflightCheck.mockRejectedValue(new Error('Boom'));

      await runPreflightCheck('project-1');

      const state = useReleaseStore.getState();
      expect(state.error).toBe('Boom');
      expect(state.isRunningPreflight).toBe(false);
    });
  });

  describe('createRelease', () => {
    it('sets error when no version selected', () => {
      createRelease('project-1');

      expect(useReleaseStore.getState().error).toBe('No version selected');
      expect(electronAPI.createRelease).not.toHaveBeenCalled();
    });

    it('sets error when version not found', () => {
      useReleaseStore.setState({ selectedVersion: '1.0.0', releaseableVersions: [] });

      createRelease('project-1');

      expect(useReleaseStore.getState().error).toBe('Version not found');
      expect(electronAPI.createRelease).not.toHaveBeenCalled();
    });

    it('starts release and invokes electron API', () => {
      const version = createVersion({ version: '2.0.0', content: 'Release notes' });
      useReleaseStore.setState({
        releaseableVersions: [version],
        selectedVersion: '2.0.0',
        createAsDraft: true,
        markAsPrerelease: true
      });

      createRelease('project-1');

      const state = useReleaseStore.getState();
      expect(state.isCreatingRelease).toBe(true);
      expect(state.releaseProgress).toEqual({
        stage: 'checking',
        progress: 0,
        message: 'Starting release...'
      });
      expect(state.error).toBeNull();
      expect(electronAPI.createRelease).toHaveBeenCalledWith({
        projectId: 'project-1',
        version: '2.0.0',
        body: 'Release notes',
        draft: true,
        prerelease: true
      });
    });
  });
});
