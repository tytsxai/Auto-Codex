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
  defaultModel: 'codex',
  agentFramework: 'auto-codex',
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
  globalCodexOAuthToken: undefined as string | undefined,
  globalOpenAIApiKey: undefined as string | undefined,
  // 已选择的代理配置 - 默认为 'auto'，按阶段优化模型选择
  selectedAgentProfile: 'auto',
  // 变更日志偏好（会在会话间持久化）
  changelogFormat: 'keep-a-changelog' as const,
  changelogAudience: 'user-facing' as const,
  changelogEmojiLevel: 'none' as const,
  // Risk policy for high-impact automation (conservative blocks risky automation)
  riskPolicy: 'conservative' as const,
  // 安全默认：不绕过 Codex CLI 审批与沙盒（终端集成可单独开启）
  codexTerminalBypassApprovalsAndSandbox: false
};

// ============================================
// 默认项目设置
// ============================================

export const DEFAULT_PROJECT_SETTINGS = {
  model: 'codex',
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
// 重要：所有路径使用 .auto-codex/（已安装实例），而非 auto-codex/（源码）
export const AUTO_BUILD_PATHS = {
  SPECS_DIR: '.auto-codex/specs',
  ROADMAP_DIR: '.auto-codex/roadmap',
  IDEATION_DIR: '.auto-codex/ideation',
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
  PROJECT_INDEX: '.auto-codex/project_index.json',
  GRAPHITI_STATE: '.graphiti_state.json'
} as const;

/**
 * 获取规范目录路径。
 * 所有规范都存放在 .auto-codex/specs/（项目的数据目录）。
 */
export function getSpecsDir(autoBuildPath: string | undefined): string {
  const basePath = autoBuildPath || '.auto-codex';
  return `${basePath}/specs`;
}
