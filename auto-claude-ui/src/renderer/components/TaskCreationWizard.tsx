import { useState, useEffect, useCallback, useRef, useMemo, type ClipboardEvent, type DragEvent } from 'react';
import { Loader2, ChevronDown, ChevronUp, Image as ImageIcon, X, RotateCcw, FolderTree, GitBranch } from 'lucide-react';
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
import { ReferencedFilesSection } from './ReferencedFilesSection';
import { TaskFileExplorerDrawer } from './TaskFileExplorerDrawer';
import { AgentProfileSelector } from './AgentProfileSelector';
import { createTask, saveDraft, loadDraft, clearDraft, isDraftEmpty } from '../stores/task-store';
import { useProjectStore } from '../stores/project-store';
import { cn } from '../lib/utils';
import type { TaskCategory, TaskPriority, TaskComplexity, TaskImpact, TaskMetadata, ImageAttachment, TaskDraft, ModelType, ThinkingLevel, ReferencedFile } from '../../shared/types';
import type { PhaseModelConfig, PhaseThinkingConfig } from '../../shared/types/settings';
import {
  TASK_CATEGORY_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_COMPLEXITY_LABELS,
  TASK_IMPACT_LABELS,
  MAX_IMAGES_PER_TASK,
  MAX_REFERENCED_FILES,
  ALLOWED_IMAGE_TYPES_DISPLAY,
  DEFAULT_AGENT_PROFILES,
  DEFAULT_PHASE_MODELS,
  DEFAULT_PHASE_THINKING
} from '../../shared/constants';
import { useSettingsStore } from '../stores/settings-store';

