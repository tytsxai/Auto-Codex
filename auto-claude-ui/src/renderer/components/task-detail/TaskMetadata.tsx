import {
  Target,
  Bug,
  Wrench,
  FileCode,
  Shield,
  Gauge,
  Palette,
  Lightbulb,
  Users,
  GitBranch,
  ListChecks,
  Clock
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn, formatRelativeTime, sanitizeMarkdownForDisplay } from '../../lib/utils';
import {
  TASK_CATEGORY_LABELS,
  TASK_CATEGORY_COLORS,
  TASK_COMPLEXITY_LABELS,
  TASK_COMPLEXITY_COLORS,
  TASK_IMPACT_LABELS,
  TASK_IMPACT_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  IDEATION_TYPE_LABELS
} from '../../../shared/constants';
import type { Task, TaskCategory } from '../../../shared/types';

// 类别图标映射
const CategoryIcon: Record<TaskCategory, typeof Target> = {
  feature: Target,
  bug_fix: Bug,
  refactoring: Wrench,
  documentation: FileCode,
  security: Shield,
  performance: Gauge,
  ui_ux: Palette,
  infrastructure: Wrench,
  testing: FileCode
};

interface TaskMetadataProps {
  task: Task;
}

export function TaskMetadata({ task }: TaskMetadataProps) {
  const hasClassification = task.metadata && (
    task.metadata.category ||
    task.metadata.priority ||
    task.metadata.complexity ||
    task.metadata.impact ||
    task.metadata.securitySeverity ||
    task.metadata.sourceType
  );

  return (
    <div className="space-y-5">
      {/* 紧凑元数据栏：分类 + 时间线 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
        {/* 分类徽章 - 左侧 */}
        {hasClassification && (
          <div className="flex flex-wrap items-center gap-1.5">
            {/* 类别 */}
            {task.metadata?.category && (
              <Badge
                variant="outline"
                className={cn('text-xs', TASK_CATEGORY_COLORS[task.metadata.category])}
              >
                {CategoryIcon[task.metadata.category] && (() => {
                  const Icon = CategoryIcon[task.metadata.category!];
                  return <Icon className="h-3 w-3 mr-1" />;
                })()}
                {TASK_CATEGORY_LABELS[task.metadata.category]}
              </Badge>
            )}
            {/* 优先级 */}
            {task.metadata?.priority && (
              <Badge
                variant="outline"
                className={cn('text-xs', TASK_PRIORITY_COLORS[task.metadata.priority])}
              >
                {TASK_PRIORITY_LABELS[task.metadata.priority]}
              </Badge>
            )}
            {/* 复杂度 */}
            {task.metadata?.complexity && (
              <Badge
                variant="outline"
                className={cn('text-xs', TASK_COMPLEXITY_COLORS[task.metadata.complexity])}
              >
                {TASK_COMPLEXITY_LABELS[task.metadata.complexity]}
              </Badge>
            )}
            {/* 影响 */}
            {task.metadata?.impact && (
              <Badge
                variant="outline"
                className={cn('text-xs', TASK_IMPACT_COLORS[task.metadata.impact])}
              >
                {TASK_IMPACT_LABELS[task.metadata.impact]}
              </Badge>
            )}
            {/* 安全严重性 */}
            {task.metadata?.securitySeverity && (
              <Badge
                variant="outline"
                className={cn('text-xs', TASK_IMPACT_COLORS[task.metadata.securitySeverity])}
              >
                <Shield className="h-3 w-3 mr-1" />
                {task.metadata.securitySeverity}
              </Badge>
            )}
            {/* 来源类型 */}
            {task.metadata?.sourceType && (
              <Badge variant="secondary" className="text-xs">
                {task.metadata.sourceType === 'ideation' && task.metadata.ideationType
                  ? IDEATION_TYPE_LABELS[task.metadata.ideationType] || task.metadata.ideationType
                  : task.metadata.sourceType}
              </Badge>
            )}
          </div>
        )}

        {/* 时间线 - 右侧 */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            创建时间 {formatRelativeTime(task.createdAt)}
          </span>
          <span className="text-border">•</span>
          <span>更新时间 {formatRelativeTime(task.updatedAt)}</span>
        </div>
      </div>

      {/* 描述 - 主要内容 */}
      {task.description && (
        <div>
          <p className="text-sm text-foreground/90 leading-relaxed">
            {sanitizeMarkdownForDisplay(task.description, 800)}
          </p>
        </div>
      )}

      {/* 次要详情 */}
      {task.metadata && (
        <div className="space-y-4 pt-2">
          {/* 理由 */}
          {task.metadata.rationale && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <Lightbulb className="h-3 w-3 text-warning" />
                理由
              </h3>
              <p className="text-sm text-foreground/80">{task.metadata.rationale}</p>
            </div>
          )}

          {/* 解决的问题 */}
          {task.metadata.problemSolved && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <Target className="h-3 w-3 text-success" />
                解决的问题
              </h3>
              <p className="text-sm text-foreground/80">{task.metadata.problemSolved}</p>
            </div>
          )}

          {/* 目标受众 */}
          {task.metadata.targetAudience && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <Users className="h-3 w-3 text-info" />
                目标受众
              </h3>
              <p className="text-sm text-foreground/80">{task.metadata.targetAudience}</p>
            </div>
          )}

          {/* 依赖项 */}
          {task.metadata.dependencies && task.metadata.dependencies.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <GitBranch className="h-3 w-3 text-purple-400" />
                依赖项
              </h3>
              <ul className="text-sm text-foreground/80 list-disc list-inside space-y-0.5">
                {task.metadata.dependencies.map((dep, idx) => (
                  <li key={idx}>{dep}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 验收标准 */}
          {task.metadata.acceptanceCriteria && task.metadata.acceptanceCriteria.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <ListChecks className="h-3 w-3 text-success" />
                验收标准
              </h3>
              <ul className="text-sm text-foreground/80 list-disc list-inside space-y-0.5">
                {task.metadata.acceptanceCriteria.map((criteria, idx) => (
                  <li key={idx}>{criteria}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 受影响的文件 */}
          {task.metadata.affectedFiles && task.metadata.affectedFiles.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <FileCode className="h-3 w-3" />
                受影响的文件
              </h3>
              <div className="flex flex-wrap gap-1">
                {task.metadata.affectedFiles.map((file, idx) => (
                  <Tooltip key={idx}>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="text-xs font-mono cursor-help">
                        {file.split('/').pop()}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="font-mono text-xs">
                      {file}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
