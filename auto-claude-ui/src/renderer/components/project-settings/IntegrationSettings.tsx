import { useState, useEffect } from 'react';
import {
  Zap,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Import,
  Radio,
  Github,
  RefreshCw,
  GitBranch
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import type { ProjectEnvConfig, LinearSyncStatus, GitHubSyncStatus, Project, ProjectSettings as ProjectSettingsType } from '../../../shared/types';

interface IntegrationSettingsProps {
  envConfig: ProjectEnvConfig | null;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;

  // 主分支的项目设置
  project: Project;
  settings: ProjectSettingsType;
  setSettings: React.Dispatch<React.SetStateAction<ProjectSettingsType>>;

  // Linear 状态
  showLinearKey: boolean;
  setShowLinearKey: React.Dispatch<React.SetStateAction<boolean>>;
  linearConnectionStatus: LinearSyncStatus | null;
  isCheckingLinear: boolean;
  linearExpanded: boolean;
  onLinearToggle: () => void;
  onOpenLinearImport: () => void;

  // GitHub 状态
  showGitHubToken: boolean;
  setShowGitHubToken: React.Dispatch<React.SetStateAction<boolean>>;
  gitHubConnectionStatus: GitHubSyncStatus | null;
  isCheckingGitHub: boolean;
  githubExpanded: boolean;
  onGitHubToggle: () => void;
}

export function IntegrationSettings({
  envConfig,
  updateEnvConfig,
  project,
  settings,
  setSettings,
  showLinearKey,
  setShowLinearKey,
  linearConnectionStatus,
  isCheckingLinear,
  linearExpanded,
  onLinearToggle,
  onOpenLinearImport,
  showGitHubToken,
  setShowGitHubToken,
  gitHubConnectionStatus,
  isCheckingGitHub,
  githubExpanded,
  onGitHubToggle
}: IntegrationSettingsProps) {
  // 分支选择状态
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

  // GitHub 区域展开时加载分支
  useEffect(() => {
    if (githubExpanded && project.path) {
      loadBranches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 为避免无限循环，刻意排除 loadBranches
  }, [githubExpanded, project.path]);

  const loadBranches = async () => {
    setIsLoadingBranches(true);
    try {
      const result = await window.electronAPI.getGitBranches(project.path);
      if (result.success && result.data) {
        setBranches(result.data);
        // 如果未设置则自动检测主分支
        if (!settings.mainBranch) {
          const detectResult = await window.electronAPI.detectMainBranch(project.path);
          if (detectResult.success && detectResult.data) {
            setSettings(prev => ({ ...prev, mainBranch: detectResult.data! }));
          }
        }
      }
    } catch (error) {
      console.error('Failed to load branches:', error);
    } finally {
      setIsLoadingBranches(false);
    }
  };

  if (!envConfig) return null;

  return (
    <>
      {/* Linear 集成区域 */}
      <section className="space-y-3">
        <button
          onClick={onLinearToggle}
          className="w-full flex items-center justify-between text-sm font-semibold text-foreground hover:text-foreground/80"
        >
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Linear 集成
            {envConfig.linearEnabled && (
              <span className="px-2 py-0.5 text-xs bg-success/10 text-success rounded-full">
                已启用
              </span>
            )}
          </div>
          {linearExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {linearExpanded && (
          <div className="space-y-4 pl-6 pt-2">
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

                {/* 连接状态 */}
                {envConfig.linearApiKey && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">连接状态</p>
                        <p className="text-xs text-muted-foreground">
                          {isCheckingLinear ? '检查中...' :
                            linearConnectionStatus?.connected
                              ? `已连接${linearConnectionStatus.teamName ? `到 ${linearConnectionStatus.teamName}` : ''}`
                              : linearConnectionStatus?.error || '未连接'}
                        </p>
                        {linearConnectionStatus?.connected && linearConnectionStatus.issueCount !== undefined && (
                          <p className="text-xs text-muted-foreground mt-1">
                            可导入 {linearConnectionStatus.issueCount}+ 个任务
                          </p>
                        )}
                      </div>
                      {isCheckingLinear ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : linearConnectionStatus?.connected ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-warning" />
                      )}
                    </div>
                  </div>
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
                          onClick={onOpenLinearImport}
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
                    onCheckedChange={(checked) => updateEnvConfig({ linearRealtimeSync: checked })}
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
                      onChange={(e) => updateEnvConfig({ linearTeamId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">项目 ID（可选）</Label>
                    <Input
                      placeholder="自动创建"
                      value={envConfig.linearProjectId || ''}
                      onChange={(e) => updateEnvConfig({ linearProjectId: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <Separator />

      {/* GitHub 集成区域 */}
      <section className="space-y-3">
        <button
          onClick={onGitHubToggle}
          className="w-full flex items-center justify-between text-sm font-semibold text-foreground hover:text-foreground/80"
        >
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4" />
            GitHub 集成
            {envConfig.githubEnabled && (
              <span className="px-2 py-0.5 text-xs bg-success/10 text-success rounded-full">
                已启用
              </span>
            )}
          </div>
          {githubExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {githubExpanded && (
          <div className="space-y-4 pl-6 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-normal text-foreground">启用 GitHub 问题</Label>
                <p className="text-xs text-muted-foreground">
                  从 GitHub 同步问题并自动创建任务
                </p>
              </div>
              <Switch
                checked={envConfig.githubEnabled}
                onCheckedChange={(checked) => updateEnvConfig({ githubEnabled: checked })}
              />
            </div>

            {envConfig.githubEnabled && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">个人访问令牌</Label>
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
                  <div className="relative">
                    <Input
                      type={showGitHubToken ? 'text' : 'password'}
                      placeholder="ghp_xxxxxxxx 或 github_pat_xxxxxxxx"
                      value={envConfig.githubToken || ''}
                      onChange={(e) => updateEnvConfig({ githubToken: e.target.value })}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGitHubToken(!showGitHubToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showGitHubToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">仓库</Label>
                  <p className="text-xs text-muted-foreground">
                    格式：<code className="px-1 bg-muted rounded">owner/repo</code>（例如：facebook/react）
                  </p>
                  <Input
                    placeholder="owner/仓库名"
                    value={envConfig.githubRepo || ''}
                    onChange={(e) => updateEnvConfig({ githubRepo: e.target.value })}
                  />
                </div>

                {/* 连接状态 */}
                {envConfig.githubToken && envConfig.githubRepo && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">连接状态</p>
                        <p className="text-xs text-muted-foreground">
                          {isCheckingGitHub ? '检查中...' :
                            gitHubConnectionStatus?.connected
                              ? `已连接到 ${gitHubConnectionStatus.repoFullName}`
                              : gitHubConnectionStatus?.error || '未连接'}
                        </p>
                        {gitHubConnectionStatus?.connected && gitHubConnectionStatus.repoDescription && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            {gitHubConnectionStatus.repoDescription}
                          </p>
                        )}
                      </div>
                      {isCheckingGitHub ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : gitHubConnectionStatus?.connected ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-warning" />
                      )}
                    </div>
                  </div>
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
                    onCheckedChange={(checked) => updateEnvConfig({ githubAutoSync: checked })}
                  />
                </div>

                <Separator />

                {/* 主分支选择 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-info" />
                    <Label className="text-sm font-medium text-foreground">主分支</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    用于创建任务工作树的基础分支。所有新任务都将从此分支创建。
                  </p>
                  <Select
                    value={settings.mainBranch || ''}
                    onValueChange={(value) => setSettings(prev => ({ ...prev, mainBranch: value }))}
                    disabled={isLoadingBranches || branches.length === 0}
                  >
                    <SelectTrigger>
                      {isLoadingBranches ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>正在加载分支...</span>
                        </div>
                      ) : (
                        <SelectValue placeholder="选择主分支" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch} value={branch}>
                          {branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {settings.mainBranch && (
                    <p className="text-xs text-muted-foreground">
                      任务将从 <code className="px-1 bg-muted rounded">{settings.mainBranch}</code> 创建分支，例如 <code className="px-1 bg-muted rounded">auto-claude/task-name</code>
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </>
  );
}
