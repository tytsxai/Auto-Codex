import { useState, useEffect } from 'react';
import {
  Key,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  Globe,
  Check,
  Star,
  Settings,
  Users
} from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { cn } from '../../lib/utils';
import type { ProjectEnvConfig, CodexProfile } from '../../../shared/types';

interface EnvironmentSettingsProps {
  envConfig: ProjectEnvConfig | null;
  isLoadingEnv: boolean;
  envError: string | null;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;

  // Codex auth state
  isCheckingCodexAuth: boolean;
  codexAuthStatus: 'checking' | 'authenticated' | 'not_authenticated' | 'error';
  handleCodexSetup: () => Promise<void>;

  // Password visibility (kept for interface compatibility but not used)
  showCodexToken: boolean;
  setShowCodexToken: React.Dispatch<React.SetStateAction<boolean>>;

  // Collapsible section
  expanded: boolean;
  onToggle: () => void;
}

export function EnvironmentSettings({
  envConfig,
  isLoadingEnv,
  envError,
  isCheckingCodexAuth,
  codexAuthStatus,
  handleCodexSetup,
  expanded,
  onToggle
}: EnvironmentSettingsProps) {
  // Load global Codex profiles to show active account
  const [codexProfiles, setCodexProfiles] = useState<CodexProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  useEffect(() => {
    const loadProfiles = async () => {
      setIsLoadingProfiles(true);
      try {
        const result = await window.electronAPI.getCodexProfiles();
        if (result.success && result.data) {
          setCodexProfiles(result.data.profiles);
          setActiveProfileId(result.data.activeProfileId);
        }
      } catch (err) {
        console.error('Failed to load Codex profiles:', err);
      } finally {
        setIsLoadingProfiles(false);
      }
    };
    loadProfiles();
  }, []);

  const activeProfile = codexProfiles.find(p => p.id === activeProfileId);
  const isProfileAuthenticated = (profile: CodexProfile): boolean => {
    if (typeof profile.isAuthenticated === 'boolean') return profile.isAuthenticated;
    return Boolean(profile.oauthToken || (profile.isDefault && profile.configDir));
  };
  const hasAuthenticatedProfiles = codexProfiles.some(isProfileAuthenticated);

  return (
    <section className="space-y-3">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-sm font-semibold text-foreground hover:text-foreground/80"
      >
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4" />
          Codex 认证
          {codexAuthStatus === 'authenticated' && (
            <span className="px-2 py-0.5 text-xs bg-success/10 text-success rounded-full">
              已连接
            </span>
          )}
          {codexAuthStatus === 'not_authenticated' && (
            <span className="px-2 py-0.5 text-xs bg-warning/10 text-warning rounded-full">
              未连接
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {expanded && (
        <div className="space-y-4 pl-6 pt-2">
          {isLoadingEnv || isLoadingProfiles ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在加载配置...
            </div>
          ) : envConfig ? (
            <>
              {/* Inheritance Info */}
              <div className="rounded-lg border border-info/30 bg-info/5 p-3">
                <div className="flex items-start gap-3">
                  <Globe className="h-5 w-5 text-info mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      使用全局认证
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Codex 认证在{' '}
                      <span className="font-medium text-info">设置 → 集成</span>中管理。
                      所有项目共享相同的 Codex 账号。
                    </p>
                  </div>
                </div>
              </div>

              {/* Active Account Display */}
              {hasAuthenticatedProfiles ? (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-sm font-medium text-foreground">当前账号</Label>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCodexSetup}
                      disabled={isCheckingCodexAuth}
                    >
                      {isCheckingCodexAuth ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          重新认证
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {activeProfile ? (
                    <div className="mt-3 flex items-center gap-3">
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                        "bg-primary text-primary-foreground"
                      )}>
                        {activeProfile.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{activeProfile.name}</span>
                          <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            当前
                          </span>
                          {isProfileAuthenticated(activeProfile) ? (
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
                        {activeProfile.email && (
                          <span className="text-xs text-muted-foreground">{activeProfile.email}</span>
                        )}
                      </div>
                    </div>
                  ) : codexProfiles.length > 0 ? (
                    <p className="text-xs text-warning mt-2">
                      未选择当前账号。请前往 设置 → 集成 选择账号。
                    </p>
                  ) : null}

                  {/* Show other authenticated accounts */}
                  {codexProfiles.filter(p => p.id !== activeProfileId && p.oauthToken).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-2">
                        其他已认证账号（用于限流备用）：
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {codexProfiles
                          .filter(p => p.id !== activeProfileId && p.oauthToken)
                          .map(profile => (
                            <div
                              key={profile.id}
                              className="flex items-center gap-1.5 text-xs bg-muted px-2 py-1 rounded"
                            >
                              <div className="h-4 w-4 rounded-full bg-muted-foreground/30 flex items-center justify-center text-[10px]">
                                {profile.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-muted-foreground">{profile.name}</span>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* No accounts configured */
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
                  <div className="flex flex-col items-center text-center">
                    <Users className="h-8 w-8 text-warning mb-2" />
                    <p className="text-sm font-medium text-foreground">未配置 Codex 账号</p>
                    <p className="text-xs text-muted-foreground mt-1 mb-3">
                      在全局设置中添加 Codex 账号以使用 Auto-Build。
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // Emit event to open app settings at Integrations
                        window.dispatchEvent(new CustomEvent('open-app-settings', { detail: 'integrations' }));
                      }}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      打开集成设置
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : envError ? (
            <p className="text-sm text-destructive">{envError}</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
