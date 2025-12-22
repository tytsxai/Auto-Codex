import { useState, useEffect } from 'react';
import {
  FolderOpen,
  Plus,
  Settings,
  Trash2,
  LayoutGrid,
  Terminal,
  Map,
  BookOpen,
  Lightbulb,
  AlertCircle,
  Download,
  RefreshCw,
  Github,
  FileText,
  Sparkles,
  GitBranch,
  HelpCircle
} from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from './ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import { cn } from '../lib/utils';
import {
  useProjectStore,
  removeProject,
  initializeProject,
  checkProjectVersion,
  updateProjectAutoBuild
} from '../stores/project-store';
import { useSettingsStore } from '../stores/settings-store';
import { AddProjectModal } from './AddProjectModal';
import { GitSetupModal } from './GitSetupModal';
import { RateLimitIndicator } from './RateLimitIndicator';
import type { Project, AutoBuildVersionInfo, GitStatus } from '../../shared/types';

export type SidebarView = 'kanban' | 'terminals' | 'roadmap' | 'context' | 'ideation' | 'github-issues' | 'changelog' | 'insights' | 'worktrees' | 'agent-tools';

interface SidebarProps {
  onSettingsClick: () => void;
  onNewTaskClick: () => void;
  activeView?: SidebarView;
  onViewChange?: (view: SidebarView) => void;
}

interface NavItem {
  id: SidebarView;
  label: string;
  icon: React.ElementType;
  shortcut?: string;
}

const projectNavItems: NavItem[] = [
  { id: 'kanban', label: '看板', icon: LayoutGrid, shortcut: 'K' },
  { id: 'terminals', label: '智能体终端', icon: Terminal, shortcut: 'A' },
  { id: 'insights', label: '洞察', icon: Sparkles, shortcut: 'N' },
  { id: 'roadmap', label: '路线图', icon: Map, shortcut: 'D' },
  { id: 'ideation', label: '创意', icon: Lightbulb, shortcut: 'I' },
  { id: 'changelog', label: '变更日志', icon: FileText, shortcut: 'L' },
  { id: 'context', label: '上下文', icon: BookOpen, shortcut: 'C' }
];

const toolsNavItems: NavItem[] = [
  { id: 'github-issues', label: 'GitHub 问题', icon: Github, shortcut: 'G' },
  { id: 'worktrees', label: '工作树', icon: GitBranch, shortcut: 'W' }
];

