import {
  CheckCircle2,
  Rocket,
  FileText,
  Settings,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

interface CompletionStepProps {
  onFinish: () => void;
  onOpenTaskCreator?: () => void;
  onOpenSettings?: () => void;
}

interface NextStepCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: () => void;
  actionLabel?: string;
}

function NextStepCard({ icon, title, description, action, actionLabel }: NextStepCardProps) {
  return (
    <Card className="border border-border bg-card/50 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            {action && actionLabel && (
              <Button
                variant="link"
                size="sm"
                onClick={action}
                className="mt-2 h-auto p-0 text-primary hover:text-primary/80"
              >
                {actionLabel}
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Completion step component for the onboarding wizard.
 * Displays a success message with suggestions for next steps
 * and a prominent "Finish" button to complete the wizard.
 */
export function CompletionStep({
  onFinish,
  onOpenTaskCreator,
  onOpenSettings
}: CompletionStepProps) {
  const nextSteps = [
    {
      icon: <FileText className="h-5 w-5" />,
      title: '创建任务',
      description: '从创建你的第一个任务开始，体验 Auto Claude 的能力。',
      action: onOpenTaskCreator,
      actionLabel: '打开任务创建器'
    },
    {
      icon: <Settings className="h-5 w-5" />,
      title: '自定义设置',
      description: '微调偏好、配置集成，或重新运行此向导。',
      action: onOpenSettings,
      actionLabel: '打开设置'
    },
    {
      icon: <BookOpen className="h-5 w-5" />,
      title: '查看文档',
      description: '了解高级功能、最佳实践与故障排查。'
    }
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-6">
      <div className="w-full max-w-2xl">
        {/* Success Hero */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/20 text-success">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Rocket className="h-4 w-4" />
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            全部就绪！
          </h1>
          <p className="mt-3 text-muted-foreground text-lg">
            Auto Claude 已准备好帮助你构建出色的软件
          </p>
        </div>

        {/* Completion message */}
        <Card className="border border-success/30 bg-success/10 mb-8">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-6 w-6 text-success shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-medium text-success">
                  设置完成
                </h3>
                <p className="mt-1 text-sm text-success/80">
                  你的环境已配置完成并可用。你可以立即创建任务，
                  或按自己的节奏探索应用。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps Section */}
        <div className="space-y-4 mb-10">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Rocket className="h-4 w-4" />
            接下来做什么？
          </div>
          <div className="grid grid-cols-1 gap-3">
            {nextSteps.map((step, index) => (
              <NextStepCard
                key={index}
                icon={step.icon}
                title={step.title}
                description={step.description}
                action={step.action}
                actionLabel={step.actionLabel}
              />
            ))}
          </div>
        </div>

        {/* Finish Button */}
        <div className="flex flex-col items-center gap-4">
          <Button
            size="lg"
            onClick={onFinish}
            className="gap-2 px-10"
          >
            <Rocket className="h-5 w-5" />
            完成并开始构建
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            你可以随时在 设置 &rarr; 应用 中重新运行此向导
          </p>
        </div>
      </div>
    </div>
  );
}
