import { useState, useEffect } from 'react';
import { Settings2, Download, RefreshCw, AlertCircle } from 'lucide-react';
import { TooltipProvider } from './components/ui/tooltip';
import { Button } from './components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from './components/ui/tooltip';
import { Sidebar, type SidebarView } from './components/Sidebar';
import { KanbanBoard } from './components/KanbanBoard';
import { TaskDetailModal } from './components/task-detail/TaskDetailModal';
import { TaskCreationWizard } from './components/TaskCreationWizard';
import { AppSettingsDialog, type AppSection } from './components/settings/AppSettings';
import type { ProjectSettingsSection } from './components/settings/ProjectSettingsContent';
import { TerminalGrid } from './components/TerminalGrid';
import { Roadmap } from './components/Roadmap';
import { Context } from './components/Context';
import { Ideation } from './components/Ideation';
import { Insights } from './components/Insights';
import { GitHubIssues } from './components/GitHubIssues';
import { Changelog } from './components/Changelog';
import { Worktrees } from './components/Worktrees';
import { WelcomeScreen } from './components/WelcomeScreen';
import { RateLimitModal } from './components/RateLimitModal';
import { SDKRateLimitModal } from './components/SDKRateLimitModal';
import { OnboardingWizard } from './components/onboarding';
import { AppUpdateNotification } from './components/AppUpdateNotification';
import { UsageIndicator } from './components/UsageIndicator';
import { ProactiveSwapListener } from './components/ProactiveSwapListener';
import { GitHubSetupModal } from './components/GitHubSetupModal';
import { useProjectStore, loadProjects, addProject, initializeProject } from './stores/project-store';
import { useTaskStore, loadTasks } from './stores/task-store';
import { useSettingsStore, loadSettings } from './stores/settings-store';
import { useTerminalStore, restoreTerminalSessions } from './stores/terminal-store';
import { useIpcListeners } from './hooks/useIpc';
import { COLOR_THEMES } from '../shared/constants';
import type { Task, Project, ColorTheme } from '../shared/types';

