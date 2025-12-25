import { IPC_CHANNELS } from "../../shared/constants";
import type {
  Project,
  ProjectSettings,
  IPCResult,
  InitializationResult,
  AutoBuildVersionInfo,
  ProjectEnvConfig,
  CodexAuthResult,
  InfrastructureStatus,
  GraphitiValidationResult,
  GraphitiConnectionTestResult,
  GitStatus,
} from "../../shared/types";
import { invokeIpc, invokeIpcResult } from "./modules/ipc-utils";

export interface ProjectAPI {
  // Project Management
  addProject: (projectPath: string) => Promise<IPCResult<Project>>;
  removeProject: (projectId: string) => Promise<IPCResult>;
  getProjects: () => Promise<IPCResult<Project[]>>;
  updateProjectSettings: (
    projectId: string,
    settings: Partial<ProjectSettings>,
  ) => Promise<IPCResult>;
  initializeProject: (
    projectId: string,
  ) => Promise<IPCResult<InitializationResult>>;
  updateProjectAutoBuild: (
    projectId: string,
  ) => Promise<IPCResult<InitializationResult>>;
  checkProjectVersion: (
    projectId: string,
  ) => Promise<IPCResult<AutoBuildVersionInfo>>;

  // Context Operations
  getProjectContext: (projectId: string) => Promise<IPCResult<unknown>>;
  refreshProjectIndex: (projectId: string) => Promise<IPCResult<unknown>>;
  getMemoryStatus: (projectId: string) => Promise<IPCResult<unknown>>;
  searchMemories: (
    projectId: string,
    query: string,
  ) => Promise<IPCResult<unknown>>;
  getRecentMemories: (
    projectId: string,
    limit?: number,
  ) => Promise<IPCResult<unknown>>;

  // Environment Configuration
  getProjectEnv: (projectId: string) => Promise<IPCResult<ProjectEnvConfig>>;
  updateProjectEnv: (
    projectId: string,
    config: Partial<ProjectEnvConfig>,
  ) => Promise<IPCResult>;
  checkCodexAuth: (projectId: string) => Promise<IPCResult<CodexAuthResult>>;
  invokeCodexSetup: (projectId: string) => Promise<IPCResult<CodexAuthResult>>;

  // Dialog Operations
  selectDirectory: () => Promise<string | null>;
  createProjectFolder: (
    location: string,
    name: string,
    initGit: boolean,
  ) => Promise<
    IPCResult<import("../../shared/types").CreateProjectFolderResult>
  >;
  getDefaultProjectLocation: () => Promise<string | null>;

  // Docker & Infrastructure Operations (for Graphiti/FalkorDB)
  getInfrastructureStatus: (
    port?: number,
  ) => Promise<IPCResult<InfrastructureStatus>>;
  startFalkorDB: (
    port?: number,
  ) => Promise<IPCResult<{ success: boolean; error?: string }>>;
  stopFalkorDB: () => Promise<IPCResult<{ success: boolean; error?: string }>>;
  openDockerDesktop: () => Promise<
    IPCResult<{ success: boolean; error?: string }>
  >;
  getDockerDownloadUrl: () => Promise<string>;

  // Graphiti Validation Operations
  validateFalkorDBConnection: (
    uri: string,
  ) => Promise<IPCResult<GraphitiValidationResult>>;
  validateOpenAIApiKey: (
    apiKey: string,
  ) => Promise<IPCResult<GraphitiValidationResult>>;
  testGraphitiConnection: (
    falkorDbUri: string,
    openAiApiKey: string,
  ) => Promise<IPCResult<GraphitiConnectionTestResult>>;

  // Git Operations
  getGitBranches: (projectPath: string) => Promise<IPCResult<string[]>>;
  getCurrentGitBranch: (
    projectPath: string,
  ) => Promise<IPCResult<string | null>>;
  detectMainBranch: (projectPath: string) => Promise<IPCResult<string | null>>;
  checkGitStatus: (projectPath: string) => Promise<IPCResult<GitStatus>>;
  initializeGit: (
    projectPath: string,
  ) => Promise<IPCResult<InitializationResult>>;
}

