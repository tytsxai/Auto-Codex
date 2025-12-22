/**
 * 应用配置常量
 * 默认设置、文件路径和项目结构
 */

// ============================================
// 默认应用设置
// ============================================

export const DEFAULT_APP_SETTINGS = {
  theme: 'system' as const,
  colorTheme: 'default' as const,
  defaultModel: 'opus',
  agentFramework: 'auto-claude',
  pythonPath: undefined as string | undefined,
  autoBuildPath: undefined as string | undefined,
  autoUpdateAutoBuild: true,
  autoNameTerminals: true,
  onboardingCompleted: false,
  notifications: {
    onTaskComplete: true,
    onTaskFailed: true,
    onReviewNeeded: true,
    sound: false
  },
  // 全局 API 密钥（作为所有项目的默认值）
  globalClaudeOAuthToken: undefined as string | undefined,
  globalOpenAIApiKey: undefined as string | undefined,
  // 已选择的代理配置 - 默认为 'auto'，按阶段优化模型选择
  selectedAgentProfile: 'auto',
  // 变更日志偏好（会在会话间持久化）
  changelogFormat: 'keep-a-changelog' as const,
  changelogAudience: 'user-facing' as const,
  changelogEmojiLevel: 'none' as const
};

// ============================================
// 默认项目设置
// ============================================

export const DEFAULT_PROJECT_SETTINGS = {
  model: 'opus',
  memoryBackend: 'file' as const,
  linearSync: false,
  notifications: {
    onTaskComplete: true,
    onTaskFailed: true,
    onReviewNeeded: true,
    sound: false
  },
  // 供代理访问的 Graphiti MCP 服务器（默认启用）
  graphitiMcpEnabled: true,
  graphitiMcpUrl: 'http://localhost:8000/mcp/'
};

// ============================================
// Auto Build 文件路径
// ============================================

// 相对于项目的文件路径
// 重要：所有路径使用 .auto-claude/（已安装实例），而非 auto-claude/（源码）
export const AUTO_BUILD_PATHS = {
  SPECS_DIR: '.auto-claude/specs',
  ROADMAP_DIR: '.auto-claude/roadmap',
  IDEATION_DIR: '.auto-claude/ideation',
  IMPLEMENTATION_PLAN: 'implementation_plan.json',
  SPEC_FILE: 'spec.md',
  QA_REPORT: 'qa_report.md',
  BUILD_PROGRESS: 'build-progress.txt',
  CONTEXT: 'context.json',
  REQUIREMENTS: 'requirements.json',
  ROADMAP_FILE: 'roadmap.json',
  ROADMAP_DISCOVERY: 'roadmap_discovery.json',
  COMPETITOR_ANALYSIS: 'competitor_analysis.json',
  IDEATION_FILE: 'ideation.json',
  IDEATION_CONTEXT: 'ideation_context.json',
  PROJECT_INDEX: '.auto-claude/project_index.json',
  GRAPHITI_STATE: '.graphiti_state.json'
} as const;

/**
 * 获取规范目录路径。
 * 所有规范都存放在 .auto-claude/specs/（项目的数据目录）。
 */
export function getSpecsDir(autoBuildPath: string | undefined): string {
  const basePath = autoBuildPath || '.auto-claude';
  return `${basePath}/specs`;
}
