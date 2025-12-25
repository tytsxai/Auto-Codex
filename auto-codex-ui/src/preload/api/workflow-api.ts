/**
 * Workflow API
 * ============
 *
 * Preload API for smart worktree workflow operations.
 */

import { IPC_CHANNELS } from "../../shared/constants";
import type {
  IPCResult,
  StageWorktreeRequest,
  CommitChangesRequest,
  DiscardChangesRequest,
  StagedChange,
  StageResult,
  WorktreeHealthStatus,
  ConflictRisk,
  ReviewReport,
  CommitResult,
  MergeOrderSuggestion,
} from "../../shared/types";
import { invokeIpcResult } from "./modules/ipc-utils";

export interface WorkflowAPI {
  // Staging operations
  stageWorktree: (
    request: StageWorktreeRequest,
  ) => Promise<IPCResult<StageResult>>;
  getStagedChanges: () => Promise<IPCResult<StagedChange[]>>;

  // Commit operations
  commitChanges: (
    request: CommitChangesRequest,
  ) => Promise<IPCResult<CommitResult | CommitResult[]>>;
  discardChanges: (
    request: DiscardChangesRequest,
  ) => Promise<IPCResult<{ success: boolean }>>;

  // Health and analysis
  getHealthStatus: () => Promise<IPCResult<WorktreeHealthStatus>>;
  getConflictRisks: () => Promise<IPCResult<ConflictRisk[]>>;
  getMergeOrder: () => Promise<IPCResult<MergeOrderSuggestion>>;

  // AI review
  aiReview: () => Promise<IPCResult<ReviewReport>>;

  // Maintenance
  cleanupStale: (days?: number) => Promise<IPCResult<{ cleaned: string[] }>>;

  // Helpers
  generateCommitMessage: (
    mode: string,
  ) => Promise<IPCResult<{ message: string }>>;
}

export const createWorkflowAPI = (): WorkflowAPI => ({
  stageWorktree: (request: StageWorktreeRequest) =>
    invokeIpcResult(IPC_CHANNELS.WORKFLOW_STAGE_WORKTREE, request),

  getStagedChanges: () =>
    invokeIpcResult(IPC_CHANNELS.WORKFLOW_GET_STAGED_CHANGES),

  commitChanges: (request: CommitChangesRequest) =>
    invokeIpcResult(IPC_CHANNELS.WORKFLOW_COMMIT_CHANGES, request),

  discardChanges: (request: DiscardChangesRequest) =>
    invokeIpcResult(IPC_CHANNELS.WORKFLOW_DISCARD_CHANGES, request),

  getHealthStatus: () =>
    invokeIpcResult(IPC_CHANNELS.WORKFLOW_GET_HEALTH_STATUS),

  getConflictRisks: () =>
    invokeIpcResult(IPC_CHANNELS.WORKFLOW_GET_CONFLICT_RISKS),

  getMergeOrder: () => invokeIpcResult(IPC_CHANNELS.WORKFLOW_GET_MERGE_ORDER),

  aiReview: () => invokeIpcResult(IPC_CHANNELS.WORKFLOW_AI_REVIEW),

  cleanupStale: (days?: number) =>
    invokeIpcResult(IPC_CHANNELS.WORKFLOW_CLEANUP_STALE, days),

  generateCommitMessage: (mode: string) =>
    invokeIpcResult(IPC_CHANNELS.WORKFLOW_GENERATE_COMMIT_MESSAGE, mode),
});
