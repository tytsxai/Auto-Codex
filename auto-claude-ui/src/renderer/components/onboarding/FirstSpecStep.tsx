import { useState } from 'react';
import {
  FileText,
  Lightbulb,
  CheckCircle2,
  ArrowRight,
  PenLine,
  ListChecks,
  Target,
  Sparkles
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

interface FirstSpecStepProps {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onOpenTaskCreator: () => void;
}

interface TipCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function TipCard({ icon, title, description }: TipCardProps) {
  return (
    <Card className="border border-border bg-card/50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <h3 className="font-medium text-foreground text-sm">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * First spec creation step for the onboarding wizard.
 * Guides users through creating their first task/spec with helpful tips
 * and provides an action to open the Task Creator.
 */
export function FirstSpecStep({ onNext, onBack, onSkip, onOpenTaskCreator }: FirstSpecStepProps) {
  const [hasCreatedSpec, setHasCreatedSpec] = useState(false);

  const tips = [
    {
      icon: <PenLine className="h-4 w-4" />,
      title: '描述清晰',
      description: '清楚说明你想构建的内容，包括需求、约束和预期行为。'
    },
    {
      icon: <Target className="h-4 w-4" />,
      title: '从小处开始',
      description: '从添加功能或修复 bug 等聚焦任务开始。小任务更容易验证。'
    },
    {
      icon: <ListChecks className="h-4 w-4" />,
      title: '提供上下文',
      description: '提及相关文件、API 或模式。提供的上下文越多，结果越好。'
    },
    {
      icon: <Sparkles className="h-4 w-4" />,
      title: '让 AI 帮忙',
      description: 'AI 可以生成标题并分类任务。重点描述你的目标，不必纠结细节。'
    }
  ];

  const handleOpenTaskCreator = () => {
    setHasCreatedSpec(true);
    onOpenTaskCreator();
  };

  const handleContinue = () => {
    onNext();
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileText className="h-7 w-7" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            创建你的第一个任务
          </h1>
          <p className="mt-2 text-muted-foreground">
            描述你想构建的内容，其余交给 Auto Claude
          </p>
        </div>

        {/* Success state after opening task creator */}
        {hasCreatedSpec && (
          <Card className="border border-success/30 bg-success/10 mb-6">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <CheckCircle2 className="h-6 w-6 text-success shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-success">
                    已打开任务创建器
                  </h3>
                  <p className="mt-1 text-sm text-success/80">
                    太好了！你现在可以创建第一个任务，或继续完成向导。
                    也可以稍后在主控制台创建任务。
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tips section */}
        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Lightbulb className="h-4 w-4" />
            高质量任务提示
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tips.map((tip, index) => (
              <TipCard
                key={index}
                icon={tip.icon}
                title={tip.title}
                description={tip.description}
              />
            ))}
          </div>
        </div>

        {/* Example task card */}
        <Card className="border border-info/30 bg-info/10 mb-8">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <FileText className="h-5 w-5 text-info shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium text-foreground">
                  任务描述示例：
                </p>
                <p className="text-sm text-muted-foreground italic">
                  &quot;在设置页面添加深色模式开关。需要将用户偏好保存在 localStorage 中，
                  并在不刷新页面的情况下立即应用主题。
                  使用 styles/theme.css 中现有的颜色变量。&quot;
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Primary action */}
        <div className="flex justify-center mb-6">
          <Button
            size="lg"
            onClick={handleOpenTaskCreator}
            className="gap-2 px-8"
          >
            <ArrowRight className="h-5 w-5" />
            打开任务创建器
          </Button>
        </div>

        {/* Skip info */}
        <p className="text-center text-sm text-muted-foreground mb-2">
          {hasCreatedSpec
            ? '你现在可以继续完成向导，或创建更多任务。'
            : '你可以跳过此步骤，稍后在控制台创建任务。'}
        </p>

        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-10 pt-6 border-t border-border">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground"
          >
            上一步
          </Button>
          <div className="flex gap-4">
            <Button
              variant="ghost"
              onClick={onSkip}
              className="text-muted-foreground hover:text-foreground"
            >
              跳过
            </Button>
            <Button onClick={handleContinue}>
              继续
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
