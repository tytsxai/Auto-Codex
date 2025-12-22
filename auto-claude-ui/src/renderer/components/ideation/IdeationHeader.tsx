import { Lightbulb, Eye, EyeOff, Settings2, Plus, Trash2, RefreshCw, Archive, CheckSquare, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { IDEATION_TYPE_COLORS } from '../../../shared/constants';
import type { IdeationType } from '../../../shared/types';
import { TypeIcon } from './TypeIcon';

interface IdeationHeaderProps {
  totalIdeas: number;
  ideaCountByType: Record<string, number>;
  showDismissed: boolean;
  showArchived: boolean;
  selectedCount: number;
  onToggleShowDismissed: () => void;
  onToggleShowArchived: () => void;
  onOpenConfig: () => void;
  onOpenAddMore: () => void;
  onDismissAll: () => void;
  onDeleteSelected: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onRefresh: () => void;
  hasActiveIdeas: boolean;
  canAddMore: boolean;
}

export function IdeationHeader({
  totalIdeas,
  ideaCountByType,
  showDismissed,
  showArchived,
  selectedCount,
  onToggleShowDismissed,
  onToggleShowArchived,
  onOpenConfig,
  onOpenAddMore,
  onDismissAll,
  onDeleteSelected,
  onSelectAll,
  onClearSelection,
  onRefresh,
  hasActiveIdeas,
  canAddMore
}: IdeationHeaderProps) {
  const hasSelection = selectedCount > 0;
  return (
    <div className="shrink-0 border-b border-border p-4 bg-card/50">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">创意</h2>
            <Badge variant="outline">{totalIdeas} 个想法</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            为你的项目生成 AI 驱动的功能想法
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 选择控制 */}
          {hasSelection ? (
            <>
              <Badge variant="secondary" className="mr-1">
                {selectedCount} 已选中
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={onDeleteSelected}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                删除
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClearSelection}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>清除选择</TooltipContent>
              </Tooltip>
              <div className="w-px h-6 bg-border mx-1" />
            </>
          ) : (
            hasActiveIdeas && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onSelectAll}
                  >
                    <CheckSquare className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>全选</TooltipContent>
              </Tooltip>
            )
          )}

          {/* 视图切换 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showDismissed ? 'secondary' : 'outline'}
                size="icon"
                onClick={onToggleShowDismissed}
              >
                {showDismissed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {showDismissed ? '隐藏已忽略' : '显示已忽略'}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showArchived ? 'secondary' : 'outline'}
                size="icon"
                onClick={onToggleShowArchived}
              >
                <Archive className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {showArchived ? '隐藏已归档' : '显示已归档'}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onOpenConfig}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>配置</TooltipContent>
          </Tooltip>
          {canAddMore && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={onOpenAddMore}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  添加更多
                </Button>
              </TooltipTrigger>
              <TooltipContent>添加更多创意类型</TooltipContent>
            </Tooltip>
          )}
          {hasActiveIdeas && !hasSelection && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={onDismissAll}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>忽略所有想法</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>重新生成想法</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* 统计 */}
      <div className="mt-4 flex items-center gap-4">
        {Object.entries(ideaCountByType).map(([type, count]) => (
          <Badge
            key={type}
            variant="outline"
            className={IDEATION_TYPE_COLORS[type]}
          >
            <TypeIcon type={type as IdeationType} />
            <span className="ml-1">{count}</span>
          </Badge>
        ))}
      </div>
    </div>
  );
}
