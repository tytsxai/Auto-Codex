import { SettingsSection } from './SettingsSection';
import { ThemeSelector } from './ThemeSelector';
import type { AppSettings } from '../../../shared/types';

interface ThemeSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

/**
 * 主题与外观设置分区
 * 使用一致的设置分区布局包裹 ThemeSelector 组件
 */
export function ThemeSettings({ settings, onSettingsChange }: ThemeSettingsProps) {
  return (
    <SettingsSection
      title="外观"
      description="自定义 Auto Claude 外观"
    >
      <ThemeSelector settings={settings} onSettingsChange={onSettingsChange} />
    </SettingsSection>
  );
}