export function Sidebar({
  onSettingsClick,
  onNewTaskClick,
  activeView = 'kanban',
  onViewChange
}: SidebarProps) {
  const projects = useProjectStore((state) => state.projects);
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);
  const selectProject = useProjectStore((state) => state.selectProject);
  const settings = useSettingsStore((state) => state.settings);

  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showInitDialog, setShowInitDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showGitSetupModal, setShowGitSetupModal] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [pendingProject, setPendingProject] = useState<Project | null>(null);
  const [_versionInfo, setVersionInfo] = useState<AutoBuildVersionInfo | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 输入时不触发快捷键
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      // 仅在已选择项目时处理快捷键
      if (!selectedProjectId) return;

      // 检查修饰键 - 只处理普通按键
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toUpperCase();

      // 查找匹配的导航项
      const allNavItems = [...projectNavItems, ...toolsNavItems];
      const matchedItem = allNavItems.find((item) => item.shortcut === key);

      if (matchedItem) {
        e.preventDefault();
        onViewChange?.(matchedItem.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProjectId, onViewChange]);

  // 项目变更时检查更新
  useEffect(() => {
    const checkUpdates = async () => {
      if (selectedProjectId && settings.autoUpdateAutoBuild) {
        const info = await checkProjectVersion(selectedProjectId);
        if (info?.updateAvailable) {
          setVersionInfo(info);
          setShowUpdateDialog(true);
        }
      }
    };
    checkUpdates();
  }, [selectedProjectId, settings.autoUpdateAutoBuild]);

  // 项目变更时检查 Git 状态
  useEffect(() => {
    const checkGit = async () => {
      if (selectedProject) {
        try {
          const result = await window.electronAPI.checkGitStatus(selectedProject.path);
          if (result.success && result.data) {
            setGitStatus(result.data);
            // 如果项目不是 Git 仓库或没有提交，则显示 Git 设置弹窗
            if (!result.data.isGitRepo || !result.data.hasCommits) {
              setShowGitSetupModal(true);
            }
          }
        } catch (error) {
          console.error('Failed to check git status:', error);
        }
      } else {
        setGitStatus(null);
      }
    };
    checkGit();
  }, [selectedProject]);

  const handleAddProject = () => {
    setShowAddProjectModal(true);
  };

  const handleProjectAdded = (project: Project, needsInit: boolean) => {
    if (needsInit) {
      setPendingProject(project);
      setShowInitDialog(true);
    }
  };

  const handleInitialize = async () => {
    if (!pendingProject) return;

    const projectId = pendingProject.id;
    setIsInitializing(true);
    try {
      const result = await initializeProject(projectId);
      if (result?.success) {
        // 关闭对话框前先清空 pendingProject
        // 这可避免 onOpenChange 触发跳过逻辑
        setPendingProject(null);
        setShowInitDialog(false);
      }
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSkipInit = () => {
    setShowInitDialog(false);
    setPendingProject(null);
  };

  const _handleUpdate = async () => {
    if (!selectedProjectId) return;

    setIsInitializing(true);
    try {
      const result = await updateProjectAutoBuild(selectedProjectId);
      if (result?.success) {
        setShowUpdateDialog(false);
        setVersionInfo(null);
      }
    } finally {
      setIsInitializing(false);
    }
  };

  const _handleSkipUpdate = () => {
    setShowUpdateDialog(false);
    setVersionInfo(null);
  };

  const handleGitInitialized = async () => {
    // 初始化后刷新 Git 状态
    if (selectedProject) {
      try {
        const result = await window.electronAPI.checkGitStatus(selectedProject.path);
        if (result.success && result.data) {
          setGitStatus(result.data);
        }
      } catch (error) {
        console.error('Failed to refresh git status:', error);
      }
    }
  };

  const _handleRemoveProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    await removeProject(projectId);
  };

  const handleProjectChange = (projectId: string) => {
    if (projectId === '__add_new__') {
      handleAddProject();
    } else {
      selectProject(projectId);
    }
  };

  const handleNavClick = (view: SidebarView) => {
    onViewChange?.(view);
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = activeView === item.id;
    const Icon = item.icon;

    return (
      <button
        key={item.id}
        onClick={() => handleNavClick(item.id)}
        disabled={!selectedProjectId}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200',
          'hover:bg-accent hover:text-accent-foreground',
          'disabled:pointer-events-none disabled:opacity-50',
          isActive && 'bg-accent text-accent-foreground'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        {item.shortcut && (
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded-md border border-border bg-secondary px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
            {item.shortcut}
          </kbd>
        )}
      </button>
    );
  };

  return (
    <TooltipProvider>
      <div className="flex h-full w-64 flex-col bg-sidebar border-r border-border">
        {/* 带拖拽区域的头部 - 为 macOS 交通灯预留额外顶部内边距 */}
        <div className="electron-drag flex h-14 items-center px-4 pt-6">
          <span className="electron-no-drag text-lg font-bold text-primary">Auto Claude</span>
        </div>

        <Separator className="mt-2" />

        {/* 项目选择下拉框 */}
        <div className="px-4 py-4">
          <Select
            value={selectedProjectId || ''}
            onValueChange={handleProjectChange}
          >
            <SelectTrigger className="w-full [&_span]:truncate">
              <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="选择项目..." className="truncate min-w-0 flex-1" />
              </div>
            </SelectTrigger>
            <SelectContent className="min-w-(--radix-select-trigger-width) max-w-(--radix-select-trigger-width)">
              {projects.length === 0 ? (
                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                  <p>暂无项目</p>
                </div>
              ) : (
                projects.map((project) => (
                  <div key={project.id} className="relative flex items-center">
                    <SelectItem value={project.id} className="flex-1 pr-10">
                      <span className="truncate" title={`${project.name} - ${project.path}`}>
                        {project.name}
                      </span>
                    </SelectItem>
                    <button
                      type="button"
                      className="absolute right-2 flex h-6 w-6 items-center justify-center rounded-md hover:bg-destructive/10 transition-colors"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        removeProject(project.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                ))
              )}
              <Separator className="my-1" />
              <SelectItem value="__add_new__">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>添加项目...</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* 项目路径 - 选中项目时显示 */}
          {selectedProject && (
            <div className="mt-2">
              <span className="truncate block text-xs text-muted-foreground" title={selectedProject.path}>
                {selectedProject.path}
              </span>
            </div>
          )}
        </div>

        <Separator />

        {/* 导航 */}
        <ScrollArea className="flex-1">
          <div className="px-3 py-4">
            {/* 项目区 */}
            <div className="mb-6">
              <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                项目
              </h3>
              <nav className="space-y-1">
                {projectNavItems.map(renderNavItem)}
              </nav>
            </div>

            {/* 工具区 */}
            <div>
              <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                工具
              </h3>
              <nav className="space-y-1">
                {toolsNavItems.map(renderNavItem)}
              </nav>
            </div>
          </div>
        </ScrollArea>

        <Separator />

        {/* 速率限制指示器 - Claude 触发限流时显示 */}
        <RateLimitIndicator />

        {/* 底部区域，包含设置、帮助和新建任务 */}
        <div className="p-4 space-y-3">
          {/* 设置与帮助行 */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 justify-start gap-2"
                  onClick={onSettingsClick}
                >
                  <Settings className="h-4 w-4" />
                  设置
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">应用设置</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => window.open('https://github.com/AndyMik90/Auto-Claude/issues', '_blank')}
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">帮助与反馈</TooltipContent>
            </Tooltip>
          </div>

          {/* 新建任务按钮 */}
          <Button
            className="w-full"
            onClick={onNewTaskClick}
            disabled={!selectedProjectId || !selectedProject?.autoBuildPath}
          >
            <Plus className="mr-2 h-4 w-4" />
            新建任务
          </Button>
          {selectedProject && !selectedProject.autoBuildPath && (
            <p className="mt-2 text-xs text-muted-foreground text-center">
              初始化 Auto Claude 以创建任务
            </p>
          )}
        </div>
      </div>

      {/* 初始化 Auto Claude 对话框 */}
      <Dialog open={showInitDialog} onOpenChange={(open) => {
        // 仅允许用户手动关闭（初始化期间不允许）
        if (!open && !isInitializing) {
          handleSkipInit();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              初始化 Auto Claude
            </DialogTitle>
            <DialogDescription>
              此项目尚未初始化 Auto Claude。是否现在设置？
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="font-medium mb-2">这将：</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>在项目中创建 <code className="text-xs bg-background px-1 py-0.5 rounded">.auto-claude</code> 文件夹</li>
                <li>复制 Auto Claude 框架文件</li>
                <li>设置任务规格目录</li>
              </ul>
            </div>
            {!settings.autoBuildPath && (
              <div className="mt-4 rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-warning">源路径未配置</p>
                    <p className="text-muted-foreground mt-1">
                      请在应用设置中设置 Auto Claude 源路径后再初始化。
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleSkipInit} disabled={isInitializing}>
              跳过
            </Button>
            <Button
              onClick={handleInitialize}
              disabled={isInitializing || !settings.autoBuildPath}
            >
              {isInitializing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  初始化中...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  初始化
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 更新 Auto Claude 对话框 - 已弃用，updateAvailable 现在始终为 false */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Auto Claude
            </DialogTitle>
            <DialogDescription>
              项目已初始化。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpdateDialog(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加项目弹窗 */}
      <AddProjectModal
        open={showAddProjectModal}
        onOpenChange={setShowAddProjectModal}
        onProjectAdded={handleProjectAdded}
      />

      {/* Git 设置弹窗 */}
      <GitSetupModal
        open={showGitSetupModal}
        onOpenChange={setShowGitSetupModal}
        project={selectedProject || null}
        gitStatus={gitStatus}
        onGitInitialized={handleGitInitialized}
      />
    </TooltipProvider>
  );
}
