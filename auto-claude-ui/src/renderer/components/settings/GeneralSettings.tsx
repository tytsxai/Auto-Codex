import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { SettingsSection } from './SettingsSection';
import { AgentProfileSettings } from './AgentProfileSettings';
import {
  AVAILABLE_MODELS,
  THINKING_LEVELS,
  DEFAULT_FEATURE_MODELS,
  DEFAULT_FEATURE_THINKING,
  FEATURE_LABELS
} from '../../../shared/constants';
import type { AppSettings, FeatureModelConfig, FeatureThinkingConfig, ModelTypeShort, ThinkingLevel } from '../../../shared/types';

interface GeneralSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  section: 'agent' | 'paths';
}

/**
 * 用于智能体配置与路径的通用设置组件
 */
export function GeneralSettings({ settings, onSettingsChange, section }: GeneralSettingsProps) {
  if (section === 'agent') {
    return (
      <div className="space-y-8">
        {/* 智能体配置选择 */}
        <AgentProfileSettings />

        {/* 其他智能体设置 */}
        <SettingsSection
          title="其他智能体设置"
          description="其他智能体配置选项"
        >
          <div className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="agentFramework" className="text-sm font-medium text-foreground">智能体框架</Label>
              <p className="text-sm text-muted-foreground">用于自动化任务的编码框架</p>
              <Select
                value={settings.agentFramework}
                onValueChange={(value) => onSettingsChange({ ...settings, agentFramework: value })}
              >
                <SelectTrigger id="agentFramework" className="w-full max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto-claude">Auto Claude</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between max-w-md">
                <div className="space-y-1">
                  <Label htmlFor="autoNameTerminals" className="text-sm font-medium text-foreground">
                    AI 终端命名
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    根据命令自动命名终端（使用 Haiku）
                  </p>
                </div>
                <Switch
                  id="autoNameTerminals"
                  checked={settings.autoNameTerminals}
                  onCheckedChange={(checked) => onSettingsChange({ ...settings, autoNameTerminals: checked })}
                />
              </div>
            </div>

            {/* 功能模型配置 */}
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-foreground">功能模型设置</Label>
                <p className="text-sm text-muted-foreground">
                  用于洞察、构思与路线图的模型与思考等级
                </p>
              </div>

              {(Object.keys(FEATURE_LABELS) as Array<keyof FeatureModelConfig>).map((feature) => {
                const featureModels = settings.featureModels || DEFAULT_FEATURE_MODELS;
                const featureThinking = settings.featureThinking || DEFAULT_FEATURE_THINKING;

                return (
                  <div key={feature} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-foreground">
                        {FEATURE_LABELS[feature].label}
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        {FEATURE_LABELS[feature].description}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 max-w-md">
                      {/* 模型选择 */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">模型</Label>
                        <Select
                          value={featureModels[feature]}
                          onValueChange={(value) => {
                            const newFeatureModels = { ...featureModels, [feature]: value as ModelTypeShort };
                            onSettingsChange({ ...settings, featureModels: newFeatureModels });
                          }}
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
                          value={featureThinking[feature]}
                          onValueChange={(value) => {
                            const newFeatureThinking = { ...featureThinking, [feature]: value as ThinkingLevel };
                            onSettingsChange({ ...settings, featureThinking: newFeatureThinking });
                          }}
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
                );
              })}
            </div>
          </div>
        </SettingsSection>
      </div>
    );
  }

  // 路径分区
  return (
    <SettingsSection
      title="路径"
      description="配置可执行文件与框架路径"
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <Label htmlFor="pythonPath" className="text-sm font-medium text-foreground">Python 路径</Label>
          <p className="text-sm text-muted-foreground">Python 可执行文件路径（留空使用默认）</p>
          <Input
            id="pythonPath"
            placeholder="python3（默认）"
            className="w-full max-w-lg"
            value={settings.pythonPath || ''}
            onChange={(e) => onSettingsChange({ ...settings, pythonPath: e.target.value })}
          />
        </div>
        <div className="space-y-3">
          <Label htmlFor="autoBuildPath" className="text-sm font-medium text-foreground">Auto Claude 路径</Label>
          <p className="text-sm text-muted-foreground">项目中 auto-claude 目录的相对路径</p>
          <Input
            id="autoBuildPath"
            placeholder="auto-claude（默认）"
            className="w-full max-w-lg"
            value={settings.autoBuildPath || ''}
            onChange={(e) => onSettingsChange({ ...settings, autoBuildPath: e.target.value })}
          />
        </div>
      </div>
    </SettingsSection>
  );
}
