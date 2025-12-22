import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import type { ProjectSettings } from '../../../shared/types';

interface NotificationsSectionProps {
  settings: ProjectSettings;
  onUpdateSettings: (updates: Partial<ProjectSettings>) => void;
}

export function NotificationsSection({ settings, onUpdateSettings }: NotificationsSectionProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">通知</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="font-normal text-foreground">任务完成时</Label>
          <Switch
            checked={settings.notifications.onTaskComplete}
            onCheckedChange={(checked) =>
              onUpdateSettings({
                notifications: {
                  ...settings.notifications,
                  onTaskComplete: checked
                }
              })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="font-normal text-foreground">任务失败时</Label>
          <Switch
            checked={settings.notifications.onTaskFailed}
            onCheckedChange={(checked) =>
              onUpdateSettings({
                notifications: {
                  ...settings.notifications,
                  onTaskFailed: checked
                }
              })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="font-normal text-foreground">需要审核时</Label>
          <Switch
            checked={settings.notifications.onReviewNeeded}
            onCheckedChange={(checked) =>
              onUpdateSettings({
                notifications: {
                  ...settings.notifications,
                  onReviewNeeded: checked
                }
              })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="font-normal text-foreground">声音</Label>
          <Switch
            checked={settings.notifications.sound}
            onCheckedChange={(checked) =>
              onUpdateSettings({
                notifications: {
                  ...settings.notifications,
                  sound: checked
                }
              })
            }
          />
        </div>
      </div>
    </section>
  );
}
