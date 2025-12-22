import { useState, useEffect } from 'react';
import {
  AlertCircle,
  Key,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  Info,
  LogIn,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from './ui/tooltip';
import { cn } from '../lib/utils';
import type { ClaudeProfile } from '../../shared/types';

interface EnvConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigured?: () => void;
  title?: string;
  description?: string;
  projectId?: string;
}

export function EnvConfigModal({
  open,
  onOpenChange,
  onConfigured,
  title = '需要 Claude 身份验证',
  description = '使用构思和路线图生成等 AI 功能需要 Claude Code OAuth 令牌。',
  projectId
}: EnvConfigModalProps) {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [hasExistingToken, setHasExistingToken] = useState(false);
  const [claudeProfiles, setClaudeProfiles] = useState<Array<{
    id: string;
    name: string;
    oauthToken?: string;
    email?: string;
    isDefault: boolean;
  }>>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);

  // 模态框打开时加载 Claude 配置文件并检查令牌状态
  useEffect(() => {
    const loadData = async () => {
      if (!open) return;

      setIsChecking(true);
      setIsLoadingProfiles(true);
      setError(null);
      setSuccess(false);

      try {
        // 并行加载令牌状态和 Claude 配置文件
        const [tokenResult, profilesResult] = await Promise.all([
          window.electronAPI.checkSourceToken(),
          window.electronAPI.getClaudeProfiles()
        ]);

        // 处理令牌状态
        if (tokenResult.success && tokenResult.data) {
          setSourcePath(tokenResult.data.sourcePath || null);
          setHasExistingToken(tokenResult.data.hasToken);

          if (tokenResult.data.hasToken) {
            // 令牌存在，显示成功状态
            setSuccess(true);
          }
        } else {
          setError(tokenResult.error || '检查令牌状态失败');
        }

        // 处理 Claude 配置文件
        if (profilesResult.success && profilesResult.data) {
          const authenticatedProfiles = profilesResult.data.profiles.filter(
            (p: ClaudeProfile) => p.oauthToken || (p.isDefault && p.configDir)
          );
          setClaudeProfiles(authenticatedProfiles);

          // 自动选择首个已认证的配置文件
          if (authenticatedProfiles.length > 0 && !selectedProfileId) {
            setSelectedProfileId(authenticatedProfiles[0].id);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '未知错误');
      } finally {
        setIsChecking(false);
        setIsLoadingProfiles(false);
      }
    };

    loadData();
  }, [open]);

  // 监听终端返回的 OAuth 令牌
  useEffect(() => {
    if (!open) return;

    const cleanup = window.electronAPI.onTerminalOAuthToken(async (info) => {
      if (info.success) {
        // 令牌由主进程自动保存到配置文件
        // 仅更新 UI 状态以反映认证成功
        setSuccess(true);
        setHasExistingToken(true);
        setIsAuthenticating(false);

        // 通知父组件
        setTimeout(() => {
          onConfigured?.();
          onOpenChange(false);
        }, 1500);
      }
    });

    return cleanup;
  }, [open, onConfigured, onOpenChange]);

  const handleUseExistingProfile = async () => {
    if (!selectedProfileId) return;

    setIsSaving(true);
    setError(null);

    try {
      // 获取选中配置文件的令牌
      const profile = claudeProfiles.find(p => p.id === selectedProfileId);
      if (!profile?.oauthToken) {
        setError('选中的账号没有有效令牌');
        setIsSaving(false);
        return;
      }

      // 将令牌保存到 auto-claude .env
      const result = await window.electronAPI.updateSourceEnv({
        claudeOAuthToken: profile.oauthToken
      });

      if (result.success) {
        setSuccess(true);
        setHasExistingToken(true);

        // 通知父组件
        setTimeout(() => {
          onConfigured?.();
          onOpenChange(false);
        }, 1500);
      } else {
        setError(result.error || '保存令牌失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAuthenticateWithBrowser = async () => {
    if (!projectId) {
      setError('未选择项目，请先选择项目。');
      return;
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      // 在终端中触发 Claude setup-token 流程
      const result = await window.electronAPI.invokeClaudeSetup(projectId);

      if (!result.success) {
        setError(result.error || '启动认证失败');
        setIsAuthenticating(false);
      }
      // 保持 isAuthenticating 为 true - 收到令牌后会清除
    } catch (err) {
      setError(err instanceof Error ? err.message : '启动认证失败');
      setIsAuthenticating(false);
    }
  };

  const handleSave = async () => {
    if (!token.trim()) {
      setError('请输入令牌');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await window.electronAPI.updateSourceEnv({
        claudeOAuthToken: token.trim()
      });

      if (result.success) {
        setSuccess(true);
        setHasExistingToken(true);
        setToken(''); // 清空输入

        // 通知父组件配置完成
        setTimeout(() => {
          onConfigured?.();
          onOpenChange(false);
        }, 1500);
      } else {
        setError(result.error || '保存令牌失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText('claude setup-token');
  };

  const handleOpenDocs = () => {
    // 打开 Claude Code 文档以获取令牌
    window.open('https://docs.anthropic.com/en/docs/claude-code', '_blank');
  };

  const handleClose = () => {
    if (!isSaving) {
      setToken('');
      setError(null);
      setSuccess(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Key className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* 加载状态 */}
        {isChecking && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* 成功状态 */}
        {!isChecking && success && (
          <div className="py-4">
            <div className="rounded-lg bg-success/10 border border-success/30 p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-success">
                  令牌配置成功
                </p>
                <p className="text-xs text-success/80 mt-1">
                  现在可以使用构思和路线图生成等 AI 功能。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 配置表单 */}
        {!isChecking && !success && (
          <div className="py-4 space-y-4">
            {/* 错误提示 */}
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* 选项 1：使用已有已认证配置文件 */}
            {!isLoadingProfiles && claudeProfiles.length > 0 && (
              <div className="space-y-3">
                <div className="rounded-lg bg-success/10 border border-success/30 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-foreground font-medium mb-1">
                        使用已有账号
                      </p>
                      <p className="text-xs text-muted-foreground">
                        你有 {claudeProfiles.length} 个已认证的 Claude 账号。请选择一个使用：
                      </p>
                    </div>
                  </div>
                </div>

                {/* 配置文件选择器 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">
                    选择账号
                  </Label>
                  <div className="space-y-2">
                    {claudeProfiles.map((profile) => (
                      <button
                        key={profile.id}
                        onClick={() => setSelectedProfileId(profile.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors text-left",
                          selectedProfileId === profile.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className={cn(
                          "h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                          selectedProfileId === profile.id
                            ? "border-primary"
                            : "border-muted-foreground"
                        )}>
                          {selectedProfileId === profile.id && (
                            <div className="h-2 w-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {profile.name}
                            {profile.isDefault && (
                              <span className="ml-2 text-xs text-muted-foreground">（默认）</span>
                            )}
                          </p>
                          {profile.email && (
                            <p className="text-xs text-muted-foreground truncate">
                              {profile.email}
                            </p>
                          )}
                        </div>
                        <CheckCircle2 className={cn(
                          "h-4 w-4 shrink-0",
                          selectedProfileId === profile.id ? "text-primary" : "text-transparent"
                        )} />
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleUseExistingProfile}
                  disabled={!selectedProfileId || isSaving}
                  className="w-full"
                  size="lg"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      正在保存...
                    </>
                  ) : (
                    <>
                      <Key className="mr-2 h-5 w-5" />
                      使用此账号
                    </>
                  )}
                </Button>

                {/* 分隔线 */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">或</span>
                  </div>
                </div>
              </div>
            )}

            {/* 选项 2：通过浏览器认证新账号 */}
            {!isLoadingProfiles && (
              <div className="space-y-3">
                <div className="rounded-lg bg-info/10 border border-info/30 p-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-info shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-foreground font-medium mb-1">
                        {claudeProfiles.length > 0 ? '或认证新账号' : '使用浏览器认证'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {claudeProfiles.length > 0
                          ? '通过浏览器登录添加新的 Claude 账号。'
                          : '点击下方打开浏览器并登录 Claude 账号。'
                        }
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleAuthenticateWithBrowser}
                  disabled={isAuthenticating}
                  className="w-full"
                  size="lg"
                  variant={claudeProfiles.length > 0 ? "outline" : "default"}
                >
                  {isAuthenticating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      等待认证...
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-5 w-5" />
                      {claudeProfiles.length > 0 ? '认证新账号' : '使用浏览器认证'}
                    </>
                  )}
                </Button>

                {isAuthenticating && (
                  <p className="text-xs text-muted-foreground text-center">
                    应会打开浏览器窗口，请在其中完成认证，然后返回此处。
                  </p>
                )}
              </div>
            )}

            {/* 手动输入前的分隔线 */}
            {!isLoadingProfiles && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">或</span>
                </div>
              </div>
            )}

            {/* 次选：手动输入令牌（可折叠） */}
            <div className="space-y-3">
              <button
                onClick={() => setShowManualEntry(!showManualEntry)}
                className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>手动输入令牌</span>
                {showManualEntry ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>

              {showManualEntry && (
                <div className="space-y-3 pl-4 border-l-2 border-border">
                  {/* 手动令牌说明 */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">步骤：</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>如果尚未安装，请先安装 Claude Code CLI</li>
                      <li>
                        运行{' '}
                        <code className="px-1 py-0.5 bg-muted rounded font-mono">
                          claude setup-token
                        </code>
                        {' '}
                        <button
                          onClick={handleCopyCommand}
                          className="inline-flex items-center text-info hover:text-info/80"
                        >
                          <Copy className="h-3 w-3 ml-1" />
                        </button>
                      </li>
                      <li>复制令牌并粘贴到下方</li>
                    </ol>
                    <button
                      onClick={handleOpenDocs}
                      className="text-info hover:text-info/80 flex items-center gap-1 mt-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                      查看文档
                    </button>
                  </div>

                  {/* 令牌输入 */}
                  <div className="space-y-2">
                    <Label htmlFor="token" className="text-sm font-medium text-foreground">
                      Claude Code OAuth 令牌
                    </Label>
                    <div className="relative">
                      <Input
                        id="token"
                        type={showToken ? 'text' : 'password'}
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="输入你的令牌..."
                        className="pr-10 font-mono text-sm"
                        disabled={isSaving || isAuthenticating}
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setShowToken(!showToken)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showToken ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {showToken ? '隐藏令牌' : '显示令牌'}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      令牌将保存到{' '}
                      <code className="px-1 py-0.5 bg-muted rounded font-mono">
                        {sourcePath ? `${sourcePath}/.env` : 'auto-claude/.env'}
                      </code>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 已有令牌信息 */}
            {hasExistingToken && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">
                  已配置过令牌。{showManualEntry ? '可在上方输入新令牌替换。' : '重新认证以替换。'}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving || isAuthenticating}>
            {success ? '关闭' : '取消'}
          </Button>
          {!success && showManualEntry && token.trim() && (
            <Button onClick={handleSave} disabled={isSaving || isAuthenticating}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在保存...
                </>
              ) : (
                <>
                  <Key className="mr-2 h-4 w-4" />
                  保存令牌
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 检查 Claude 令牌是否已配置的 Hook
 * 返回 { hasToken, isLoading, checkToken }
 */
export function useClaudeTokenCheck() {
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkToken = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.checkSourceToken();
      if (result.success && result.data) {
        setHasToken(result.data.hasToken);
      } else {
        setHasToken(false);
        setError(result.error || '检查令牌失败');
      }
    } catch (err) {
      setHasToken(false);
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkToken();
  }, []);

  return { hasToken, isLoading, error, checkToken };
}
