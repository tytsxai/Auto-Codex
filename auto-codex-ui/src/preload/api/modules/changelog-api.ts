import { IPC_CHANNELS } from "../../../shared/constants";
import type {
  ChangelogTask,
  TaskSpecContent,
  ChangelogGenerationRequest,
  ChangelogGenerationResult,
  ChangelogSaveRequest,
  ChangelogSaveResult,
  ChangelogGenerationProgress,
  ExistingChangelog,
  GitBranchInfo,
  GitTagInfo,
  GitCommit,
  GitHistoryOptions,
  BranchDiffOptions,
  Task,
  IPCResult,
} from "../../../shared/types";
import {
  createIpcListener,
  invokeIpcResult,
  sendIpc,
  IpcListenerCleanup,
} from "./ipc-utils";

/**
 * Changelog API operations
 */
export interface ChangelogAPI {
  // Operations
  getChangelogDoneTasks: (
    projectId: string,
    tasks?: Task[],
  ) => Promise<IPCResult<ChangelogTask[]>>;
  loadTaskSpecs: (
    projectId: string,
    taskIds: string[],
  ) => Promise<IPCResult<TaskSpecContent[]>>;
  generateChangelog: (request: ChangelogGenerationRequest) => void;
  saveChangelog: (
    request: ChangelogSaveRequest,
  ) => Promise<IPCResult<ChangelogSaveResult>>;
  readExistingChangelog: (
    projectId: string,
  ) => Promise<IPCResult<ExistingChangelog>>;
  suggestChangelogVersion: (
    projectId: string,
    taskIds: string[],
  ) => Promise<IPCResult<{ version: string; reason: string }>>;
  suggestChangelogVersionFromCommits: (
    projectId: string,
    commits: GitCommit[],
  ) => Promise<IPCResult<{ version: string; reason: string }>>;
  getChangelogBranches: (
    projectId: string,
  ) => Promise<IPCResult<GitBranchInfo[]>>;
  getChangelogTags: (projectId: string) => Promise<IPCResult<GitTagInfo[]>>;
  getChangelogCommitsPreview: (
    projectId: string,
    options: GitHistoryOptions | BranchDiffOptions,
    mode: "git-history" | "branch-diff",
  ) => Promise<IPCResult<GitCommit[]>>;
  saveChangelogImage: (
    projectId: string,
    imageData: string,
    filename: string,
  ) => Promise<IPCResult<{ relativePath: string; url: string }>>;

  // Event Listeners
  onChangelogGenerationProgress: (
    callback: (
      projectId: string,
      progress: ChangelogGenerationProgress,
    ) => void,
  ) => IpcListenerCleanup;
  onChangelogGenerationComplete: (
    callback: (projectId: string, result: ChangelogGenerationResult) => void,
  ) => IpcListenerCleanup;
  onChangelogGenerationError: (
    callback: (projectId: string, error: string) => void,
  ) => IpcListenerCleanup;
}

/**
 * Creates the Changelog API implementation
 */
export const createChangelogAPI = (): ChangelogAPI => ({
  // Operations
  getChangelogDoneTasks: (
    projectId: string,
    tasks?: Task[],
  ): Promise<IPCResult<ChangelogTask[]>> =>
    invokeIpcResult(IPC_CHANNELS.CHANGELOG_GET_DONE_TASKS, projectId, tasks),

  loadTaskSpecs: (
    projectId: string,
    taskIds: string[],
  ): Promise<IPCResult<TaskSpecContent[]>> =>
    invokeIpcResult(IPC_CHANNELS.CHANGELOG_LOAD_TASK_SPECS, projectId, taskIds),

  generateChangelog: (request: ChangelogGenerationRequest): void =>
    sendIpc(IPC_CHANNELS.CHANGELOG_GENERATE, request),

  saveChangelog: (
    request: ChangelogSaveRequest,
  ): Promise<IPCResult<ChangelogSaveResult>> =>
    invokeIpcResult(IPC_CHANNELS.CHANGELOG_SAVE, request),

  readExistingChangelog: (
    projectId: string,
  ): Promise<IPCResult<ExistingChangelog>> =>
    invokeIpcResult(IPC_CHANNELS.CHANGELOG_READ_EXISTING, projectId),

  suggestChangelogVersion: (
    projectId: string,
    taskIds: string[],
  ): Promise<IPCResult<{ version: string; reason: string }>> =>
    invokeIpcResult(IPC_CHANNELS.CHANGELOG_SUGGEST_VERSION, projectId, taskIds),

  suggestChangelogVersionFromCommits: (
    projectId: string,
    commits: GitCommit[],
  ): Promise<IPCResult<{ version: string; reason: string }>> =>
    invokeIpcResult(
      IPC_CHANNELS.CHANGELOG_SUGGEST_VERSION_FROM_COMMITS,
      projectId,
      commits,
    ),

  getChangelogBranches: (
    projectId: string,
  ): Promise<IPCResult<GitBranchInfo[]>> =>
    invokeIpcResult(IPC_CHANNELS.CHANGELOG_GET_BRANCHES, projectId),

  getChangelogTags: (projectId: string): Promise<IPCResult<GitTagInfo[]>> =>
    invokeIpcResult(IPC_CHANNELS.CHANGELOG_GET_TAGS, projectId),

  getChangelogCommitsPreview: (
    projectId: string,
    options: GitHistoryOptions | BranchDiffOptions,
    mode: "git-history" | "branch-diff",
  ): Promise<IPCResult<GitCommit[]>> =>
    invokeIpcResult(
      IPC_CHANNELS.CHANGELOG_GET_COMMITS_PREVIEW,
      projectId,
      options,
      mode,
    ),

  saveChangelogImage: (
    projectId: string,
    imageData: string,
    filename: string,
  ): Promise<IPCResult<{ relativePath: string; url: string }>> =>
    invokeIpcResult(
      IPC_CHANNELS.CHANGELOG_SAVE_IMAGE,
      projectId,
      imageData,
      filename,
    ),

  // Event Listeners
  onChangelogGenerationProgress: (
    callback: (
      projectId: string,
      progress: ChangelogGenerationProgress,
    ) => void,
  ): IpcListenerCleanup =>
    createIpcListener(IPC_CHANNELS.CHANGELOG_GENERATION_PROGRESS, callback),

  onChangelogGenerationComplete: (
    callback: (projectId: string, result: ChangelogGenerationResult) => void,
  ): IpcListenerCleanup =>
    createIpcListener(IPC_CHANNELS.CHANGELOG_GENERATION_COMPLETE, callback),

  onChangelogGenerationError: (
    callback: (projectId: string, error: string) => void,
  ): IpcListenerCleanup =>
    createIpcListener(IPC_CHANNELS.CHANGELOG_GENERATION_ERROR, callback),
});
