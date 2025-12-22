/**
 * TaskEditDialog - 用于编辑任务详情的对话框
 *
 * 允许用户修改所有任务属性，包括标题、描述、分类字段、图片和审核设置。
 * 为保持一致性，采用与 TaskCreationWizard 相同的对话框模式。
 *
 * 功能：
 * - 使用当前任务值预填表单
 * - 表单校验（描述必填）
 * - 可编辑的分类字段（类别、优先级、复杂度、影响）
 * - 可编辑的图片附件（添加/移除图片）
 * - 可编辑的审核设置（requireReviewBeforeCoding）
 * - 通过 persistUpdateTask 保存更改（更新 store + 规格文件）
 * - 无变更时阻止保存
 *
 * @example
 * ```tsx
 * <TaskEditDialog
 *   task={selectedTask}
 *   open={isEditDialogOpen}
 *   onOpenChange={setIsEditDialogOpen}
 *   onSaved={() => console.log('Task updated!')}
 * />
 * ```
 */
import { useState, useEffect, useCallback, useRef, type ClipboardEvent, type DragEvent } from 'react';
import { Loader2, Image as ImageIcon, ChevronDown, ChevronUp, X } from 'lucide-react';
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
import { Checkbox } from './ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';
import {
  ImageUpload,
  generateImageId,
  blobToBase64,
  createThumbnail,
  isValidImageMimeType,
  resolveFilename
} from './ImageUpload';
import { AgentProfileSelector } from './AgentProfileSelector';
import { persistUpdateTask } from '../stores/task-store';
import { cn } from '../lib/utils';
import type { Task, ImageAttachment, TaskCategory, TaskPriority, TaskComplexity, TaskImpact, ModelType, ThinkingLevel } from '../../shared/types';
import {
  TASK_CATEGORY_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_COMPLEXITY_LABELS,
  TASK_IMPACT_LABELS,
  MAX_IMAGES_PER_TASK,
  ALLOWED_IMAGE_TYPES_DISPLAY,
  DEFAULT_AGENT_PROFILES,
  DEFAULT_PHASE_MODELS,
  DEFAULT_PHASE_THINKING
} from '../../shared/constants';
import type { PhaseModelConfig, PhaseThinkingConfig } from '../../shared/types/settings';
import { useSettingsStore } from '../stores/settings-store';

/**
 * TaskEditDialog 组件的 props
 */
interface TaskEditDialogProps {
  /** 要编辑的任务 */
  task: Task;
  /** 对话框是否打开 */
  open: boolean;
  /** 对话框打开状态变化时的回调 */
  onOpenChange: (open: boolean) => void;
  /** 任务成功保存时的可选回调 */
  onSaved?: () => void;
}

