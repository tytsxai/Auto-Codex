/**
 * 路线图相关常量
 * 功能优先级、复杂度和影响指标
 */

// ============================================
// 路线图优先级
// ============================================

export const ROADMAP_PRIORITY_LABELS: Record<string, string> = {
  must: '必需',
  should: '应该有',
  could: '可有可无',
  wont: '不会有'
};

export const ROADMAP_PRIORITY_COLORS: Record<string, string> = {
  must: 'bg-destructive/10 text-destructive border-destructive/30',
  should: 'bg-warning/10 text-warning border-warning/30',
  could: 'bg-info/10 text-info border-info/30',
  wont: 'bg-muted text-muted-foreground border-muted'
};

// ============================================
// 路线图复杂度
// ============================================

export const ROADMAP_COMPLEXITY_COLORS: Record<string, string> = {
  low: 'bg-success/10 text-success',
  medium: 'bg-warning/10 text-warning',
  high: 'bg-destructive/10 text-destructive'
};

// ============================================
// 路线图影响
// ============================================

export const ROADMAP_IMPACT_COLORS: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-info/10 text-info',
  high: 'bg-success/10 text-success'
};

// ============================================
// 路线图状态（用于看板列）
// ============================================

export interface RoadmapStatusColumn {
  id: string;
  label: string;
  color: string;
  icon: string;
}

export const ROADMAP_STATUS_COLUMNS: RoadmapStatusColumn[] = [
  { id: 'under_review', label: '审核中', color: 'border-t-muted-foreground/50', icon: 'Eye' },
  { id: 'planned', label: '已规划', color: 'border-t-info', icon: 'Calendar' },
  { id: 'in_progress', label: '进行中', color: 'border-t-primary', icon: 'Play' },
  { id: 'done', label: '已完成', color: 'border-t-success', icon: 'Check' }
];

export const ROADMAP_STATUS_LABELS: Record<string, string> = {
  under_review: '审核中',
  planned: '已规划',
  in_progress: '进行中',
  done: '已完成'
};

export const ROADMAP_STATUS_COLORS: Record<string, string> = {
  under_review: 'bg-muted text-muted-foreground',
  planned: 'bg-info/10 text-info',
  in_progress: 'bg-primary/10 text-primary',
  done: 'bg-success/10 text-success'
};
