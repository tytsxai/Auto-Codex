import { Zap, Import, Radio } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';
import { StatusBadge } from './StatusBadge';
import { PasswordInput } from './PasswordInput';
import { ConnectionStatus } from './ConnectionStatus';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import type { ProjectEnvConfig, LinearSyncStatus } from '../../../shared/types';

interface LinearIntegrationSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  envConfig: ProjectEnvConfig;
  onUpdateConfig: (updates: Partial<ProjectEnvConfig>) => void;
  linearConnectionStatus: LinearSyncStatus | null;
  isCheckingLinear: boolean;
  onOpenImportModal: () => void;
}

export function LinearIntegrationSection({
  isExpanded,
  onToggle,
  envConfig,
  onUpdateConfig,
  linearConnectionStatus,
  isCheckingLinear,
  onOpenImportModal,
}: LinearIntegrationSectionProps) {
  const badge = envConfig.linearEnabled ? (
    <StatusBadge status="success" label="已启用" />
  ) : null;

  return (
    <CollapsibleSection
      title="Linear 集成"
      icon={<Zap className="h-4 w-4" />}
      isExpanded={isExpanded}
      onToggle={onToggle}
      badge={badge}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="font-normal text-foreground">启用 Linear 同步</Label>
          <p className="text-xs text-muted-foreground">
            自动创建和更新 Linear 问题
          </p>
        </div>
        <Switch
          checked={envConfig.linearEnabled}
          onCheckedChange={(checked) => onUpdateConfig({ linearEnabled: checked })}
        />
      </div>

      {envConfig.linearEnabled && (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">API 密钥</Label>
            <p className="text-xs text-muted-foreground">
              从{' '}
              <a
                href="https://linear.app/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-info hover:underline"
              >
                Linear 设置
              </a>
            </p>
            <PasswordInput
              value={envConfig.linearApiKey || ''}
              onChange={(value) => onUpdateConfig({ linearApiKey: value })}
              placeholder="lin_api_xxxxxxxx"
            />
          </div>

          {/* 连接状态 */}
          {envConfig.linearApiKey && (
            <ConnectionStatus
              isChecking={isCheckingLinear}
              isConnected={linearConnectionStatus?.connected || false}
              title="连接状态"
              successMessage={`已连接${linearConnectionStatus?.teamName ? `到 ${linearConnectionStatus.teamName}` : ''}`}
              errorMessage={linearConnectionStatus?.error || '未连接'}
              additionalInfo={
                linearConnectionStatus?.connected && linearConnectionStatus.issueCount !== undefined
                  ? `可导入 ${linearConnectionStatus.issueCount}+ 个任务`
                  : undefined
              }
            />
          )}

          {/* 导入现有任务按钮 */}
          {linearConnectionStatus?.connected && (
            <div className="rounded-lg border border-info/30 bg-info/5 p-3">
              <div className="flex items-start gap-3">
                <Import className="h-5 w-5 text-info mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">导入现有任务</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    选择要导入到 AutoBuild 作为任务的 Linear 问题。
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={onOpenImportModal}
                  >
                    <Import className="h-4 w-4 mr-2" />
                    从 Linear 导入任务
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* 实时同步开关 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-info" />
                <Label className="font-normal text-foreground">实时同步</Label>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                自动导入 Linear 中新建的任务
              </p>
            </div>
            <Switch
              checked={envConfig.linearRealtimeSync || false}
              onCheckedChange={(checked) => onUpdateConfig({ linearRealtimeSync: checked })}
            />
          </div>

          {envConfig.linearRealtimeSync && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 ml-6">
              <p className="text-xs text-warning">
                启用后，新的 Linear 问题会自动导入到 AutoBuild。
                请在下方配置团队/项目筛选条件，以控制导入哪些问题。
              </p>
            </div>
          )}

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">团队 ID（可选）</Label>
              <Input
                placeholder="自动检测"
                value={envConfig.linearTeamId || ''}
                onChange={(e) => onUpdateConfig({ linearTeamId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">项目 ID（可选）</Label>
              <Input
                placeholder="自动创建"
                value={envConfig.linearProjectId || ''}
                onChange={(e) => onUpdateConfig({ linearProjectId: e.target.value })}
              />
            </div>
          </div>
        </>
      )}
    </CollapsibleSection>
  );
}
