import { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  CloudDownload,
  Loader2,
  ExternalLink,
  Download,
  Sparkles
} from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Progress } from '../ui/progress';
import { cn } from '../../lib/utils';
import { SettingsSection } from './SettingsSection';
import type {
  AppSettings,
  AutoBuildSourceUpdateCheck,
  AutoBuildSourceUpdateProgress,
  AppUpdateAvailableEvent,
  AppUpdateProgress
} from '../../../shared/types';

/**
 * 用于发布说明的简易 markdown 渲染器
 * 处理：标题、加粗、列表、换行
 */
function ReleaseNotesRenderer({ markdown }: { markdown: string }) {
  const html = useMemo(() => {
    const result = markdown
      // 转义 HTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // 标题（### Header -> <h3>）
      .replace(/^### (.+)$/gm, '<h4 class="text-sm font-semibold text-foreground mt-3 mb-1.5 first:mt-0">$1</h4>')
      .replace(/^## (.+)$/gm, '<h3 class="text-sm font-semibold text-foreground mt-3 mb-1.5 first:mt-0">$1</h3>')
      // 加粗（**text** -> <strong>）
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-foreground font-medium">$1</strong>')
      // 行内代码（`code` -> <code>）
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-muted rounded text-xs">$1</code>')
      // 列表项（- item -> <li>）
      .replace(/^- (.+)$/gm, '<li class="ml-4 text-muted-foreground before:content-[\'•\'] before:mr-2 before:text-muted-foreground/60">$1</li>')
      // 包裹连续列表项
      .replace(/(<li[^>]*>.*?<\/li>\n?)+/g, '<ul class="space-y-1 my-2">$&</ul>')
      // 其余行换行
      .replace(/\n\n/g, '<div class="h-2"></div>')
      .replace(/\n/g, '<br/>');

    return result;
  }, [markdown]);

  return (
    <div
      className="text-sm text-muted-foreground leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

interface AdvancedSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  section: 'updates' | 'notifications' | 'workflow';
  version: string;
}

/**
 * 更新与通知的高级设置
 */
export function AdvancedSettings({ settings, onSettingsChange, section, version }: AdvancedSettingsProps) {
  // Auto Codex 源码更新状态
  const [sourceUpdateCheck, setSourceUpdateCheck] = useState<AutoBuildSourceUpdateCheck | null>(null);
  const [isCheckingSourceUpdate, setIsCheckingSourceUpdate] = useState(false);
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<AutoBuildSourceUpdateProgress | null>(null);
  // 成功更新后可更新的本地版本状态
  const [displayVersion, setDisplayVersion] = useState<string>(version);

  // Electron 应用更新状态
  const [appUpdateInfo, setAppUpdateInfo] = useState<AppUpdateAvailableEvent | null>(null);
  const [_isCheckingAppUpdate, setIsCheckingAppUpdate] = useState(false);
  const [isDownloadingAppUpdate, setIsDownloadingAppUpdate] = useState(false);
  const [appDownloadProgress, setAppDownloadProgress] = useState<AppUpdateProgress | null>(null);
  const [isAppUpdateDownloaded, setIsAppUpdateDownloaded] = useState(false);

  // prop 变化时同步 displayVersion
  useEffect(() => {
    setDisplayVersion(version);
  }, [version]);

  // 挂载时检查更新
  useEffect(() => {
    if (section === 'updates') {
      checkForSourceUpdates();
      checkForAppUpdates();
    }
  }, [section]);

  // 监听源码下载进度
  useEffect(() => {
    const cleanup = window.electronAPI.onAutoBuildSourceUpdateProgress((progress) => {
      setDownloadProgress(progress);
      if (progress.stage === 'complete') {
        setIsDownloadingUpdate(false);
        // 如果提供了新版本则更新显示版本
        if (progress.newVersion) {
          setDisplayVersion(progress.newVersion);
        }
        checkForSourceUpdates();
      } else if (progress.stage === 'error') {
        setIsDownloadingUpdate(false);
      }
    });

    return cleanup;
  }, []);

  // 监听应用更新事件
  useEffect(() => {
    const cleanupAvailable = window.electronAPI.onAppUpdateAvailable((info) => {
      setAppUpdateInfo(info);
      setIsCheckingAppUpdate(false);
    });

    const cleanupDownloaded = window.electronAPI.onAppUpdateDownloaded((info) => {
      setAppUpdateInfo(info);
      setIsDownloadingAppUpdate(false);
      setIsAppUpdateDownloaded(true);
      setAppDownloadProgress(null);
    });

    const cleanupProgress = window.electronAPI.onAppUpdateProgress((progress) => {
      setAppDownloadProgress(progress);
    });

    return () => {
      cleanupAvailable();
      cleanupDownloaded();
      cleanupProgress();
    };
  }, []);

  const checkForAppUpdates = async () => {
    setIsCheckingAppUpdate(true);
    try {
      const result = await window.electronAPI.checkAppUpdate();
      if (result.success && result.data) {
        setAppUpdateInfo(result.data);
      } else {
        // 无可用更新
        setAppUpdateInfo(null);
      }
    } catch (err) {
      console.error('Failed to check for app updates:', err);
    } finally {
      setIsCheckingAppUpdate(false);
    }
  };

  const handleDownloadAppUpdate = async () => {
    setIsDownloadingAppUpdate(true);
    try {
      await window.electronAPI.downloadAppUpdate();
    } catch (err) {
      console.error('Failed to download app update:', err);
      setIsDownloadingAppUpdate(false);
    }
  };

  const handleInstallAppUpdate = () => {
    window.electronAPI.installAppUpdate();
  };

  const checkForSourceUpdates = async () => {
    if (window.DEBUG) console.warn('[AdvancedSettings] Checking for source updates...');
    setIsCheckingSourceUpdate(true);
    try {
      const result = await window.electronAPI.checkAutoBuildSourceUpdate();
      if (window.DEBUG) console.warn('[AdvancedSettings] Check result:', result);
      if (result.success && result.data) {
        setSourceUpdateCheck(result.data);
        // 从检查结果更新显示版本（最准确）
        if (result.data.currentVersion) {
          setDisplayVersion(result.data.currentVersion);
        }
      }
    } catch (err) {
      console.error('[AdvancedSettings] Check error:', err);
    } finally {
      setIsCheckingSourceUpdate(false);
    }
  };

  const handleDownloadSourceUpdate = () => {
    setIsDownloadingUpdate(true);
    setDownloadProgress(null);
    window.electronAPI.downloadAutoBuildSourceUpdate();
  };

  if (section === 'updates') {
    return (
      <SettingsSection
        title="更新"
        description="管理 Auto Codex 更新"
      >
        <div className="space-y-6">
          {/* Electron 应用更新分区 */}
          {(appUpdateInfo || isAppUpdateDownloaded) && (
            <div className="rounded-lg border-2 border-info/50 bg-info/5 p-5 space-y-4">
              <div className="flex items-center gap-2 text-info">
                <Sparkles className="h-5 w-5" />
                <h3 className="font-semibold">应用更新就绪</h3>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    新版本
                  </p>
                  <p className="text-base font-medium text-foreground">
                    {appUpdateInfo?.version || '未知'}
                  </p>
                  {appUpdateInfo?.releaseDate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      发布于 {new Date(appUpdateInfo.releaseDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {isAppUpdateDownloaded ? (
                  <CheckCircle2 className="h-6 w-6 text-success" />
                ) : isDownloadingAppUpdate ? (
                  <RefreshCw className="h-6 w-6 animate-spin text-info" />
                ) : (
                  <Download className="h-6 w-6 text-info" />
                )}
              </div>

              {/* 发布说明 */}
              {appUpdateInfo?.releaseNotes && (
                <div className="bg-background rounded-lg p-4 max-h-48 overflow-y-auto border border-border/50">
                  <ReleaseNotesRenderer markdown={appUpdateInfo.releaseNotes} />
                </div>
              )}

              {/* 下载进度 */}
              {isDownloadingAppUpdate && appDownloadProgress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">下载中...</span>
                    <span className="text-foreground font-medium">
                      {Math.round(appDownloadProgress.percent)}%
                    </span>
                  </div>
                  <Progress value={appDownloadProgress.percent} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">
                    {(appDownloadProgress.transferred / 1024 / 1024).toFixed(2)} MB / {(appDownloadProgress.total / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}

              {/* 下载完成 */}
              {isAppUpdateDownloaded && (
                <div className="flex items-center gap-3 text-sm text-success bg-success/10 border border-success/30 rounded-lg p-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <span>更新已下载！点击安装以重启并应用更新。</span>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex gap-3">
                {isAppUpdateDownloaded ? (
                  <Button onClick={handleInstallAppUpdate}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    安装并重启
                  </Button>
                ) : (
                  <Button
                    onClick={handleDownloadAppUpdate}
                    disabled={isDownloadingAppUpdate}
                  >
                    {isDownloadingAppUpdate ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        下载中...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        下载更新
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* 统一版本展示与更新检查 */}
          <div className="rounded-lg border border-border bg-muted/50 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">版本</p>
                <p className="text-base font-medium text-foreground">
                  {displayVersion || '加载中...'}
                </p>
              </div>
              {isCheckingSourceUpdate ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : sourceUpdateCheck?.updateAvailable ? (
                <AlertCircle className="h-6 w-6 text-info" />
              ) : (
                <CheckCircle2 className="h-6 w-6 text-success" />
              )}
            </div>

            {/* 更新状态 */}
            {isCheckingSourceUpdate ? (
              <p className="text-sm text-muted-foreground">
                正在检查更新...
              </p>
            ) : sourceUpdateCheck ? (
              <>
                {sourceUpdateCheck.latestVersion && sourceUpdateCheck.updateAvailable && (
                  <p className="text-sm text-info">
                    有新版本可用：{sourceUpdateCheck.latestVersion}
                  </p>
                )}

                {sourceUpdateCheck.error && (
                  <p className="text-sm text-destructive">{sourceUpdateCheck.error}</p>
                )}

                {!sourceUpdateCheck.updateAvailable && !sourceUpdateCheck.error && (
                  <p className="text-sm text-muted-foreground">
                    已是最新版本。
                  </p>
                )}

                {sourceUpdateCheck.updateAvailable && (
                  <div className="space-y-4 pt-2">
                    {sourceUpdateCheck.releaseNotes && (
                      <div className="bg-background rounded-lg p-4 max-h-48 overflow-y-auto border border-border/50">
                        <ReleaseNotesRenderer markdown={sourceUpdateCheck.releaseNotes} />
                      </div>
                    )}

                    {sourceUpdateCheck.releaseUrl && (
                      <button
                        onClick={() => window.electronAPI.openExternal(sourceUpdateCheck.releaseUrl!)}
                        className="inline-flex items-center gap-1.5 text-sm text-info hover:text-info/80 hover:underline transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        在 GitHub 查看完整发布说明
                      </button>
                    )}

                    {isDownloadingUpdate ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>{downloadProgress?.message || '下载中...'}</span>
                        </div>
                        {downloadProgress?.percent !== undefined && (
                          <Progress value={downloadProgress.percent} className="h-2" />
                        )}
                      </div>
                    ) : downloadProgress?.stage === 'complete' ? (
                      <div className="flex items-center gap-3 text-sm text-success">
                        <CheckCircle2 className="h-5 w-5" />
                        <span>{downloadProgress.message}</span>
                      </div>
                    ) : downloadProgress?.stage === 'error' ? (
                      <div className="flex items-center gap-3 text-sm text-destructive">
                        <AlertCircle className="h-5 w-5" />
                        <span>{downloadProgress.message}</span>
                      </div>
                    ) : (
                      <Button onClick={handleDownloadSourceUpdate}>
                        <CloudDownload className="mr-2 h-4 w-4" />
                        下载更新
                      </Button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                无法检查更新
              </p>
            )}

            <div className="pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={checkForSourceUpdates}
                disabled={isCheckingSourceUpdate}
              >
                <RefreshCw className={cn('mr-2 h-4 w-4', isCheckingSourceUpdate && 'animate-spin')} />
                检查更新
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-border">
            <div className="space-y-1">
              <Label className="font-medium text-foreground">自动更新项目</Label>
              <p className="text-sm text-muted-foreground">
                当有新版本时自动更新项目中的 Auto Codex
              </p>
            </div>
            <Switch
              checked={settings.autoUpdateAutoBuild}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, autoUpdateAutoBuild: checked })
              }
            />
          </div>
        </div>
      </SettingsSection>
    );
  }

  // 通知分区
  if (section === 'notifications') {
    return (
      <SettingsSection
        title="通知"
        description="配置默认通知偏好"
      >
        <div className="space-y-4">
          {[
            { key: 'onTaskComplete', label: '任务完成时', description: '任务成功完成时通知' },
            { key: 'onTaskFailed', label: '任务失败时', description: '任务出错时通知' },
            { key: 'onReviewNeeded', label: '需要评审时', description: '质量审查需要你的评审时通知' },
            { key: 'sound', label: '声音', description: '通知时播放声音' }
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div className="space-y-1">
                <Label className="font-medium text-foreground">{item.label}</Label>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Switch
                checked={settings.notifications[item.key as keyof typeof settings.notifications]}
                onCheckedChange={(checked) =>
                  onSettingsChange({
                    ...settings,
                    notifications: {
                      ...settings.notifications,
                      [item.key]: checked
                    }
                  })
                }
              />
            </div>
          ))}
        </div>
      </SettingsSection>
    );
  }

  // 工作流分区
  return (
    <SettingsSection
      title="工作流"
      description="配置工作树管理与合并行为"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/40 bg-destructive/5">
          <div className="space-y-1">
            <Label className="font-medium text-foreground">终端绕过审批与沙盒（危险）</Label>
            <p className="text-sm text-muted-foreground">
              仅影响集成终端里启动的 Codex CLI；启用后将附加 <code>--dangerously-bypass-approvals-and-sandbox</code>
            </p>
          </div>
          <Switch
            checked={settings.codexTerminalBypassApprovalsAndSandbox ?? false}
            onCheckedChange={(checked) =>
              onSettingsChange({ ...settings, codexTerminalBypassApprovalsAndSandbox: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <div className="space-y-1">
            <Label className="font-medium text-foreground">合并后自动清理</Label>
            <p className="text-sm text-muted-foreground">
              成功合并并提交后自动删除工作树
            </p>
          </div>
          <Switch
            checked={settings.autoCleanupWorktreeAfterMerge ?? false}
            onCheckedChange={(checked) =>
              onSettingsChange({ ...settings, autoCleanupWorktreeAfterMerge: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <div className="space-y-1">
            <Label className="font-medium text-foreground">过期天数</Label>
            <p className="text-sm text-muted-foreground">
              超过此天数未活动的工作树将被标记为过期
            </p>
          </div>
          <input
            type="number"
            min={1}
            max={90}
            value={settings.staleWorktreeDays ?? 7}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                staleWorktreeDays: Math.max(1, Math.min(90, parseInt(e.target.value) || 7))
              })
            }
            className="w-20 h-9 px-3 rounded-md border border-input bg-background text-sm"
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <div className="space-y-1">
            <Label className="font-medium text-foreground">显示过期警告</Label>
            <p className="text-sm text-muted-foreground">
              启动时显示过期工作树警告
            </p>
          </div>
          <Switch
            checked={settings.showStaleWorktreeWarning ?? true}
            onCheckedChange={(checked) =>
              onSettingsChange({ ...settings, showStaleWorktreeWarning: checked })
            }
          />
        </div>
      </div>
    </SettingsSection>
  );
}
