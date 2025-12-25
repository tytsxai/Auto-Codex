/**
 * Electron 通信用 IPC 通道名称
 * 主进程 <-> 渲染进程 通信
 */

export const IPC_CHANNELS = {
  // 项目操作
  PROJECT_ADD: "project:add",
  PROJECT_REMOVE: "project:remove",
  PROJECT_LIST: "project:list",
  PROJECT_UPDATE_SETTINGS: "project:updateSettings",
  PROJECT_INITIALIZE: "project:initialize",
  PROJECT_UPDATE_AUTOBUILD: "project:updateAutoBuild",
  PROJECT_CHECK_VERSION: "project:checkVersion",

  // 任务操作
  TASK_LIST: "task:list",
  TASK_CREATE: "task:create",
  TASK_DELETE: "task:delete",
  TASK_UPDATE: "task:update",
  TASK_START: "task:start",
  TASK_STOP: "task:stop",
  TASK_REVIEW: "task:review",
  TASK_UPDATE_STATUS: "task:updateStatus",
  TASK_RECOVER_STUCK: "task:recoverStuck",
  TASK_CHECK_RUNNING: "task:checkRunning",

  // 工作区管理（用于人工审核）
  // 按规范架构：每个 spec 都有自己的工作树，位于 .worktrees/{spec-name}/
  TASK_WORKTREE_STATUS: "task:worktreeStatus",
  TASK_WORKTREE_DIFF: "task:worktreeDiff",
  TASK_WORKTREE_MERGE: "task:worktreeMerge",
  TASK_WORKTREE_MERGE_PREVIEW: "task:worktreeMergePreview", // 合并前预览冲突
  TASK_WORKTREE_DISCARD: "task:worktreeDiscard",
  TASK_LIST_WORKTREES: "task:listWorktrees",
  TASK_ARCHIVE: "task:archive",
  TASK_UNARCHIVE: "task:unarchive",

  // 任务事件（主进程 -> 渲染进程）
  TASK_PROGRESS: "task:progress",
  TASK_ERROR: "task:error",
  TASK_LOG: "task:log",
  TASK_STATUS_CHANGE: "task:statusChange",
  TASK_EXECUTION_PROGRESS: "task:executionProgress",

  // 任务阶段日志（持久化、按阶段可折叠）
  TASK_LOGS_GET: "task:logsGet", // 从 spec 目录加载日志
  TASK_LOGS_WATCH: "task:logsWatch", // 开始监听日志变化
  TASK_LOGS_UNWATCH: "task:logsUnwatch", // 停止监听日志变化
  TASK_LOGS_CHANGED: "task:logsChanged", // 事件：日志已变更（主进程 -> 渲染进程）
  TASK_LOGS_STREAM: "task:logsStream", // 事件：流式日志块（主进程 -> 渲染进程）

  // 终端操作
  TERMINAL_CREATE: "terminal:create",
  TERMINAL_DESTROY: "terminal:destroy",
  TERMINAL_INPUT: "terminal:input",
  TERMINAL_RESIZE: "terminal:resize",
  TERMINAL_INVOKE_CODEX: "terminal:invokeCodex",
  TERMINAL_GENERATE_NAME: "terminal:generateName",

  // 终端会话管理
  TERMINAL_GET_SESSIONS: "terminal:getSessions",
  TERMINAL_RESTORE_SESSION: "terminal:restoreSession",
  TERMINAL_CLEAR_SESSIONS: "terminal:clearSessions",
  TERMINAL_RESUME_CODEX: "terminal:resumeCodex",
  TERMINAL_GET_SESSION_DATES: "terminal:getSessionDates",
  TERMINAL_GET_SESSIONS_FOR_DATE: "terminal:getSessionsForDate",
  TERMINAL_RESTORE_FROM_DATE: "terminal:restoreFromDate",

  // 终端事件（主进程 -> 渲染进程）
  TERMINAL_OUTPUT: "terminal:output",
  TERMINAL_EXIT: "terminal:exit",
  TERMINAL_TITLE_CHANGE: "terminal:titleChange",
  TERMINAL_CODEX_SESSION: "terminal:codexSession", // 已捕获 Codex 会话 ID
  TERMINAL_RATE_LIMIT: "terminal:rateLimit", // 检测到 Codex 限流
  TERMINAL_OAUTH_TOKEN: "terminal:oauthToken", // 从 Codex 认证输出捕获 OAuth 令牌

  // Codex 配置管理（多账号支持）
  CODEX_PROFILES_GET: "codex:profilesGet",
  CODEX_PROFILE_SAVE: "codex:profileSave",
  CODEX_PROFILE_DELETE: "codex:profileDelete",
  CODEX_PROFILE_RENAME: "codex:profileRename",
  CODEX_PROFILE_SET_ACTIVE: "codex:profileSetActive",
  CODEX_PROFILE_SWITCH: "codex:profileSwitch",
  CODEX_PROFILE_INITIALIZE: "codex:profileInitialize",
  CODEX_PROFILE_SET_TOKEN: "codex:profileSetToken", // 为配置设置 OAuth 令牌
  CODEX_PROFILE_LOGIN_TERMINAL: "codex:profileLoginTerminal",
  CODEX_PROFILE_AUTO_SWITCH_SETTINGS: "codex:autoSwitchSettings",
  CODEX_PROFILE_UPDATE_AUTO_SWITCH: "codex:updateAutoSwitch",
  CODEX_PROFILE_FETCH_USAGE: "codex:fetchUsage",
  CODEX_PROFILE_GET_BEST_PROFILE: "codex:getBestProfile",

  // SDK/CLI 限流事件（用于非终端 Codex 调用）
  CODEX_SDK_RATE_LIMIT: "codex:sdkRateLimit",
  // 使用不同配置重试被限流的操作
  CODEX_RETRY_WITH_PROFILE: "codex:retryWithProfile",

  // 用量监控（主动切换账号）
  USAGE_UPDATED: "codex:usageUpdated", // 事件：用量数据已更新（主进程 -> 渲染进程）
  USAGE_REQUEST: "codex:usageRequest", // 请求当前用量快照
  PROACTIVE_SWAP_NOTIFICATION: "codex:proactiveSwapNotification", // 事件：发生主动切换

  // 设置
  SETTINGS_GET: "settings:get",
  SETTINGS_SAVE: "settings:save",

  // 对话框
  DIALOG_SELECT_DIRECTORY: "dialog:selectDirectory",
  DIALOG_CREATE_PROJECT_FOLDER: "dialog:createProjectFolder",
  DIALOG_GET_DEFAULT_PROJECT_LOCATION: "dialog:getDefaultProjectLocation",

  // 应用信息
  APP_VERSION: "app:version",
  APP_PROTOCOL_INFO: "app:protocolInfo",

  // Shell 操作
  SHELL_OPEN_EXTERNAL: "shell:openExternal",

  // 路线图操作
  ROADMAP_GET: "roadmap:get",
  ROADMAP_GET_STATUS: "roadmap:getStatus",
  ROADMAP_SAVE: "roadmap:save",
  ROADMAP_GENERATE: "roadmap:generate",
  ROADMAP_GENERATE_WITH_COMPETITOR: "roadmap:generateWithCompetitor",
  ROADMAP_REFRESH: "roadmap:refresh",
  ROADMAP_STOP: "roadmap:stop",
  ROADMAP_UPDATE_FEATURE: "roadmap:updateFeature",
  ROADMAP_CONVERT_TO_SPEC: "roadmap:convertToSpec",

  // 路线图事件（主进程 -> 渲染进程）
  ROADMAP_PROGRESS: "roadmap:progress",
  ROADMAP_COMPLETE: "roadmap:complete",
  ROADMAP_ERROR: "roadmap:error",
  ROADMAP_STOPPED: "roadmap:stopped",

  // 上下文操作
  CONTEXT_GET: "context:get",
  CONTEXT_REFRESH_INDEX: "context:refreshIndex",
  CONTEXT_MEMORY_STATUS: "context:memoryStatus",
  CONTEXT_SEARCH_MEMORIES: "context:searchMemories",
  CONTEXT_GET_MEMORIES: "context:getMemories",

  // 环境配置
  ENV_GET: "env:get",
  ENV_UPDATE: "env:update",
  ENV_CHECK_CODEX_AUTH: "env:checkCodexAuth",
  ENV_INVOKE_CODEX_SETUP: "env:invokeCodexSetup",

  // 创意操作
  IDEATION_GET: "ideation:get",
  IDEATION_GENERATE: "ideation:generate",
  IDEATION_REFRESH: "ideation:refresh",
  IDEATION_STOP: "ideation:stop",
  IDEATION_UPDATE_IDEA: "ideation:updateIdea",
  IDEATION_CONVERT_TO_TASK: "ideation:convertToTask",
  IDEATION_DISMISS: "ideation:dismiss",
  IDEATION_DISMISS_ALL: "ideation:dismissAll",
  IDEATION_ARCHIVE: "ideation:archive",
  IDEATION_DELETE: "ideation:delete",
  IDEATION_DELETE_MULTIPLE: "ideation:deleteMultiple",

  // 创意事件（主进程 -> 渲染进程）
  IDEATION_PROGRESS: "ideation:progress",
  IDEATION_LOG: "ideation:log",
  IDEATION_COMPLETE: "ideation:complete",
  IDEATION_ERROR: "ideation:error",
  IDEATION_STOPPED: "ideation:stopped",
  IDEATION_TYPE_COMPLETE: "ideation:typeComplete",
  IDEATION_TYPE_FAILED: "ideation:typeFailed",

  // Linear 集成
  LINEAR_GET_TEAMS: "linear:getTeams",
  LINEAR_GET_PROJECTS: "linear:getProjects",
  LINEAR_GET_ISSUES: "linear:getIssues",
  LINEAR_IMPORT_ISSUES: "linear:importIssues",
  LINEAR_CHECK_CONNECTION: "linear:checkConnection",

  // GitHub 集成
  GITHUB_GET_REPOSITORIES: "github:getRepositories",
  GITHUB_GET_ISSUES: "github:getIssues",
  GITHUB_GET_ISSUE: "github:getIssue",
  GITHUB_GET_ISSUE_COMMENTS: "github:getIssueComments",
  GITHUB_CHECK_CONNECTION: "github:checkConnection",
  GITHUB_INVESTIGATE_ISSUE: "github:investigateIssue",
  GITHUB_IMPORT_ISSUES: "github:importIssues",
  GITHUB_CREATE_RELEASE: "github:createRelease",

  // GitHub OAuth（gh CLI 认证）
  GITHUB_CHECK_CLI: "github:checkCli",
  GITHUB_CHECK_AUTH: "github:checkAuth",
  GITHUB_START_AUTH: "github:startAuth",
  GITHUB_GET_TOKEN: "github:getToken",
  GITHUB_GET_USER: "github:getUser",
  GITHUB_LIST_USER_REPOS: "github:listUserRepos",
  GITHUB_DETECT_REPO: "github:detectRepo",
  GITHUB_GET_BRANCHES: "github:getBranches",

  // GitHub 事件（主进程 -> 渲染进程）
  GITHUB_INVESTIGATION_PROGRESS: "github:investigationProgress",
  GITHUB_INVESTIGATION_COMPLETE: "github:investigationComplete",
  GITHUB_INVESTIGATION_ERROR: "github:investigationError",

  // Docker 与基础设施状态
  DOCKER_STATUS: "docker:status",
  DOCKER_START_FALKORDB: "docker:startFalkordb",
  DOCKER_STOP_FALKORDB: "docker:stopFalkordb",
  DOCKER_OPEN_DESKTOP: "docker:openDesktop",
  DOCKER_GET_DOWNLOAD_URL: "docker:getDownloadUrl",

  // Graphiti 校验
  GRAPHITI_VALIDATE_FALKORDB: "graphiti:validateFalkordb",
  GRAPHITI_VALIDATE_OPENAI: "graphiti:validateOpenai",
  GRAPHITI_TEST_CONNECTION: "graphiti:testConnection",

  // Auto Codex 源码更新
  AUTOBUILD_SOURCE_CHECK: "autobuild:source:check",
  AUTOBUILD_SOURCE_DOWNLOAD: "autobuild:source:download",
  AUTOBUILD_SOURCE_VERSION: "autobuild:source:version",
  AUTOBUILD_SOURCE_PROGRESS: "autobuild:source:progress",

  // Auto Codex 源码环境配置
  AUTOBUILD_SOURCE_ENV_GET: "autobuild:source:env:get",
  AUTOBUILD_SOURCE_ENV_UPDATE: "autobuild:source:env:update",
  AUTOBUILD_SOURCE_ENV_CHECK_TOKEN: "autobuild:source:env:checkToken",

  // 变更日志操作
  CHANGELOG_GET_DONE_TASKS: "changelog:getDoneTasks",
  CHANGELOG_LOAD_TASK_SPECS: "changelog:loadTaskSpecs",
  CHANGELOG_GENERATE: "changelog:generate",
  CHANGELOG_SAVE: "changelog:save",
  CHANGELOG_READ_EXISTING: "changelog:readExisting",
  CHANGELOG_SUGGEST_VERSION: "changelog:suggestVersion",
  CHANGELOG_SUGGEST_VERSION_FROM_COMMITS: "changelog:suggestVersionFromCommits",

  // 变更日志 Git 操作（用于基于 Git 的变更日志生成）
  CHANGELOG_GET_BRANCHES: "changelog:getBranches",
  CHANGELOG_GET_TAGS: "changelog:getTags",
  CHANGELOG_GET_COMMITS_PREVIEW: "changelog:getCommitsPreview",
  CHANGELOG_SAVE_IMAGE: "changelog:saveImage",

  // 变更日志事件（主进程 -> 渲染进程）
  CHANGELOG_GENERATION_PROGRESS: "changelog:generationProgress",
  CHANGELOG_GENERATION_COMPLETE: "changelog:generationComplete",
  CHANGELOG_GENERATION_ERROR: "changelog:generationError",

  // 洞察操作
  INSIGHTS_GET_SESSION: "insights:getSession",
  INSIGHTS_SEND_MESSAGE: "insights:sendMessage",
  INSIGHTS_CLEAR_SESSION: "insights:clearSession",
  INSIGHTS_CREATE_TASK: "insights:createTask",
  INSIGHTS_LIST_SESSIONS: "insights:listSessions",
  INSIGHTS_NEW_SESSION: "insights:newSession",
  INSIGHTS_SWITCH_SESSION: "insights:switchSession",
  INSIGHTS_DELETE_SESSION: "insights:deleteSession",
  INSIGHTS_RENAME_SESSION: "insights:renameSession",
  INSIGHTS_UPDATE_MODEL_CONFIG: "insights:updateModelConfig",

  // 洞察事件（主进程 -> 渲染进程）
  INSIGHTS_STREAM_CHUNK: "insights:streamChunk",
  INSIGHTS_STATUS: "insights:status",
  INSIGHTS_ERROR: "insights:error",

  // 文件浏览器操作
  FILE_EXPLORER_LIST: "fileExplorer:list",

  // Git 操作
  GIT_GET_BRANCHES: "git:getBranches",
  GIT_GET_CURRENT_BRANCH: "git:getCurrentBranch",
  GIT_DETECT_MAIN_BRANCH: "git:detectMainBranch",
  GIT_CHECK_STATUS: "git:checkStatus",
  GIT_INITIALIZE: "git:initialize",

  // 应用自动更新操作
  APP_UPDATE_CHECK: "app-update:check",
  APP_UPDATE_DOWNLOAD: "app-update:download",
  APP_UPDATE_INSTALL: "app-update:install",
  APP_UPDATE_GET_VERSION: "app-update:get-version",

  // 应用自动更新事件（主进程 -> 渲染进程）
  APP_UPDATE_AVAILABLE: "app-update:available",
  APP_UPDATE_DOWNLOADED: "app-update:downloaded",
  APP_UPDATE_PROGRESS: "app-update:progress",
  APP_UPDATE_ERROR: "app-update:error",

  // 发布操作
  RELEASE_SUGGEST_VERSION: "release:suggestVersion",
  RELEASE_CREATE: "release:create",
  RELEASE_PREFLIGHT: "release:preflight",
  RELEASE_GET_VERSIONS: "release:getVersions",

  // 发布事件（主进程 -> 渲染进程）
  RELEASE_PROGRESS: "release:progress",

  // 工作流操作（智能工作树管理）
  WORKFLOW_STAGE_WORKTREE: "workflow:stageWorktree",
  WORKFLOW_GET_STAGED_CHANGES: "workflow:getStagedChanges",
  WORKFLOW_COMMIT_CHANGES: "workflow:commitChanges",
  WORKFLOW_DISCARD_CHANGES: "workflow:discardChanges",
  WORKFLOW_GET_HEALTH_STATUS: "workflow:getHealthStatus",
  WORKFLOW_GET_CONFLICT_RISKS: "workflow:getConflictRisks",
  WORKFLOW_GET_MERGE_ORDER: "workflow:getMergeOrder",
  WORKFLOW_AI_REVIEW: "workflow:aiReview",
  WORKFLOW_CLEANUP_STALE: "workflow:cleanupStale",
  WORKFLOW_GENERATE_COMMIT_MESSAGE: "workflow:generateCommitMessage",
  WORKFLOW_GET_WORKTREE_CHANGES: "workflow:getWorktreeChanges",
} as const;