export const createProjectAPI = (): ProjectAPI => ({
  // Project Management
  addProject: (projectPath: string): Promise<IPCResult<Project>> =>
    invokeIpcResult(IPC_CHANNELS.PROJECT_ADD, projectPath),

  removeProject: (projectId: string): Promise<IPCResult> =>
    invokeIpcResult(IPC_CHANNELS.PROJECT_REMOVE, projectId),

  getProjects: (): Promise<IPCResult<Project[]>> =>
    invokeIpcResult(IPC_CHANNELS.PROJECT_LIST),

  updateProjectSettings: (
    projectId: string,
    settings: Partial<ProjectSettings>,
  ): Promise<IPCResult> =>
    invokeIpcResult(IPC_CHANNELS.PROJECT_UPDATE_SETTINGS, projectId, settings),

  initializeProject: (
    projectId: string,
  ): Promise<IPCResult<InitializationResult>> =>
    invokeIpcResult(IPC_CHANNELS.PROJECT_INITIALIZE, projectId),

  updateProjectAutoBuild: (
    projectId: string,
  ): Promise<IPCResult<InitializationResult>> =>
    invokeIpcResult(IPC_CHANNELS.PROJECT_UPDATE_AUTOBUILD, projectId),

  checkProjectVersion: (
    projectId: string,
  ): Promise<IPCResult<AutoBuildVersionInfo>> =>
    invokeIpcResult(IPC_CHANNELS.PROJECT_CHECK_VERSION, projectId),

  // Context Operations
  getProjectContext: (projectId: string) =>
    invokeIpcResult(IPC_CHANNELS.CONTEXT_GET, projectId),

  refreshProjectIndex: (projectId: string) =>
    invokeIpcResult(IPC_CHANNELS.CONTEXT_REFRESH_INDEX, projectId),

  getMemoryStatus: (projectId: string) =>
    invokeIpcResult(IPC_CHANNELS.CONTEXT_MEMORY_STATUS, projectId),

  searchMemories: (projectId: string, query: string) =>
    invokeIpcResult(IPC_CHANNELS.CONTEXT_SEARCH_MEMORIES, projectId, query),

  getRecentMemories: (projectId: string, limit?: number) =>
    invokeIpcResult(IPC_CHANNELS.CONTEXT_GET_MEMORIES, projectId, limit),

  // Environment Configuration
  getProjectEnv: (projectId: string): Promise<IPCResult<ProjectEnvConfig>> =>
    invokeIpcResult(IPC_CHANNELS.ENV_GET, projectId),

  updateProjectEnv: (
    projectId: string,
    config: Partial<ProjectEnvConfig>,
  ): Promise<IPCResult> =>
    invokeIpcResult(IPC_CHANNELS.ENV_UPDATE, projectId, config),

  checkCodexAuth: (projectId: string): Promise<IPCResult<CodexAuthResult>> =>
    invokeIpcResult(IPC_CHANNELS.ENV_CHECK_CODEX_AUTH, projectId),

  invokeCodexSetup: (projectId: string): Promise<IPCResult<CodexAuthResult>> =>
    invokeIpcResult(IPC_CHANNELS.ENV_INVOKE_CODEX_SETUP, projectId),

  // Dialog Operations
  selectDirectory: (): Promise<string | null> =>
    invokeIpc(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY),

  createProjectFolder: (
    location: string,
    name: string,
    initGit: boolean,
  ): Promise<
    IPCResult<import("../../shared/types").CreateProjectFolderResult>
  > =>
    invokeIpcResult(
      IPC_CHANNELS.DIALOG_CREATE_PROJECT_FOLDER,
      location,
      name,
      initGit,
    ),

  getDefaultProjectLocation: (): Promise<string | null> =>
    invokeIpc(IPC_CHANNELS.DIALOG_GET_DEFAULT_PROJECT_LOCATION),

  // Docker & Infrastructure Operations
  getInfrastructureStatus: (
    port?: number,
  ): Promise<IPCResult<InfrastructureStatus>> =>
    invokeIpcResult(IPC_CHANNELS.DOCKER_STATUS, port),

  startFalkorDB: (
    port?: number,
  ): Promise<IPCResult<{ success: boolean; error?: string }>> =>
    invokeIpcResult(IPC_CHANNELS.DOCKER_START_FALKORDB, port),

  stopFalkorDB: (): Promise<IPCResult<{ success: boolean; error?: string }>> =>
    invokeIpcResult(IPC_CHANNELS.DOCKER_STOP_FALKORDB),

  openDockerDesktop: (): Promise<
    IPCResult<{ success: boolean; error?: string }>
  > => invokeIpcResult(IPC_CHANNELS.DOCKER_OPEN_DESKTOP),

  getDockerDownloadUrl: (): Promise<string> =>
    invokeIpc(IPC_CHANNELS.DOCKER_GET_DOWNLOAD_URL),

  // Graphiti Validation Operations
  validateFalkorDBConnection: (
    uri: string,
  ): Promise<IPCResult<GraphitiValidationResult>> =>
    invokeIpcResult(IPC_CHANNELS.GRAPHITI_VALIDATE_FALKORDB, uri),

  validateOpenAIApiKey: (
    apiKey: string,
  ): Promise<IPCResult<GraphitiValidationResult>> =>
    invokeIpcResult(IPC_CHANNELS.GRAPHITI_VALIDATE_OPENAI, apiKey),

  testGraphitiConnection: (
    falkorDbUri: string,
    openAiApiKey: string,
  ): Promise<IPCResult<GraphitiConnectionTestResult>> =>
    invokeIpcResult(
      IPC_CHANNELS.GRAPHITI_TEST_CONNECTION,
      falkorDbUri,
      openAiApiKey,
    ),

  // Git Operations
  getGitBranches: (projectPath: string): Promise<IPCResult<string[]>> =>
    invokeIpcResult(IPC_CHANNELS.GIT_GET_BRANCHES, projectPath),

  getCurrentGitBranch: (
    projectPath: string,
  ): Promise<IPCResult<string | null>> =>
    invokeIpcResult(IPC_CHANNELS.GIT_GET_CURRENT_BRANCH, projectPath),

  detectMainBranch: (projectPath: string): Promise<IPCResult<string | null>> =>
    invokeIpcResult(IPC_CHANNELS.GIT_DETECT_MAIN_BRANCH, projectPath),

  checkGitStatus: (projectPath: string): Promise<IPCResult<GitStatus>> =>
    invokeIpcResult(IPC_CHANNELS.GIT_CHECK_STATUS, projectPath),

  initializeGit: (
    projectPath: string,
  ): Promise<IPCResult<InitializationResult>> =>
    invokeIpcResult(IPC_CHANNELS.GIT_INITIALIZE, projectPath),
});
