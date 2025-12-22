/**
 * AddFeatureDialog - 向路线图添加新功能的对话框
 *
 * 允许用户创建包含标题、描述、优先级、阶段、复杂度和影响字段的新路线图功能。
 * 为保持一致性，遵循与 TaskEditDialog 相同的对话框模式。
 *
 * 功能：
 * - 表单校验（标题和描述为必填项）
 * - 可选择的分类字段（优先级、阶段、复杂度、影响）
 * - 将功能添加到路线图存储并持久化到文件
 *
 * @example
 * ```tsx
 * <AddFeatureDialog
 *   phases={roadmap.phases}
 *   open={isAddDialogOpen}
 *   onOpenChange={setIsAddDialogOpen}
 *   onFeatureAdded={(featureId) => console.log('Feature added:', featureId)}
 * />
 * ```
 */
import { useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';
import { useRoadmapStore } from '../stores/roadmap-store';
import {
  ROADMAP_PRIORITY_LABELS
} from '../../shared/constants';
import type {
  RoadmapPhase,
  RoadmapFeaturePriority,
  RoadmapFeatureStatus,
  FeatureSource
} from '../../shared/types';

/**
 * AddFeatureDialog 组件的属性
 */
interface AddFeatureDialogProps {
  /** 可选择的阶段列表 */
  phases: RoadmapPhase[];
  /** 对话框是否打开 */
  open: boolean;
  /** 对话框打开状态变化时的回调 */
  onOpenChange: (open: boolean) => void;
  /** 功能添加成功时的可选回调，接收新功能 ID */
  onFeatureAdded?: (featureId: string) => void;
  /** 预选的默认阶段 ID（可选） */
  defaultPhaseId?: string;
}

// 复杂度选项
const COMPLEXITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' }
] as const;

// 影响选项
const IMPACT_OPTIONS = [
  { value: 'low', label: '低影响' },
  { value: 'medium', label: '中影响' },
  { value: 'high', label: '高影响' }
] as const;

export function AddFeatureDialog({
  phases,
  open,
  onOpenChange,
  onFeatureAdded,
  defaultPhaseId
}: AddFeatureDialogProps) {
  // 表单状态
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rationale, setRationale] = useState('');
  const [priority, setPriority] = useState<RoadmapFeaturePriority>('should');
  const [phaseId, setPhaseId] = useState<string>('');
  const [complexity, setComplexity] = useState<'low' | 'medium' | 'high'>('medium');
  const [impact, setImpact] = useState<'low' | 'medium' | 'high'>('medium');

  // UI 状态
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 存储操作
  const addFeature = useRoadmapStore((state) => state.addFeature);

  // 对话框打开/关闭时重置表单
  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setRationale('');
      setPriority('should');
      setPhaseId(defaultPhaseId || (phases.length > 0 ? phases[0].id : ''));
      setComplexity('medium');
      setImpact('medium');
      setError(null);
    }
  }, [open, defaultPhaseId, phases]);

  const handleSave = async () => {
    // 校验必填字段
    if (!title.trim()) {
      setError('标题为必填项');
      return;
    }
    if (!description.trim()) {
      setError('描述为必填项');
      return;
    }
    if (!phaseId) {
      setError('请选择阶段');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // 将功能添加到存储
      const newFeatureId = addFeature({
        title: title.trim(),
        description: description.trim(),
        rationale: rationale.trim() || `User-created feature for ${title.trim()}`,
        priority,
        complexity,
        impact,
        phaseId,
        dependencies: [],
        status: 'under_review' as RoadmapFeatureStatus,
        acceptanceCriteria: [],
        userStories: [],
        source: { provider: 'internal' }
      });

      // 通过 IPC 持久化到文件
      const roadmap = useRoadmapStore.getState().roadmap;
      if (roadmap) {
        // 从路线图获取项目 ID
        const result = await window.electronAPI.saveRoadmap(roadmap.projectId, roadmap);
        if (!result.success) {
          throw new Error(result.error || 'Failed to save roadmap');
        }
      }

      // 成功 - 关闭对话框并通知父组件
      onOpenChange(false);
      onFeatureAdded?.(newFeatureId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加功能失败，请重试。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      onOpenChange(false);
    }
  };

  // 表单校验
  const isValid = title.trim().length > 0 && description.trim().length > 0 && phaseId !== '';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">添加功能</DialogTitle>
          <DialogDescription>
            向路线图添加新功能。提供您想要构建的内容以及它如何融入您的产品策略的详细信息。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* 标题（必填） */}
          <div className="space-y-2">
            <Label htmlFor="add-feature-title" className="text-sm font-medium text-foreground">
              功能标题 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="add-feature-title"
              placeholder="例如：用户认证、深色模式支持"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSaving}
            />
          </div>

          {/* 描述（必填） */}
          <div className="space-y-2">
            <Label htmlFor="add-feature-description" className="text-sm font-medium text-foreground">
              描述 <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="add-feature-description"
              placeholder="描述此功能的作用以及它对用户的价值。"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isSaving}
            />
          </div>

          {/* 理由（可选） */}
          <div className="space-y-2">
            <Label htmlFor="add-feature-rationale" className="text-sm font-medium text-foreground">
              理由 <span className="text-muted-foreground font-normal">（可选）</span>
            </Label>
            <Textarea
              id="add-feature-rationale"
              placeholder="解释为什么应该构建此功能以及它如何符合产品愿景。"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={2}
              disabled={isSaving}
            />
          </div>

          {/* 分类字段 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 阶段 */}
            <div className="space-y-2">
              <Label htmlFor="add-feature-phase" className="text-sm font-medium text-foreground">
                阶段 <span className="text-destructive">*</span>
              </Label>
              <Select
                value={phaseId}
                onValueChange={setPhaseId}
                disabled={isSaving}
              >
                <SelectTrigger id="add-feature-phase">
                  <SelectValue placeholder="选择阶段" />
                </SelectTrigger>
                <SelectContent>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.order}. {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 优先级 */}
            <div className="space-y-2">
              <Label htmlFor="add-feature-priority" className="text-sm font-medium text-foreground">
                优先级
              </Label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as RoadmapFeaturePriority)}
                disabled={isSaving}
              >
                <SelectTrigger id="add-feature-priority">
                  <SelectValue placeholder="选择优先级" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROADMAP_PRIORITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 复杂度 */}
            <div className="space-y-2">
              <Label htmlFor="add-feature-complexity" className="text-sm font-medium text-foreground">
                复杂度
              </Label>
              <Select
                value={complexity}
                onValueChange={(value) => setComplexity(value as 'low' | 'medium' | 'high')}
                disabled={isSaving}
              >
                <SelectTrigger id="add-feature-complexity">
                  <SelectValue placeholder="选择复杂度" />
                </SelectTrigger>
                <SelectContent>
                  {COMPLEXITY_OPTIONS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 影响 */}
            <div className="space-y-2">
              <Label htmlFor="add-feature-impact" className="text-sm font-medium text-foreground">
                影响
              </Label>
              <Select
                value={impact}
                onValueChange={(value) => setImpact(value as 'low' | 'medium' | 'high')}
                disabled={isSaving}
              >
                <SelectTrigger id="add-feature-impact">
                  <SelectValue placeholder="选择影响" />
                </SelectTrigger>
                <SelectContent>
                  {IMPACT_OPTIONS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 错误 */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
              <X className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !isValid}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                添加中...
              </>
            ) : (
              '添加功能'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
