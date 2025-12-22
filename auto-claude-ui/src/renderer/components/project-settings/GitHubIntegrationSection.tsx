import { useState } from 'react';
import { Github, RefreshCw, KeyRound, Info } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';
import { StatusBadge } from './StatusBadge';
import { PasswordInput } from './PasswordInput';
import { ConnectionStatus } from './ConnectionStatus';
import { GitHubOAuthFlow } from './GitHubOAuthFlow';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { Button } from '../ui/button';
import type { ProjectEnvConfig, GitHubSyncStatus } from '../../../shared/types';

interface GitHubIntegrationSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  envConfig: ProjectEnvConfig;
  onUpdateConfig: (updates: Partial<ProjectEnvConfig>) => void;
  gitHubConnectionStatus: GitHubSyncStatus | null;
  isCheckingGitHub: boolean;
  projectName?: string;
}

export function GitHubIntegrationSection({
  isExpanded,
  onToggle,
  envConfig,
  onUpdateConfig,
  gitHubConnectionStatus,
  isCheckingGitHub,
  projectName,
}: GitHubIntegrationSectionProps) {
  const [showOAuthFlow, setShowOAuthFlow] = useState(false);

  const badge = envConfig.githubEnabled ? (
    <StatusBadge status="success" label="已启用" />
  ) : null;

  const handleOAuthSuccess = (token: string, _username?: string) => {
    onUpdateConfig({ githubToken: token });
    setShowOAuthFlow(false);
  };

  return (
    <CollapsibleSection
      title="GitHub 集成"
      icon={<Github className="h-4 w-4" />}
      isExpanded={isExpanded}
      onToggle={onToggle}
      badge={badge}
    >
      {/* 项目专属配置提示 */}
      {projectName && (
        <div className="rounded-lg border border-info/30 bg-info/5 p-3 mb-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-info mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">项目专属配置</p>
              <p className="text-xs text-muted-foreground mt-1">
                此 GitHub 仓库仅为 <span className="font-semibold text-foreground">{projectName}</span> 配置。
                每个项目都可以拥有自己的 GitHub 仓库。
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="font-normal text-foreground">启用 GitHub 问题</Label>
          <p className="text-xs text-muted-foreground">
            从 GitHub 同步问题并自动创建任务
          </p>
        </div>
        <Switch
          checked={envConfig.githubEnabled}
          onCheckedChange={(checked) => onUpdateConfig({ githubEnabled: checked })}
        />
      </div>

      {envConfig.githubEnabled && (
        <>
          {showOAuthFlow ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground">GitHub 认证</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowOAuthFlow(false)}
                >
                  使用手动令牌
                </Button>
              </div>
              <GitHubOAuthFlow
                onSuccess={handleOAuthSuccess}
                onCancel={() => setShowOAuthFlow(false)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground">个人访问令牌</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOAuthFlow(true)}
                  className="gap-2"
                >
                  <KeyRound className="h-3 w-3" />
                  改用 OAuth
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                在{' '}
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=Auto-Build-UI"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info hover:underline"
                >
                  GitHub 设置
                </a>
                创建带 <code className="px-1 bg-muted rounded">repo</code> 权限的令牌
              </p>
              <PasswordInput
                value={envConfig.githubToken || ''}
                onChange={(value) => onUpdateConfig({ githubToken: value })}
                placeholder="ghp_xxxxxxxx 或 github_pat_xxxxxxxx"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">仓库</Label>
            <p className="text-xs text-muted-foreground">
              格式：<code className="px-1 bg-muted rounded">owner/repo</code>（例如：facebook/react）
            </p>
            <Input
              placeholder="owner/仓库名"
              value={envConfig.githubRepo || ''}
              onChange={(e) => onUpdateConfig({ githubRepo: e.target.value })}
            />
          </div>

          {/* 连接状态 */}
          {envConfig.githubToken && envConfig.githubRepo && (
            <ConnectionStatus
              isChecking={isCheckingGitHub}
              isConnected={gitHubConnectionStatus?.connected || false}
              title="连接状态"
              successMessage={`已连接到 ${gitHubConnectionStatus?.repoFullName}`}
              errorMessage={gitHubConnectionStatus?.error || '未连接'}
              additionalInfo={gitHubConnectionStatus?.repoDescription}
            />
          )}

          {/* 访问问题的说明 */}
          {gitHubConnectionStatus?.connected && (
            <div className="rounded-lg border border-info/30 bg-info/5 p-3">
              <div className="flex items-start gap-3">
                <Github className="h-5 w-5 text-info mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">可用问题</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    从侧边栏访问 GitHub 问题，以查看、调查并从问题创建任务。
                  </p>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* 自动同步开关 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-info" />
                <Label className="font-normal text-foreground">加载时自动同步</Label>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                项目加载时自动获取问题
              </p>
            </div>
            <Switch
              checked={envConfig.githubAutoSync || false}
              onCheckedChange={(checked) => onUpdateConfig({ githubAutoSync: checked })}
            />
          </div>
        </>
      )}
    </CollapsibleSection>
  );
}
