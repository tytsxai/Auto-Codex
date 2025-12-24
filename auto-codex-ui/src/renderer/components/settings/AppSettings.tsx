import { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Save,
  Loader2,
  Palette,
  Bot,
  FolderOpen,
  Key,
  Package,
  Bell,
  Settings2,
  Zap,
  Github,
  Database,
  Sparkles,
  GitBranch
} from 'lucide-react';
import {
  FullScreenDialog,
  FullScreenDialogContent,
  FullScreenDialogHeader,
  FullScreenDialogBody,
  FullScreenDialogFooter,
  FullScreenDialogTitle,
  FullScreenDialogDescription
} from '../ui/full-screen-dialog';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../../lib/utils';
import { useSettings } from './hooks/useSettings';
import { ThemeSettings } from './ThemeSettings';
import { GeneralSettings } from './GeneralSettings';
import { IntegrationSettings } from './IntegrationSettings';
import { AdvancedSettings } from './AdvancedSettings';
import { ProjectSelector } from './ProjectSelector';
import { ProjectSettingsContent, ProjectSettingsSection } from './ProjectSettingsContent';
import { useProjectStore } from '../../stores/project-store';
import type { UseProjectSettingsReturn } from '../project-settings/hooks/useProjectSettings';

interface AppSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: AppSection;
  initialProjectSection?: ProjectSettingsSection;
  onRerunWizard?: () => void;
}

// 应用级设置分区
export type AppSection = 'appearance' | 'agent' | 'paths' | 'integrations' | 'updates' | 'notifications' | 'workflow';

interface NavItem<T extends string> {
  id: T;
  label: string;
  icon: React.ElementType;
  description: string;
}

const appNavItems: NavItem<AppSection>[] = [
  { id: 'appearance', label: '外观', icon: Palette, description: '主题与视觉偏好' },
  { id: 'agent', label: '智能体设置', icon: Bot, description: '默认模型与框架' },
  { id: 'paths', label: '路径', icon: FolderOpen, description: 'Python 与框架路径' },
  { id: 'integrations', label: '集成', icon: Key, description: 'API 密钥与 Codex 账户' },
  { id: 'workflow', label: '工作流', icon: GitBranch, description: '工作树管理与合并' },
  { id: 'updates', label: '更新', icon: Package, description: 'Auto Codex 更新' },
  { id: 'notifications', label: '通知', icon: Bell, description: '提醒偏好' }
];

const projectNavItems: NavItem<ProjectSettingsSection>[] = [
  { id: 'general', label: '通用', icon: Settings2, description: 'Auto-Build 与智能体配置' },
  { id: 'codex', label: 'Codex 认证', icon: Key, description: 'Codex 认证' },
  { id: 'linear', label: 'Linear', icon: Zap, description: 'Linear 集成' },
  { id: 'github', label: 'GitHub', icon: Github, description: 'GitHub 工单同步' },
  { id: 'memory', label: '记忆', icon: Database, description: 'Graphiti 记忆后端' }
];

/**
 * 主应用设置对话框容器
 * 协调应用与项目设置分区
 */
