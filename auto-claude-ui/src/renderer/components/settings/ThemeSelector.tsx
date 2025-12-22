import { Check, Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Label } from '../ui/label';
import { COLOR_THEMES } from '../../../shared/constants';
import { useSettingsStore } from '../../stores/settings-store';
import type { ColorTheme, AppSettings } from '../../../shared/types';

interface ThemeSelectorProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

/**
 * 主题选择组件，展示带预览色块的主题卡片网格
 * 以及三种模式切换（浅色/深色/系统）
 *
 * 主题更改会立即应用于实时预览，其他设置需保存后生效。
 */
export function ThemeSelector({ settings, onSettingsChange }: ThemeSelectorProps) {
  const updateStoreSettings = useSettingsStore((state) => state.updateSettings);

  const currentColorTheme = settings.colorTheme || 'default';
  const currentMode = settings.theme;
  const isDark = currentMode === 'dark' ||
    (currentMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const handleColorThemeChange = (themeId: ColorTheme) => {
    // 更新本地草稿状态
    onSettingsChange({ ...settings, colorTheme: themeId });
    // 立即应用到 store 以实时预览（触发 App.tsx 的 useEffect）
    updateStoreSettings({ colorTheme: themeId });
  };

  const handleModeChange = (mode: 'light' | 'dark' | 'system') => {
    // 更新本地草稿状态
    onSettingsChange({ ...settings, theme: mode });
    // 立即应用到 store 以实时预览（触发 App.tsx 的 useEffect）
    updateStoreSettings({ theme: mode });
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* 模式切换 */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-foreground">外观模式</Label>
        <p className="text-sm text-muted-foreground">选择浅色、深色或跟随系统</p>
        <div className="grid grid-cols-3 gap-3 max-w-md pt-1">
          {(['system', 'light', 'dark'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                currentMode === mode
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-accent/50'
              )}
            >
              {getModeIcon(mode)}
              <span className="text-sm font-medium capitalize">{mode}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 颜色主题网格 */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-foreground">颜色主题</Label>
        <p className="text-sm text-muted-foreground">选择界面的配色方案</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {COLOR_THEMES.map((theme) => {
            const isSelected = currentColorTheme === theme.id;
            const bgColor = isDark ? theme.previewColors.darkBg : theme.previewColors.bg;
            const accentColor = isDark
              ? (theme.previewColors.darkAccent || theme.previewColors.accent)
              : theme.previewColors.accent;

            return (
              <button
                key={theme.id}
                onClick={() => handleColorThemeChange(theme.id)}
                className={cn(
                  'relative flex flex-col p-4 rounded-lg border-2 text-left transition-all',
                  'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/50 hover:bg-accent/30'
                )}
              >
                {/* 选中指示 */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}

                {/* 预览色块 */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex -space-x-1.5">
                    <div
                      className="w-6 h-6 rounded-full border-2 border-background shadow-sm"
                      style={{ backgroundColor: bgColor }}
                      title="背景色"
                    />
                    <div
                      className="w-6 h-6 rounded-full border-2 border-background shadow-sm"
                      style={{ backgroundColor: accentColor }}
                      title="强调色"
                    />
                  </div>
                </div>

                {/* 主题信息 */}
                <div className="space-y-1">
                  <p className="font-medium text-sm text-foreground">{theme.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{theme.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
