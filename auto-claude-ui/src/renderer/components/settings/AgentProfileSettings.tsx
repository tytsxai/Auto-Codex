import { useState } from 'react';
import { Brain, Scale, Zap, Check, Sparkles, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  DEFAULT_AGENT_PROFILES,
  AVAILABLE_MODELS,
  THINKING_LEVELS,
  DEFAULT_PHASE_MODELS,
  DEFAULT_PHASE_THINKING
} from '../../../shared/constants';
import { useSettingsStore, saveSettings } from '../../stores/settings-store';
import { SettingsSection } from './SettingsSection';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import type { AgentProfile, PhaseModelConfig, PhaseThinkingConfig, ModelTypeShort, ThinkingLevel } from '../../../shared/types/settings';

/**
 * 智能体配置图标映射
 */
const iconMap: Record<string, React.ElementType> = {
  Brain,
  Scale,
  Zap,
  Sparkles
};

const PHASE_LABELS: Record<keyof PhaseModelConfig, { label: string; description: string }> = {
  spec: { label: '规格制定', description: '调研、需求与上下文收集' },
  planning: { label: '规划', description: '实现计划与架构设计' },
  coding: { label: '编码', description: '实际代码实现' },
  qa: { label: 'QA 审查', description: '质量保证与验证' }
};

/**
 * 智能体配置设置组件
 * 显示预设的智能体配置以快速设置模型/思考等级
 * 用于设置页的智能体设置
 */
