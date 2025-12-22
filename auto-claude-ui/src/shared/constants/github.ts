/**
 * GitHub 集成常量
 * Issue 状态、复杂度等级和调查相关常量
 */

// ============================================
// GitHub Issue 状态
// ============================================

export const GITHUB_ISSUE_STATE_LABELS: Record<string, string> = {
  open: 'Open',
  closed: 'Closed'
};

export const GITHUB_ISSUE_STATE_COLORS: Record<string, string> = {
  open: 'bg-success/10 text-success border-success/30',
  closed: 'bg-purple-500/10 text-purple-400 border-purple-500/30'
};

// ============================================
// GitHub 复杂度（用于调查结果）
// ============================================

export const GITHUB_COMPLEXITY_COLORS: Record<string, string> = {
  simple: 'bg-success/10 text-success',
  standard: 'bg-warning/10 text-warning',
  complex: 'bg-destructive/10 text-destructive'
};
