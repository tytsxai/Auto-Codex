/**
 * 变更日志相关常量
 * 格式选项、受众类型和生成配置
 */

// ============================================
// 变更日志格式
// ============================================

export const CHANGELOG_FORMAT_LABELS: Record<string, string> = {
  'keep-a-changelog': 'Keep a Changelog 格式',
  'simple-list': '简单列表',
  'github-release': 'GitHub 发布'
};

export const CHANGELOG_FORMAT_DESCRIPTIONS: Record<string, string> = {
  'keep-a-changelog': 'Structured format with Added/Changed/Fixed/Removed sections',
  'simple-list': 'Clean bulleted list with categories',
  'github-release': 'GitHub-style release notes'
};

// ============================================
// 变更日志受众
// ============================================

export const CHANGELOG_AUDIENCE_LABELS: Record<string, string> = {
  'technical': '技术向',
  'user-facing': '面向用户',
  'marketing': '营销'
};

export const CHANGELOG_AUDIENCE_DESCRIPTIONS: Record<string, string> = {
  'technical': 'Detailed technical changes for developers',
  'user-facing': 'Clear, non-technical descriptions for end users',
  'marketing': 'Value-focused copy emphasizing benefits'
};

// ============================================
// 变更日志表情等级
// ============================================

export const CHANGELOG_EMOJI_LEVEL_LABELS: Record<string, string> = {
  'none': '无',
  'little': '仅标题',
  'medium': '标题+重点',
  'high': '全部'
};

export const CHANGELOG_EMOJI_LEVEL_DESCRIPTIONS: Record<string, string> = {
  'none': 'No emojis',
  'little': 'Emojis on section headings only',
  'medium': 'Emojis on headings and key items',
  'high': 'Emojis on headings and every line'
};

// ============================================
// 变更日志来源模式
// ============================================

export const CHANGELOG_SOURCE_MODE_LABELS: Record<string, string> = {
  'tasks': '已完成任务',
  'git-history': 'Git 历史',
  'branch-diff': '分支对比'
};

export const CHANGELOG_SOURCE_MODE_DESCRIPTIONS: Record<string, string> = {
  'tasks': 'Generate from completed spec tasks',
  'git-history': 'Generate from recent commits or tag range',
  'branch-diff': 'Generate from commits between two branches'
};

// ============================================
// Git 历史类型
// ============================================

export const GIT_HISTORY_TYPE_LABELS: Record<string, string> = {
  'recent': '最近提交',
  'since-date': '自某日期起',
  'tag-range': '标签之间'
};

export const GIT_HISTORY_TYPE_DESCRIPTIONS: Record<string, string> = {
  'recent': 'Last N commits from HEAD',
  'since-date': 'All commits since a specific date',
  'tag-range': 'Commits between two tags'
};

// ============================================
// 变更日志生成阶段
// ============================================

export const CHANGELOG_STAGE_LABELS: Record<string, string> = {
  'loading_specs': '正在加载规范文件...',
  'loading_commits': '正在加载提交...',
  'generating': '正在生成变更日志...',
  'formatting': '正在格式化输出...',
  'complete': '完成',
  'error': '错误'
};

// ============================================
// 默认配置
// ============================================

// 默认变更日志文件路径
export const DEFAULT_CHANGELOG_PATH = 'CHANGELOG.md';
