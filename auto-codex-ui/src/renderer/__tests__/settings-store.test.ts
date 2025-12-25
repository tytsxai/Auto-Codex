/**
 * Unit tests for Settings Store
 * Tests Zustand store for settings state management
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  useSettingsStore,
  loadSettings,
  saveSettings
} from '../stores/settings-store';
import { DEFAULT_APP_SETTINGS } from '../../shared/constants';
import type { AppSettings } from '../../shared/types';

function createSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    ...DEFAULT_APP_SETTINGS,
    notifications: {
      ...DEFAULT_APP_SETTINGS.notifications
    },
    ...overrides
  } as AppSettings;
}

describe('Settings Store', () => {
  let electronAPI: {
    getSettings: ReturnType<typeof vi.fn>;
    saveSettings: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    electronAPI = {
      getSettings: vi.fn(),
      saveSettings: vi.fn()
    };

    if (!(globalThis as typeof globalThis & { window?: Window }).window) {
      (globalThis as typeof globalThis & { window: Window }).window = {} as Window;
    }

    (window as Window & { electronAPI: typeof electronAPI }).electronAPI = electronAPI;

    useSettingsStore.setState({
      settings: createSettings(),
      isLoading: false,
      error: null
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('state management', () => {
    it('sets settings and updates theme', () => {
      const initial = createSettings({ theme: 'dark' });

      useSettingsStore.getState().setSettings(initial);
      useSettingsStore.getState().updateSettings({ theme: 'light' });

      const state = useSettingsStore.getState();
      expect(state.settings.theme).toBe('light');
      expect(state.settings.defaultModel).toBe(initial.defaultModel);
    });

    it('sets loading and error state', () => {
      useSettingsStore.getState().setLoading(true);
      useSettingsStore.getState().setError('Oops');

      const state = useSettingsStore.getState();
      expect(state.isLoading).toBe(true);
      expect(state.error).toBe('Oops');
    });
  });

  describe('loadSettings', () => {
    it('loads settings and migrates onboarding for existing users', async () => {
      const incoming = createSettings({
        onboardingCompleted: undefined,
        globalOpenAIApiKey: 'sk-test'
      });

      electronAPI.getSettings.mockResolvedValue({
        success: true,
        data: incoming
      });

      await loadSettings();

      const state = useSettingsStore.getState();
      expect(state.settings.globalOpenAIApiKey).toBe('sk-test');
      expect(state.settings.onboardingCompleted).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(electronAPI.saveSettings).toHaveBeenCalledWith({
        onboardingCompleted: true
      });
    });

    it('does not persist when onboardingCompleted is already set', async () => {
      const incoming = createSettings({ onboardingCompleted: true });

      electronAPI.getSettings.mockResolvedValue({
        success: true,
        data: incoming
      });

      await loadSettings();

      expect(useSettingsStore.getState().settings.onboardingCompleted).toBe(true);
      expect(electronAPI.saveSettings).not.toHaveBeenCalled();
    });

    it('sets error when IPC throws', async () => {
      electronAPI.getSettings.mockRejectedValue(new Error('Load boom'));

      await loadSettings();

      const state = useSettingsStore.getState();
      expect(state.error).toBe('Load boom');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('saveSettings', () => {
    it('updates store when save succeeds', async () => {
      electronAPI.saveSettings.mockResolvedValue({ success: true });

      const result = await saveSettings({ theme: 'dark' });

      expect(result).toBe(true);
      expect(useSettingsStore.getState().settings.theme).toBe('dark');
    });

    it('returns false when save fails', async () => {
      useSettingsStore.getState().setSettings(createSettings({ theme: 'light' }));
      electronAPI.saveSettings.mockResolvedValue({ success: false });

      const result = await saveSettings({ theme: 'dark' });

      expect(result).toBe(false);
      expect(useSettingsStore.getState().settings.theme).toBe('light');
    });

    it('returns false when save throws', async () => {
      electronAPI.saveSettings.mockRejectedValue(new Error('Save boom'));

      const result = await saveSettings({ theme: 'dark' });

      expect(result).toBe(false);
    });
  });
});
