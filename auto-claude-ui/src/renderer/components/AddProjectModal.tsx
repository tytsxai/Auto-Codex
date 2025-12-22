import { useState, useEffect } from 'react';
import { FolderOpen, FolderPlus, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import { cn } from '../lib/utils';
import { addProject } from '../stores/project-store';
import type { Project } from '../../shared/types';

type ModalStep = 'choose' | 'create-form';

interface AddProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectAdded?: (project: Project, needsInit: boolean) => void;
}

export function AddProjectModal({ open, onOpenChange, onProjectAdded }: AddProjectModalProps) {
  const [step, setStep] = useState<ModalStep>('choose');
  const [projectName, setProjectName] = useState('');
  const [projectLocation, setProjectLocation] = useState('');
  const [initGit, setInitGit] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 模态框打开时重置状态
  useEffect(() => {
    if (open) {
      setStep('choose');
      setProjectName('');
      setProjectLocation('');
      setInitGit(true);
      setError(null);
    }
  }, [open]);

  // 挂载时加载默认位置
  useEffect(() => {
    const loadDefaultLocation = async () => {
      try {
        const defaultDir = await window.electronAPI.getDefaultProjectLocation();
        if (defaultDir) {
          setProjectLocation(defaultDir);
        }
      } catch {
        // 忽略 - 结果只会为空
      }
    };
    loadDefaultLocation();
  }, []);

  const handleOpenExisting = async () => {
    try {
      const path = await window.electronAPI.selectDirectory();
      if (path) {
        const project = await addProject(path);
        if (project) {
          // 自动检测并保存项目的主分支
          try {
            const mainBranchResult = await window.electronAPI.detectMainBranch(path);
            if (mainBranchResult.success && mainBranchResult.data) {
              await window.electronAPI.updateProjectSettings(project.id, {
                mainBranch: mainBranchResult.data
              });
            }
          } catch {
            // 非致命错误 - 主分支可稍后在设置中指定
          }
          onProjectAdded?.(project, !project.autoBuildPath);
          onOpenChange(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '打开项目失败');
    }
  };

  const handleSelectLocation = async () => {
    try {
      const path = await window.electronAPI.selectDirectory();
      if (path) {
        setProjectLocation(path);
      }
    } catch {
      // 用户取消 - 忽略
    }
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      setError('请输入项目名称');
      return;
    }
    if (!projectLocation.trim()) {
      setError('请选择位置');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // 创建项目文件夹
      const result = await window.electronAPI.createProjectFolder(
        projectLocation,
        projectName.trim(),
        initGit
      );

      if (!result.success || !result.data) {
        setError(result.error || '创建项目文件夹失败');
        return;
      }

      // 将项目添加到存储中
      const project = await addProject(result.data.path);
      if (project) {
        // 对使用 git init 的新项目设置主分支
        // 现代 git 默认创建 'main' 分支
        if (initGit) {
          try {
            const mainBranchResult = await window.electronAPI.detectMainBranch(result.data.path);
            if (mainBranchResult.success && mainBranchResult.data) {
              await window.electronAPI.updateProjectSettings(project.id, {
                mainBranch: mainBranchResult.data
              });
            }
          } catch {
            // 非致命错误 - 主分支可稍后在设置中指定
          }
        }
        onProjectAdded?.(project, true); // 新项目始终需要初始化
        onOpenChange(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建项目失败');
    } finally {
      setIsCreating(false);
    }
  };

  const renderChooseStep = () => (
    <>
      <DialogHeader>
        <DialogTitle>添加项目</DialogTitle>
        <DialogDescription>
          选择添加项目的方式
        </DialogDescription>
      </DialogHeader>

      <div className="py-4 space-y-3">
        {/* 打开已有选项 */}
        <button
          onClick={handleOpenExisting}
          className={cn(
            'w-full flex items-center gap-4 p-4 rounded-xl border border-border',
            'bg-card hover:bg-accent hover:border-accent transition-all duration-200',
            'text-left group'
          )}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FolderOpen className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground">打开已有文件夹</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              浏览电脑中的现有项目
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>

        {/* 创建新项目选项 */}
        <button
          onClick={() => setStep('create-form')}
          className={cn(
            'w-full flex items-center gap-4 p-4 rounded-xl border border-border',
            'bg-card hover:bg-accent hover:border-accent transition-all duration-200',
            'text-left group'
          )}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-success/10">
            <FolderPlus className="h-6 w-6 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground">创建新项目</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              从新项目文件夹开始
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 mt-2">
          {error}
        </div>
      )}
    </>
  );

  const renderCreateForm = () => (
    <>
      <DialogHeader>
        <DialogTitle>创建新项目</DialogTitle>
        <DialogDescription>
          设置新的项目文件夹
        </DialogDescription>
      </DialogHeader>

      <div className="py-4 space-y-4">
        {/* 项目名称 */}
        <div className="space-y-2">
          <Label htmlFor="project-name">项目名称</Label>
          <Input
            id="project-name"
            placeholder="我的-项目"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            将作为文件夹名称。使用小写并用连字符。
          </p>
        </div>

        {/* 位置 */}
        <div className="space-y-2">
          <Label htmlFor="project-location">位置</Label>
          <div className="flex gap-2">
            <Input
              id="project-location"
              placeholder="选择文件夹..."
              value={projectLocation}
              onChange={(e) => setProjectLocation(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" onClick={handleSelectLocation}>
              浏览
            </Button>
          </div>
          {projectLocation && projectName && (
            <p className="text-xs text-muted-foreground">
              将创建：<code className="bg-muted px-1 py-0.5 rounded">{projectLocation}/{projectName}</code>
            </p>
          )}
        </div>

        {/* Git 初始化复选框 */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="init-git"
            checked={initGit}
            onChange={(e) => setInitGit(e.target.checked)}
            className="h-4 w-4 rounded border-border bg-background"
          />
          <Label htmlFor="init-git" className="text-sm font-normal cursor-pointer">
            初始化 git 仓库
          </Label>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
            {error}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => setStep('choose')} disabled={isCreating}>
          返回
        </Button>
        <Button onClick={handleCreateProject} disabled={isCreating}>
          {isCreating ? '正在创建...' : '创建项目'}
        </Button>
      </DialogFooter>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === 'choose' ? renderChooseStep() : renderCreateForm()}
      </DialogContent>
    </Dialog>
  );
}
