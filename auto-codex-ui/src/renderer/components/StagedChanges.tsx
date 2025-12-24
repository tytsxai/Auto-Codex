import { useEffect, useState, useCallback } from 'react';
import {
  GitCommit,
  RefreshCw,
  Loader2,
  AlertCircle,
  FileCode,
  Check,
  X,
  Trash2,
  ChevronDown,
  ChevronRight,
  Clock,
  FolderGit2,
  Play,
  CheckCircle2
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from './ui/collapsible';
import type { StagedChange, CommitResult, ReviewReport, CommitMode } from '../../shared/types';

interface StagedChangesProps {
  projectId: string;
}

export function StagedChanges({ projectId: _projectId }: StagedChangesProps) {
  const [stagedChanges, setStagedChanges] = useState<StagedChange[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Commit dialog state
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [commitMode, setCommitMode] = useState<CommitMode>('all');
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitResult | CommitResult[] | null>(null);

  // Review state
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewReport, setReviewReport] = useState<ReviewReport | null>(null);

  // Discard confirmation
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  // Expanded tasks
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Load staged changes
  const loadStagedChanges = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.getStagedChanges();
      if (result.success && result.data) {
        setStagedChanges(result.data);
      } else {
        setError(result.error || '加载暂存更改失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载暂存更改失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadStagedChanges();
  }, [loadStagedChanges]);

  // Generate commit message
  const generateCommitMessage = async () => {
    try {
      const result = await window.electronAPI.generateCommitMessage(commitMode);
      if (result.success && result.data) {
        setCommitMessage(result.data.message);
      }
    } catch (err) {
      console.error('Failed to generate commit message:', err);
    }
  };

  // Run AI review
  const handleReview = async () => {
    setIsReviewing(true);
    setReviewReport(null);

    try {
      const result = await window.electronAPI.aiReview();
      if (result.success && result.data) {
        setReviewReport(result.data);
      } else {
        setError(result.error || 'AI 审查失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 审查失败');
    } finally {
      setIsReviewing(false);
    }
  };

  // Handle commit
  const handleCommit = async () => {
    setIsCommitting(true);
    setCommitResult(null);

    try {
      const result = await window.electronAPI.commitChanges({
        mode: commitMode,
        message: commitMessage,
        selectedFiles: commitMode === 'partial' ? Array.from(selectedFiles) : undefined
      });

      if (result.success && result.data) {
        setCommitResult(result.data);
        // Refresh staged changes
        await loadStagedChanges();
      } else {
        setCommitResult({
          success: false,
          message: '',
          filesCommitted: [],
          error: result.error || '提交失败'
        });
      }
    } catch (err) {
      setCommitResult({
        success: false,
        message: '',
        filesCommitted: [],
        error: err instanceof Error ? err.message : '提交失败'
      });
    } finally {
      setIsCommitting(false);
    }
  };

  // Handle discard
  const handleDiscard = async () => {
    setIsDiscarding(true);

    try {
      const result = await window.electronAPI.discardChanges({});
      if (result.success) {
        await loadStagedChanges();
        setShowDiscardConfirm(false);
        setReviewReport(null);
      } else {
        setError(result.error || '撤销更改失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '撤销更改失败');
    } finally {
      setIsDiscarding(false);
    }
  };

  // Toggle task expansion
  const toggleTask = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Toggle file selection
  const toggleFile = (file: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) {
        next.delete(file);
      } else {
        next.add(file);
      }
      return next;
    });
  };

  // Get all files
  const allFiles = stagedChanges.flatMap((c) => c.files);
  const totalFiles = allFiles.length;

  // Open commit dialog
  const openCommitDialog = () => {
    setCommitResult(null);
    setCommitMessage('');
    setSelectedFiles(new Set(allFiles));
    generateCommitMessage();
    setShowCommitDialog(true);
  };

  if (stagedChanges.length === 0 && !isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center p-6">
        <div className="rounded-full bg-muted p-4 mb-4">
          <FolderGit2 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">暂无暂存更改</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          合并工作树后，更改会暂存在这里等待审查和提交。
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={loadStagedChanges}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GitCommit className="h-6 w-6" />
            暂存更改
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {stagedChanges.length} 个任务，{totalFiles} 个文件待提交
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadStagedChanges} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReview}
            disabled={isReviewing || stagedChanges.length === 0}
          >
            {isReviewing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            AI 审查
          </Button>
        </div>
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

      {/* Review Report */}
      {reviewReport && (
        <div
          className={`mb-4 rounded-lg border p-4 text-sm ${
            reviewReport.success
              ? 'border-success/50 bg-success/10'
              : 'border-warning/50 bg-warning/10'
          }`}
        >
          <div className="flex items-start gap-2">
            {reviewReport.success ? (
              <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            )}
            <div className="flex-1">
              <p className={`font-medium ${reviewReport.success ? 'text-success' : 'text-warning'}`}>
                {reviewReport.summary}
              </p>
              {reviewReport.issues.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {reviewReport.issues.map((issue, i) => (
                    <li key={i} className="text-muted-foreground">
                      <span className="font-mono text-xs">{issue.file}</span>: {issue.message}
                    </li>
                  ))}
                </ul>
              )}
              {reviewReport.suggestions.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-muted-foreground">建议：</p>
                  <ul className="list-disc list-inside text-xs mt-1">
                    {reviewReport.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && stagedChanges.length === 0 && (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Staged changes list */}
      <ScrollArea className="flex-1 -mx-2">
        <div className="space-y-3 px-2">
          {stagedChanges.map((change) => (
            <Collapsible
              key={change.taskId}
              open={expandedTasks.has(change.taskId)}
              onOpenChange={() => toggleTask(change.taskId)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {expandedTasks.has(change.taskId) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <CardTitle className="text-base">{change.specName}</CardTitle>
                        <Badge variant="outline">{change.files.length} 文件</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(change.stagedAt).toLocaleString()}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-1">
                      {change.files.map((file) => (
                        <div
                          key={file}
                          className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-muted/50"
                        >
                          <FileCode className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-mono text-xs truncate">{file}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>

      {/* Action buttons */}
      <div className="mt-6 flex gap-3 justify-end border-t border-border pt-4">
        <Button
          variant="outline"
          onClick={() => setShowDiscardConfirm(true)}
          disabled={stagedChanges.length === 0}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          撤销全部
        </Button>
        <Button onClick={openCommitDialog} disabled={stagedChanges.length === 0}>
          <GitCommit className="h-4 w-4 mr-2" />
          提交更改
        </Button>
      </div>

      {/* Commit Dialog */}
      <Dialog open={showCommitDialog} onOpenChange={setShowCommitDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCommit className="h-5 w-5" />
              提交更改
            </DialogTitle>
            <DialogDescription>选择提交模式并输入提交消息</DialogDescription>
          </DialogHeader>

          {!commitResult && (
            <div className="space-y-4 py-4">
              {/* Commit mode */}
              <div className="space-y-2">
                <Label>提交模式</Label>
                <Select
                  value={commitMode}
                  onValueChange={(v) => {
                    setCommitMode(v as CommitMode);
                    // Regenerate message when mode changes
                    setTimeout(generateCommitMessage, 100);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部提交 - 所有更改合并为一个提交</SelectItem>
                    <SelectItem value="by_task">按任务提交 - 每个任务单独提交</SelectItem>
                    <SelectItem value="partial">部分提交 - 选择要提交的文件</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Commit message */}
              <div className="space-y-2">
                <Label>提交消息</Label>
                <Input
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="feat: implement feature"
                />
              </div>

              {/* File selection for partial mode */}
              {commitMode === 'partial' && (
                <div className="space-y-2">
                  <Label>选择文件</Label>
                  <ScrollArea className="h-48 border rounded-md p-2">
                    {allFiles.map((file) => (
                      <div key={file} className="flex items-center gap-2 py-1">
                        <Checkbox
                          checked={selectedFiles.has(file)}
                          onCheckedChange={() => toggleFile(file)}
                        />
                        <span className="font-mono text-xs truncate">{file}</span>
                      </div>
                    ))}
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground">
                    已选择 {selectedFiles.size} / {allFiles.length} 个文件
                  </p>
                </div>
              )}
            </div>
          )}

          {commitResult && (
            <div className="py-4">
              {Array.isArray(commitResult) ? (
                <div className="space-y-2">
                  {commitResult.map((r, i) => (
                    <div
                      key={i}
                      className={`rounded-lg p-3 text-sm ${
                        r.success
                          ? 'bg-success/10 border border-success/30'
                          : 'bg-destructive/10 border border-destructive/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {r.success ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : (
                          <X className="h-4 w-4 text-destructive" />
                        )}
                        <span className={r.success ? 'text-success' : 'text-destructive'}>
                          {r.success ? '提交成功' : '提交失败'}
                        </span>
                      </div>
                      {r.commitHash && (
                        <p className="text-xs font-mono text-muted-foreground mt-1">
                          {r.commitHash.substring(0, 8)}
                        </p>
                      )}
                      {r.error && <p className="text-xs text-destructive mt-1">{r.error}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className={`rounded-lg p-4 text-sm ${
                    commitResult.success
                      ? 'bg-success/10 border border-success/30'
                      : 'bg-destructive/10 border border-destructive/30'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {commitResult.success ? (
                      <Check className="h-4 w-4 text-success mt-0.5" />
                    ) : (
                      <X className="h-4 w-4 text-destructive mt-0.5" />
                    )}
                    <div>
                      <p
                        className={`font-medium ${
                          commitResult.success ? 'text-success' : 'text-destructive'
                        }`}
                      >
                        {commitResult.success ? '提交成功' : '提交失败'}
                      </p>
                      {commitResult.commitHash && (
                        <p className="text-xs font-mono text-muted-foreground mt-1">
                          提交哈希: {commitResult.commitHash.substring(0, 8)}
                        </p>
                      )}
                      {commitResult.error && (
                        <p className="text-muted-foreground mt-1">{commitResult.error}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCommitDialog(false);
                setCommitResult(null);
              }}
            >
              {commitResult ? '关闭' : '取消'}
            </Button>
            {!commitResult && (
              <Button
                onClick={handleCommit}
                disabled={isCommitting || !commitMessage.trim()}
              >
                {isCommitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    <GitCommit className="h-4 w-4 mr-2" />
                    提交
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard Confirmation */}
      <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>撤销所有暂存更改？</AlertDialogTitle>
            <AlertDialogDescription>
              这将撤销所有暂存的更改，恢复到合并前的状态。此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDiscarding}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscard}
              disabled={isDiscarding}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDiscarding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  撤销中...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  撤销全部
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