export function App() {
  // 加载 IPC 监听器以进行实时更新
  useIpcListeners();

  // Store
  const projects = useProjectStore((state) => state.projects);
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);
  const tasks = useTaskStore((state) => state.tasks);
  const settings = useSettingsStore((state) => state.settings);
  const settingsLoading = useSettingsStore((state) => state.isLoading);

  // UI 状态
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isNewTaskDialogOpen, setIsNewTaskDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<AppSection | undefined>(undefined);
  const [settingsInitialProjectSection, setSettingsInitialProjectSection] = useState<ProjectSettingsSection | undefined>(undefined);
  const [activeView, setActiveView] = useState<SidebarView>('kanban');
  const [isOnboardingWizardOpen, setIsOnboardingWizardOpen] = useState(false);

  // 初始化对话框状态
  const [showInitDialog, setShowInitDialog] = useState(false);
  const [pendingProject, setPendingProject] = useState<Project | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initSuccess, setInitSuccess] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [skippedInitProjectId, setSkippedInitProjectId] = useState<string | null>(null);

  // GitHub 设置状态（Auto Codex 初始化后显示）
  const [showGitHubSetup, setShowGitHubSetup] = useState(false);
  const [gitHubSetupProject, setGitHubSetupProject] = useState<Project | null>(null);

  // 获取选中的项目
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // 初始加载
  useEffect(() => {
    loadProjects();
    loadSettings();
  }, []);

  // 跟踪设置是否至少加载过一次
  const [settingsHaveLoaded, setSettingsHaveLoaded] = useState(false);

  // 加载完成时标记设置已加载
  useEffect(() => {
    if (!settingsLoading && !settingsHaveLoaded) {
      setSettingsHaveLoaded(true);
    }
  }, [settingsLoading, settingsHaveLoaded]);

  // 首次运行检测 - 未完成时显示引导向导
  // 仅在从磁盘加载设置后再检查以避免竞态
  useEffect(() => {
    if (settingsHaveLoaded && settings.onboardingCompleted === false) {
      setIsOnboardingWizardOpen(true);
    }
  }, [settingsHaveLoaded, settings.onboardingCompleted]);

  // 监听 open-app-settings 事件（例如来自项目设置）
  useEffect(() => {
    const handleOpenAppSettings = (event: Event) => {
      const customEvent = event as CustomEvent<AppSection>;
      const section = customEvent.detail;
      if (section) {
        setSettingsInitialSection(section);
      }
      setIsSettingsDialogOpen(true);
    };

    window.addEventListener('open-app-settings', handleOpenAppSettings);
    return () => {
      window.removeEventListener('open-app-settings', handleOpenAppSettings);
    };
  }, []);

  // 监听 Codex 登录终端事件（由主进程创建）
  useEffect(() => {
    const cleanup = window.electronAPI.onCodexProfileLoginTerminal((info) => {
      const title = info.profileName ? `Codex Login (${info.profileName})` : 'Codex Login';
      useTerminalStore.getState().addExternalTerminal({
        id: info.terminalId,
        title,
        cwd: info.cwd
      });
      setActiveView('terminals');
    });

    return () => {
      cleanup?.();
    };
  }, []);

  // 监听应用更新 - 更新就绪时自动打开设置的“更新”区域
  useEffect(() => {
    // 当更新已下载并可安装时，打开设置的更新区域
    const cleanupDownloaded = window.electronAPI.onAppUpdateDownloaded(() => {
      console.warn('[App] Update downloaded, opening settings to updates section');
      setSettingsInitialSection('updates');
      setIsSettingsDialogOpen(true);
    });

    return () => {
      cleanupDownloaded();
    };
  }, []);

  // 检查所选项目是否需要初始化（例如 .auto-codex 文件夹被删除）
  useEffect(() => {
    // 初始化进行中时不显示对话框
    if (isInitializing) return;

    if (selectedProject && !selectedProject.autoBuildPath && skippedInitProjectId !== selectedProject.id) {
      // 项目存在但未初始化 - 显示初始化对话框
      setPendingProject(selectedProject);
      setInitError(null); // 清除之前的错误
      setInitSuccess(false); // 重置成功标记
      setShowInitDialog(true);
    }
  }, [selectedProject, skippedInitProjectId, isInitializing]);

  // 项目变更时加载任务
  useEffect(() => {
    if (selectedProjectId) {
      loadTasks(selectedProjectId);
      setSelectedTask(null); // 项目变更时清除选择
    } else {
      useTaskStore.getState().clearTasks();
    }

    // 处理项目变更时的终端
    const currentTerminals = useTerminalStore.getState().terminals;

    // 关闭现有终端（它们属于上一个项目）
    currentTerminals.forEach((t) => {
      window.electronAPI.destroyTerminal(t.id);
    });
    useTerminalStore.getState().clearAllTerminals();

    // 尝试为新项目恢复已保存会话
    if (selectedProject?.path) {
      restoreTerminalSessions(selectedProject.path).catch((err) => {
        console.error('[App] Failed to restore sessions:', err);
      });
    }
  }, [selectedProjectId, selectedProject?.path, selectedProject?.name]);

  // 加载时应用主题
  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = () => {
      // 应用亮/暗模式
      if (settings.theme === 'dark') {
        root.classList.add('dark');
      } else if (settings.theme === 'light') {
        root.classList.remove('dark');
      } else {
        // 系统偏好
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    // 通过 data-theme 属性应用配色主题
    // 校验 colorTheme 是否为已知主题，非法则回退为 'default'
    const validThemeIds = COLOR_THEMES.map((t) => t.id);
    const rawColorTheme = settings.colorTheme ?? 'default';
    const colorTheme: ColorTheme = validThemeIds.includes(rawColorTheme as ColorTheme)
      ? (rawColorTheme as ColorTheme)
      : 'default';

    if (colorTheme === 'default') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', colorTheme);
    }

    applyTheme();

    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (settings.theme === 'system') {
        applyTheme();
      }
    };
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [settings.theme, settings.colorTheme]);

  // 任务变化时更新选中任务（用于实时更新）
  useEffect(() => {
    if (selectedTask) {
      const updatedTask = tasks.find(
        (t) => t.id === selectedTask.id || t.specId === selectedTask.specId
      );
      if (updatedTask) {
        setSelectedTask(updatedTask);
      }
    }
  }, [tasks, selectedTask?.id, selectedTask?.specId, selectedTask]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const handleCloseTaskDetail = () => {
    setSelectedTask(null);
  };

  const handleAddProject = async () => {
    try {
      const path = await window.electronAPI.selectDirectory();
      if (path) {
        const project = await addProject(path);
        if (project && !project.autoBuildPath) {
          // 项目未初始化 Auto Codex，显示初始化对话框
          setPendingProject(project);
          setInitError(null); // 清除之前的错误
          setInitSuccess(false); // 重置成功标记
          setShowInitDialog(true);
        }
      }
    } catch (error) {
      console.error('Failed to add project:', error);
    }
  };

    const handleInitialize = async () => {
      if (!pendingProject) return;

      const projectId = pendingProject.id;
      if (window.DEBUG) console.warn('[InitDialog] Starting initialization for project:', projectId);
      setIsInitializing(true);
      setInitSuccess(false);
      setInitError(null); // 清除之前的错误
      try {
        const result = await initializeProject(projectId);
        if (window.DEBUG) console.warn('[InitDialog] Initialization result:', result);

        if (result?.success) {
          if (window.DEBUG) console.warn('[InitDialog] Initialization successful, closing dialog');
          // 从 store 获取更新后的项目
          const updatedProject = useProjectStore.getState().projects.find(p => p.id === projectId);
          if (window.DEBUG) console.warn('[InitDialog] Updated project:', updatedProject);

        // 标记成功以防 onOpenChange 将其视为跳过
        setInitSuccess(true);
        setIsInitializing(false);

        // 现在关闭对话框
        setShowInitDialog(false);
        setPendingProject(null);

        // 显示 GitHub 设置弹窗
        if (updatedProject) {
          setGitHubSetupProject(updatedProject);
          setShowGitHubSetup(true);
        }
        } else {
          // 初始化失败 - 显示错误但保持对话框开启
          if (window.DEBUG) console.warn('[InitDialog] Initialization failed, showing error');
          const errorMessage = result?.error || 'Failed to initialize Auto Codex. Please try again.';
          setInitError(errorMessage);
          setIsInitializing(false);
        }
    } catch (error) {
      // 发生了意外错误
      console.error('[InitDialog] Unexpected error during initialization:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setInitError(errorMessage);
      setIsInitializing(false);
    }
  };

  const handleGitHubSetupComplete = async (settings: {
    githubToken: string;
    githubRepo: string;
    mainBranch: string;
  }) => {
    if (!gitHubSetupProject) return;

    try {
      // 注意：settings.githubToken 是 GitHub 访问令牌（来自 gh CLI），
      // 不是 OpenAI API 令牌。它们是不同的：
      // - GitHub 令牌：用于 GitHub API 访问（仓库操作）
      // - OpenAI API Key：用于 Codex 访问（run.py、roadmap 等）
      // 用户需要使用 'codex login'（例如 `codex login --device-auth`）单独完成 Codex 认证

      // 使用 GitHub 设置更新项目环境配置
      await window.electronAPI.updateProjectEnv(gitHubSetupProject.id, {
        githubEnabled: true,
        githubToken: settings.githubToken, // 用于仓库访问的 GitHub 令牌
        githubRepo: settings.githubRepo
      });

      // 使用 mainBranch 更新项目设置
      await window.electronAPI.updateProjectSettings(gitHubSetupProject.id, {
        mainBranch: settings.mainBranch
      });

      // 刷新项目以获取更新数据
      await loadProjects();
    } catch (error) {
      console.error('Failed to save GitHub settings:', error);
    }

    setShowGitHubSetup(false);
    setGitHubSetupProject(null);
  };

  const handleGitHubSetupSkip = () => {
    setShowGitHubSetup(false);
    setGitHubSetupProject(null);
  };

  const handleSkipInit = () => {
    if (window.DEBUG) console.warn('[InitDialog] User skipped initialization');
    if (pendingProject) {
      setSkippedInitProjectId(pendingProject.id);
    }
    setShowInitDialog(false);
    setPendingProject(null);
    setInitError(null); // 跳过时清除错误
    setInitSuccess(false); // 重置成功标记
  };

  const handleGoToTask = (taskId: string) => {
    // 切换到看板视图
    setActiveView('kanban');
    // 查找并选中任务（按 id 或 specId 匹配）
    const task = tasks.find((t) => t.id === taskId || t.specId === taskId);
    if (task) {
      setSelectedTask(task);
    }
  };

  return (
    <TooltipProvider>
      <ProactiveSwapListener />
      <div className="flex h-screen bg-background">
        {/* 侧边栏 */}
        <Sidebar
          onSettingsClick={() => setIsSettingsDialogOpen(true)}
          onNewTaskClick={() => setIsNewTaskDialogOpen(true)}
          activeView={activeView}
          onViewChange={setActiveView}
        />

        {/* 主内容 */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* 头部 */}
          <header className="electron-drag flex h-14 items-center justify-between border-b border-border bg-card/50 backdrop-blur-sm px-6">
            <div className="electron-no-drag">
              {selectedProject ? (
                <h1 className="font-semibold text-foreground">{selectedProject.name}</h1>
              ) : (
                <div className="text-muted-foreground">
                  Select a project to get started
                </div>
              )}
            </div>
            {selectedProject && (
              <div className="electron-no-drag flex items-center gap-3">
                <UsageIndicator />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsSettingsDialogOpen(true)}
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Settings</TooltipContent>
                </Tooltip>
              </div>
            )}
          </header>

          {/* 主内容区域 */}
          <main className="flex-1 overflow-hidden">
            {selectedProject ? (
              <>
                {activeView === 'kanban' && (
                  <KanbanBoard
                    tasks={tasks}
                    onTaskClick={handleTaskClick}
                    onNewTaskClick={() => setIsNewTaskDialogOpen(true)}
                  />
                )}
                {/* TerminalGrid 始终挂载，非激活时隐藏以保留终端状态 */}
                <div className={activeView === 'terminals' ? 'h-full' : 'hidden'}>
                  <TerminalGrid
                    projectPath={selectedProject?.path}
                    onNewTaskClick={() => setIsNewTaskDialogOpen(true)}
                  />
                </div>
                {activeView === 'roadmap' && selectedProjectId && (
                  <Roadmap projectId={selectedProjectId} onGoToTask={handleGoToTask} />
                )}
                {activeView === 'context' && selectedProjectId && (
                  <Context projectId={selectedProjectId} />
                )}
                {activeView === 'ideation' && selectedProjectId && (
                  <Ideation projectId={selectedProjectId} onGoToTask={handleGoToTask} />
                )}
                {activeView === 'insights' && selectedProjectId && (
                  <Insights projectId={selectedProjectId} />
                )}
                {activeView === 'github-issues' && selectedProjectId && (
                  <GitHubIssues
                    onOpenSettings={() => {
                      setSettingsInitialProjectSection('github');
                      setIsSettingsDialogOpen(true);
                    }}
                    onNavigateToTask={handleGoToTask}
                  />
                )}
                {activeView === 'changelog' && selectedProjectId && (
                  <Changelog />
                )}
                {activeView === 'worktrees' && selectedProjectId && (
                  <Worktrees projectId={selectedProjectId} />
                )}
                {activeView === 'agent-tools' && (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <h2 className="text-lg font-semibold text-foreground">Agent Tools</h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Configure and manage agent tools - Coming soon
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <WelcomeScreen
                projects={projects}
                onNewProject={handleAddProject}
                onOpenProject={handleAddProject}
                onSelectProject={(projectId) => useProjectStore.getState().selectProject(projectId)}
              />
            )}
          </main>
        </div>

        {/* 任务详情弹窗 */}
        <TaskDetailModal
          open={!!selectedTask}
          task={selectedTask}
          onOpenChange={(open) => !open && handleCloseTaskDetail()}
        />

        {/* 对话框 */}
        {selectedProjectId && (
          <TaskCreationWizard
            projectId={selectedProjectId}
            open={isNewTaskDialogOpen}
            onOpenChange={setIsNewTaskDialogOpen}
          />
        )}

        <AppSettingsDialog
          open={isSettingsDialogOpen}
          onOpenChange={(open) => {
            setIsSettingsDialogOpen(open);
            if (!open) {
              // 对话框关闭时重置初始区域
              setSettingsInitialSection(undefined);
              setSettingsInitialProjectSection(undefined);
            }
          }}
          initialSection={settingsInitialSection}
          initialProjectSection={settingsInitialProjectSection}
          onRerunWizard={() => {
            // 重置引导状态以触发向导
            useSettingsStore.getState().updateSettings({ onboardingCompleted: false });
            // 关闭设置对话框
            setIsSettingsDialogOpen(false);
            // 打开引导向导
            setIsOnboardingWizardOpen(true);
          }}
        />

        {/* 初始化 Auto Codex 对话框 */}
        <Dialog open={showInitDialog} onOpenChange={(open) => {
          if (window.DEBUG) {
            console.warn('[InitDialog] onOpenChange called', { open, pendingProject: !!pendingProject, isInitializing, initSuccess });
          }
          // 仅在用户手动关闭对话框时触发跳过
          // 不触发的情况：初始化成功、没有待处理项目、或正在初始化
          if (!open && pendingProject && !isInitializing && !initSuccess) {
            handleSkipInit();
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Initialize Auto Codex
              </DialogTitle>
              <DialogDescription>
                This project doesn't have Auto Codex initialized. Would you like to set it up now?
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="rounded-lg bg-muted p-4 text-sm">
                <p className="font-medium mb-2">This will:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Create a <code className="text-xs bg-background px-1 py-0.5 rounded">.auto-codex</code> folder in your project</li>
                  <li>Copy the Auto Codex framework files</li>
                  <li>Set up the specs directory for your tasks</li>
                </ul>
              </div>
              {!settings.autoBuildPath && (
                <div className="mt-4 rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-warning">Source path not configured</p>
                      <p className="text-muted-foreground mt-1">
                        Please set the Auto Codex source path in App Settings before initializing.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {initError && (
                <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-destructive">Initialization Failed</p>
                      <p className="text-muted-foreground mt-1">
                        {initError}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleSkipInit} disabled={isInitializing}>
                Skip
              </Button>
              <Button
                onClick={handleInitialize}
                disabled={isInitializing || !settings.autoBuildPath}
              >
                {isInitializing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Initialize
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* GitHub 设置弹窗 - Auto Codex 初始化后用于配置 GitHub */}
        {gitHubSetupProject && (
          <GitHubSetupModal
            open={showGitHubSetup}
            onOpenChange={setShowGitHubSetup}
            project={gitHubSetupProject}
            onComplete={handleGitHubSetupComplete}
            onSkip={handleGitHubSetupSkip}
          />
        )}

        {/* 限流弹窗 - Codex 触达用量限制时显示（终端） */}
        <RateLimitModal />

        {/* SDK 限流弹窗 - SDK/CLI 操作触达限制时显示（变更日志、任务等） */}
        <SDKRateLimitModal />

        {/* 引导向导 - 首次启动且 onboardingCompleted 为 false 时显示 */}
        <OnboardingWizard
          open={isOnboardingWizardOpen}
          onOpenChange={setIsOnboardingWizardOpen}
          onOpenTaskCreator={() => {
            setIsOnboardingWizardOpen(false);
            setIsNewTaskDialogOpen(true);
          }}
          onOpenSettings={() => {
            setIsOnboardingWizardOpen(false);
            setIsSettingsDialogOpen(true);
          }}
        />

        {/* 应用更新通知 - 有新版本可用时显示 */}
        <AppUpdateNotification />
      </div>
    </TooltipProvider>
  );
}
