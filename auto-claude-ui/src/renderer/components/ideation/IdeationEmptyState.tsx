import { Lightbulb, Settings2, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Switch } from '../ui/switch';
import {
  IDEATION_TYPE_LABELS
} from '../../../shared/constants';
import type { IdeationType, IdeationConfig } from '../../../shared/types';
import { TypeIcon } from './TypeIcon';
import { ALL_IDEATION_TYPES } from './constants';

const IDEATION_TYPE_LABELS_ZH: Record<string, string> = {
  code_improvements: '代码改进',
  ui_ux_improvements: 'UI/UX 改进',
  documentation_gaps: '文档',
  security_hardening: '安全加固',
  performance_optimizations: '性能优化',
  code_quality: '代码质量'
};

interface IdeationEmptyStateProps {
  config: IdeationConfig;
  hasToken: boolean | null;
  isCheckingToken: boolean;
  onGenerate: () => void;
  onOpenConfig: () => void;
  onToggleIdeationType: (type: IdeationType) => void;
}

export function IdeationEmptyState({
  config,
  hasToken,
  isCheckingToken,
  onGenerate,
  onOpenConfig,
  onToggleIdeationType
}: IdeationEmptyStateProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <Card className="w-full max-w-lg p-8 text-center">
        <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">暂无想法</h2>
        <p className="text-muted-foreground mb-6">
          基于项目上下文、既有模式与目标受众，生成 AI 驱动的功能想法。
        </p>

        {/* Configuration Preview */}
        <div className="mb-6 p-4 bg-muted/50 rounded-lg text-left">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">已启用的创意类型</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenConfig}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {ALL_IDEATION_TYPES.map((type) => (
              <div
                key={type}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <TypeIcon type={type} />
                  <span className="text-sm">{IDEATION_TYPE_LABELS_ZH[type] ?? IDEATION_TYPE_LABELS[type]}</span>
                </div>
                <Switch
                  checked={config.enabledTypes.includes(type)}
                  onCheckedChange={() => onToggleIdeationType(type)}
                />
              </div>
            ))}
          </div>
        </div>

        <Button onClick={onGenerate} size="lg" disabled={isCheckingToken}>
          <Sparkles className="h-4 w-4 mr-2" />
          生成想法
        </Button>

        {/* Show warning if token is missing */}
        {hasToken === false && !isCheckingToken && (
          <p className="mt-3 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 inline-block mr-1 text-warning" />
            Claude token 尚未配置。生成时会提示你输入。
          </p>
        )}
      </Card>
    </div>
  );
}
