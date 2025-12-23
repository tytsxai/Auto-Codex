import { Sparkles, Zap, Brain, FileCode } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

interface WelcomeStepProps {
  onGetStarted: () => void;
  onSkip: () => void;
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <Card className="border border-border bg-card/50 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <h3 className="font-medium text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Welcome step component for the onboarding wizard.
 * Displays a welcome message with a feature overview and actions to get started or skip.
 */
export function WelcomeStep({ onGetStarted, onSkip }: WelcomeStepProps) {
  const features = [
    {
      icon: <Sparkles className="h-5 w-5" />,
      title: 'AI 驱动开发',
      description: '使用 Codex 智能体生成代码并构建功能'
    },
    {
      icon: <FileCode className="h-5 w-5" />,
      title: '规格驱动的工作流',
      description: '通过清晰规格定义任务，让 Auto Codex 负责实现'
    },
    {
      icon: <Brain className="h-5 w-5" />,
      title: '记忆与上下文',
      description: '可选的 Graphiti 集成，提供跨会话的持久记忆'
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: '并行执行',
      description: '并行运行多个智能体，加快开发节奏'
    }
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-6">
      <div className="w-full max-w-2xl">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            欢迎使用 Auto Codex
          </h1>
          <p className="mt-3 text-muted-foreground text-lg">
            使用 AI 智能体自主构建软件
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>

        {/* Description */}
        <div className="text-center mb-8">
          <p className="text-muted-foreground">
            本向导将帮助你用几步完成环境设置。
            你可以配置 Codex OAuth 认证令牌，选择性启用记忆功能，
            并创建你的第一个任务。
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            onClick={onGetStarted}
            className="gap-2 px-8"
          >
            <Sparkles className="h-5 w-5" />
            开始使用
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={onSkip}
            className="text-muted-foreground hover:text-foreground"
          >
            跳过设置
          </Button>
        </div>
      </div>
    </div>
  );
}
