import { ExternalLink, Play, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Checkbox } from '../ui/checkbox';
import {
  IDEATION_TYPE_LABELS,
  IDEATION_TYPE_COLORS,
  IDEATION_STATUS_COLORS,
  IDEATION_EFFORT_COLORS,
  IDEATION_IMPACT_COLORS,
  SECURITY_SEVERITY_COLORS,
  UIUX_CATEGORY_LABELS,
  DOCUMENTATION_CATEGORY_LABELS,
  CODE_QUALITY_SEVERITY_COLORS
} from '../../../shared/constants';
import type {
  Idea,
  CodeImprovementIdea,
  UIUXImprovementIdea,
  DocumentationGapIdea,
  SecurityHardeningIdea,
  PerformanceOptimizationIdea,
  CodeQualityIdea
} from '../../../shared/types';
import { TypeIcon } from './TypeIcon';
import {
  isCodeImprovementIdea,
  isUIUXIdea,
  isDocumentationGapIdea,
  isSecurityHardeningIdea,
  isPerformanceOptimizationIdea,
  isCodeQualityIdea
} from './type-guards';

const IDEATION_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  selected: '已选择',
  converted: '已转换',
  dismissed: '已忽略',
  archived: '已归档'
};

const IDEATION_TYPE_LABELS_ZH: Record<string, string> = {
  code_improvements: '代码改进',
  ui_ux_improvements: 'UI/UX 改进',
  documentation_gaps: '文档',
  security_hardening: '安全加固',
  performance_optimizations: '性能优化',
  code_quality: '代码质量'
};

const IDEATION_EFFORT_LABELS_ZH: Record<string, string> = {
  trivial: '极小',
  small: '小',
  medium: '中',
  large: '大',
  complex: '复杂'
};

const IDEATION_IMPACT_LABELS_ZH: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '关键'
};

const SECURITY_SEVERITY_LABELS_ZH: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '关键'
};

const CODE_QUALITY_SEVERITY_LABELS_ZH: Record<string, string> = {
  suggestion: '建议',
  minor: '轻微',
  major: '严重',
  critical: '关键'
};

const UIUX_CATEGORY_LABELS_ZH: Record<string, string> = {
  usability: '可用性',
  accessibility: '无障碍',
  performance: '性能',
  visual: '视觉设计',
  interaction: '交互'
};

const DOCUMENTATION_CATEGORY_LABELS_ZH: Record<string, string> = {
  readme: 'README',
  api_docs: 'API 文档',
  inline_comments: '行内注释',
  examples: '示例与教程',
  architecture: '架构文档',
  troubleshooting: '故障排查指南'
};

interface IdeaCardProps {
  idea: Idea;
  isSelected: boolean;
  onClick: () => void;
  onConvert: (idea: Idea) => void;
  onGoToTask?: (taskId: string) => void;
  onDismiss: (idea: Idea) => void;
  onToggleSelect: (ideaId: string) => void;
}

export function IdeaCard({ idea, isSelected, onClick, onConvert, onGoToTask, onDismiss, onToggleSelect }: IdeaCardProps) {
  const isDismissed = idea.status === 'dismissed';
  const isArchived = idea.status === 'archived';
  const isConverted = idea.status === 'converted';
  const isInactive = isDismissed || isArchived;

  return (
    <Card
      className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
        isInactive ? 'opacity-50' : ''
      } ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* 选择复选框 */}
        <div
          className="pt-0.5"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(idea.id);
          }}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(idea.id)}
            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
        </div>

        <div className="flex-1 flex items-start justify-between">
          <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className={IDEATION_TYPE_COLORS[idea.type]}>
              <TypeIcon type={idea.type} />
              <span className="ml-1">
                {IDEATION_TYPE_LABELS_ZH[idea.type] ?? IDEATION_TYPE_LABELS[idea.type]}
              </span>
            </Badge>
            {idea.status !== 'draft' && (
              <Badge variant="outline" className={IDEATION_STATUS_COLORS[idea.status]}>
                {IDEATION_STATUS_LABELS[idea.status] ?? idea.status}
              </Badge>
            )}
            {isCodeImprovementIdea(idea) && (
              <Badge variant="outline" className={IDEATION_EFFORT_COLORS[(idea as CodeImprovementIdea).estimatedEffort]}>
                {IDEATION_EFFORT_LABELS_ZH[(idea as CodeImprovementIdea).estimatedEffort] ?? (idea as CodeImprovementIdea).estimatedEffort}
              </Badge>
            )}
            {isUIUXIdea(idea) && (
              <Badge variant="outline">
                {UIUX_CATEGORY_LABELS_ZH[(idea as UIUXImprovementIdea).category] ?? UIUX_CATEGORY_LABELS[(idea as UIUXImprovementIdea).category]}
              </Badge>
            )}
            {isDocumentationGapIdea(idea) && (
              <Badge variant="outline">
                {DOCUMENTATION_CATEGORY_LABELS_ZH[(idea as DocumentationGapIdea).category] ?? DOCUMENTATION_CATEGORY_LABELS[(idea as DocumentationGapIdea).category]}
              </Badge>
            )}
            {isSecurityHardeningIdea(idea) && (
              <Badge variant="outline" className={SECURITY_SEVERITY_COLORS[(idea as SecurityHardeningIdea).severity]}>
                {SECURITY_SEVERITY_LABELS_ZH[(idea as SecurityHardeningIdea).severity] ?? (idea as SecurityHardeningIdea).severity}
              </Badge>
            )}
            {isPerformanceOptimizationIdea(idea) && (
              <Badge variant="outline" className={IDEATION_IMPACT_COLORS[(idea as PerformanceOptimizationIdea).impact]}>
                {(IDEATION_IMPACT_LABELS_ZH[(idea as PerformanceOptimizationIdea).impact] ?? (idea as PerformanceOptimizationIdea).impact)} 影响
              </Badge>
            )}
            {isCodeQualityIdea(idea) && (
              <Badge variant="outline" className={CODE_QUALITY_SEVERITY_COLORS[(idea as CodeQualityIdea).severity]}>
                {CODE_QUALITY_SEVERITY_LABELS_ZH[(idea as CodeQualityIdea).severity] ?? (idea as CodeQualityIdea).severity}
              </Badge>
            )}
          </div>
          <h3 className={`font-medium ${isInactive ? 'line-through' : ''}`}>
            {idea.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2">{idea.description}</p>
          </div>
          {/* 操作按钮 */}
          {!isInactive && !isConverted && (
            <div className="flex items-center gap-1 ml-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onConvert(idea);
                    }}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>转换为任务</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss(idea);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>忽略</TooltipContent>
              </Tooltip>
            </div>
          )}
          {/* 已归档的想法显示任务链接 */}
          {isArchived && idea.taskId && onGoToTask && (
            <div className="flex items-center gap-1 ml-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onGoToTask(idea.taskId!);
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>前往任务</TooltipContent>
              </Tooltip>
            </div>
          )}
          {/* 旧逻辑：已转换状态也显示任务链接 */}
          {isConverted && idea.taskId && onGoToTask && (
            <div className="flex items-center gap-1 ml-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onGoToTask(idea.taskId!);
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>前往任务</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