export function TaskEditDialog({ task, open, onOpenChange, onSaved }: TaskEditDialogProps) {
  // 从设置中获取选中的智能体配置作为默认值
  const { settings } = useSettingsStore();
  const selectedProfile = DEFAULT_AGENT_PROFILES.find(
    p => p.id === settings.selectedAgentProfile
  ) || DEFAULT_AGENT_PROFILES.find(p => p.id === 'auto')!;

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [pasteSuccess, setPasteSuccess] = useState(false);

  // 分类字段
  const [category, setCategory] = useState<TaskCategory | ''>(task.metadata?.category || '');
  const [priority, setPriority] = useState<TaskPriority | ''>(task.metadata?.priority || '');
  const [complexity, setComplexity] = useState<TaskComplexity | ''>(task.metadata?.complexity || '');
  const [impact, setImpact] = useState<TaskImpact | ''>(task.metadata?.impact || '');

  // 智能体配置 / 模型配置
  const [profileId, setProfileId] = useState<string>(() => {
    // 检查任务是否使用 Auto 配置
    if (task.metadata?.isAutoProfile) {
      return 'auto';
    }
    // 从任务元数据确定配置 ID，或默认使用 'auto'
    const taskModel = task.metadata?.model;
    const taskThinking = task.metadata?.thinkingLevel;
    if (taskModel && taskThinking) {
      // 检查是否匹配已知配置
      const matchingProfile = DEFAULT_AGENT_PROFILES.find(
        p => p.model === taskModel && p.thinkingLevel === taskThinking && !p.isAutoProfile
      );
      return matchingProfile?.id || 'custom';
    }
    return settings.selectedAgentProfile || 'auto';
  });
  const [model, setModel] = useState<ModelType | ''>(task.metadata?.model || selectedProfile.model);
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel | ''>(
    task.metadata?.thinkingLevel || selectedProfile.thinkingLevel
  );
  // Auto 配置 - 按阶段配置
  const [phaseModels, setPhaseModels] = useState<PhaseModelConfig | undefined>(
    task.metadata?.phaseModels || selectedProfile.phaseModels || DEFAULT_PHASE_MODELS
  );
  const [phaseThinking, setPhaseThinking] = useState<PhaseThinkingConfig | undefined>(
    task.metadata?.phaseThinking || selectedProfile.phaseThinking || DEFAULT_PHASE_THINKING
  );

  // 图片附件
  const [images, setImages] = useState<ImageAttachment[]>(task.metadata?.attachedImages || []);

  // 审核设置
  const [requireReviewBeforeCoding, setRequireReviewBeforeCoding] = useState(
    task.metadata?.requireReviewBeforeCoding ?? false
  );

  // 文本域引用，用于处理粘贴事件
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // 文本域上方图片拖拽状态
  const [isDragOverTextarea, setIsDragOverTextarea] = useState(false);

  // 任务变更或对话框打开时重置表单
  useEffect(() => {
    if (open) {
      setTitle(task.title);
      setDescription(task.description);
      setCategory(task.metadata?.category || '');
      setPriority(task.metadata?.priority || '');
      setComplexity(task.metadata?.complexity || '');
      setImpact(task.metadata?.impact || '');

      // 重置模型配置
      const taskModel = task.metadata?.model;
      const taskThinking = task.metadata?.thinkingLevel;
      const isAutoProfile = task.metadata?.isAutoProfile;

      if (isAutoProfile) {
        setProfileId('auto');
        setModel(taskModel || selectedProfile.model);
        setThinkingLevel(taskThinking || selectedProfile.thinkingLevel);
        setPhaseModels(task.metadata?.phaseModels || DEFAULT_PHASE_MODELS);
        setPhaseThinking(task.metadata?.phaseThinking || DEFAULT_PHASE_THINKING);
      } else if (taskModel && taskThinking) {
        const matchingProfile = DEFAULT_AGENT_PROFILES.find(
          p => p.model === taskModel && p.thinkingLevel === taskThinking && !p.isAutoProfile
        );
        setProfileId(matchingProfile?.id || 'custom');
        setModel(taskModel);
        setThinkingLevel(taskThinking);
        setPhaseModels(DEFAULT_PHASE_MODELS);
        setPhaseThinking(DEFAULT_PHASE_THINKING);
      } else {
        setProfileId(settings.selectedAgentProfile || 'auto');
        setModel(selectedProfile.model);
        setThinkingLevel(selectedProfile.thinkingLevel);
        setPhaseModels(selectedProfile.phaseModels || DEFAULT_PHASE_MODELS);
        setPhaseThinking(selectedProfile.phaseThinking || DEFAULT_PHASE_THINKING);
      }

      setImages(task.metadata?.attachedImages || []);
      setRequireReviewBeforeCoding(task.metadata?.requireReviewBeforeCoding ?? false);
      setError(null);

      // 有内容时自动展开区块
      if (task.metadata?.category || task.metadata?.priority || task.metadata?.complexity || task.metadata?.impact) {
        setShowAdvanced(true);
      }
      // 任务有图片时自动展开图片区块
      setShowImages((task.metadata?.attachedImages || []).length > 0);
      setPasteSuccess(false);
    }
  }, [open, task, settings.selectedAgentProfile, selectedProfile.model, selectedProfile.thinkingLevel]);

  /**
   * 处理粘贴事件以支持截图
   */
  const handlePaste = useCallback(async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardItems = e.clipboardData?.items;
    if (!clipboardItems) return;

    // 在剪贴板中查找图片项
    const imageItems: DataTransferItem[] = [];
    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];
      if (item.type.startsWith('image/')) {
        imageItems.push(item);
      }
    }

    // 若无图片，允许正常粘贴行为
    if (imageItems.length === 0) return;

    // 有图片时阻止默认粘贴
    e.preventDefault();

    // 检查是否还能添加更多图片
    const remainingSlots = MAX_IMAGES_PER_TASK - images.length;
    if (remainingSlots <= 0) {
      setError(`Maximum of ${MAX_IMAGES_PER_TASK} images allowed`);
      return;
    }

    setError(null);

    // 处理图片项
    const newImages: ImageAttachment[] = [];
    const existingFilenames = images.map(img => img.filename);

    for (const item of imageItems.slice(0, remainingSlots)) {
      const file = item.getAsFile();
      if (!file) continue;

      // 校验图片类型
      if (!isValidImageMimeType(file.type)) {
        setError(`图片类型无效。允许：${ALLOWED_IMAGE_TYPES_DISPLAY}`);
        continue;
      }

      try {
        const dataUrl = await blobToBase64(file);
        const thumbnail = await createThumbnail(dataUrl);

        // 为粘贴图片生成文件名（screenshot-timestamp.ext）
        const extension = file.type.split('/')[1] || 'png';
        const baseFilename = `screenshot-${Date.now()}.${extension}`;
        const resolvedFilename = resolveFilename(baseFilename, [
          ...existingFilenames,
          ...newImages.map(img => img.filename)
        ]);

        newImages.push({
          id: generateImageId(),
          filename: resolvedFilename,
          mimeType: file.type,
          size: file.size,
          data: dataUrl.split(',')[1], // 存储不含 data URL 前缀的 base64
          thumbnail
        });
      } catch {
        setError('处理粘贴的图片失败');
      }
    }

    if (newImages.length > 0) {
      setImages(prev => [...prev, ...newImages]);
      // 自动展开图片区块
      setShowImages(true);
      // 显示成功反馈
      setPasteSuccess(true);
      setTimeout(() => setPasteSuccess(false), 2000);
    }
  }, [images]);

  /**
   * 处理文本域拖拽悬停以支持图片拖入
   */
  const handleTextareaDragOver = useCallback((e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverTextarea(true);
  }, []);

  /**
   * 处理文本域拖拽离开
   */
  const handleTextareaDragLeave = useCallback((e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverTextarea(false);
  }, []);

  /**
   * 处理文本域的图片文件拖放
   */
  const handleTextareaDrop = useCallback(
    async (e: DragEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOverTextarea(false);

      if (isSaving) return;

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      // 筛选图片文件
      const imageFiles: File[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          imageFiles.push(file);
        }
      }

      if (imageFiles.length === 0) return;

      // 检查是否还能添加更多图片
      const remainingSlots = MAX_IMAGES_PER_TASK - images.length;
      if (remainingSlots <= 0) {
        setError(`最多允许 ${MAX_IMAGES_PER_TASK} 张图片`);
        return;
      }

      setError(null);

      // 处理图片文件
      const newImages: ImageAttachment[] = [];
      const existingFilenames = images.map(img => img.filename);

      for (const file of imageFiles.slice(0, remainingSlots)) {
        // 校验图片类型
        if (!isValidImageMimeType(file.type)) {
          setError(`图片类型无效。允许：${ALLOWED_IMAGE_TYPES_DISPLAY}`);
          continue;
        }

        try {
          const dataUrl = await blobToBase64(file);
          const thumbnail = await createThumbnail(dataUrl);

          // 使用原始文件名或生成一个
          const baseFilename = file.name || `dropped-image-${Date.now()}.${file.type.split('/')[1] || 'png'}`;
          const resolvedFilename = resolveFilename(baseFilename, [
            ...existingFilenames,
            ...newImages.map(img => img.filename)
          ]);

          newImages.push({
            id: generateImageId(),
            filename: resolvedFilename,
            mimeType: file.type,
            size: file.size,
            data: dataUrl.split(',')[1], // 存储不含 data URL 前缀的 base64
            thumbnail
          });
        } catch {
          setError('处理拖入的图片失败');
        }
      }

      if (newImages.length > 0) {
        setImages(prev => [...prev, ...newImages]);
        // 自动展开图片区块
        setShowImages(true);
        // 显示成功反馈
        setPasteSuccess(true);
        setTimeout(() => setPasteSuccess(false), 2000);
      }
    },
    [images, isSaving]
  );

  const handleSave = async () => {
    // 校验输入 - 仅描述为必填
    if (!description.trim()) {
      setError('描述为必填项');
      return;
    }

    // 检查是否有任何变更
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const hasChanges =
      trimmedTitle !== task.title ||
      trimmedDescription !== task.description ||
      category !== (task.metadata?.category || '') ||
      priority !== (task.metadata?.priority || '') ||
      complexity !== (task.metadata?.complexity || '') ||
      impact !== (task.metadata?.impact || '') ||
      model !== (task.metadata?.model || '') ||
      thinkingLevel !== (task.metadata?.thinkingLevel || '') ||
      requireReviewBeforeCoding !== (task.metadata?.requireReviewBeforeCoding ?? false) ||
      JSON.stringify(images) !== JSON.stringify(task.metadata?.attachedImages || []);

    if (!hasChanges) {
      // 无变更，直接关闭
      onOpenChange(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    // 构建元数据更新
    const metadataUpdates: Partial<typeof task.metadata> = {};
    if (category) metadataUpdates.category = category;
    if (priority) metadataUpdates.priority = priority;
    if (complexity) metadataUpdates.complexity = complexity;
    if (impact) metadataUpdates.impact = impact;
    if (model) metadataUpdates.model = model as ModelType;
    if (thinkingLevel) metadataUpdates.thinkingLevel = thinkingLevel as ThinkingLevel;
    // Auto 配置 - 按阶段配置
    if (profileId === 'auto') {
      metadataUpdates.isAutoProfile = true;
      if (phaseModels) metadataUpdates.phaseModels = phaseModels;
      if (phaseThinking) metadataUpdates.phaseThinking = phaseThinking;
    } else {
      // 切换离开 auto 时清理 auto 配置字段
      metadataUpdates.isAutoProfile = false;
    }
    if (images.length > 0) metadataUpdates.attachedImages = images;
    metadataUpdates.requireReviewBeforeCoding = requireReviewBeforeCoding;

    // 标题是可选项 - 为空时由后端自动生成
    const success = await persistUpdateTask(task.id, {
      title: trimmedTitle,
      description: trimmedDescription,
      metadata: metadataUpdates
    });

    if (success) {
      onOpenChange(false);
      onSaved?.();
    } else {
      setError('更新任务失败。请重试。');
    }

    setIsSaving(false);
  };

  const handleClose = () => {
    if (!isSaving) {
      onOpenChange(false);
    }
  };

  // 仅描述为必填 - 标题为空时自动生成
  const isValid = description.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">编辑任务</DialogTitle>
          <DialogDescription>
            更新任务详情，包括标题、描述、分类、图片和设置。更改将保存到规范文件中。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* 描述（主要 - 必填） */}
          <div className="space-y-2">
            <Label htmlFor="edit-description" className="text-sm font-medium text-foreground">
              描述 <span className="text-destructive">*</span>
            </Label>
            <Textarea
              ref={descriptionRef}
              id="edit-description"
              placeholder="描述功能、缺陷修复或改进。尽可能详细说明需求、限制和预期行为。"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onPaste={handlePaste}
              onDragOver={handleTextareaDragOver}
              onDragLeave={handleTextareaDragLeave}
              onDrop={handleTextareaDrop}
              rows={5}
              disabled={isSaving}
              className={cn(
                isDragOverTextarea && !isSaving && "border-primary bg-primary/5 ring-2 ring-primary/20"
              )}
            />
            <p className="text-xs text-muted-foreground">
              提示：使用 {navigator.platform.includes('Mac') ? '⌘V' : 'Ctrl+V'} 直接粘贴截图以添加参考图片。
            </p>
          </div>

          {/* 标题（可选 - 为空时自动生成） */}
          <div className="space-y-2">
            <Label htmlFor="edit-title" className="text-sm font-medium text-foreground">
              任务标题 <span className="text-muted-foreground font-normal">(可选)</span>
            </Label>
            <Input
              id="edit-title"
              placeholder="留空将根据描述自动生成"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              若留空，将自动生成简短的描述性标题。
            </p>
          </div>

          {/* 智能体配置选择 */}
          <AgentProfileSelector
            profileId={profileId}
            model={model}
            thinkingLevel={thinkingLevel}
            phaseModels={phaseModels}
            phaseThinking={phaseThinking}
            onProfileChange={(newProfileId, newModel, newThinkingLevel) => {
              setProfileId(newProfileId);
              setModel(newModel);
              setThinkingLevel(newThinkingLevel);
            }}
            onModelChange={setModel}
            onThinkingLevelChange={setThinkingLevel}
            onPhaseModelsChange={setPhaseModels}
            onPhaseThinkingChange={setPhaseThinking}
            disabled={isSaving}
          />

          {/* 粘贴成功提示 */}
          {pasteSuccess && (
            <div className="flex items-center gap-2 text-sm text-success animate-in fade-in slide-in-from-top-1 duration-200">
              <ImageIcon className="h-4 w-4" />
              图片已成功添加！
            </div>
          )}

          {/* 高级选项开关 */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={cn(
              'flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors',
              'w-full justify-between py-2 px-3 rounded-md hover:bg-muted/50'
            )}
            disabled={isSaving}
          >
            <span>分类（可选）</span>
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {/* 高级选项 */}
          {showAdvanced && (
            <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
              <div className="grid grid-cols-2 gap-4">
                {/* 类别 */}
                <div className="space-y-2">
                  <Label htmlFor="edit-category" className="text-xs font-medium text-muted-foreground">
                    类别
                  </Label>
                  <Select
                    value={category}
                    onValueChange={(value) => setCategory(value as TaskCategory)}
                    disabled={isSaving}
                  >
                    <SelectTrigger id="edit-category" className="h-9">
                      <SelectValue placeholder="选择类别" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TASK_CATEGORY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 优先级 */}
                <div className="space-y-2">
                  <Label htmlFor="edit-priority" className="text-xs font-medium text-muted-foreground">
                    优先级
                  </Label>
                  <Select
                    value={priority}
                    onValueChange={(value) => setPriority(value as TaskPriority)}
                    disabled={isSaving}
                  >
                    <SelectTrigger id="edit-priority" className="h-9">
                      <SelectValue placeholder="选择优先级" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 复杂度 */}
                <div className="space-y-2">
                  <Label htmlFor="edit-complexity" className="text-xs font-medium text-muted-foreground">
                    复杂度
                  </Label>
                  <Select
                    value={complexity}
                    onValueChange={(value) => setComplexity(value as TaskComplexity)}
                    disabled={isSaving}
                  >
                    <SelectTrigger id="edit-complexity" className="h-9">
                      <SelectValue placeholder="选择复杂度" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TASK_COMPLEXITY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 影响 */}
                <div className="space-y-2">
                  <Label htmlFor="edit-impact" className="text-xs font-medium text-muted-foreground">
                    影响
                  </Label>
                  <Select
                    value={impact}
                    onValueChange={(value) => setImpact(value as TaskImpact)}
                    disabled={isSaving}
                  >
                    <SelectTrigger id="edit-impact" className="h-9">
                      <SelectValue placeholder="选择影响" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TASK_IMPACT_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                这些标签有助于组织和确定任务优先级。可选，但便于筛选。
              </p>
            </div>
          )}

          {/* 图片开关 */}
          <button
            type="button"
            onClick={() => setShowImages(!showImages)}
            className={cn(
              'flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors',
              'w-full justify-between py-2 px-3 rounded-md hover:bg-muted/50'
            )}
            disabled={isSaving}
          >
            <span className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              参考图片（可选）
              {images.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  {images.length}
                </span>
              )}
            </span>
            {showImages ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {/* 图片上传区块 */}
          {showImages && (
            <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
              <p className="text-xs text-muted-foreground">
                附上截图、原型或示意图，为 AI 提供视觉上下文。
              </p>
              <ImageUpload
                images={images}
                onImagesChange={setImages}
                disabled={isSaving}
              />
            </div>
          )}

          {/* 审核要求开关 */}
          <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30">
            <Checkbox
              id="edit-require-review"
              checked={requireReviewBeforeCoding}
              onCheckedChange={(checked) => setRequireReviewBeforeCoding(checked === true)}
              disabled={isSaving}
              className="mt-0.5"
            />
            <div className="flex-1 space-y-1">
              <Label
                htmlFor="edit-require-review"
                className="text-sm font-medium text-foreground cursor-pointer"
              >
                编码前需要人工审核
              </Label>
              <p className="text-xs text-muted-foreground">
                启用后，编码阶段开始前会提示你审核规范和实现计划。你可以批准、要求更改或提供反馈。
              </p>
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
                正在保存...
              </>
            ) : (
              '保存更改'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
