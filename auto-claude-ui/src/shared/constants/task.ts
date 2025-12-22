/**
 * 任务相关常量
 * 包括状态、类别、复杂度、优先级和执行阶段
 */

// ============================================
// 任务状态（看板列）
// ============================================

// 看板顺序中的任务状态列
export const TASK_STATUS_COLUMNS = [
  'backlog',
  'in_progress',
  'ai_review',
  'human_review',
  'done'
] as const;

// 可读的状态标签
export const TASK_STATUS_LABELS: Record<string, string> = {
  backlog: '规划中',
  in_progress: '进行中',
  ai_review: 'AI 审核',
  human_review: '人工审核',
  done: '已完成'
};

// UI 中的状态颜色
export const TASK_STATUS_COLORS: Record<string, string> = {
  backlog: 'bg-muted text-muted-foreground',
  in_progress: 'bg-info/10 text-info',
  ai_review: 'bg-warning/10 text-warning',
  human_review: 'bg-purple-500/10 text-purple-400',
  done: 'bg-success/10 text-success'
};

// ============================================
// 子任务状态
// ============================================

export const SUBTASK_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-muted',
  in_progress: 'bg-info',
  completed: 'bg-success',
  failed: 'bg-destructive'
};

// ============================================
// 执行阶段
// ============================================

// 执行阶段标签
export const EXECUTION_PHASE_LABELS: Record<string, string> = {
  idle: '空闲',
  planning: '规划中',
  coding: '编码中',
  qa_review: 'AI 审核',
  qa_fixing: '修复问题',
  complete: '完成',
  failed: '失败'
};

// 执行阶段颜色（用于进度条和指示器）
export const EXECUTION_PHASE_COLORS: Record<string, string> = {
  idle: 'bg-muted text-muted-foreground',
  planning: 'bg-amber-500 text-amber-50',
  coding: 'bg-info text-info-foreground',
  qa_review: 'bg-purple-500 text-purple-50',
  qa_fixing: 'bg-warning text-warning-foreground',
  complete: 'bg-success text-success-foreground',
  failed: 'bg-destructive text-destructive-foreground'
};

// 执行阶段徽章颜色（描边样式）
export const EXECUTION_PHASE_BADGE_COLORS: Record<string, string> = {
  idle: 'bg-muted/50 text-muted-foreground border-muted',
  planning: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  coding: 'bg-info/10 text-info border-info/30',
  qa_review: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  qa_fixing: 'bg-warning/10 text-warning border-warning/30',
  complete: 'bg-success/10 text-success border-success/30',
  failed: 'bg-destructive/10 text-destructive border-destructive/30'
};

// 执行阶段进度权重（用于整体进度计算）
export const EXECUTION_PHASE_WEIGHTS: Record<string, { start: number; end: number }> = {
  idle: { start: 0, end: 0 },
  planning: { start: 0, end: 20 },
  coding: { start: 20, end: 80 },
  qa_review: { start: 80, end: 95 },
  qa_fixing: { start: 80, end: 95 },  // 与 qa_review 相同区间，会循环回退
  complete: { start: 100, end: 100 },
  failed: { start: 0, end: 0 }
};

// ============================================
// 任务类别
// ============================================

export const TASK_CATEGORY_LABELS: Record<string, string> = {
  feature: '功能',
  bug_fix: '修复缺陷',
  refactoring: '重构',
  documentation: '文档',
  security: '安全',
  performance: '性能',
  ui_ux: 'UI/UX',
  infrastructure: '基础设施',
  testing: '测试'
};

export const TASK_CATEGORY_COLORS: Record<string, string> = {
  feature: 'bg-primary/10 text-primary border-primary/30',
  bug_fix: 'bg-destructive/10 text-destructive border-destructive/30',
  refactoring: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  documentation: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  security: 'bg-red-500/10 text-red-400 border-red-500/30',
  performance: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  ui_ux: 'bg-info/10 text-info border-info/30',
  infrastructure: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  testing: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
};

// ============================================
// 任务复杂度
// ============================================

export const TASK_COMPLEXITY_LABELS: Record<string, string> = {
  trivial: '极简',
  small: '小型',
  medium: '中',
  large: '大型',
  complex: '复杂'
};

export const TASK_COMPLEXITY_COLORS: Record<string, string> = {
  trivial: 'bg-success/10 text-success',
  small: 'bg-info/10 text-info',
  medium: 'bg-warning/10 text-warning',
  large: 'bg-orange-500/10 text-orange-400',
  complex: 'bg-destructive/10 text-destructive'
};

// ============================================
// 任务影响
// ============================================

export const TASK_IMPACT_LABELS: Record<string, string> = {
  low: '低影响',
  medium: '中影响',
  high: '高影响',
  critical: '严重影响'
};

export const TASK_IMPACT_COLORS: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-info/10 text-info',
  high: 'bg-warning/10 text-warning',
  critical: 'bg-destructive/10 text-destructive'
};

// ============================================
// 任务优先级
// ============================================

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急'
};

export const TASK_PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-info/10 text-info',
  high: 'bg-warning/10 text-warning',
  urgent: 'bg-destructive/10 text-destructive'
};

// ============================================
// 图片/附件常量
// ============================================

// 最大图片文件大小（10 MB）
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

// 每个任务允许的最大图片数量
export const MAX_IMAGES_PER_TASK = 10;

// 每个任务允许引用的最大文件数量
export const MAX_REFERENCED_FILES = 20;

// 允许的图片 MIME 类型
export const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml'
] as const;

// 允许的图片文件扩展名（用于显示）
export const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'] as const;

// 错误信息中显示的可读类型
export const ALLOWED_IMAGE_TYPES_DISPLAY = 'PNG, JPEG, GIF, WebP, SVG';

// 规范文件夹内的附件目录名
export const ATTACHMENTS_DIR = 'attachments';