export function AppSettingsDialog({ open, onOpenChange, initialSection, initialProjectSection, onRerunWizard }: AppSettingsDialogProps) {
  const { settings, setSettings, isSaving, error, saveSettings, revertTheme, commitTheme } = useSettings();
  const [version, setVersion] = useState<string>('');

  // 跟踪当前激活的顶层分区
  const [activeTopLevel, setActiveTopLevel] = useState<'app' | 'project'>('app');
  const [appSection, setAppSection] = useState<AppSection>(initialSection || 'appearance');
  const [projectSection, setProjectSection] = useState<ProjectSettingsSection>('general');

  // 当对话框以指定分区打开时跳转到初始分区
  useEffect(() => {
    if (open) {
      if (initialProjectSection) {
        setActiveTopLevel('project');
        setProjectSection(initialProjectSection);
      } else if (initialSection) {
        setActiveTopLevel('app');
        setAppSection(initialSection);
      }
    }
  }, [open, initialSection, initialProjectSection]);

  // 项目状态
  const projects = useProjectStore((state) => state.projects);
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);
  const selectProject = useProjectStore((state) => state.selectProject);
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // 项目设置 Hook 状态（从子组件提升）
  const [projectSettingsHook, setProjectSettingsHook] = useState<UseProjectSettingsReturn | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);

  // 挂载时加载应用版本
  useEffect(() => {
    window.electronAPI.getAppVersion().then(setVersion);
  }, []);

  // 记忆回调以避免无限循环
  const handleProjectHookReady = useCallback((hook: UseProjectSettingsReturn | null) => {
    setProjectSettingsHook(hook);
    if (hook) {
      setProjectError(hook.error || hook.envError || null);
    } else {
      setProjectError(null);
    }
  }, []);

  const handleSave = async () => {
    // 先保存应用设置
    const appSaveSuccess = await saveSettings();

    // 若在项目分区且已选择项目，则同时保存项目设置
    if (activeTopLevel === 'project' && selectedProject && projectSettingsHook) {
      await projectSettingsHook.handleSave(() => {});
      // 检查项目错误
      if (projectSettingsHook.error || projectSettingsHook.envError) {
        setProjectError(projectSettingsHook.error || projectSettingsHook.envError);
        return; // 出错时不关闭对话框
      }
    }

    if (appSaveSuccess) {
      // 提交主题以便后续取消不回退到旧值
      commitTheme();
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    // onOpenChange 处理器会回退主题更改
    onOpenChange(false);
  };

  const handleProjectChange = (projectId: string | null) => {
    selectProject(projectId);
  };

  const renderAppSection = () => {
    switch (appSection) {
      case 'appearance':
        return <ThemeSettings settings={settings} onSettingsChange={setSettings} />;
      case 'agent':
        return <GeneralSettings settings={settings} onSettingsChange={setSettings} section="agent" />;
      case 'paths':
        return <GeneralSettings settings={settings} onSettingsChange={setSettings} section="paths" />;
      case 'integrations':
        return <IntegrationSettings settings={settings} onSettingsChange={setSettings} isOpen={open} />;
      case 'updates':
        return <AdvancedSettings settings={settings} onSettingsChange={setSettings} section="updates" version={version} />;
      case 'notifications':
        return <AdvancedSettings settings={settings} onSettingsChange={setSettings} section="notifications" version={version} />;
      case 'workflow':
        return <AdvancedSettings settings={settings} onSettingsChange={setSettings} section="workflow" version={version} />;
      default:
        return null;
    }
  };

  const renderContent = () => {
    if (activeTopLevel === 'app') {
      return renderAppSection();
    }
    return (
      <ProjectSettingsContent
        project={selectedProject}
        activeSection={projectSection}
        isOpen={open}
        onHookReady={handleProjectHookReady}
      />
    );
  };

  // 判断项目导航项是否应禁用
  const projectNavDisabled = !selectedProjectId;

  return (
    <FullScreenDialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) {
        // 对话框正在关闭（通过 X、Esc 或点击遮罩）
        // 回退未保存的主题更改
        revertTheme();
      }
      onOpenChange(newOpen);
    }}>
      <FullScreenDialogContent>
        <FullScreenDialogHeader>
          <FullScreenDialogTitle className="flex items-center gap-3">
            <Settings className="h-6 w-6" />
            设置
          </FullScreenDialogTitle>
          <FullScreenDialogDescription>
            配置应用与项目设置
          </FullScreenDialogDescription>
        </FullScreenDialogHeader>

        <FullScreenDialogBody>
          <div className="flex h-full">
            {/* 导航侧边栏 */}
            <nav className="w-80 border-r border-border bg-muted/30 p-4">
              <ScrollArea className="h-full">
                <div className="space-y-6">
                  {/* 应用 分区 */}
                  <div>
                    <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      应用
                    </h3>
                    <div className="space-y-1">
                      {appNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTopLevel === 'app' && appSection === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActiveTopLevel('app');
                              setAppSection(item.id);
                            }}
                            className={cn(
                              'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all',
                              isActive
                                ? 'bg-accent text-accent-foreground'
                                : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium text-sm">{item.label}</div>
                              <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                            </div>
                          </button>
                        );
                      })}

                      {/* 重新运行向导按钮 */}
                      {onRerunWizard && (
                        <button
                          onClick={() => {
                            onOpenChange(false);
                            onRerunWizard();
                          }}
                          className={cn(
                            'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all mt-2',
                            'border border-dashed border-muted-foreground/30',
                            'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
                          )}
                        >
                            <Sparkles className="h-5 w-5 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium text-sm">重新运行向导</div>
                              <div className="text-xs text-muted-foreground truncate">重新开始设置向导</div>
                            </div>
                          </button>
                      )}
                    </div>
                  </div>

                  {/* 项目 分区 */}
                  <div>
                    <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      项目
                    </h3>

                    {/* 项目选择器 */}
                    <div className="px-1 mb-3">
                      <ProjectSelector
                        selectedProjectId={selectedProjectId}
                        onProjectChange={handleProjectChange}
                      />
                    </div>

                    {/* 项目导航项 */}
                    <div className="space-y-1">
                      {projectNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTopLevel === 'project' && projectSection === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActiveTopLevel('project');
                              setProjectSection(item.id);
                            }}
                            disabled={projectNavDisabled}
                            className={cn(
                              'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all',
                              isActive
                                ? 'bg-accent text-accent-foreground'
                                : projectNavDisabled
                                  ? 'opacity-50 cursor-not-allowed text-muted-foreground'
                                  : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium text-sm">{item.label}</div>
                              <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 底部版本 */}
                {version && (
                  <div className="mt-8 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground text-center">
                      版本 {version}
                    </p>
                  </div>
                )}
              </ScrollArea>
            </nav>

            {/* 主内容 */}
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-8 max-w-2xl">
                  {renderContent()}
                </div>
              </ScrollArea>
            </div>
          </div>
        </FullScreenDialogBody>

        <FullScreenDialogFooter>
          {(error || projectError) && (
            <div className="flex-1 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-2 text-sm text-destructive">
              {error || projectError}
            </div>
          )}
          <Button variant="outline" onClick={handleCancel}>
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || (activeTopLevel === 'project' && projectSettingsHook?.isSaving)}
          >
            {(isSaving || (activeTopLevel === 'project' && projectSettingsHook?.isSaving)) ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在保存...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                保存设置
              </>
            )}
          </Button>
        </FullScreenDialogFooter>
      </FullScreenDialogContent>
    </FullScreenDialog>
  );
}
