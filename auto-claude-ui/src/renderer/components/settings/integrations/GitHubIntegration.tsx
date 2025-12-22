import { useState, useEffect } from 'react';
import { Github, RefreshCw, KeyRound, Loader2, CheckCircle2, AlertCircle, User, Lock, Globe, ChevronDown, GitBranch } from 'lucide-react';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Separator } from '../../ui/separator';
import { Button } from '../../ui/button';
import { GitHubOAuthFlow } from '../../project-settings/GitHubOAuthFlow';
import { PasswordInput } from '../../project-settings/PasswordInput';
import type { ProjectEnvConfig, GitHubSyncStatus } from '../../../../shared/types';

// 调试日志
const DEBUG = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true';
function debugLog(message: string, data?: unknown) {
  if (DEBUG) {
    if (data !== undefined) {
      console.warn(`[GitHubIntegration] ${message}`, data);
    } else {
      console.warn(`[GitHubIntegration] ${message}`);
    }
  }
}

interface GitHubRepo {
  fullName: string;
  description: string | null;
  isPrivate: boolean;
}

interface GitHubIntegrationProps {
  envConfig: ProjectEnvConfig | null;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;
  showGitHubToken: boolean;
  setShowGitHubToken: React.Dispatch<React.SetStateAction<boolean>>;
  gitHubConnectionStatus: GitHubSyncStatus | null;
  isCheckingGitHub: boolean;
  projectPath?: string; // 用于获取 git 分支的项目路径
}

/**
 * GitHub 集成设置组件。
 * 管理 GitHub 令牌（手动或 OAuth）、仓库配置和连接状态。
 */
