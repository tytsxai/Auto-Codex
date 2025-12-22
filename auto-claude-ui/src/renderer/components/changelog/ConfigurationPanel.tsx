import { ArrowLeft, FileText, GitCommit, Sparkles, RefreshCw, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import {
  CHANGELOG_FORMAT_LABELS,
  CHANGELOG_AUDIENCE_LABELS,
  CHANGELOG_EMOJI_LEVEL_LABELS,
  CHANGELOG_STAGE_LABELS
} from '../../../shared/constants';
import { getVersionBumpDescription, type SummaryInfo } from './utils';
import type {
  ChangelogFormat,
  ChangelogAudience,
  ChangelogEmojiLevel,
  ChangelogSourceMode
} from '../../../shared/types';

interface ConfigurationPanelProps {
  sourceMode: ChangelogSourceMode;
  summaryInfo: SummaryInfo;
  existingChangelog: { lastVersion?: string } | null;
  version: string;
  versionReason: string | null;
  date: string;
  format: ChangelogFormat;
  audience: ChangelogAudience;
  emojiLevel: ChangelogEmojiLevel;
  customInstructions: string;
  generationProgress: { stage: string; progress: number; message?: string; error?: string } | null;
  isGenerating: boolean;
  error: string | null;
  showAdvanced: boolean;
  canGenerate: boolean;
  onBack: () => void;
  onVersionChange: (v: string) => void;
  onDateChange: (d: string) => void;
  onFormatChange: (f: ChangelogFormat) => void;
  onAudienceChange: (a: ChangelogAudience) => void;
  onEmojiLevelChange: (l: ChangelogEmojiLevel) => void;
  onCustomInstructionsChange: (i: string) => void;
  onShowAdvancedChange: (show: boolean) => void;
  onGenerate: () => void;
}

export function ConfigurationPanel({
  sourceMode,
  summaryInfo,
  existingChangelog,
  version,
  versionReason,
  date,
  format,
  audience,
  emojiLevel,
  customInstructions,
  generationProgress,
  isGenerating,
  error,
  showAdvanced,
  canGenerate,
  onBack,
  onVersionChange,
  onDateChange,
  onFormatChange,
  onAudienceChange,
  onEmojiLevelChange,
  onCustomInstructionsChange,
  onShowAdvancedChange,
  onGenerate
}: ConfigurationPanelProps) {
  const versionBumpDescription = getVersionBumpDescription(versionReason);
  const localizedVersionBumpDescription = versionBumpDescription === 'Major version bump (breaking changes detected)'
    ? '主版本提升（检测到破坏性变更）'
    : versionBumpDescription === 'Minor version bump (new features detected)'
      ? '次版本提升（检测到新功能）'
      : versionBumpDescription === 'Patch version bump (fixes/improvements)'
        ? '补丁版本提升（修复/改进）'
        : versionBumpDescription;
  const formatDescriptions: Record<ChangelogFormat, string> = {
    'keep-a-changelog': '包含新增/变更/修复/移除等结构化章节',
    'simple-list': '带分类的简洁项目列表',
    'github-release': 'GitHub 风格的发布说明'
  };
  const audienceDescriptions: Record<ChangelogAudience, string> = {
    'technical': '面向开发者的详细技术变更',
    'user-facing': '面向终端用户的清晰非技术描述',
    'marketing': '强调收益价值的文案'
  };
  const emojiDescriptions: Record<ChangelogEmojiLevel, string> = {
    'none': '不使用表情',
    'little': '仅用于章节标题',
    'medium': '用于标题和重点条目',
    'high': '用于标题和每一行'
  };
  const summaryLabel = summaryInfo.label === 'task'
    ? '项任务'
    : summaryInfo.label === 'commit'
      ? '项提交'
      : '项';
  const summaryDetails = summaryInfo.details.replace(/\+(\d+)\s+more/g, '+$1 更多');

  return (
    <div className="w-80 shrink-0 border-r border-border overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Back button and summary */}
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回选择
          </Button>
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              {sourceMode === 'tasks' ? (
                <FileText className="h-4 w-4" />
              ) : (
                <GitCommit className="h-4 w-4" />
              )}
              包含 {summaryInfo.count} {summaryLabel}
            </div>
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {summaryDetails}
            </div>
          </div>
        </div>

        {/* Version & Date */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">发布信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="version">版本</Label>
              <Input
                id="version"
                value={version}
                onChange={(e) => onVersionChange(e.target.value)}
                placeholder="1.0.0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">日期</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
              />
            </div>
            {(existingChangelog?.lastVersion || versionBumpDescription) && (
              <div className="text-xs text-muted-foreground space-y-1">
                {existingChangelog?.lastVersion && (
                  <p>上一版本：{existingChangelog.lastVersion}</p>
                )}
                {localizedVersionBumpDescription && (
                  <p className="text-primary/70">{localizedVersionBumpDescription}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Format & Audience */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">输出样式</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>格式</Label>
              <Select
                value={format}
                onValueChange={(value) => onFormatChange(value as ChangelogFormat)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHANGELOG_FORMAT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      <div>
                        <div>{label}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDescriptions[value as ChangelogFormat]}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>受众</Label>
              <Select
                value={audience}
                onValueChange={(value) => onAudienceChange(value as ChangelogAudience)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHANGELOG_AUDIENCE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      <div>
                        <div>{label}</div>
                        <div className="text-xs text-muted-foreground">
                          {audienceDescriptions[value as ChangelogAudience]}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>表情</Label>
              <Select
                value={emojiLevel}
                onValueChange={(value) => onEmojiLevelChange(value as ChangelogEmojiLevel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHANGELOG_EMOJI_LEVEL_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      <div>
                        <div>{label}</div>
                        <div className="text-xs text-muted-foreground">
                          {emojiDescriptions[value as ChangelogEmojiLevel]}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Advanced Options */}
        <Collapsible open={showAdvanced} onOpenChange={onShowAdvancedChange}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              高级选项
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <Label htmlFor="instructions">自定义说明</Label>
                  <Textarea
                    id="instructions"
                    value={customInstructions}
                    onChange={(e) => onCustomInstructionsChange(e.target.value)}
                    placeholder="为 AI 添加任何特殊说明..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    可选。指导 AI 的语气、需要包含的具体细节等。
                  </p>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Generate Button */}
        <Button
          className="w-full"
          onClick={onGenerate}
          disabled={!canGenerate}
          size="lg"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              生成变更日志
            </>
          )}
        </Button>

        {/* Progress */}
        {generationProgress && isGenerating && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{CHANGELOG_STAGE_LABELS[generationProgress.stage]}</span>
              <span>{generationProgress.progress}%</span>
            </div>
            <Progress value={generationProgress.progress} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <span className="text-destructive">{error}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
