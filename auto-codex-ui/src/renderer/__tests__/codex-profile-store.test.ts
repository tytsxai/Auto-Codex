/**
 * Unit tests for Codex Profile Store
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  useCodexProfileStore,
  loadCodexProfiles,
  switchTerminalToProfile
} from '../stores/codex-profile-store';
import type { CodexProfile, CodexProfileSettings } from '../../shared/types';

function makeProfile(overrides: Partial<CodexProfile> = {}): CodexProfile {
  return {
    id: `profile-${Math.random().toString(36).slice(2)}`,
    name: 'Profile',
    configDir: '/tmp/codex',
    isDefault: false,
    createdAt: new Date(),
    ...overrides
  } as CodexProfile;
}

describe('CodexProfileStore', () => {
  let electronAPI: {
    getCodexProfiles: ReturnType<typeof vi.fn>;
    switchCodexProfile: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    electronAPI = {
      getCodexProfiles: vi.fn(),
      switchCodexProfile: vi.fn()
    };

    if (!(globalThis as typeof globalThis & { window?: Window }).window) {
      (globalThis as typeof globalThis & { window: Window }).window = {} as Window;
    }

    (window as Window & { electronAPI: typeof electronAPI }).electronAPI = electronAPI;

    useCodexProfileStore.setState({
      profiles: [],
      activeProfileId: 'default',
      isLoading: false,
      isSwitching: false
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('updates profiles and active profile', () => {
    const profiles = [makeProfile({ id: 'p1' }), makeProfile({ id: 'p2' })];
    const settings: CodexProfileSettings = {
      profiles,
      activeProfileId: 'p2',
      autoSwitch: {
        enabled: false,
        proactiveSwapEnabled: false,
        sessionThreshold: 95,
        weeklyThreshold: 99,
        autoSwitchOnRateLimit: false,
        usageCheckInterval: 30000
      }
    };

    useCodexProfileStore.getState().setProfiles(settings);

    expect(useCodexProfileStore.getState().profiles).toHaveLength(2);
    expect(useCodexProfileStore.getState().activeProfileId).toBe('p2');
  });

  it('adds, updates, and removes profiles', () => {
    const profile = makeProfile({ id: 'p1', name: 'One' });
    useCodexProfileStore.getState().addProfile(profile);

    expect(useCodexProfileStore.getState().profiles).toHaveLength(1);

    useCodexProfileStore.getState().updateProfile({ ...profile, name: 'Updated' });
    expect(useCodexProfileStore.getState().profiles[0].name).toBe('Updated');

    useCodexProfileStore.getState().removeProfile('p1');
    expect(useCodexProfileStore.getState().profiles).toHaveLength(0);
  });

  it('loads profiles from IPC', async () => {
    const settings: CodexProfileSettings = {
      profiles: [makeProfile({ id: 'p1' })],
      activeProfileId: 'p1',
      autoSwitch: {
        enabled: false,
        proactiveSwapEnabled: false,
        sessionThreshold: 95,
        weeklyThreshold: 99,
        autoSwitchOnRateLimit: false,
        usageCheckInterval: 30000
      }
    };
    electronAPI.getCodexProfiles.mockResolvedValue({ success: true, data: settings });

    await loadCodexProfiles();

    expect(electronAPI.getCodexProfiles).toHaveBeenCalled();
    expect(useCodexProfileStore.getState().profiles).toHaveLength(1);
    expect(useCodexProfileStore.getState().activeProfileId).toBe('p1');
    expect(useCodexProfileStore.getState().isLoading).toBe(false);
  });

  it('clears loading flag when IPC fails', async () => {
    electronAPI.getCodexProfiles.mockRejectedValue(new Error('boom'));

    await loadCodexProfiles();

    expect(useCodexProfileStore.getState().isLoading).toBe(false);
  });

  it('switches terminal to a profile on success', async () => {
    electronAPI.switchCodexProfile.mockResolvedValue({ success: true });

    const result = await switchTerminalToProfile('term-1', 'profile-1');

    expect(result).toBe(true);
    expect(useCodexProfileStore.getState().activeProfileId).toBe('profile-1');
    expect(useCodexProfileStore.getState().isSwitching).toBe(false);
  });

  it('returns false when switch fails', async () => {
    electronAPI.switchCodexProfile.mockResolvedValue({ success: false });

    const result = await switchTerminalToProfile('term-1', 'profile-1');

    expect(result).toBe(false);
    expect(useCodexProfileStore.getState().activeProfileId).toBe('default');
    expect(useCodexProfileStore.getState().isSwitching).toBe(false);
  });
});