interface TaskCreationWizardProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskCreationWizard({
  projectId,
  open,
  onOpenChange
}: TaskCreationWizardProps) {
  // 从设置中获取选中的智能体配置
  const { settings } = useSettingsStore();
  const selectedProfile = DEFAULT_AGENT_PROFILES.find(
    p => p.id === settings.selectedAgentProfile
  ) || DEFAULT_AGENT_PROFILES.find(p => p.id === 'auto')!;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [showGitOptions, setShowGitOptions] = useState(false);

  // Git 选项状态
  // 使用特殊值表示“使用项目默认”，因为 Radix UI Select 不允许空字符串
  const PROJECT_DEFAULT_BRANCH = '__project_default__';
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [baseBranch, setBaseBranch] = useState<string>(PROJECT_DEFAULT_BRANCH);
  const [projectDefaultBranch, setProjectDefaultBranch] = useState<string>('');

  // 从项目 store 获取项目路径
  const projects = useProjectStore((state) => state.projects);
  const projectPath = useMemo(() => {
    const project = projects.find((p) => p.id === projectId);
    return project?.path ?? null;
  }, [projects, projectId]);

  // 元数据字段
  const [category, setCategory] = useState<TaskCategory | ''>('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [complexity, setComplexity] = useState<TaskComplexity | ''>('');
  const [impact, setImpact] = useState<TaskImpact | ''>('');

  // 模型配置（从选中的智能体配置初始化）
  const [profileId, setProfileId] = useState<string>(settings.selectedAgentProfile || 'auto');
  const [model, setModel] = useState<ModelType | ''>(selectedProfile.model);
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel | ''>(selectedProfile.thinkingLevel);
  // Auto 配置 - 按阶段配置
  // 若应用设置中有自定义配置则使用，否则回退到默认值
  const [phaseModels, setPhaseModels] = useState<PhaseModelConfig | undefined>(
    settings.customPhaseModels || selectedProfile.phaseModels || DEFAULT_PHASE_MODELS
  );
  const [phaseThinking, setPhaseThinking] = useState<PhaseThinkingConfig | undefined>(
    settings.customPhaseThinking || selectedProfile.phaseThinking || DEFAULT_PHASE_THINKING
  );

  // 图片附件
  const [images, setImages] = useState<ImageAttachment[]>([]);

  // 来自文件资源管理器的引用文件
  const [referencedFiles, setReferencedFiles] = useState<ReferencedFile[]>([]);

  // 审核设置
  const [requireReviewBeforeCoding, setRequireReviewBeforeCoding] = useState(false);

  // 草稿状态
  const [isDraftRestored, setIsDraftRestored] = useState(false);
  const [pasteSuccess, setPasteSuccess] = useState(false);

  // 文本域引用，用于处理粘贴事件
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // 文本域上方图片拖拽状态
  const [isDragOverTextarea, setIsDragOverTextarea] = useState(false);

  // 对话框打开时加载草稿，或使用所选配置初始化
  useEffect(() => {
    if (open && projectId) {
      const draft = loadDraft(projectId);
      if (draft && !isDraftEmpty(draft)) {
        setTitle(draft.title);
        setDescription(draft.description);
        setCategory(draft.category);
        setPriority(draft.priority);
        setComplexity(draft.complexity);
        setImpact(draft.impact);
        // 如草稿存在则加载 model/thinkingLevel/profileId，否则使用配置默认值
        setProfileId(draft.profileId || settings.selectedAgentProfile || 'auto');
        setModel(draft.model || selectedProfile.model);
        setThinkingLevel(draft.thinkingLevel || selectedProfile.thinkingLevel);
        setPhaseModels(draft.phaseModels || settings.customPhaseModels || selectedProfile.phaseModels || DEFAULT_PHASE_MODELS);
        setPhaseThinking(draft.phaseThinking || settings.customPhaseThinking || selectedProfile.phaseThinking || DEFAULT_PHASE_THINKING);
        setImages(draft.images);
        setReferencedFiles(draft.referencedFiles ?? []);
        setRequireReviewBeforeCoding(draft.requireReviewBeforeCoding ?? false);
        setIsDraftRestored(true);

        // 有内容时展开区块
        if (draft.category || draft.priority || draft.complexity || draft.impact) {
          setShowAdvanced(true);
        }
        if (draft.images.length > 0) {
          setShowImages(true);
        }
        // 注意：引用文件区始终可见，无需展开
      } else {
        // 无草稿 - 使用所选配置和自定义设置初始化
        setProfileId(settings.selectedAgentProfile || 'auto');
        setModel(selectedProfile.model);
        setThinkingLevel(selectedProfile.thinkingLevel);
        setPhaseModels(settings.customPhaseModels || selectedProfile.phaseModels || DEFAULT_PHASE_MODELS);
        setPhaseThinking(settings.customPhaseThinking || selectedProfile.phaseThinking || DEFAULT_PHASE_THINKING);
      }
    }
  }, [open, projectId, settings.selectedAgentProfile, settings.customPhaseModels, settings.customPhaseThinking, selectedProfile.model, selectedProfile.thinkingLevel]);

  // 对话框打开时获取分支和项目默认分支
  useEffect(() => {
    if (open && projectPath) {
      fetchBranches();
      fetchProjectDefaultBranch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectPath]);

  const fetchBranches = async () => {
    if (!projectPath) return;

    setIsLoadingBranches(true);
    try {
      const result = await window.electronAPI.getGitBranches(projectPath);
      if (result.success && result.data) {
        setBranches(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch branches:', err);
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const fetchProjectDefaultBranch = async () => {
    if (!projectId) return;

    try {
      // 获取环境配置以检查是否配置了默认分支
      const result = await window.electronAPI.getProjectEnv(projectId);
      if (result.success && result.data?.defaultBranch) {
        setProjectDefaultBranch(result.data.defaultBranch);
      } else if (projectPath) {
        // 回退到自动检测
        const detectResult = await window.electronAPI.detectMainBranch(projectPath);
        if (detectResult.success && detectResult.data) {
          setProjectDefaultBranch(detectResult.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch project default branch:', err);
    }
  };

  /**
   * 将当前表单状态作为草稿返回
   */
  const getCurrentDraft = useCallback((): TaskDraft => ({
    projectId,
    title,
    description,
    category,
    priority,
    complexity,
    impact,
    profileId,
    model,
    thinkingLevel,
    phaseModels,
    phaseThinking,
    images,
    referencedFiles,
    requireReviewBeforeCoding,
    savedAt: new Date()
  }), [projectId, title, description, category, priority, complexity, impact, profileId, model, thinkingLevel, phaseModels, phaseThinking, images, referencedFiles, requireReviewBeforeCoding]);
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
      setError(`最多允许 ${MAX_IMAGES_PER_TASK} 张图片`);
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
   * 处理文本域的文件引用与图片拖放
   */
  const handleTextareaDrop = useCallback(
    async (e: DragEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOverTextarea(false);

      if (isCreating) return;

      // 先检查文件引用拖放（来自文件资源管理器）
      const jsonData = e.dataTransfer?.getData('application/json');
      if (jsonData) {
        try {
          const data = JSON.parse(jsonData);
          if (data.type === 'file-reference' && data.name) {
            // 在文本域光标位置插入 @引用
            const textarea = descriptionRef.current;
            if (textarea) {
              const cursorPos = textarea.selectionStart || 0;
              const textBefore = description.substring(0, cursorPos);
              const textAfter = description.substring(cursorPos);

              // 在光标位置插入 @引用
              const mention = `@${data.name}`;
              const newDescription = textBefore + mention + textAfter;
              setDescription(newDescription);

              // 将光标置于插入的引用之后
              setTimeout(() => {
                textarea.focus();
                const newCursorPos = cursorPos + mention.length;
                textarea.setSelectionRange(newCursorPos, newCursorPos);
              }, 0);

              return; // 不按图片处理
            }
          }
        } catch {
          // 非有效 JSON，继续处理图片
        }
      }

      // 回退到图片文件处理
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
    [images, isCreating, description]
  );

  /**
   * 从描述中解析 @引用并创建 ReferencedFile 条目
   * 与已有 referencedFiles 合并，避免重复
   */
  const parseFileMentions = useCallback((text: string, existingFiles: ReferencedFile[]): ReferencedFile[] => {
    // 匹配 @filename 模式（支持点、连字符、下划线和路径分隔符）
    const mentionRegex = /@([\w\-./\\]+\.\w+)/g;
    const matches = Array.from(text.matchAll(mentionRegex));

    if (matches.length === 0) return existingFiles;

    // 创建已有文件名集合以便快速查找
    const existingNames = new Set(existingFiles.map(f => f.name));

    // 解析列表中尚不存在的引用文件
    const newFiles: ReferencedFile[] = [];
    matches.forEach(match => {
      const fileName = match[1];
      if (!existingNames.has(fileName)) {
        newFiles.push({
          id: crypto.randomUUID(),
          path: fileName, // 存储来自 @引用的相对路径
          name: fileName,
          isDirectory: false,
          addedAt: new Date()
        });
        existingNames.add(fileName); // 防止引用内部重复
      }
    });

    return [...existingFiles, ...newFiles];
  }, []);

  const handleCreate = async () => {
    if (!description.trim()) {
      setError('请填写描述');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // 从描述中解析 @引用并与引用文件合并
      const allReferencedFiles = parseFileMentions(description, referencedFiles);

      // 根据选择的值构建元数据
      const metadata: TaskMetadata = {
        sourceType: 'manual'
      };

      if (category) metadata.category = category;
      if (priority) metadata.priority = priority;
      if (complexity) metadata.complexity = complexity;
      if (impact) metadata.impact = impact;
      if (model) metadata.model = model;
      if (thinkingLevel) metadata.thinkingLevel = thinkingLevel;
      // Auto 配置 - 按阶段配置
      if (profileId === 'auto') {
        metadata.isAutoProfile = true;
        if (phaseModels) metadata.phaseModels = phaseModels;
        if (phaseThinking) metadata.phaseThinking = phaseThinking;
      }
      if (images.length > 0) metadata.attachedImages = images;
      if (allReferencedFiles.length > 0) metadata.referencedFiles = allReferencedFiles;
      if (requireReviewBeforeCoding) metadata.requireReviewBeforeCoding = true;
      // 仅在 baseBranch 不是项目默认占位值时包含
      if (baseBranch && baseBranch !== PROJECT_DEFAULT_BRANCH) metadata.baseBranch = baseBranch;

      // 标题是可选项 - 为空时由后端自动生成
      const task = await createTask(projectId, title.trim(), description.trim(), metadata);
      if (task) {
        // 创建成功后清除草稿
        clearDraft(projectId);
        // 重置表单并关闭
        resetForm();
        onOpenChange(false);
      } else {
        setError('创建任务失败。请重试。');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('');
    setPriority('');
    setComplexity('');
    setImpact('');
    // 重置为所选配置的默认值与自定义设置
    setProfileId(settings.selectedAgentProfile || 'auto');
    setModel(selectedProfile.model);
    setThinkingLevel(selectedProfile.thinkingLevel);
    setPhaseModels(settings.customPhaseModels || selectedProfile.phaseModels || DEFAULT_PHASE_MODELS);
    setPhaseThinking(settings.customPhaseThinking || selectedProfile.phaseThinking || DEFAULT_PHASE_THINKING);
    setImages([]);
    setReferencedFiles([]);
    setRequireReviewBeforeCoding(false);
    setBaseBranch(PROJECT_DEFAULT_BRANCH);
    setError(null);
    setShowAdvanced(false);
    setShowImages(false);
    setShowFileExplorer(false);
    setShowGitOptions(false);
    setIsDraftRestored(false);
    setPasteSuccess(false);
  };

  /**
   * 处理对话框关闭 - 有内容时保存草稿
   */
  const handleClose = () => {
    if (isCreating) return;

    const draft = getCurrentDraft();

    // 有内容时保存草稿
    if (!isDraftEmpty(draft)) {
      saveDraft(draft);
    } else {
      // 表单为空时清除已有草稿
      clearDraft(projectId);
    }

    resetForm();
    onOpenChange(false);
  };

  /**
   * 丢弃草稿并重新开始
   */
  const handleDiscardDraft = () => {
    clearDraft(projectId);
    resetForm();
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          "max-h-[90vh] p-0 overflow-hidden transition-all duration-300 ease-out",
          showFileExplorer ? "sm:max-w-[900px]" : "sm:max-w-[550px]"
        )}
        hideCloseButton={showFileExplorer}
      >
        <div className="flex h-full min-h-0 overflow-hidden">
          {/* 表单内容 */}
          <div className="flex-1 flex flex-col p-6 min-w-0 min-h-0 overflow-y-auto relative">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-foreground">创建新任务</DialogTitle>
            {isDraftRestored && (
              <div className="flex items-center gap-2">
                <span className="text-xs bg-info/10 text-info px-2 py-1 rounded-md">
                  草稿已恢复
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleDiscardDraft}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  重新开始
                </Button>
              </div>
            )}
          </div>
          <DialogDescription>
            描述你想构建的内容。AI 将分析你的需求并生成详细的规范。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* 描述（主要 - 必填） */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-foreground">
              描述 <span className="text-destructive">*</span>
            </Label>
            {/* 包裹文本域以支持文件 @引用 */}
            <div className="relative">
              {/* @引用语法高亮覆盖层 */}
              <div
                className="absolute inset-0 pointer-events-none overflow-hidden rounded-md border border-transparent"
                style={{
                  padding: '0.5rem 0.75rem',
                  font: 'inherit',
                  lineHeight: '1.5',
                  wordWrap: 'break-word',
                  whiteSpace: 'pre-wrap',
                  color: 'transparent'
                }}
              >
                {description.split(/(@[\w\-./\\]+\.\w+)/g).map((part, i) => {
                  // 检查此部分是否为 @引用
                  if (part.match(/^@[\w\-./\\]+\.\w+$/)) {
                    return (
                      <span
                        key={i}
                        className="bg-info/20 text-info-foreground rounded px-0.5"
                        style={{ color: 'hsl(var(--info))' }}
                      >
                        {part}
                      </span>
                    );
                  }
                  return <span key={i}>{part}</span>;
                })}
              </div>
              <Textarea
                ref={descriptionRef}
                id="description"
                placeholder="描述你要实现的功能、缺陷修复或改进。尽可能详细说明需求、限制和预期行为。"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onPaste={handlePaste}
                onDragOver={handleTextareaDragOver}
                onDragLeave={handleTextareaDragLeave}
                onDrop={handleTextareaDrop}
                rows={5}
                disabled={isCreating}
                className={cn(
                  "resize-y min-h-[120px] max-h-[400px] relative bg-transparent",
                  // 拖拽到文本域上方时的视觉反馈
                  isDragOverTextarea && !isCreating && "border-primary bg-primary/5 ring-2 ring-primary/20"
                )}
                style={{ caretColor: 'auto' }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              提示：从资源管理器拖拽文件以插入 @引用，或使用 {navigator.platform.includes('Mac') ? '⌘V' : 'Ctrl+V'} 粘贴截图。
            </p>
          </div>

          {/* 标题（可选 - 为空时自动生成） */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium text-foreground">
              任务标题 <span className="text-muted-foreground font-normal">(可选)</span>
            </Label>
            <Input
              id="title"
              placeholder="留空将根据描述自动生成"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isCreating}
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
            disabled={isCreating}
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
            disabled={isCreating}
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
                  <Label htmlFor="category" className="text-xs font-medium text-muted-foreground">
                    类别
                  </Label>
                  <Select
                    value={category}
                    onValueChange={(value) => setCategory(value as TaskCategory)}
                    disabled={isCreating}
                  >
                    <SelectTrigger id="category" className="h-9">
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
                  <Label htmlFor="priority" className="text-xs font-medium text-muted-foreground">
                    优先级
                  </Label>
                  <Select
                    value={priority}
                    onValueChange={(value) => setPriority(value as TaskPriority)}
                    disabled={isCreating}
                  >
                    <SelectTrigger id="priority" className="h-9">
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
                  <Label htmlFor="complexity" className="text-xs font-medium text-muted-foreground">
                    复杂度
                  </Label>
                  <Select
                    value={complexity}
                    onValueChange={(value) => setComplexity(value as TaskComplexity)}
                    disabled={isCreating}
                  >
                    <SelectTrigger id="complexity" className="h-9">
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
                  <Label htmlFor="impact" className="text-xs font-medium text-muted-foreground">
                    影响
                  </Label>
                  <Select
                    value={impact}
                    onValueChange={(value) => setImpact(value as TaskImpact)}
                    disabled={isCreating}
                  >
                    <SelectTrigger id="impact" className="h-9">
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
            disabled={isCreating}
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
                disabled={isCreating}
              />
            </div>
          )}

          {/* 引用文件区 - 始终可见，简洁列表 */}
          <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
            {/* 标题 */}
            <div className="flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">引用文件</span>
              {referencedFiles.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  {referencedFiles.length}/{MAX_REFERENCED_FILES}
                </span>
              )}
            </div>

            {/* 空状态提示 */}
            {referencedFiles.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                从文件资源管理器将文件拖到此表单任意位置以添加引用，或使用下方的“浏览文件”按钮。
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  这些文件将在 AI 处理任务时提供上下文。
                </p>
                <ReferencedFilesSection
                  files={referencedFiles}
                  onRemove={(id) => setReferencedFiles(prev => prev.filter(f => f.id !== id))}
                  maxFiles={MAX_REFERENCED_FILES}
                  disabled={isCreating}
                />
              </>
            )}
          </div>

          {/* 审核要求开关 */}
          <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30">
            <Checkbox
              id="require-review"
              checked={requireReviewBeforeCoding}
              onCheckedChange={(checked) => setRequireReviewBeforeCoding(checked === true)}
              disabled={isCreating}
              className="mt-0.5"
            />
            <div className="flex-1 space-y-1">
              <Label
                htmlFor="require-review"
                className="text-sm font-medium text-foreground cursor-pointer"
              >
                编码前需要人工审核
              </Label>
              <p className="text-xs text-muted-foreground">
                启用后，编码阶段开始前会提示你审核规范和实现计划。你可以批准、要求更改或提供反馈。
              </p>
            </div>
          </div>

          {/* Git 选项开关 */}
          <button
            type="button"
            onClick={() => setShowGitOptions(!showGitOptions)}
            className={cn(
              'flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors',
              'w-full justify-between py-2 px-3 rounded-md hover:bg-muted/50'
            )}
            disabled={isCreating}
          >
            <span className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Git 选项（可选）
              {baseBranch && baseBranch !== PROJECT_DEFAULT_BRANCH && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  {baseBranch}
                </span>
              )}
            </span>
            {showGitOptions ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {/* Git 选项 */}
          {showGitOptions && (
            <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
              <div className="space-y-2">
                <Label htmlFor="base-branch" className="text-sm font-medium text-foreground">
                  基准分支（可选）
                </Label>
                <Select
                  value={baseBranch}
                  onValueChange={setBaseBranch}
                  disabled={isCreating || isLoadingBranches}
                >
                  <SelectTrigger id="base-branch" className="h-9">
                    <SelectValue placeholder={`使用项目默认${projectDefaultBranch ? ` (${projectDefaultBranch})` : ''}`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PROJECT_DEFAULT_BRANCH}>
                      使用项目默认{projectDefaultBranch ? ` (${projectDefaultBranch})` : ''}
                    </SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch} value={branch}>
                        {branch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  覆盖此任务工作树的创建分支。留空将使用项目配置的默认分支。
                </p>
              </div>
            </div>
          )}

          {/* 错误 */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
              <X className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex items-center gap-2">
            {/* 文件资源管理器开关按钮 */}
            {projectPath && (
              <Button
                type="button"
                variant={showFileExplorer ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFileExplorer(!showFileExplorer)}
                disabled={isCreating}
                className="gap-1.5"
              >
                <FolderTree className="h-4 w-4" />
                {showFileExplorer ? '隐藏文件' : '浏览文件'}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isCreating}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={isCreating || !description.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在创建...
                </>
              ) : (
                '创建任务'
              )}
            </Button>
          </div>
        </DialogFooter>
          </div>

          {/* 文件资源管理器抽屉 */}
          {projectPath && (
            <TaskFileExplorerDrawer
              isOpen={showFileExplorer}
              onClose={() => setShowFileExplorer(false)}
              projectPath={projectPath}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
