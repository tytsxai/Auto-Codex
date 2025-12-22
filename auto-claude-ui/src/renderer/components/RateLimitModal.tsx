import { useEffect, useState } from 'react';
import { AlertCircle, ExternalLink, Clock, RefreshCw, User, ChevronDown, Check, Zap, Star, Plus } from 'lucide-react';
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
import { useClaudeProfileStore, loadClaudeProfiles, switchTerminalToProfile } from '../stores/claude-profile-store';

const CLAUDE_UPGRADE_URL = 'https://claude.ai/upgrade';

export function RateLimitModal() {
  const { isModalOpen, rateLimitInfo, hideRateLimitModal, clearPendingRateLimit } = useRateLimitStore();
  const { profiles, activeProfileId, isSwitching } = useClaudeProfileStore();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [autoSwitchEnabled, setAutoSwitchEnabled] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

  // 模态框打开时加载配置文件和自动切换设置
  useEffect(() => {
    if (isModalOpen) {
      loadClaudeProfiles();
      loadAutoSwitchSettings();

      // 若有建议的配置文件则预选
      if (rateLimitInfo?.suggestedProfileId) {
        setSelectedProfileId(rateLimitInfo.suggestedProfileId);
      }
    }
  }, [isModalOpen, rateLimitInfo?.suggestedProfileId]);

  // 模态框关闭时重置选择
  useEffect(() => {
    if (!isModalOpen) {
      setSelectedProfileId(null);
      setIsAddingProfile(false);
      setNewProfileName('');
    }
  }, [isModalOpen]);

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
    window.open(CLAUDE_UPGRADE_URL, '_blank');
  };

  const handleAddProfile = async () => {
    if (!newProfileName.trim()) return;

    setIsAddingProfile(true);
    try {
      // 创建新配置文件 - 后端会设置正确的 configDir
      const profileName = newProfileName.trim();
      const profileSlug = profileName.toLowerCase().replace(/\s+/g, '-');
      
      const result = await window.electronAPI.saveClaudeProfile({
        id: `profile-${Date.now()}`,
        name: profileName,
        // 使用占位路径 - 后端会解析实际路径
        configDir: `~/.claude-profiles/${profileSlug}`,
        isDefault: false,
        createdAt: new Date()
      });

      if (result.success && result.data) {
        // 初始化配置文件（创建终端并运行 claude setup-token）
        const initResult = await window.electronAPI.initializeClaudeProfile(result.data.id);
        
        if (initResult.success) {
          // 重新加载配置文件
          loadClaudeProfiles();
          setNewProfileName('');
          // 关闭模态框以便用户查看终端
          hideRateLimitModal();
          
          // 提示用户查看终端
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

  const handleSwitchProfile = async () => {
    if (!selectedProfileId || !rateLimitInfo?.terminalId) return;

    const success = await switchTerminalToProfile(rateLimitInfo.terminalId, selectedProfileId);
    if (success) {
      // 切换成功后清除待处理的速率限制
      clearPendingRateLimit();
    }
  };

  // 获取非当前触发速率限制的配置文件
  const currentProfileId = rateLimitInfo?.profileId || activeProfileId;
  const availableProfiles = profiles.filter(p => p.id !== currentProfileId);
  const hasMultipleProfiles = profiles.length > 1;

  const selectedProfile = selectedProfileId
    ? profiles.find(p => p.id === selectedProfileId)
    : null;

  const currentProfile = profiles.find(p => p.id === currentProfileId);
  const suggestedProfile = rateLimitInfo?.suggestedProfileId
    ? profiles.find(p => p.id === rateLimitInfo.suggestedProfileId)
    : null;

  // 检查是否已经自动切换
  const autoSwitchHappened = rateLimitInfo?.autoSwitchEnabled && suggestedProfile;

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && hideRateLimitModal()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <AlertCircle className="h-5 w-5" />
            已达到 Claude Code 使用上限
          </DialogTitle>
          <DialogDescription>
            您已达到本周期的 Claude Code 使用上限。
            {currentProfile && !currentProfile.isDefault && (
              <span className="text-muted-foreground">（账号：{currentProfile.name}）</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* 自动切换提示 */}
          {autoSwitchHappened && (
            <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
              <Zap className="h-5 w-5 text-green-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  正在自动切换到 {suggestedProfile?.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Claude 将自动使用其他账号重启
                </p>
              </div>
            </div>
          )}

          {/* 重置时间信息 */}
          {rateLimitInfo?.resetTime && !autoSwitchHappened && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
              <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  将在 {rateLimitInfo.resetTime} 重置
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  该时间将恢复使用额度
                </p>
              </div>
            </div>
          )}

          {/* 账号切换/添加账号区域 - 未自动切换时显示 */}
          {!autoSwitchHappened && (
            <div className="rounded-lg border border-accent/50 bg-accent/10 p-4">
              <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <User className="h-4 w-4" />
                {hasMultipleProfiles ? '切换 Claude 账号' : '使用其他账号'}
              </h4>
              
              {hasMultipleProfiles ? (
                <>
                  <p className="text-sm text-muted-foreground mb-3">
                    {suggestedProfile ? (
                      <>推荐：<strong>{suggestedProfile.name}</strong> 还有更多可用额度。</>
                    ) : (
                      '您已配置其他 Claude 订阅，切换后可继续工作：'
                    )}
                  </p>

                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="flex-1 justify-between">
                          <span className="truncate flex items-center gap-2">
                            {selectedProfile?.name || '选择账号...'}
                            {selectedProfileId === rateLimitInfo?.suggestedProfileId && (
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
                              {profile.id === rateLimitInfo?.suggestedProfileId && (
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
                            // 聚焦添加账号输入框
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
                      onClick={handleSwitchProfile}
                      disabled={!selectedProfileId || isSwitching}
                      className="gap-2 shrink-0"
                    >
                      {isSwitching ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          正在切换...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          切换
                        </>
                      )}
                    </Button>
                  </div>

                  {selectedProfile?.description && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {selectedProfile.description}
                    </p>
                  )}

                  {/* 自动切换开关 */}
                  {availableProfiles.length > 0 && (
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                      <Label htmlFor="auto-switch" className="text-xs text-muted-foreground cursor-pointer">
                        触发速率限制时自动切换
                      </Label>
                      <Switch
                        id="auto-switch"
                        checked={autoSwitchEnabled}
                        onCheckedChange={handleAutoSwitchToggle}
                        disabled={isLoadingSettings}
                      />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground mb-3">
                  添加另一个 Claude 订阅，以便在触发速率限制时自动切换。
                </p>
              )}

              {/* 添加新账号区域 */}
              <div className={hasMultipleProfiles ? "mt-4 pt-3 border-t border-border/50" : ""}>
                <p className="text-xs text-muted-foreground mb-2">
                  {hasMultipleProfiles ? '添加另一个账号：' : '连接 Claude 账号：'}
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
                  将打开 Claude 登录以认证新账号。
                </p>
              </div>
            </div>
          )}

          {/* 升级提示 */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <h4 className="text-sm font-medium text-foreground mb-2">
              升级以获得更多使用额度
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              升级 Claude 订阅以获得更高的使用上限。
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={hideRateLimitModal}>
            {autoSwitchHappened ? '继续' : hasMultipleProfiles ? '关闭' : '知道了'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
