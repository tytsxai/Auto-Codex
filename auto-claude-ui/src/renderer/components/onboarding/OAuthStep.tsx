import { useState, useEffect } from 'react';
import {
  Key,
  Eye,
  EyeOff,
  Info,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Star,
  Check,
  Pencil,
  X,
  LogIn,
  ChevronDown,
  ChevronRight,
  Users
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent } from '../ui/card';
import { cn } from '../../lib/utils';
import { loadClaudeProfiles as loadGlobalClaudeProfiles } from '../../stores/claude-profile-store';
import type { ClaudeProfile } from '../../../shared/types';

interface OAuthStepProps {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

/**
 * OAuth step component for the onboarding wizard.
 * Guides users through Claude profile management and OAuth authentication,
 * reusing patterns from IntegrationSettings.tsx.
 */
export function OAuthStep({ onNext, onBack, onSkip }: OAuthStepProps) {
  // Claude Profiles state
  const [claudeProfiles, setClaudeProfiles] = useState<ClaudeProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [newProfileName, setNewProfileName] = useState('');
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState('');
  const [authenticatingProfileId, setAuthenticatingProfileId] = useState<string | null>(null);

  // Manual token entry state
  const [expandedTokenProfileId, setExpandedTokenProfileId] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [manualTokenEmail, setManualTokenEmail] = useState('');
  const [showManualToken, setShowManualToken] = useState(false);
  const [savingTokenProfileId, setSavingTokenProfileId] = useState<string | null>(null);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Derived state: check if at least one profile is authenticated
  const hasAuthenticatedProfile = claudeProfiles.some(
    (profile) => profile.oauthToken || (profile.isDefault && profile.configDir)
  );

  // Reusable function to load Claude profiles
  const loadClaudeProfiles = async () => {
    setIsLoadingProfiles(true);
    setError(null);
    try {
      const result = await window.electronAPI.getClaudeProfiles();
      if (result.success && result.data) {
        setClaudeProfiles(result.data.profiles);
        setActiveProfileId(result.data.activeProfileId);
        // Also update the global store
        await loadGlobalClaudeProfiles();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载配置文件失败');
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  // Load Claude profiles on mount
  useEffect(() => {
    loadClaudeProfiles();
  }, []);

  // Listen for OAuth authentication completion
  useEffect(() => {
    const unsubscribe = window.electronAPI.onTerminalOAuthToken(async (info) => {
      if (info.success && info.profileId) {
        // Reload profiles to show updated state
        await loadClaudeProfiles();
        // Show simple success notification
        alert(`✅ 配置文件认证成功！\n\n${info.email ? `账户：${info.email}` : '认证完成。'}\n\n现在可以使用该配置文件。`);
      }
    });

    return unsubscribe;
  }, []);

  // Profile management handlers - following patterns from IntegrationSettings.tsx
  const handleAddProfile = async () => {
    if (!newProfileName.trim()) return;

    setIsAddingProfile(true);
    setError(null);
    try {
      const profileName = newProfileName.trim();
      const profileSlug = profileName.toLowerCase().replace(/\s+/g, '-');

      const result = await window.electronAPI.saveClaudeProfile({
        id: `profile-${Date.now()}`,
        name: profileName,
        configDir: `~/.claude-profiles/${profileSlug}`,
        isDefault: false,
        createdAt: new Date()
      });

      if (result.success && result.data) {
        // Initialize the profile (starts OAuth flow)
        const initResult = await window.electronAPI.initializeClaudeProfile(result.data.id);

        if (initResult.success) {
          await loadClaudeProfiles();
          setNewProfileName('');

          alert(
            `正在认证“${profileName}”...\n\n` +
            `将打开浏览器窗口，使用你的 Claude 账户登录。\n\n` +
            `认证完成后会自动保存。`
          );
        } else {
          await loadClaudeProfiles();
          alert(`启动认证失败：${initResult.error || '请重试。'}`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加配置文件失败');
      alert('添加配置文件失败。请重试。');
    } finally {
      setIsAddingProfile(false);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    setDeletingProfileId(profileId);
    setError(null);
    try {
      const result = await window.electronAPI.deleteClaudeProfile(profileId);
      if (result.success) {
        await loadClaudeProfiles();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除配置文件失败');
    } finally {
      setDeletingProfileId(null);
    }
  };

  const startEditingProfile = (profile: ClaudeProfile) => {
    setEditingProfileId(profile.id);
    setEditingProfileName(profile.name);
  };

  const cancelEditingProfile = () => {
    setEditingProfileId(null);
    setEditingProfileName('');
  };

  const handleRenameProfile = async () => {
    if (!editingProfileId || !editingProfileName.trim()) return;

    setError(null);
    try {
      const result = await window.electronAPI.renameClaudeProfile(editingProfileId, editingProfileName.trim());
      if (result.success) {
        await loadClaudeProfiles();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '重命名配置文件失败');
    } finally {
      setEditingProfileId(null);
      setEditingProfileName('');
    }
  };

  const handleSetActiveProfile = async (profileId: string) => {
    setError(null);
    try {
      const result = await window.electronAPI.setActiveClaudeProfile(profileId);
      if (result.success) {
        setActiveProfileId(profileId);
        await loadGlobalClaudeProfiles();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '设置当前配置文件失败');
    }
  };

  const handleAuthenticateProfile = async (profileId: string) => {
    setAuthenticatingProfileId(profileId);
    setError(null);
    try {
      const initResult = await window.electronAPI.initializeClaudeProfile(profileId);
      if (initResult.success) {
        alert(
          `正在认证配置文件...\n\n` +
          `将打开浏览器窗口，使用你的 Claude 账户登录。\n\n` +
          `认证完成后会自动保存。`
        );
      } else {
        alert(`启动认证失败：${initResult.error || '请重试。'}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '配置文件认证失败');
      alert('启动认证失败。请重试。');
    } finally {
      setAuthenticatingProfileId(null);
    }
  };

  const toggleTokenEntry = (profileId: string) => {
    if (expandedTokenProfileId === profileId) {
      setExpandedTokenProfileId(null);
      setManualToken('');
      setManualTokenEmail('');
      setShowManualToken(false);
    } else {
      setExpandedTokenProfileId(profileId);
      setManualToken('');
      setManualTokenEmail('');
      setShowManualToken(false);
    }
  };

  const handleSaveManualToken = async (profileId: string) => {
    if (!manualToken.trim()) return;

    setSavingTokenProfileId(profileId);
    setError(null);
    try {
      const result = await window.electronAPI.setClaudeProfileToken(
        profileId,
        manualToken.trim(),
        manualTokenEmail.trim() || undefined
      );
      if (result.success) {
        await loadClaudeProfiles();
        setExpandedTokenProfileId(null);
        setManualToken('');
        setManualTokenEmail('');
        setShowManualToken(false);
      } else {
        alert(`保存令牌失败：${result.error || '请重试。'}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存令牌失败');
      alert('保存令牌失败。请重试。');
    } finally {
      setSavingTokenProfileId(null);
    }
  };

  const handleContinue = () => {
    onNext();
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users className="h-7 w-7" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            配置 Claude 认证
          </h1>
          <p className="mt-2 text-muted-foreground">
            添加 Claude 账户以启用 AI 功能
          </p>
        </div>

        {/* Loading state */}
        {isLoadingProfiles && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Profile management UI - placeholder for subtask-1-4 */}
        {!isLoadingProfiles && (
          <div className="space-y-6">
            {/* Error banner */}
            {error && (
              <Card className="border border-destructive/30 bg-destructive/10">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Info card */}
            <Card className="border border-info/30 bg-info/10">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <Info className="h-5 w-5 text-info shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      添加多个 Claude 订阅，在达到速率限制时可自动切换。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Profile list */}
            <div className="rounded-lg bg-muted/30 border border-border p-4">
              {claudeProfiles.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center mb-4">
                  <p className="text-sm text-muted-foreground">尚未配置任何账户</p>
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {claudeProfiles.map((profile) => (
                    <div
                      key={profile.id}
                      className={cn(
                        "rounded-lg border transition-colors",
                        profile.id === activeProfileId
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background"
                      )}
                    >
                      <div className={cn(
                        "flex items-center justify-between p-3",
                        expandedTokenProfileId !== profile.id && "hover:bg-muted/50"
                      )}>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0",
                            profile.id === activeProfileId
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}>
                            {(editingProfileId === profile.id ? editingProfileName : profile.name).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            {editingProfileId === profile.id ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={editingProfileName}
                                  onChange={(e) => setEditingProfileName(e.target.value)}
                                  className="h-7 text-sm w-40"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRenameProfile();
                                    if (e.key === 'Escape') cancelEditingProfile();
                                  }}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={handleRenameProfile}
                                  className="h-7 w-7 text-success hover:text-success hover:bg-success/10"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={cancelEditingProfile}
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium text-foreground">{profile.name}</span>
                                  {profile.isDefault && (
                                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">默认</span>
                                  )}
                                  {profile.id === activeProfileId && (
                                    <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded flex items-center gap-1">
                                      <Star className="h-3 w-3" />
                                      当前
                                    </span>
                                  )}
                                  {(profile.oauthToken || (profile.isDefault && profile.configDir)) ? (
                                    <span className="text-xs bg-success/20 text-success px-1.5 py-0.5 rounded flex items-center gap-1">
                                      <Check className="h-3 w-3" />
                                      已认证
                                    </span>
                                  ) : (
                                    <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded">
                                      需要认证
                                    </span>
                                  )}
                                </div>
                                {profile.email && (
                                  <span className="text-xs text-muted-foreground">{profile.email}</span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        {editingProfileId !== profile.id && (
                          <div className="flex items-center gap-1">
                            {/* Authenticate button - show if not authenticated */}
                            {!profile.oauthToken && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAuthenticateProfile(profile.id)}
                                disabled={authenticatingProfileId === profile.id}
                                className="gap-1 h-7 text-xs"
                              >
                                {authenticatingProfileId === profile.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <LogIn className="h-3 w-3" />
                                )}
                                认证
                              </Button>
                            )}
                            {profile.id !== activeProfileId && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSetActiveProfile(profile.id)}
                                className="gap-1 h-7 text-xs"
                              >
                                <Check className="h-3 w-3" />
                                设为当前
                              </Button>
                            )}
                            {/* Toggle token entry button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleTokenEntry(profile.id)}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title={expandedTokenProfileId === profile.id ? "隐藏令牌输入" : "手动输入令牌"}
                            >
                              {expandedTokenProfileId === profile.id ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => startEditingProfile(profile)}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="重命名配置文件"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            {!profile.isDefault && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteProfile(profile.id)}
                                disabled={deletingProfileId === profile.id}
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="删除配置文件"
                              >
                                {deletingProfileId === profile.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Expanded token entry section */}
                      {expandedTokenProfileId === profile.id && (
                        <div className="px-3 pb-3 pt-0 border-t border-border/50 mt-0">
                          <div className="bg-muted/30 rounded-lg p-3 mt-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-medium text-muted-foreground">
                                手动输入令牌
                              </Label>
                              <span className="text-xs text-muted-foreground">
                                运行 <code className="px-1 py-0.5 bg-muted rounded font-mono text-xs">claude setup-token</code> 获取令牌
                              </span>
                            </div>

                            <div className="space-y-2">
                              <div className="relative">
                                <Input
                                  type={showManualToken ? 'text' : 'password'}
                                  placeholder="sk-ant-oat01-..."
                                  value={manualToken}
                                  onChange={(e) => setManualToken(e.target.value)}
                                  className="pr-10 font-mono text-xs h-8"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowManualToken(!showManualToken)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                  {showManualToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </button>
                              </div>

                              <Input
                                type="email"
                                placeholder="邮箱（可选，用于显示）"
                                value={manualTokenEmail}
                                onChange={(e) => setManualTokenEmail(e.target.value)}
                                className="text-xs h-8"
                              />
                            </div>

                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleTokenEntry(profile.id)}
                                className="h-7 text-xs"
                              >
                                取消
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSaveManualToken(profile.id)}
                                disabled={!manualToken.trim() || savingTokenProfileId === profile.id}
                                className="h-7 text-xs gap-1"
                              >
                                {savingTokenProfileId === profile.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="h-3 w-3" />
                                )}
                                保存令牌
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add new account input */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="账户名称（例如：工作、个人）"
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
                  onClick={handleAddProfile}
                  disabled={!newProfileName.trim() || isAddingProfile}
                  size="sm"
                  className="gap-1 shrink-0"
                >
                  {isAddingProfile ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  添加
                </Button>
              </div>
            </div>

            {/* Success state when profiles are authenticated */}
            {hasAuthenticatedProfile && (
              <Card className="border border-success/30 bg-success/10">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <p className="text-sm text-success">
                      你至少有一个已认证的 Claude 账户，可以继续下一步。
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-10 pt-6 border-t border-border">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground"
          >
            上一步
          </Button>
          <div className="flex gap-4">
            <Button
              variant="ghost"
              onClick={onSkip}
              className="text-muted-foreground hover:text-foreground"
            >
              跳过
            </Button>
            <Button
              onClick={handleContinue}
              disabled={!hasAuthenticatedProfile}
            >
              继续
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
