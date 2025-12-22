import { FileText, GitCommit, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { TaskCard, CommitCard } from './ChangelogEntry';
import type { ChangelogTask, ChangelogSourceMode, GitCommit as GitCommitType } from '../../../shared/types';

interface ChangelogListProps {
  sourceMode: ChangelogSourceMode;
  // Task mode
  doneTasks: ChangelogTask[];
  selectedTaskIds: string[];
  onToggleTask: (taskId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  // Git mode
  previewCommits: GitCommitType[];
  isLoadingCommits: boolean;
  // Continue
  onContinue: () => void;
  canContinue: boolean;
}

export function ChangelogList({
  sourceMode,
  doneTasks,
  selectedTaskIds,
  onToggleTask,
  onSelectAll,
  onDeselectAll,
  previewCommits,
  isLoadingCommits,
  onContinue,
  canContinue
}: ChangelogListProps) {
  // Get summary text for footer badge
  const getSummaryCount = () => {
    switch (sourceMode) {
      case 'tasks':
        return selectedTaskIds.length;
      case 'git-history':
      case 'branch-diff':
        return previewCommits.length;
      default:
        return 0;
    }
  };

  const getSummaryLabel = () => {
    switch (sourceMode) {
      case 'tasks':
        return '项任务';
      case 'git-history':
      case 'branch-diff':
        return '项提交';
      default:
        return '项';
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tasks Mode - Task Selection */}
      {sourceMode === 'tasks' && (
        <>
          {/* Task selection header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-3 bg-muted/30">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">
                已选择 {selectedTaskIds.length} / {doneTasks.length} 项任务
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSelectAll}
                  className="h-7 px-2 text-xs"
                >
                  全选
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDeselectAll}
                  className="h-7 px-2 text-xs"
                >
                  清除
                </Button>
              </div>
            </div>
          </div>

          {/* Task grid */}
          <ScrollArea className="flex-1 p-6">
            {doneTasks.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center py-12">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground/30" />
                  <h3 className="mt-4 text-lg font-medium">暂无已完成任务</h3>
                  <p className="mt-2 text-sm text-muted-foreground max-w-md">
                    在看板中完成任务并标记为“完成”，即可将其纳入变更日志。
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {doneTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isSelected={selectedTaskIds.includes(task.id)}
                    onToggle={() => onToggleTask(task.id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </>
      )}

      {/* Git History / Branch Diff Mode - Commit Preview */}
      {(sourceMode === 'git-history' || sourceMode === 'branch-diff') && (
        <>
          {/* Commit preview header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-3 bg-muted/30">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">
                找到 {previewCommits.length} 条提交
              </span>
              {isLoadingCommits && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Commit list */}
          <ScrollArea className="flex-1 p-6">
            {isLoadingCommits ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center py-12">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="mt-4 text-sm text-muted-foreground">正在加载提交...</p>
                </div>
              </div>
            ) : previewCommits.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center py-12">
                  <GitCommit className="mx-auto h-12 w-12 text-muted-foreground/30" />
                  <h3 className="mt-4 text-lg font-medium">未找到提交</h3>
                  <p className="mt-2 text-sm text-muted-foreground max-w-md">
                    {sourceMode === 'git-history'
                      ? '配置历史选项并点击“加载提交”进行预览。'
                      : '选择两个分支并点击“加载提交”查看变更。'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {previewCommits.map((commit) => (
                  <CommitCard key={commit.fullHash} commit={commit} />
                ))}
              </div>
            )}
          </ScrollArea>
        </>
      )}

      {/* Footer with Continue button */}
      <div className="flex items-center justify-end border-t border-border px-6 py-4 bg-background">
        <Button onClick={onContinue} disabled={!canContinue} size="lg">
          继续
          <ArrowRight className="ml-2 h-4 w-4" />
          {canContinue && (
            <Badge variant="secondary" className="ml-2">
              {getSummaryCount()} {getSummaryLabel()}
            </Badge>
          )}
        </Button>
      </div>
    </div>
  );
}
