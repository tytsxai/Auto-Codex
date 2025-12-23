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
import type { CodexProfile } from '../../shared/types';

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
  title = '需要 Codex 身份验证',
  description = '使用构思和路线图生成等 AI 功能需要 Codex 认证：可用 OPENAI_API_KEY、OAuth 令牌，或本地 Codex CLI 配置（~/.codex/auth.json 或 ~/.codex/config.toml）。',
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
  const [codexProfiles, setCodexProfiles] = useState<Array<{
    id: string;
    name: string;
    oauthToken?: string;
    email?: string;
    isDefault: boolean;
    isAuthenticated?: boolean;
  }>>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);

  const isCodexProfileUsable = (profile: CodexProfile): boolean => {
    if (typeof profile.isAuthenticated === 'boolean') return profile.isAuthenticated;
    return Boolean(profile.oauthToken || (profile.isDefault && profile.configDir));
  };

  // 模态框打开时加载 Codex 配置文件并检查令牌状态
  useEffect(() => {
    const loadData = async () => {
      if (!open) return;

      setIsChecking(true);
      setIsLoadingProfiles(true);
      setError(null);
      setSuccess(false);

      try {
        // 并行加载令牌状态和 Codex 配置文件
        const [tokenResult, profilesResult] = await Promise.all([
          window.electronAPI.checkSourceToken(),
          window.electronAPI.getCodexProfiles()
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

        // 处理 Codex 配置文件
        if (profilesResult.success && profilesResult.data) {
          const authenticatedProfiles = profilesResult.data.profiles.filter(
            (p: CodexProfile) => isCodexProfileUsable(p)
          );
          setCodexProfiles(authenticatedProfiles);

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
  }, [open, selectedProfileId]);

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
      const profile = codexProfiles.find(p => p.id === selectedProfileId);
      if (!profile) {
        setError('未找到所选账号');
        return;
      }

      if (!isCodexProfileUsable(profile as CodexProfile)) {
        setError('选中的账号没有有效令牌或可用的 Codex CLI 配置（~/.codex/auth.json 或 ~/.codex/config.toml）。');
        return;
      }

      // 切换当前 Codex Profile（主进程会把正确的认证环境注入到后续 AI 子进程中）
      // 注意：不要把 token 写入 auto-codex/.env（避免泄露且不支持非 OAuth 的 API Key 配置）。
      const result = await window.electronAPI.setActiveCodexProfile(selectedProfileId);

      if (result.success) {
        setSuccess(true);
        setHasExistingToken(true);

        // 通知父组件
        setTimeout(() => {
          onConfigured?.();
          onOpenChange(false);
        }, 1500);
      } else {
        setError(result.error || '切换账号失败');
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
      // 在终端中触发 Codex login 流程
      const result = await window.electronAPI.invokeCodexSetup(projectId);

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
        codexOAuthToken: token.trim()
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
    navigator.clipboard.writeText('codex login --device-auth');
  };

  const handleOpenDocs = () => {
    // 打开 Codex Code 文档以获取令牌
    window.open('https://docs.anthropic.com/en/docs/codex-code', '_blank');
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
                  认证配置成功
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
            {!isLoadingProfiles && codexProfiles.length > 0 && (
              <div className="space-y-3">
                <div className="rounded-lg bg-success/10 border border-success/30 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-foreground font-medium mb-1">
                        使用已有账号
                      </p>
                      <p className="text-xs text-muted-foreground">
                        你有 {codexProfiles.length} 个已认证的 Codex 账号。请选择一个使用：
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
                    {codexProfiles.map((profile) => (
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
                        {codexProfiles.length > 0 ? '或认证新账号' : '使用浏览器认证'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {codexProfiles.length > 0
                          ? '通过浏览器登录添加新的 Codex 账号。'
                          : '点击下方打开浏览器并登录 Codex 账号。'
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
                  variant={codexProfiles.length > 0 ? "outline" : "default"}
                >
                  {isAuthenticating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      等待认证...
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-5 w-5" />
                      {codexProfiles.length > 0 ? '认证新账号' : '使用浏览器认证'}
                    </>
                  )}
                </Button>

                {isAuthenticating && (
                  <p className="text-xs text-muted-foreground text-center">
                    应会打开浏览器窗口完成认证；若未自动弹出，请在终端打开提示的登录链接。
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

            {/* 次选：手动输入 OAuth 令牌（可折叠） */}
            <div className="space-y-3">
              <button
                onClick={() => setShowManualEntry(!showManualEntry)}
                className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>手动输入 OAuth 令牌</span>
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
                      <li>如果尚未安装，请先安装 Codex CLI</li>
                      <li>
                        运行{' '}
                        <code className="px-1 py-0.5 bg-muted rounded font-mono">
                          codex login --device-auth
                        </code>
                        {' '}
                        <button
                          onClick={handleCopyCommand}
                          className="inline-flex items-center text-info hover:text-info/80"
                        >
                          <Copy className="h-3 w-3 ml-1" />
                        </button>
                      </li>
                      <li>完成登录后，如 CLI 输出 OAuth 令牌，请复制并粘贴到下方</li>
                    </ol>
                    <p className="text-xs text-muted-foreground">
                      API Key 登录：运行{' '}
                      <code className="px-1 py-0.5 bg-muted rounded font-mono">
                        printenv OPENAI_API_KEY | codex login --with-api-key
                      </code>
                      （会写入{' '}
                      <code className="px-1 py-0.5 bg-muted rounded font-mono">~/.codex/auth.json</code>
                      ，无需粘贴到这里）。你也可以在{' '}
                      <code className="px-1 py-0.5 bg-muted rounded font-mono">auto-codex/.env</code>{' '}
                      中设置{' '}
                      <code className="px-1 py-0.5 bg-muted rounded font-mono">OPENAI_API_KEY</code>。
                    </p>
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
                      Codex Code OAuth 令牌
                    </Label>
                    <div className="relative">
                      <Input
                        id="token"
                        type={showToken ? 'text' : 'password'}
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="oat01-...（CODEX_CODE_OAUTH_TOKEN）"
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
                        {sourcePath ? `${sourcePath}/.env` : 'auto-codex/.env'}
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
                  已配置过认证信息。{showManualEntry ? '可在上方输入新令牌替换。' : '重新认证以替换。'}
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
 * 检查 Codex 令牌是否已配置的 Hook
 * 返回 { hasToken, isLoading, checkToken }
 */
export function useCodexTokenCheck() {
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
