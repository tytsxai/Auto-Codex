import { create } from 'zustand';
import type { AppSettings } from '../../shared/types';
import { DEFAULT_APP_SETTINGS } from '../../shared/constants';

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  error: string | null;

  // 操作
  setSettings: (settings: AppSettings) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_APP_SETTINGS as AppSettings,
  isLoading: true,  // 因为应用初始化时会加载设置，所以初始为 true
  error: null,

  setSettings: (settings) => set({ settings }),

  updateSettings: (updates) =>
    set((state) => ({
      settings: { ...state.settings, ...updates }
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error })
}));

/**
 * 检查设置是否需要迁移 onboardingCompleted 标记。
 * 现有用户（已配置令牌或项目）应将
 * onboardingCompleted 设为 true 以跳过引导向导。
 */
function migrateOnboardingCompleted(settings: AppSettings): AppSettings {
  // 仅在 onboardingCompleted 为 undefined（未明确设置）时迁移
  if (settings.onboardingCompleted !== undefined) {
    return settings;
  }

  // 检查现有用户的迹象：
  // - 已配置 Claude OAuth 令牌
  // - 已配置 auto-build 源路径
  const hasOAuthToken = Boolean(settings.globalClaudeOAuthToken);
  const hasAutoBuildPath = Boolean(settings.autoBuildPath);

  const isExistingUser = hasOAuthToken || hasAutoBuildPath;

  if (isExistingUser) {
    // 为现有用户标记 onboarding 已完成
    return { ...settings, onboardingCompleted: true };
  }

  // 新用户 - 设为 false 以触发引导向导
  return { ...settings, onboardingCompleted: false };
}

/**
 * 从主进程加载设置
 */
export async function loadSettings(): Promise<void> {
  const store = useSettingsStore.getState();
  store.setLoading(true);

  try {
    const result = await window.electronAPI.getSettings();
    if (result.success && result.data) {
      // 应用 onboardingCompleted 标记的迁移
      const migratedSettings = migrateOnboardingCompleted(result.data);
      store.setSettings(migratedSettings);

      // 如果迁移更改了设置，则持久化
      if (migratedSettings.onboardingCompleted !== result.data.onboardingCompleted) {
        await window.electronAPI.saveSettings({
          onboardingCompleted: migratedSettings.onboardingCompleted
        });
      }
    }
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Failed to load settings');
  } finally {
    store.setLoading(false);
  }
}

/**
 * 保存设置到主进程
 */
export async function saveSettings(updates: Partial<AppSettings>): Promise<boolean> {
  const store = useSettingsStore.getState();

  try {
    const result = await window.electronAPI.saveSettings(updates);
    if (result.success) {
      store.updateSettings(updates);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
