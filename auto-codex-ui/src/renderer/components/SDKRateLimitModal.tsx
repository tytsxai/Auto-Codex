import { useEffect, useState } from 'react';
import { AlertCircle, ExternalLink, Clock, RefreshCw, User, ChevronDown, Check, Star, Zap, FileText, ListTodo, Map, Lightbulb, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { useRateLimitStore } from '../stores/rate-limit-store';
import { useCodexProfileStore, loadCodexProfiles } from '../stores/codex-profile-store';
import type { SDKRateLimitInfo } from '../../shared/types';

const CODEX_UPGRADE_URL = 'https://codex.ai/upgrade';

/**
 * Get a human-readable name for the source
 */
function getSourceName(source: SDKRateLimitInfo['source']): string {
  switch (source) {
    case 'changelog': return '变更日志生成';
    case 'task': return '任务执行';
    case 'roadmap': return '路线图生成';
    case 'ideation': return '构思';
    case 'title-generator': return '标题生成';
    default: return 'Codex 操作';
  }
}

/**
 * Get an icon for the source
 */
function getSourceIcon(source: SDKRateLimitInfo['source']) {
  switch (source) {
    case 'changelog': return FileText;
    case 'task': return ListTodo;
    case 'roadmap': return Map;
    case 'ideation': return Lightbulb;
    default: return AlertCircle;
  }
}

export function SDKRateLimitModal() {
  const { isSDKModalOpen, sdkRateLimitInfo, hideSDKRateLimitModal, clearPendingRateLimit } = useRateLimitStore();
  const { profiles, isSwitching, setSwitching } = useCodexProfileStore();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [autoSwitchEnabled, setAutoSwitchEnabled] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [swapInfo, setSwapInfo] = useState<{
    wasAutoSwapped: boolean;
    swapReason?: 'proactive' | 'reactive';
    swappedFrom?: string;
    swappedTo?: string;
  } | null>(null);

  // Load profiles and auto-switch settings when modal opens
  useEffect(() => {
    if (isSDKModalOpen) {
      loadCodexProfiles();
      loadAutoSwitchSettings();

      // Pre-select the suggested profile if available
      if (sdkRateLimitInfo?.suggestedProfile?.id) {
        setSelectedProfileId(sdkRateLimitInfo.suggestedProfile.id);
      }

      // Set swap info if auto-swap occurred
      if (sdkRateLimitInfo) {
        setSwapInfo({
          wasAutoSwapped: sdkRateLimitInfo.wasAutoSwapped ?? false,
          swapReason: sdkRateLimitInfo.swapReason,
          swappedFrom: profiles.find(p => p.id === sdkRateLimitInfo.profileId)?.name,
          swappedTo: sdkRateLimitInfo.swappedToProfile?.name
        });
      }
    }
  }, [isSDKModalOpen, sdkRateLimitInfo, profiles]);

  // Reset selection when modal closes
  useEffect(() => {
    if (!isSDKModalOpen) {
      setSelectedProfileId(null);
      setIsRetrying(false);
      setIsAddingProfile(false);
      setNewProfileName('');
    }
  }, [isSDKModalOpen]);

  const loadAutoSwitchSettings = async () => {
    try {
      const result = await window.electronAPI.getAutoSwitchSettings();
      if (result.success && result.data) {
        setAutoSwitchEnabled(result.data.autoSwitchOnRateLimit);
      }
    } catch (err) {
      console.error('Failed to load auto-switch settings:', err);
    }
  };

  const handleAutoSwitchToggle = async (enabled: boolean) => {
    setIsLoadingSettings(true);
    try {
      await window.electronAPI.updateAutoSwitchSettings({
        enabled: enabled,
        autoSwitchOnRateLimit: enabled
      });
      setAutoSwitchEnabled(enabled);
    } catch (err) {
      console.error('Failed to update auto-switch settings:', err);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleUpgrade = () => {
    window.open(CODEX_UPGRADE_URL, '_blank');
  };

  const handleAddProfile = async () => {
    if (!newProfileName.trim()) return;

    setIsAddingProfile(true);
    try {
      // Create a new profile - the backend will set the proper configDir
      const profileName = newProfileName.trim();
      const profileSlug = profileName.toLowerCase().replace(/\s+/g, '-');
      
      const result = await window.electronAPI.saveCodexProfile({
        id: `profile-${Date.now()}`,
        name: profileName,
        // Use a placeholder - the backend will resolve the actual path
        configDir: `~/.codex-profiles/${profileSlug}`,
        isDefault: false,
        createdAt: new Date()
      });

      if (result.success && result.data) {
        // Initialize the profile (creates terminal and runs codex login)
        const initResult = await window.electronAPI.initializeCodexProfile(result.data.id);
        
        if (initResult.success) {
          // Reload profiles
          loadCodexProfiles();
          setNewProfileName('');
          // Close the modal so user can see the terminal
          hideSDKRateLimitModal();
          
          // Alert the user about the terminal
          alert(
            `已打开终端以认证“${profileName}”。\n\n` +
            `完成步骤：\n` +
            `1. 查看侧边栏中的“代理终端”区域\n` +
            `2. 在浏览器中完成 OAuth 登录\n` +
            `3. 令牌将自动保存\n\n` +
            `完成后返回此处，账号即可使用。`
          );
        } else {
          alert(`启动认证失败：${initResult.error || '请重试。'}`);
        }
      }
    } catch (err) {
      console.error('Failed to add profile:', err);
      alert('添加账号失败。请重试。');
    } finally {
      setIsAddingProfile(false);
    }
  };

  const handleRetryWithProfile = async () => {
    if (!selectedProfileId || !sdkRateLimitInfo?.projectId) return;

    setIsRetrying(true);
    setSwitching(true);

    try {
      // First, set the active profile
      await window.electronAPI.setActiveCodexProfile(selectedProfileId);

      // Then retry the operation
      const result = await window.electronAPI.retryWithProfile({
        source: sdkRateLimitInfo.source,
        projectId: sdkRateLimitInfo.projectId,
        taskId: sdkRateLimitInfo.taskId,
        profileId: selectedProfileId
      });

      if (result.success) {
        // Clear the pending rate limit since we successfully switched
        clearPendingRateLimit();
      }
    } catch (err) {
      console.error('Failed to retry with profile:', err);
    } finally {
      setIsRetrying(false);
      setSwitching(false);
    }
  };

  if (!sdkRateLimitInfo) return null;

  // Get profiles that are not the current rate-limited one
  const currentProfileId = sdkRateLimitInfo.profileId;
  const availableProfiles = profiles.filter(p => p.id !== currentProfileId);
  const hasMultipleProfiles = profiles.length > 1;

  const selectedProfile = selectedProfileId
    ? profiles.find(p => p.id === selectedProfileId)
    : null;

  const currentProfile = profiles.find(p => p.id === currentProfileId);
  const suggestedProfile = sdkRateLimitInfo.suggestedProfile
    ? profiles.find(p => p.id === sdkRateLimitInfo.suggestedProfile?.id)
    : null;

  const SourceIcon = getSourceIcon(sdkRateLimitInfo.source);
  const sourceName = getSourceName(sdkRateLimitInfo.source);

  return (
    <Dialog open={isSDKModalOpen} onOpenChange={(open) => !open && hideSDKRateLimitModal()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <AlertCircle className="h-5 w-5" />
            Codex Code 速率限制
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <SourceIcon className="h-4 w-4" />
            {sourceName} 因使用限制而中断。
            {currentProfile && (
              <span className="text-muted-foreground">（账号：{currentProfile.name}）</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Swap notification info */}
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
            {swapInfo?.wasAutoSwapped ? (
              <>
                <p className="font-medium mb-1">
                  {swapInfo.swapReason === 'proactive' ? '✓ 主动切换' : '⚡ 被动切换'}
                </p>
                <p>
                  {swapInfo.swapReason === 'proactive'
                    ? `在达到速率限制前已自动从 ${swapInfo.swappedFrom} 切换到 ${swapInfo.swappedTo}。`
                    : `${swapInfo.swappedFrom} 触发速率限制，已自动切换到 ${swapInfo.swappedTo} 并重新开始。`
                  }
                </p>
                <p className="mt-2 text-[10px]">
                  工作已无中断继续进行。
                </p>
              </>
            ) : (
              <>
                <p className="font-medium mb-1">已达到速率限制</p>
                <p>
                  操作已停止，因为 {currentProfile?.name || '您的账号'} 达到使用上限。
                  {hasMultipleProfiles
                    ? ' 请在下方切换到其他账号以继续。'
                    : ' 添加其他 Codex 账号以继续工作。'}
                </p>
              </>
            )}
          </div>

          {/* Upgrade button */}
          <Button
            variant="default"
            size="sm"
            className="gap-2 w-full"
            onClick={() => window.open(CODEX_UPGRADE_URL, '_blank')}
          >
            <Zap className="h-4 w-4" />
            升级到 Pro 以获得更高上限
          </Button>

          {/* Reset time info */}
          {sdkRateLimitInfo.resetTime && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
              <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  将在 {sdkRateLimitInfo.resetTime} 重置
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sdkRateLimitInfo.limitType === 'weekly'
                    ? '周度限制 - 大约一周后重置'
                    : '会话限制 - 几小时后重置'}
                </p>
              </div>
            </div>
          )}

          {/* Profile switching / Add account section */}
          <div className="rounded-lg border border-accent/50 bg-accent/10 p-4">
            <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <User className="h-4 w-4" />
              {hasMultipleProfiles ? '切换账号并重试' : '使用其他账号'}
            </h4>
            
            {hasMultipleProfiles ? (
              <>
                <p className="text-sm text-muted-foreground mb-3">
                    {suggestedProfile ? (
                      <>推荐：<strong>{suggestedProfile.name}</strong> 还有更多可用额度。</>
                    ) : (
                      '切换到其他 Codex 账号并重试操作：'
                    )}
                  </p>

                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex-1 justify-between">
                        <span className="truncate flex items-center gap-2">
                          {selectedProfile?.name || '选择账号...'}
                          {selectedProfileId === sdkRateLimitInfo.suggestedProfile?.id && (
                            <Star className="h-3 w-3 text-yellow-500" />
                          )}
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[220px] bg-popover border border-border shadow-lg">
                      {availableProfiles.map((profile) => (
                        <DropdownMenuItem
                          key={profile.id}
                          onClick={() => setSelectedProfileId(profile.id)}
                          className="flex items-center justify-between"
                        >
                          <span className="truncate flex items-center gap-2">
                            {profile.name}
                            {profile.id === sdkRateLimitInfo.suggestedProfile?.id && (
                              <Star className="h-3 w-3 text-yellow-500" aria-label="推荐" />
                            )}
                          </span>
                          {selectedProfileId === profile.id && (
                            <Check className="h-4 w-4 shrink-0" />
                          )}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          // Focus the add account input
                          const input = document.querySelector('input[placeholder*="账号名称"]') as HTMLInputElement;
                          if (input) input.focus();
                        }}
                        className="flex items-center gap-2 text-muted-foreground"
                      >
                        <Plus className="h-4 w-4" />
                        添加新账号...
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleRetryWithProfile}
                    disabled={!selectedProfileId || isRetrying || isSwitching}
                    className="gap-2 shrink-0"
                  >
                    {isRetrying || isSwitching ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          正在重试...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          重试
                        </>
                      )}
                    </Button>
                  </div>

                {selectedProfile?.description && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {selectedProfile.description}
                  </p>
                )}

                {/* Auto-switch toggle */}
                {availableProfiles.length > 0 && (
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                      <Label htmlFor="sdk-auto-switch" className="text-xs text-muted-foreground cursor-pointer">
                        触发速率限制时自动切换并重试
                      </Label>
                      <Switch
                      id="sdk-auto-switch"
                      checked={autoSwitchEnabled}
                      onCheckedChange={handleAutoSwitchToggle}
                      disabled={isLoadingSettings}
                    />
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground mb-3">
                添加另一个 Codex 订阅，以便在触发速率限制时自动切换。
              </p>
            )}

            {/* Add new account section */}
            <div className={hasMultipleProfiles ? "mt-4 pt-3 border-t border-border/50" : ""}>
              <p className="text-xs text-muted-foreground mb-2">
                {hasMultipleProfiles ? '添加另一个账号：' : '连接 Codex 账号：'}
              </p>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="账号名称（如：工作、个人）"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  className="flex-1 h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newProfileName.trim()) {
                      handleAddProfile();
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddProfile}
                  disabled={!newProfileName.trim() || isAddingProfile}
                  className="gap-1 shrink-0"
                >
                  {isAddingProfile ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  添加
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                将打开 Codex 登录以认证新账号。
              </p>
            </div>
          </div>

          {/* Upgrade prompt */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <h4 className="text-sm font-medium text-foreground mb-2">
              升级以获得更多使用额度
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              升级 Codex 订阅以获得更高的使用上限。
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleUpgrade}
            >
              <ExternalLink className="h-4 w-4" />
              升级订阅
            </Button>
          </div>

          {/* Info about what was interrupted */}
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
            <p className="font-medium mb-1">发生了什么：</p>
            <p>
              {sourceName.toLowerCase()} 操作已停止，因为您的 Codex 账号
              （{currentProfile?.name || '默认账号'}）达到使用上限。
              {hasMultipleProfiles
                ? ' 您可以切换到其他账号并重试，或在上方添加更多账号。'
                : ' 在上方添加其他 Codex 账号以继续工作，或等待限制重置。'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={hideSDKRateLimitModal}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
