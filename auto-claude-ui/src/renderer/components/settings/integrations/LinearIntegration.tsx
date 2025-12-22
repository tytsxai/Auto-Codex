import { Radio, Import, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Separator } from '../../ui/separator';
import type { ProjectEnvConfig, LinearSyncStatus } from '../../../../shared/types';

interface LinearIntegrationProps {
  envConfig: ProjectEnvConfig | null;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;
  showLinearKey: boolean;
  setShowLinearKey: React.Dispatch<React.SetStateAction<boolean>>;
  linearConnectionStatus: LinearSyncStatus | null;
  isCheckingLinear: boolean;
  onOpenLinearImport: () => void;
}

/**
 * Linear 集成设置组件。
 * 管理 Linear API 密钥、连接状态和导入功能。
 */
export function LinearIntegration({
  envConfig,
  updateEnvConfig,
  showLinearKey,
  setShowLinearKey,
  linearConnectionStatus,
  isCheckingLinear,
  onOpenLinearImport
}: LinearIntegrationProps) {
  if (!envConfig) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="font-normal text-foreground">启用 Linear 同步</Label>
          <p className="text-xs text-muted-foreground">
            自动创建和更新 Linear 问题
          </p>
        </div>
        <Switch
          checked={envConfig.linearEnabled}
          onCheckedChange={(checked) => updateEnvConfig({ linearEnabled: checked })}
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
              {' '}获取您的 API 密钥
            </p>
            <div className="relative">
              <Input
                type={showLinearKey ? 'text' : 'password'}
                placeholder="lin_api_xxxxxxxx"
                value={envConfig.linearApiKey || ''}
                onChange={(e) => updateEnvConfig({ linearApiKey: e.target.value })}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowLinearKey(!showLinearKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showLinearKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {envConfig.linearApiKey && (
            <ConnectionStatus
              isChecking={isCheckingLinear}
              connectionStatus={linearConnectionStatus}
            />
          )}

          {linearConnectionStatus?.connected && (
            <ImportTasksPrompt onOpenLinearImport={onOpenLinearImport} />
          )}

          <Separator />

          <RealtimeSyncToggle
            enabled={envConfig.linearRealtimeSync || false}
            onToggle={(checked) => updateEnvConfig({ linearRealtimeSync: checked })}
          />

          {envConfig.linearRealtimeSync && <RealtimeSyncWarning />}

          <Separator />

          <TeamProjectIds
            teamId={envConfig.linearTeamId || ''}
            projectId={envConfig.linearProjectId || ''}
            onTeamIdChange={(value) => updateEnvConfig({ linearTeamId: value })}
            onProjectIdChange={(value) => updateEnvConfig({ linearProjectId: value })}
          />
        </>
      )}
    </div>
  );
}

interface ConnectionStatusProps {
  isChecking: boolean;
  connectionStatus: LinearSyncStatus | null;
}

function ConnectionStatus({ isChecking, connectionStatus }: ConnectionStatusProps) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">连接状态</p>
          <p className="text-xs text-muted-foreground">
            {isChecking ? '检查中...' :
              connectionStatus?.connected
                ? `已连接${connectionStatus.teamName ? `到 ${connectionStatus.teamName}` : ''}`
                : connectionStatus?.error || '未连接'}
          </p>
          {connectionStatus?.connected && connectionStatus.issueCount !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">
              {connectionStatus.issueCount}+ 个任务可导入
            </p>
          )}
        </div>
        {isChecking ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : connectionStatus?.connected ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <AlertCircle className="h-4 w-4 text-warning" />
        )}
      </div>
    </div>
  );
}

interface ImportTasksPromptProps {
  onOpenLinearImport: () => void;
}

function ImportTasksPrompt({ onOpenLinearImport }: ImportTasksPromptProps) {
  return (
    <div className="rounded-lg border border-info/30 bg-info/5 p-3">
      <div className="flex items-start gap-3">
        <Import className="h-5 w-5 text-info mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">导入现有任务</p>
          <p className="text-xs text-muted-foreground mt-1">
            选择要导入 AutoBuild 作为任务的 Linear 问题。
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={onOpenLinearImport}
          >
            <Import className="h-4 w-4 mr-2" />
            从 Linear 导入任务
          </Button>
        </div>
      </div>
    </div>
  );
}

interface RealtimeSyncToggleProps {
  enabled: boolean;
  onToggle: (checked: boolean) => void;
}

function RealtimeSyncToggle({ enabled, onToggle }: RealtimeSyncToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-info" />
          <Label className="font-normal text-foreground">实时同步</Label>
        </div>
        <p className="text-xs text-muted-foreground pl-6">
          自动导入在 Linear 中创建的新任务
        </p>
      </div>
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </div>
  );
}

function RealtimeSyncWarning() {
  return (
    <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 ml-6">
      <p className="text-xs text-warning">
        启用后，新的 Linear 问题将自动导入 AutoBuild。
        请确保在下方配置团队/项目筛选器以控制导入哪些问题。
      </p>
    </div>
  );
}

interface TeamProjectIdsProps {
  teamId: string;
  projectId: string;
  onTeamIdChange: (value: string) => void;
  onProjectIdChange: (value: string) => void;
}

function TeamProjectIds({ teamId, projectId, onTeamIdChange, onProjectIdChange }: TeamProjectIdsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">团队 ID（可选）</Label>
        <Input
          placeholder="自动检测"
          value={teamId}
          onChange={(e) => onTeamIdChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">项目 ID（可选）</Label>
        <Input
          placeholder="自动创建"
          value={projectId}
          onChange={(e) => onProjectIdChange(e.target.value)}
        />
      </div>
    </div>
  );
}