export function GitHubIntegration({
  envConfig,
  updateEnvConfig,
  showGitHubToken: _showGitHubToken,
  setShowGitHubToken: _setShowGitHubToken,
  gitHubConnectionStatus,
  isCheckingGitHub,
  projectPath
}: GitHubIntegrationProps) {
  const [authMode, setAuthMode] = useState<'manual' | 'oauth' | 'oauth-success'>('manual');
  const [oauthUsername, setOauthUsername] = useState<string | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);

  // 分支选择状态
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [branchesError, setBranchesError] = useState<string | null>(null);

  debugLog('Render - authMode:', authMode);
  debugLog('Render - projectPath:', projectPath);
  debugLog('Render - envConfig:', envConfig ? { githubEnabled: envConfig.githubEnabled, hasToken: !!envConfig.githubToken, defaultBranch: envConfig.defaultBranch } : null);

  // 进入 oauth-success 模式时获取仓库
  useEffect(() => {
    if (authMode === 'oauth-success') {
      fetchUserRepos();
    }
  }, [authMode]);

  // 当启用 GitHub 且项目路径可用时获取分支
  useEffect(() => {
    debugLog(`useEffect[branches] - githubEnabled: ${envConfig?.githubEnabled}, projectPath: ${projectPath}`);
    if (envConfig?.githubEnabled && projectPath) {
      debugLog('useEffect[branches] - Triggering fetchBranches');
      fetchBranches();
    } else {
      debugLog('useEffect[branches] - Skipping fetchBranches (conditions not met)');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envConfig?.githubEnabled, projectPath]);

  const fetchBranches = async () => {
    if (!projectPath) {
      debugLog('fetchBranches: No projectPath, skipping');
      return;
    }

    debugLog('fetchBranches: Starting with projectPath:', projectPath);
    setIsLoadingBranches(true);
    setBranchesError(null);

    try {
      debugLog('fetchBranches: Calling getGitBranches...');
      const result = await window.electronAPI.getGitBranches(projectPath);
      debugLog('fetchBranches: getGitBranches result:', { success: result.success, dataType: typeof result.data, dataLength: Array.isArray(result.data) ? result.data.length : 'N/A', error: result.error });

      // result.data 直接是数组（不是 { branches: [] }）
      if (result.success && result.data) {
        setBranches(result.data);
        debugLog('fetchBranches: Loaded branches:', result.data.length);

        // 如果未设置则自动检测默认分支
        if (!envConfig?.defaultBranch) {
          debugLog('fetchBranches: No defaultBranch set, auto-detecting...');
          const detectResult = await window.electronAPI.detectMainBranch(projectPath);
          debugLog('fetchBranches: detectMainBranch result:', detectResult);
          if (detectResult.success && detectResult.data) {
            debugLog('fetchBranches: Auto-detected default branch:', detectResult.data);
            updateEnvConfig({ defaultBranch: detectResult.data });
          }
        }
      } else {
        debugLog('fetchBranches: Failed -', result.error || 'No data returned');
        setBranchesError(result.error || 'Failed to load branches');
      }
    } catch (err) {
      debugLog('fetchBranches: Exception:', err);
      setBranchesError(err instanceof Error ? err.message : 'Failed to load branches');
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const fetchUserRepos = async () => {
    debugLog('Fetching user repositories...');
    setIsLoadingRepos(true);
    setReposError(null);

    try {
      const result = await window.electronAPI.listGitHubUserRepos();
      debugLog('listGitHubUserRepos result:', result);

      if (result.success && result.data?.repos) {
        setRepos(result.data.repos);
        debugLog('Loaded repos:', result.data.repos.length);
      } else {
        setReposError(result.error || 'Failed to load repositories');
      }
    } catch (err) {
      debugLog('Error fetching repos:', err);
      setReposError(err instanceof Error ? err.message : 'Failed to load repositories');
    } finally {
      setIsLoadingRepos(false);
    }
  };

  if (!envConfig) {
    debugLog('No envConfig, returning null');
    return null;
  }

  const handleOAuthSuccess = (token: string, username?: string) => {
    debugLog('handleOAuthSuccess called with token length:', token.length);
    debugLog('OAuth username:', username);

    // 更新令牌
    updateEnvConfig({ githubToken: token });

    // 显示带用户名的成功状态
    setOauthUsername(username || null);
    setAuthMode('oauth-success');
  };

  const handleSwitchToManual = () => {
    setAuthMode('manual');
    setOauthUsername(null);
  };

  const handleSwitchToOAuth = () => {
    setAuthMode('oauth');
  };

  const handleSelectRepo = (repoFullName: string) => {
    debugLog('Selected repo:', repoFullName);
    updateEnvConfig({ githubRepo: repoFullName });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="font-normal text-foreground">启用 GitHub Issues</Label>
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
          {/* OAuth 成功状态 */}
          {authMode === 'oauth-success' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-success/30 bg-success/10 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <div>
                      <p className="text-sm font-medium text-success">已通过 GitHub CLI 连接</p>
                      {oauthUsername && (
                        <p className="text-xs text-success/80 flex items-center gap-1 mt-0.5">
                          <User className="h-3 w-3" />
                          已认证为 {oauthUsername}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSwitchToManual}
                    className="text-xs"
                  >
                    使用其他令牌
                  </Button>
                </div>
              </div>

              {/* 仓库下拉选择 */}
              <RepositoryDropdown
                repos={repos}
                selectedRepo={envConfig.githubRepo || ''}
                isLoading={isLoadingRepos}
                error={reposError}
                onSelect={handleSelectRepo}
                onRefresh={fetchUserRepos}
                onManualEntry={() => setAuthMode('manual')}
              />
            </div>
          )}

          {/* OAuth 流程 */}
          {authMode === 'oauth' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground">GitHub 认证</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSwitchToManual}
                >
                  使用手动令牌
                </Button>
              </div>
              <GitHubOAuthFlow
                onSuccess={handleOAuthSuccess}
                onCancel={handleSwitchToManual}
              />
            </div>
          )}

          {/* 手动令牌输入 */}
          {authMode === 'manual' && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-foreground">个人访问令牌</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSwitchToOAuth}
                    className="gap-2"
                  >
                    <KeyRound className="h-3 w-3" />
                    使用 OAuth 代替
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  从{' '}
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=Auto-Build-UI"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-info hover:underline"
                  >
                    GitHub 设置
                  </a>
                  {' '}创建具有 <code className="px-1 bg-muted rounded">repo</code> 权限的令牌
                </p>
                <PasswordInput
                  value={envConfig.githubToken || ''}
                  onChange={(value) => updateEnvConfig({ githubToken: value })}
                  placeholder="ghp_xxxxxxxx or github_pat_xxxxxxxx"
                />
              </div>

              <RepositoryInput
                value={envConfig.githubRepo || ''}
                onChange={(value) => updateEnvConfig({ githubRepo: value })}
              />
            </>
          )}

          {envConfig.githubToken && envConfig.githubRepo && (
            <ConnectionStatus
              isChecking={isCheckingGitHub}
              connectionStatus={gitHubConnectionStatus}
            />
          )}

          {gitHubConnectionStatus?.connected && <IssuesAvailableInfo />}

          <Separator />

          {/* 默认分支选择器 */}
          {projectPath && (
            <BranchSelector
              branches={branches}
              selectedBranch={envConfig.defaultBranch || ''}
              isLoading={isLoadingBranches}
              error={branchesError}
              onSelect={(branch) => updateEnvConfig({ defaultBranch: branch })}
              onRefresh={fetchBranches}
            />
          )}

          <Separator />

          <AutoSyncToggle
            enabled={envConfig.githubAutoSync || false}
            onToggle={(checked) => updateEnvConfig({ githubAutoSync: checked })}
          />
        </>
      )}
    </div>
  );
}