export function AgentProfileSettings() {
  const settings = useSettingsStore((state) => state.settings);
  const selectedProfileId = settings.selectedAgentProfile || 'auto';
  const [showPhaseConfig, setShowPhaseConfig] = useState(selectedProfileId === 'auto');

  // 从设置或默认值获取当前阶段配置
  const currentPhaseModels: PhaseModelConfig = settings.customPhaseModels || DEFAULT_PHASE_MODELS;
  const currentPhaseThinking: PhaseThinkingConfig = settings.customPhaseThinking || DEFAULT_PHASE_THINKING;

  const handleSelectProfile = async (profileId: string) => {
    const success = await saveSettings({ selectedAgentProfile: profileId });
    if (!success) {
      // 记录错误便于调试，后续可展示用户提示
      console.error('Failed to save agent profile selection');
      return;
    }
    // 选择 Auto 配置时自动展开阶段配置
    if (profileId === 'auto') {
      setShowPhaseConfig(true);
    }
  };

  const handlePhaseModelChange = async (phase: keyof PhaseModelConfig, value: ModelTypeShort) => {
    const newPhaseModels = { ...currentPhaseModels, [phase]: value };
    await saveSettings({ customPhaseModels: newPhaseModels });
  };

  const handlePhaseThinkingChange = async (phase: keyof PhaseThinkingConfig, value: ThinkingLevel) => {
    const newPhaseThinking = { ...currentPhaseThinking, [phase]: value };
    await saveSettings({ customPhaseThinking: newPhaseThinking });
  };

  const handleResetToDefaults = async () => {
    await saveSettings({
      customPhaseModels: DEFAULT_PHASE_MODELS,
      customPhaseThinking: DEFAULT_PHASE_THINKING
    });
  };

  /**
   * 获取可读的模型标签
   */
  const getModelLabel = (modelValue: string): string => {
    const model = AVAILABLE_MODELS.find((m) => m.value === modelValue);
    return model?.label || modelValue;
  };

  /**
   * 获取可读的思考等级标签
   */
  const getThinkingLabel = (thinkingValue: string): string => {
    const level = THINKING_LEVELS.find((l) => l.value === thinkingValue);
    return level?.label || thinkingValue;
  };

  /**
   * 检查当前阶段配置是否不同于默认值
   */
  const hasCustomConfig = (): boolean => {
    const phases: Array<keyof PhaseModelConfig> = ['spec', 'planning', 'coding', 'qa'];
    return phases.some(
      phase =>
        currentPhaseModels[phase] !== DEFAULT_PHASE_MODELS[phase] ||
        currentPhaseThinking[phase] !== DEFAULT_PHASE_THINKING[phase]
    );
  };

  /**
   * 渲染单个配置卡片
   */
  const renderProfileCard = (profile: AgentProfile) => {
    const isSelected = selectedProfileId === profile.id;
    const Icon = iconMap[profile.icon || 'Brain'] || Brain;

    return (
      <button
        key={profile.id}
        onClick={() => handleSelectProfile(profile.id)}
        className={cn(
          'relative w-full rounded-lg border p-4 text-left transition-all duration-200',
          'hover:border-primary/50 hover:shadow-sm',
          isSelected
            ? 'border-primary bg-primary/5'
            : 'border-border bg-card'
        )}
      >
        {/* 选中指示 */}
        {isSelected && (
          <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        )}

        {/* 配置内容 */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg shrink-0',
              isSelected ? 'bg-primary/10' : 'bg-muted'
            )}
          >
            <Icon
              className={cn(
                'h-5 w-5',
                isSelected ? 'text-primary' : 'text-muted-foreground'
              )}
            />
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <h3 className="font-medium text-sm text-foreground">{profile.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              {profile.description}
            </p>

            {/* 模型与思考等级徽标 */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {getModelLabel(profile.model)}
              </span>
              <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {getThinkingLabel(profile.thinkingLevel)} 思考
              </span>
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <SettingsSection
      title="默认智能体配置"
      description="选择模型与思考等级的预设配置"
    >
      <div className="space-y-4">
        {/* 说明 */}
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">
            智能体配置提供 Claude 模型与思考等级的预设组合。
            创建新任务时将默认使用这些设置，你也可以在任务创建向导中随时覆盖。
          </p>
        </div>

        {/* 配置卡片 - 大屏为两列网格 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {DEFAULT_AGENT_PROFILES.map(renderProfileCard)}
        </div>

        {/* 阶段配置（仅 Auto 配置） */}
        {selectedProfileId === 'auto' && (
          <div className="mt-6 rounded-lg border border-border bg-card">
            {/* 标题 - 可折叠 */}
            <button
              type="button"
              onClick={() => setShowPhaseConfig(!showPhaseConfig)}
              className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors rounded-t-lg"
            >
              <div>
                <h4 className="font-medium text-sm text-foreground">Phase Configuration</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  为每个阶段自定义模型与思考等级
                </p>
              </div>
              {showPhaseConfig ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {/* 阶段配置内容 */}
            {showPhaseConfig && (
              <div className="border-t border-border p-4 space-y-4">
                {/* 重置按钮 */}
                {hasCustomConfig() && (
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResetToDefaults}
                      className="text-xs h-7"
                    >
                      <RotateCcw className="h-3 w-3 mr-1.5" />
                      重置为默认
                    </Button>
                  </div>
                )}

                {/* 阶段配置网格 */}
                <div className="space-y-4">
                  {(Object.keys(PHASE_LABELS) as Array<keyof PhaseModelConfig>).map((phase) => (
                    <div key={phase} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium text-foreground">
                          {PHASE_LABELS[phase].label}
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          {PHASE_LABELS[phase].description}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {/* 模型选择 */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">模型</Label>
                          <Select
                            value={currentPhaseModels[phase]}
                            onValueChange={(value) => handlePhaseModelChange(phase, value as ModelTypeShort)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {AVAILABLE_MODELS.map((m) => (
                                <SelectItem key={m.value} value={m.value}>
                                  {m.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {/* 思考等级选择 */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">思考等级</Label>
                          <Select
                            value={currentPhaseThinking[phase]}
                            onValueChange={(value) => handlePhaseThinkingChange(phase, value as ThinkingLevel)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {THINKING_LEVELS.map((level) => (
                                <SelectItem key={level.value} value={level.value}>
                                  {level.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 提示说明 */}
                <p className="text-[10px] text-muted-foreground mt-4 pt-3 border-t border-border">
                  使用 Auto 配置创建新任务时将默认应用这些设置。
                  你可以在任务创建向导中按任务覆盖它们。
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </SettingsSection>
  );
}
