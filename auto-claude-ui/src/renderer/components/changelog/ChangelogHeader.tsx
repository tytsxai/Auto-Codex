import { RefreshCw, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import type { WizardStep } from './hooks/useChangelog';

interface ChangelogHeaderProps {
  step: WizardStep;
  onRefresh: () => void;
}

export function ChangelogHeader({ step, onRefresh }: ChangelogHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border px-6 py-4">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold">变更日志生成器</h1>
          <p className="text-sm text-muted-foreground">
            {step === 1
              ? '步骤 1：选择要包含的已完成任务'
              : step === 2
                ? '步骤 2：配置并生成变更日志'
                : '步骤 3：发布并归档任务'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* 步骤指示器 */}
        <div className="flex items-center gap-2 mr-4">
          <StepIndicator step={1} currentStep={step} label="选择" />
          <div className="w-6 h-px bg-border" />
          <StepIndicator step={2} currentStep={step} label="生成" />
          <div className="w-6 h-px bg-border" />
          <StepIndicator step={3} currentStep={step} label="发布" />
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>
    </div>
  );
}

interface StepIndicatorProps {
  step: WizardStep;
  currentStep: WizardStep;
  label: string;
}

function StepIndicator({ step, currentStep, label }: StepIndicatorProps) {
  const isActive = step === currentStep;
  const isComplete = step < currentStep;

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors',
          isComplete
            ? 'bg-primary text-primary-foreground'
            : isActive
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
        )}
      >
        {isComplete ? <Check className="h-3 w-3" /> : step}
      </div>
      <span
        className={cn(
          'text-sm',
          isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
        )}
      >
        {label}
      </span>
    </div>
  );
}