interface RepositoryDropdownProps {
  repos: GitHubRepo[];
  selectedRepo: string;
  isLoading: boolean;
  error: string | null;
  onSelect: (repoFullName: string) => void;
  onRefresh: () => void;
  onManualEntry: () => void;
}

function RepositoryDropdown({
  repos,
  selectedRepo,
  isLoading,
  error,
  onSelect,
  onRefresh,
  onManualEntry
}: RepositoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const filteredRepos = repos.filter(repo =>
    repo.fullName.toLowerCase().includes(filter.toLowerCase()) ||
    (repo.description?.toLowerCase().includes(filter.toLowerCase()))
  );

  const selectedRepoData = repos.find(r => r.fullName === selectedRepo);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-foreground">仓库</Label>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-7 px-2"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onManualEntry}
            className="h-7 text-xs"
          >
            手动输入
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading}
          className="w-full flex items-center justify-between px-3 py-2 text-sm border border-input rounded-md bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在加载仓库...
            </span>
          ) : selectedRepo ? (
            <span className="flex items-center gap-2">
              {selectedRepoData?.isPrivate ? (
                <Lock className="h-3 w-3 text-muted-foreground" />
              ) : (
                <Globe className="h-3 w-3 text-muted-foreground" />
              )}
              {selectedRepo}
            </span>
          ) : (
            <span className="text-muted-foreground">选择仓库...</span>
          )}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && !isLoading && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-hidden">
            {/* 搜索过滤 */}
            <div className="p-2 border-b border-border">
              <Input
                placeholder="搜索仓库..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-8 text-sm"
                autoFocus
              />
            </div>

            {/* 仓库列表 */}
            <div className="max-h-48 overflow-y-auto">
              {filteredRepos.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  {filter ? '没有匹配的仓库' : '未找到仓库'}
                </div>
              ) : (
                filteredRepos.map((repo) => (
                  <button
                    key={repo.fullName}
                    type="button"
                    onClick={() => {
                      onSelect(repo.fullName);
                      setIsOpen(false);
                      setFilter('');
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-accent flex items-start gap-2 ${
                      repo.fullName === selectedRepo ? 'bg-accent' : ''
                    }`}
                  >
                    {repo.isPrivate ? (
                      <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    ) : (
                      <Globe className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{repo.fullName}</p>
                      {repo.description && (
                        <p className="text-xs text-muted-foreground truncate">{repo.description}</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {selectedRepo && (
        <p className="text-xs text-muted-foreground">
          已选择: <code className="px-1 bg-muted rounded">{selectedRepo}</code>
        </p>
      )}
    </div>
  );
}

interface RepositoryInputProps {
  value: string;
  onChange: (value: string) => void;
}

function RepositoryInput({ value, onChange }: RepositoryInputProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">仓库</Label>
      <p className="text-xs text-muted-foreground">
        格式: <code className="px-1 bg-muted rounded">owner/repo</code> (例如 facebook/react)
      </p>
      <Input
        placeholder="所有者/仓库名"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

interface ConnectionStatusProps {
  isChecking: boolean;
  connectionStatus: GitHubSyncStatus | null;
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
                ? `已连接到 ${connectionStatus.repoFullName}`
                : connectionStatus?.error || '未连接'}
          </p>
          {connectionStatus?.connected && connectionStatus.repoDescription && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              {connectionStatus.repoDescription}
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

function IssuesAvailableInfo() {
  return (
    <div className="rounded-lg border border-info/30 bg-info/5 p-3">
      <div className="flex items-start gap-3">
        <Github className="h-5 w-5 text-info mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Issues 可用</p>
          <p className="text-xs text-muted-foreground mt-1">
            从侧边栏访问 GitHub Issues，查看、调查并从问题创建任务。
          </p>
        </div>
      </div>
    </div>
  );
}

interface AutoSyncToggleProps {
  enabled: boolean;
  onToggle: (checked: boolean) => void;
}

function AutoSyncToggle({ enabled, onToggle }: AutoSyncToggleProps) {
  return (
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
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </div>
  );
}

interface BranchSelectorProps {
  branches: string[];
  selectedBranch: string;
  isLoading: boolean;
  error: string | null;
  onSelect: (branch: string) => void;
  onRefresh: () => void;
}

function BranchSelector({
  branches,
  selectedBranch,
  isLoading,
  error,
  onSelect,
  onRefresh
}: BranchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const filteredBranches = branches.filter(branch =>
    branch.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-info" />
            <Label className="text-sm font-medium text-foreground">默认分支</Label>
          </div>
          <p className="text-xs text-muted-foreground pl-6">
            创建任务工作树的基础分支
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-7 px-2"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive pl-6">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}

      <div className="relative pl-6">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading}
          className="w-full flex items-center justify-between px-3 py-2 text-sm border border-input rounded-md bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在加载分支...
            </span>
          ) : selectedBranch ? (
            <span className="flex items-center gap-2">
              <GitBranch className="h-3 w-3 text-muted-foreground" />
              {selectedBranch}
            </span>
          ) : (
            <span className="text-muted-foreground">自动检测 (main/master)</span>
          )}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && !isLoading && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-hidden">
            {/* 搜索过滤 */}
            <div className="p-2 border-b border-border">
              <Input
                placeholder="搜索分支..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-8 text-sm"
                autoFocus
              />
            </div>

            {/* 自动检测选项 */}
            <button
              type="button"
              onClick={() => {
                onSelect('');
                setIsOpen(false);
                setFilter('');
              }}
              className={`w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2 ${
                !selectedBranch ? 'bg-accent' : ''
              }`}
            >
              <span className="text-sm text-muted-foreground italic">自动检测 (main/master)</span>
            </button>

            {/* 分支列表 */}
            <div className="max-h-40 overflow-y-auto border-t border-border">
              {filteredBranches.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  {filter ? '没有匹配的分支' : '未找到分支'}
                </div>
              ) : (
                filteredBranches.map((branch) => (
                  <button
                    key={branch}
                    type="button"
                    onClick={() => {
                      onSelect(branch);
                      setIsOpen(false);
                      setFilter('');
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2 ${
                      branch === selectedBranch ? 'bg-accent' : ''
                    }`}
                  >
                    <GitBranch className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{branch}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {selectedBranch && (
        <p className="text-xs text-muted-foreground pl-6">
          所有新任务将从 <code className="px-1 bg-muted rounded">{selectedBranch}</code> 分支创建
        </p>
      )}
    </div>
  );
}
