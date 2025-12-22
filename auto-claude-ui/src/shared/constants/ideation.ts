/**
 * 创意相关常量
 * AI 生成的项目改进类型、分类与配置
 */

// ============================================
// 创意类型
// ============================================

// 创意类型标签与描述
// 注意：已移除 high_value_features - 战略性功能归属路线图
// low_hanging_fruit 已更名为 code_improvements，以覆盖所有从代码揭示的机会
export const IDEATION_TYPE_LABELS: Record<string, string> = {
  code_improvements: '代码改进',
  ui_ux_improvements: 'UI/UX 改进',
  documentation_gaps: '文档',
  security_hardening: '安全',
  performance_optimizations: '性能',
  code_quality: '代码质量'
};

export const IDEATION_TYPE_DESCRIPTIONS: Record<string, string> = {
  code_improvements: 'Code-revealed opportunities from patterns, architecture, and infrastructure analysis',
  ui_ux_improvements: 'Visual and interaction improvements identified through app analysis',
  documentation_gaps: 'Missing or outdated documentation that needs attention',
  security_hardening: 'Security vulnerabilities and hardening opportunities',
  performance_optimizations: 'Performance bottlenecks and optimization opportunities',
  code_quality: 'Refactoring opportunities, large files, code smells, and best practice violations'
};

// 创意类型颜色
export const IDEATION_TYPE_COLORS: Record<string, string> = {
  code_improvements: 'bg-success/10 text-success border-success/30',
  ui_ux_improvements: 'bg-info/10 text-info border-info/30',
  documentation_gaps: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  security_hardening: 'bg-destructive/10 text-destructive border-destructive/30',
  performance_optimizations: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  code_quality: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
};

// 创意类型图标（Lucide 图标名称）
export const IDEATION_TYPE_ICONS: Record<string, string> = {
  code_improvements: 'Zap',
  ui_ux_improvements: 'Palette',
  documentation_gaps: 'BookOpen',
  security_hardening: 'Shield',
  performance_optimizations: 'Gauge',
  code_quality: 'Code2'
};

// ============================================
// 创意状态
// ============================================

export const IDEATION_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  selected: 'bg-primary/10 text-primary',
  converted: 'bg-success/10 text-success',
  dismissed: 'bg-destructive/10 text-destructive line-through',
  archived: 'bg-violet-500/10 text-violet-400'
};

// ============================================
// 创意工作量/复杂度
// ============================================

// 创意工作量颜色（code_improvements 使用全色谱）
export const IDEATION_EFFORT_COLORS: Record<string, string> = {
  trivial: 'bg-success/10 text-success',
  small: 'bg-info/10 text-info',
  medium: 'bg-warning/10 text-warning',
  large: 'bg-orange-500/10 text-orange-400',
  complex: 'bg-destructive/10 text-destructive'
};

// ============================================
// 创意影响
// ============================================

export const IDEATION_IMPACT_COLORS: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-info/10 text-info',
  high: 'bg-warning/10 text-warning',
  critical: 'bg-destructive/10 text-destructive'
};

// ============================================
// 分类专用标签
// ============================================

// 安全严重级别颜色
export const SECURITY_SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-info/10 text-info',
  medium: 'bg-warning/10 text-warning',
  high: 'bg-orange-500/10 text-orange-500',
  critical: 'bg-destructive/10 text-destructive'
};

// UI/UX 分类标签
export const UIUX_CATEGORY_LABELS: Record<string, string> = {
  usability: '可用性',
  accessibility: '无障碍',
  performance: '性能',
  visual: '视觉设计',
  interaction: '交互'
};

// 文档分类标签
export const DOCUMENTATION_CATEGORY_LABELS: Record<string, string> = {
  readme: 'README',
  api_docs: 'API 文档',
  inline_comments: '行内注释',
  examples: '示例与教程',
  architecture: '架构文档',
  troubleshooting: '故障排查指南'
};

// 安全分类标签
export const SECURITY_CATEGORY_LABELS: Record<string, string> = {
  authentication: '认证',
  authorization: '授权',
  input_validation: '输入校验',
  data_protection: '数据保护',
  dependencies: '依赖',
  configuration: '配置',
  secrets_management: '密钥管理'
};

// 性能分类标签
export const PERFORMANCE_CATEGORY_LABELS: Record<string, string> = {
  bundle_size: '包体积',
  runtime: '运行时性能',
  memory: '内存使用',
  database: '数据库查询',
  network: '网络请求',
  rendering: '渲染',
  caching: '缓存'
};

// 代码质量分类标签
export const CODE_QUALITY_CATEGORY_LABELS: Record<string, string> = {
  large_files: '大文件',
  code_smells: '代码异味',
  complexity: '高复杂度',
  duplication: '代码重复',
  naming: '命名规范',
  structure: '文件结构',
  linting: '代码规范问题',
  testing: '测试覆盖率',
  types: '类型安全',
  dependencies: '依赖问题',
  dead_code: '无用代码',
  git_hygiene: 'Git 规范'
};

// 代码质量严重级别颜色
export const CODE_QUALITY_SEVERITY_COLORS: Record<string, string> = {
  suggestion: 'bg-info/10 text-info',
  minor: 'bg-warning/10 text-warning',
  major: 'bg-orange-500/10 text-orange-500',
  critical: 'bg-destructive/10 text-destructive'
};

// ============================================
// 默认配置
// ============================================

// 默认创意配置
// 注意：已移除 high_value_features，low_hanging_fruit 已更名为 code_improvements
export const DEFAULT_IDEATION_CONFIG = {
  enabledTypes: ['code_improvements', 'ui_ux_improvements', 'security_hardening'] as const,
  includeRoadmapContext: true,
  includeKanbanContext: true,
  maxIdeasPerType: 5
};
