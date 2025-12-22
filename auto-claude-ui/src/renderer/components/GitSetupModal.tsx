import { useState } from 'react';
import { GitBranch, Terminal, CheckCircle2, AlertCircle, Loader2, FolderGit2 } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import type { Project, GitStatus } from '../../shared/types';

interface GitSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  gitStatus: GitStatus | null;
  onGitInitialized: () => void;
  onSkip?: () => void;
}

export function GitSetupModal({
  open,
  onOpenChange,
  project,
  gitStatus,
  onGitInitialized,
  onSkip
}: GitSetupModalProps) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'info' | 'initializing' | 'success'>('info');

  const needsGitInit = gitStatus && !gitStatus.isGitRepo;
  const _needsCommit = gitStatus && gitStatus.isGitRepo && !gitStatus.hasCommits;

  const handleInitializeGit = async () => {
    if (!project) return;

    setIsInitializing(true);
    setError(null);
    setStep('initializing');

    try {
      // 调用后端初始化 git
      const result = await window.electronAPI.initializeGit(project.path);

      if (result.success) {
        setStep('success');
        // 稍等片刻展示成功，然后触发回调
        setTimeout(() => {
          onGitInitialized();
          onOpenChange(false);
          setStep('info');
        }, 1500);
      } else {
        setError(result.error || '初始化 git 失败');
        setStep('info');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '初始化 git 失败');
      setStep('info');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSkip = () => {
    onSkip?.();
    onOpenChange(false);
  };

  const renderInfoStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FolderGit2 className="h-5 w-5 text-primary" />
          需要 Git 仓库
        </DialogTitle>
        <DialogDescription>
          Auto Claude 使用 git 在隔离工作区中安全构建功能
        </DialogDescription>
      </DialogHeader>

      <div className="py-4 space-y-4">
        {/* 状态指示 */}
        <div className="rounded-lg bg-muted p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium text-sm">
                {needsGitInit
                  ? '此文件夹不是 git 仓库'
                  : 'Git 仓库没有提交记录'}
              </p>
              <p className="text-sm text-muted-foreground">
                {needsGitInit
                  ? '在 Auto Claude 管理代码前需要初始化 git。'
                  : 'Auto Claude 创建工作区需要至少一次提交。'}
              </p>
            </div>
          </div>
        </div>

        {/* 将执行的操作 */}
        <div className="rounded-lg border border-border p-4">
          <p className="font-medium text-sm mb-3">我们将为你设置 git：</p>
          <ul className="space-y-2">
            {needsGitInit && (
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <GitBranch className="h-4 w-4 text-primary" />
                初始化新的 git 仓库
              </li>
            )}
            <li className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              使用当前文件创建初始提交
            </li>
          </ul>
        </div>

        {/* 面向高级用户的手动指引 */}
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            想手动执行？
          </summary>
          <div className="mt-3 rounded-lg bg-muted/50 p-3 font-mono text-xs space-y-1">
            <p className="text-muted-foreground">在项目文件夹打开终端并运行：</p>
            {needsGitInit && <p>git init</p>}
            <p>git add .</p>
            <p>git commit -m "Initial commit"</p>
          </div>
        </details>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={handleSkip}>
          暂时跳过
        </Button>
        <Button onClick={handleInitializeGit} disabled={isInitializing}>
          <GitBranch className="mr-2 h-4 w-4" />
          初始化 Git
        </Button>
      </DialogFooter>
    </>
  );

  const renderInitializingStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          正在设置 Git
        </DialogTitle>
      </DialogHeader>

      <div className="py-8 flex flex-col items-center justify-center">
        <div className="space-y-3 text-center">
          <Terminal className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            正在初始化 git 仓库并创建初始提交...
          </p>
        </div>
      </div>
    </>
  );

  const renderSuccessStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-success" />
          Git 已初始化
        </DialogTitle>
      </DialogHeader>

      <div className="py-8 flex flex-col items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <p className="text-sm text-muted-foreground">
            项目已可在 Auto Claude 中使用！
          </p>
        </div>
      </div>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === 'info' && renderInfoStep()}
        {step === 'initializing' && renderInitializingStep()}
        {step === 'success' && renderSuccessStep()}
      </DialogContent>
    </Dialog>
  );
}
