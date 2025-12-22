import { useState, useEffect } from 'react';
import {
  Github,
  GitBranch,
  Key,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';
import { GitHubOAuthFlow } from './project-settings/GitHubOAuthFlow';
import { ClaudeOAuthFlow } from './project-settings/ClaudeOAuthFlow';
import type { Project, ProjectSettings } from '../../shared/types';

interface GitHubSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  onComplete: (settings: { githubToken: string; githubRepo: string; mainBranch: string }) => void;
  onSkip?: () => void;
}

type SetupStep = 'github-auth' | 'claude-auth' | 'repo' | 'branch' | 'complete';

/**
 * 设置模态框 - Auto Claude 初始化后的必需设置流程
 *
 * 流程：
 * 1. 使用 GitHub 认证（通过 gh CLI OAuth）- 用于仓库操作
 * 2. 使用 Claude 认证（通过 claude CLI OAuth）- 用于 AI 功能
 * 3. 检测/确认仓库
 * 4. 选择任务的基础分支（带推荐默认值）
 */
export function GitHubSetupModal({
  open,
  onOpenChange,
  project,
  onComplete,
  onSkip
}: GitHubSetupModalProps) {
  const [step, setStep] = useState<SetupStep>('github-auth');
  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [githubRepo, setGithubRepo] = useState<string | null>(null);
  const [detectedRepo, setDetectedRepo] = useState<string | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [recommendedBranch, setRecommendedBranch] = useState<string | null>(null);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isLoadingRepo, setIsLoadingRepo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 模态框打开时重置状态
  useEffect(() => {
    if (open) {
      setStep('github-auth');
      setGithubToken(null);
      setGithubRepo(null);
      setDetectedRepo(null);
      setBranches([]);
      setSelectedBranch(null);
      setRecommendedBranch(null);
      setError(null);
    }
  }, [open]);

  // 认证成功后从 git remote 检测仓库
  const detectRepository = async () => {
    setIsLoadingRepo(true);
    setError(null);

    try {
      // 尝试从 git remote 检测仓库
      const result = await window.electronAPI.detectGitHubRepo(project.path);
      if (result.success && result.data) {
        setDetectedRepo(result.data);
        setGithubRepo(result.data);
        setStep('branch');
        // 立即加载分支
        await loadBranches(result.data);
      } else {
        // 未检测到远程仓库，显示仓库输入步骤
        setStep('repo');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect repository');
      setStep('repo');
    } finally {
      setIsLoadingRepo(false);
    }
  };

  // 从 GitHub 加载分支
  const loadBranches = async (repo: string) => {
    setIsLoadingBranches(true);
    setError(null);

    try {
      // 从 GitHub API 获取分支
      const result = await window.electronAPI.getGitHubBranches(repo, githubToken!);
      if (result.success && result.data) {
        setBranches(result.data);

        // 检测推荐分支（main > master > develop > first）
        const recommended = detectRecommendedBranch(result.data);
        setRecommendedBranch(recommended);
        setSelectedBranch(recommended);
      } else {
        setError(result.error || 'Failed to load branches');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load branches');
    } finally {
      setIsLoadingBranches(false);
    }
  };

  // 从列表中检测推荐分支
  const detectRecommendedBranch = (branchList: string[]): string | null => {
    const priorities = ['main', 'master', 'develop', 'dev'];
    for (const priority of priorities) {
      if (branchList.includes(priority)) {
        return priority;
      }
    }
    return branchList[0] || null;
  };

  // 处理 GitHub OAuth 成功
  const handleGitHubAuthSuccess = async (token: string) => {
    setGithubToken(token);
    // 进入 Claude 认证步骤
    setStep('claude-auth');
  };

  // 处理 Claude OAuth 成功
  const handleClaudeAuthSuccess = async () => {
    // Claude 令牌已在 OAuth 流程中保存到当前配置文件
    // 进入仓库检测
    await detectRepository();
  };

  // 处理分支选择完成
  const handleComplete = () => {
    if (githubToken && githubRepo && selectedBranch) {
      onComplete({
        githubToken,
        githubRepo,
        mainBranch: selectedBranch
      });
    }
  };

  // 渲染步骤内容
  const renderStepContent = () => {
    switch (step) {
      case 'github-auth':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Github className="h-5 w-5" />
                连接 GitHub
              </DialogTitle>
              <DialogDescription>
                Auto Claude 需要 GitHub 来管理代码分支并保持任务最新。
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <GitHubOAuthFlow
                onSuccess={handleGitHubAuthSuccess}
                onCancel={onSkip}
              />
            </div>
          </>
        );

      case 'claude-auth':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                连接 Claude AI
              </DialogTitle>
              <DialogDescription>
                Auto Claude 使用 Claude AI 提供路线图生成、任务自动化和构思等智能功能。
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <ClaudeOAuthFlow
                onSuccess={handleClaudeAuthSuccess}
                onCancel={onSkip}
              />
            </div>
          </>
        );

      case 'repo':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Github className="h-5 w-5" />
                未检测到仓库
              </DialogTitle>
              <DialogDescription>
                无法检测到该项目的 GitHub 仓库，请确保项目已配置 GitHub 远程仓库。
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">未找到 GitHub 远程仓库</p>
                    <p className="text-xs text-muted-foreground">
                      要使用 Auto Claude，项目需要连接到 GitHub 仓库。
                    </p>
                    <div className="text-xs font-mono bg-muted p-2 rounded mt-2">
                      git remote add origin https://github.com/owner/repo.git
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>

            <DialogFooter>
              {onSkip && (
                <Button variant="outline" onClick={onSkip}>
                  暂时跳过
                </Button>
              )}
              <Button onClick={detectRepository} disabled={isLoadingRepo}>
                {isLoadingRepo ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    正在检查...
                  </>
                ) : (
                  '重新检测'
                )}
              </Button>
            </DialogFooter>
          </>
        );

      case 'branch':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                选择基础分支
              </DialogTitle>
              <DialogDescription>
                选择 Auto Claude 用于创建任务分支的基础分支。
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* 显示检测到的仓库 */}
              {detectedRepo && (
                <div className="flex items-center gap-2 text-sm">
                  <Github className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">仓库：</span>
                  <code className="px-2 py-0.5 bg-muted rounded font-mono text-xs">
                    {detectedRepo}
                  </code>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </div>
              )}

              {/* 分支选择器 */}
              <div className="space-y-2">
                <Label>基础分支</Label>
                <Select
                  value={selectedBranch || ''}
                  onValueChange={setSelectedBranch}
                  disabled={isLoadingBranches || branches.length === 0}
                >
                  <SelectTrigger>
                    {isLoadingBranches ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>正在加载分支...</span>
                      </div>
                    ) : (
                      <SelectValue placeholder="选择分支" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch} value={branch}>
                        <div className="flex items-center gap-2">
                          <span>{branch}</span>
                          {branch === recommendedBranch && (
                            <span className="flex items-center gap-1 text-xs text-success">
                              <Sparkles className="h-3 w-3" />
                              推荐
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  所有任务将从类似{' '}
                  <code className="px-1 bg-muted rounded">auto-claude/task-name</code>
                  {selectedBranch && (
                    <>，基于 <code className="px-1 bg-muted rounded">{selectedBranch}</code></>
                  )}
                </p>
              </div>

              {/* 分支选择说明 */}
              <div className="rounded-lg border border-info/30 bg-info/5 p-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-info mt-0.5" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">为什么选择分支？</p>
                    <p className="mt-1">
                      Auto Claude 为每个任务创建隔离工作区。选择合适的基础分支可确保
                      任务从主开发线的最新代码开始。
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>

            <DialogFooter>
              {onSkip && (
                <Button variant="outline" onClick={onSkip}>
                  暂时跳过
                </Button>
              )}
              <Button
                onClick={handleComplete}
                disabled={!selectedBranch || isLoadingBranches}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                完成设置
              </Button>
            </DialogFooter>
          </>
        );

      case 'complete':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                设置完成
              </DialogTitle>
            </DialogHeader>

            <div className="py-8 flex flex-col items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Auto Claude 已准备就绪！你现在可以创建任务，这些任务将基于
                <code className="px-1 bg-muted rounded">{selectedBranch}</code> 自动创建。
              </p>
            </div>
          </>
        );
    }
  };

  // 进度指示
  const renderProgress = () => {
    const steps: { label: string }[] = [
      { label: '身份验证' },
      { label: '配置' },
    ];

    // 完成步骤不显示进度
    if (step === 'complete') return null;

    // 将步骤映射到进度索引
    // 认证步骤（github-auth、claude-auth、repo）= 0
    // 配置步骤（branch）= 1
    const currentIndex =
      step === 'github-auth' ? 0 :
      step === 'claude-auth' ? 0 :
      step === 'repo' ? 0 :
      1;

    return (
      <div className="flex items-center justify-center gap-2 mb-4">
        {steps.map((s, index) => (
          <div key={index} className="flex items-center">
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                index < currentIndex
                  ? 'bg-success text-success-foreground'
                  : index === currentIndex
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {index < currentIndex ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                index + 1
              )}
            </div>
            <span className={`ml-2 text-xs ${
              index === currentIndex ? 'text-foreground font-medium' : 'text-muted-foreground'
            }`}>
              {s.label}
            </span>
            {index < steps.length - 1 && (
              <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {renderProgress()}
        {renderStepContent()}
      </DialogContent>
    </Dialog>
  );
}
