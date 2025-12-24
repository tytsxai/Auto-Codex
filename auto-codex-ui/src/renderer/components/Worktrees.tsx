import { useEffect, useState, useCallback } from 'react';
import {
  GitBranch,
  RefreshCw,
  Trash2,
  Loader2,
  AlertCircle,
  FolderOpen,
  GitMerge,
  FileCode,
  Plus,
  Minus,
  ChevronRight,
  Check,
  X,
  Clock,
  AlertTriangle,
  HardDrive,
  Shield,
  ArrowUpDown
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from './ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from './ui/tooltip';
import { useProjectStore } from '../stores/project-store';
import { useTaskStore } from '../stores/task-store';
import type { WorktreeListItem, WorktreeMergeResult, WorktreeHealthStatus, ConflictRisk, MergeOrderSuggestion } from '../../shared/types';

interface WorktreesProps {
  projectId: string;
}

export function Worktrees({ projectId }: WorktreesProps) {
  const projects = useProjectStore((state) => state.projects);
  const selectedProject = projects.find((p) => p.id === projectId);
  const tasks = useTaskStore((state) => state.tasks);

  const [worktrees, setWorktrees] = useState<WorktreeListItem[]>([]);
  const [staleCount, setStaleCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Health status state
  const [healthStatus, setHealthStatus] = useState<WorktreeHealthStatus | null>(null);
  const [conflictRisks, setConflictRisks] = useState<ConflictRisk[]>([]);
  const [mergeOrder, setMergeOrder] = useState<MergeOrderSuggestion | null>(null);

  // Merge dialog state
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [selectedWorktree, setSelectedWorktree] = useState<WorktreeListItem | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<WorktreeMergeResult | null>(null);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [worktreeToDelete, setWorktreeToDelete] = useState<WorktreeListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load worktrees
  const loadWorktrees = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.listWorktrees(projectId);
      if (result.success && result.data) {
        setWorktrees(result.data.worktrees);
        setStaleCount(result.data.staleCount || 0);
      } else {
        setError(result.error || '加载工作树失败');
      }

      // Load health status
      const healthResult = await window.electronAPI.getHealthStatus();
      if (healthResult.success && healthResult.data) {
        setHealthStatus(healthResult.data);
      }

      // Load conflict risks
      const conflictResult = await window.electronAPI.getConflictRisks();
      if (conflictResult.success && conflictResult.data) {
        setConflictRisks(conflictResult.data);
      }

      // Load merge order suggestion
      const orderResult = await window.electronAPI.getMergeOrder();
      if (orderResult.success && orderResult.data) {
        setMergeOrder(orderResult.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载工作树失败');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Load on mount and when project changes
  useEffect(() => {
    loadWorktrees();
  }, [loadWorktrees]);

  // Find task for a worktree
  const findTaskForWorktree = (specName: string) => {
    return tasks.find((t) => t.projectId === projectId && t.specId === specName);
  };

  // Get conflict risk for a worktree
  const getConflictRiskForWorktree = (specName: string): ConflictRisk | undefined => {
    return conflictRisks.find(
      (r) => r.worktreeA === specName || r.worktreeB === specName
    );
  };

  // Get merge order position
  const getMergeOrderPosition = (specName: string): number | undefined => {
    if (!mergeOrder) return undefined;
    const index = mergeOrder.order.indexOf(specName);
    return index >= 0 ? index + 1 : undefined;
  };

  // Get risk level badge variant
  const getRiskBadgeVariant = (level: string): 'default' | 'outline' | 'destructive' | 'secondary' => {
    switch (level) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      default:
        return 'secondary';
    }
  };

  // Handle merge
  const handleMerge = async () => {
    if (!selectedWorktree) return;

    const task = findTaskForWorktree(selectedWorktree.specName);
    if (!task) {
      setError('未找到此工作树对应的任务');
      return;
    }

    setIsMerging(true);
    try {
      const result = await window.electronAPI.mergeWorktree(task.id);
      if (result.success && result.data) {
        setMergeResult(result.data);
        if (result.data.success) {
          // Refresh worktrees after successful merge
          await loadWorktrees();
        }
      } else {
        setMergeResult({
          success: false,
          message: result.error || '合并失败'
        });
      }
    } catch (err) {
      setMergeResult({
        success: false,
        message: err instanceof Error ? err.message : '合并失败'
      });
    } finally {
      setIsMerging(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!worktreeToDelete) return;

    const task = findTaskForWorktree(worktreeToDelete.specName);
    if (!task) {
      setError('未找到此工作树对应的任务');
      return;
    }

    setIsDeleting(true);
    try {
      const result = await window.electronAPI.discardWorktree(task.id);
      if (result.success) {
        // Refresh worktrees after successful delete
        await loadWorktrees();
        setShowDeleteConfirm(false);
        setWorktreeToDelete(null);
      } else {
        setError(result.error || '删除工作树失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除工作树失败');
    } finally {
      setIsDeleting(false);
    }
  };

  // Open merge dialog
  const openMergeDialog = (worktree: WorktreeListItem) => {
    setSelectedWorktree(worktree);
    setMergeResult(null);
    setShowMergeDialog(true);
  };

  // Confirm delete
  const confirmDelete = (worktree: WorktreeListItem) => {
    setWorktreeToDelete(worktree);
    setShowDeleteConfirm(true);
  };

  if (!selectedProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">选择项目以查看工作树</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GitBranch className="h-6 w-6" />
            工作树
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            管理 Auto Codex 任务的独立工作区
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadWorktrees}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm">
          <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-destructive">错误</p>
              <p className="text-muted-foreground mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stale worktrees warning */}
      {staleCount > 0 && (
        <div className="mb-4 rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-warning">发现 {staleCount} 个过期工作树</p>
              <p className="text-muted-foreground mt-1">
                这些工作树已超过 7 天没有活动。考虑清理未使用的工作树以节省磁盘空间。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Health Status Summary */}
      {healthStatus && worktrees.length > 0 && (
        <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-info" />
              <div>
                <p className="text-xs text-muted-foreground">工作树</p>
                <p className="text-lg font-semibold">{healthStatus.totalCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">磁盘占用</p>
                <p className="text-lg font-semibold">{healthStatus.totalDiskUsageMb.toFixed(1)} MB</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              <div>
                <p className="text-xs text-muted-foreground">过期</p>
                <p className="text-lg font-semibold">{healthStatus.staleCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-destructive" />
              <div>
                <p className="text-xs text-muted-foreground">冲突风险</p>
                <p className="text-lg font-semibold">{conflictRisks.length}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Merge Order Suggestion */}
      {mergeOrder && mergeOrder.order.length > 1 && (
        <div className="mb-4 rounded-lg border border-info/50 bg-info/10 p-4 text-sm">
          <div className="flex items-start gap-2">
            <ArrowUpDown className="h-4 w-4 text-info mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-info">建议合并顺序</p>
              <p className="text-muted-foreground mt-1">{mergeOrder.reason}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {mergeOrder.order.map((spec, i) => (
                  <Badge key={spec} variant="outline" className="text-xs">
                    {i + 1}. {spec}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && worktrees.length === 0 && (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && worktrees.length === 0 && (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <GitBranch className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">暂无工作树</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            Auto Codex 构建功能时会自动创建工作树。
            它们为每个任务提供独立的工作区。
          </p>
        </div>
      )}

      {/* Worktrees list */}
      {worktrees.length > 0 && (
        <ScrollArea className="flex-1 -mx-2">
          <div className="space-y-4 px-2">
            {worktrees.map((worktree) => {
              const task = findTaskForWorktree(worktree.specName);
              const conflictRisk = getConflictRiskForWorktree(worktree.specName);
              const orderPosition = getMergeOrderPosition(worktree.specName);
              return (
                <Card key={worktree.specName} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base flex items-center gap-2">
                          <GitBranch className="h-4 w-4 text-info shrink-0" />
                          <span className="truncate">{worktree.branch}</span>
                          {worktree.isStale && (
                            <Badge variant="outline" className="shrink-0 text-warning border-warning/50 bg-warning/10">
                              <Clock className="h-3 w-3 mr-1" />
                              过期
                            </Badge>
                          )}
                          {conflictRisk && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant={getRiskBadgeVariant(conflictRisk.riskLevel)}
                                    className="shrink-0"
                                  >
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    冲突风险
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>与 {conflictRisk.worktreeA === worktree.specName ? conflictRisk.worktreeB : conflictRisk.worktreeA} 有 {conflictRisk.conflictingFiles.length} 个文件冲突</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {orderPosition && (
                            <Badge variant="outline" className="shrink-0 text-info border-info/50">
                              #{orderPosition}
                            </Badge>
                          )}
                        </CardTitle>
                        {task && (
                          <CardDescription className="mt-1 truncate">
                            {task.title}
                          </CardDescription>
                        )}
                      </div>
                      <Badge variant="outline" className="shrink-0 ml-2">
                        {worktree.specName}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {/* Stats */}
                    <div className="flex flex-wrap gap-4 text-sm mb-4">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <FileCode className="h-3.5 w-3.5" />
                        <span>{worktree.filesChanged} 个文件更改</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <ChevronRight className="h-3.5 w-3.5" />
                        <span>{worktree.commitCount} 个提交领先</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-success">
                        <Plus className="h-3.5 w-3.5" />
                        <span>{worktree.additions}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-destructive">
                        <Minus className="h-3.5 w-3.5" />
                        <span>{worktree.deletions}</span>
                      </div>
                      {worktree.daysSinceLastActivity !== undefined && (
                        <div className={`flex items-center gap-1.5 ${worktree.isStale ? 'text-warning' : 'text-muted-foreground'}`}>
                          <Clock className="h-3.5 w-3.5" />
                          <span>{worktree.daysSinceLastActivity} 天前活动</span>
                        </div>
                      )}
                    </div>

                    {/* Branch info */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 bg-muted/50 rounded-md p-2">
                      <span className="font-mono">{worktree.baseBranch}</span>
                      <ChevronRight className="h-3 w-3" />
                      <span className="font-mono text-info">{worktree.branch}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => openMergeDialog(worktree)}
                        disabled={!task}
                      >
                        <GitMerge className="h-3.5 w-3.5 mr-1.5" />
                        暂存到 {worktree.baseBranch}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Copy worktree path to clipboard
                          void navigator.clipboard.writeText(worktree.path).catch((err) => {
                            setError(err instanceof Error ? err.message : '复制路径失败');
                          });
                        }}
                      >
                        <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                        复制路径
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => confirmDelete(worktree)}
                        disabled={!task}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        删除
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}

      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5" />
              暂存工作树更改
            </DialogTitle>
            <DialogDescription>
              将此工作树的更改暂存到基础分支。暂存后可在"暂存更改"面板中统一审查和提交。
            </DialogDescription>
          </DialogHeader>

          {selectedWorktree && !mergeResult && (
            <div className="py-4">
              <div className="rounded-lg bg-muted p-4 text-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">源分支</span>
                  <span className="font-mono text-info">{selectedWorktree.branch}</span>
                </div>
                <div className="flex items-center justify-center">
                  <ChevronRight className="h-4 w-4 text-muted-foreground rotate-90" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">目标分支</span>
                  <span className="font-mono">{selectedWorktree.baseBranch}</span>
                </div>
                <div className="border-t border-border pt-3 mt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">更改</span>
                    <span>
                      {selectedWorktree.commitCount} 个提交，{selectedWorktree.filesChanged} 个文件
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {mergeResult && (
            <div className="py-4">
              <div className={`rounded-lg p-4 text-sm ${
                mergeResult.success
                  ? mergeResult.staged
                    ? 'bg-info/10 border border-info/30'
                    : 'bg-success/10 border border-success/30'
                  : 'bg-destructive/10 border border-destructive/30'
              }`}>
                <div className="flex items-start gap-2">
                  {mergeResult.success ? (
                    mergeResult.staged ? (
                      <GitMerge className="h-4 w-4 text-info mt-0.5" />
                    ) : (
                      <Check className="h-4 w-4 text-success mt-0.5" />
                    )
                  ) : (
                    <X className="h-4 w-4 text-destructive mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-medium ${
                      mergeResult.success
                        ? mergeResult.staged
                          ? 'text-info'
                          : 'text-success'
                        : 'text-destructive'
                    }`}>
                      {mergeResult.success
                        ? mergeResult.staged
                          ? '已暂存'
                          : '合并成功'
                        : '合并失败'}
                    </p>
                    <p className="text-muted-foreground mt-1">{mergeResult.message}</p>
                    {mergeResult.staged && (
                      <p className="text-xs text-muted-foreground mt-2">
                        更改已暂存到主仓库，可在"暂存更改"面板中查看和提交。
                      </p>
                    )}
                    {mergeResult.suggestedCommitMessage && (
                      <div className="mt-3 p-2 bg-muted/50 rounded text-xs">
                        <p className="font-medium mb-1">建议的提交消息：</p>
                        <p className="font-mono text-muted-foreground">{mergeResult.suggestedCommitMessage}</p>
                      </div>
                    )}
                    {mergeResult.conflictFiles && mergeResult.conflictFiles.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium">冲突文件：</p>
                        <ul className="list-disc list-inside text-xs mt-1">
                          {mergeResult.conflictFiles.map(file => (
                            <li key={file} className="font-mono">{file}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowMergeDialog(false);
                setMergeResult(null);
              }}
            >
              {mergeResult ? '关闭' : '取消'}
            </Button>
            {!mergeResult && (
              <Button
                onClick={handleMerge}
                disabled={isMerging}
              >
                {isMerging ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    暂存中...
                  </>
                ) : (
                  <>
                    <GitMerge className="h-4 w-4 mr-2" />
                    暂存更改
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除工作树？</AlertDialogTitle>
            <AlertDialogDescription>
              这将永久删除该工作树及所有未提交的更改。
              {worktreeToDelete && (
                <span className="block mt-2 font-mono text-sm">
                  {worktreeToDelete.branch}
                </span>
              )}
              此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  删除中...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
