import { Separator } from '../ui/separator';

interface SettingsSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

/**
 * 设置分区可复用包装组件
 * 提供一致的布局与样式
 */
export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Separator />
      {children}
    </div>
  );
}
