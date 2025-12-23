/**
 * Workflow Types
 * ==============
 *
 * TypeScript types for the smart worktree workflow system.
 */

export type RiskLevel = 'low' | 'medium' | 'high';

export type IssueType = 'conflict' | 'import_error' | 'type_mismatch' | 'test_failure' | 'syntax_error';

export type CommitMode = 'all' | 'by_task' | 'partial';

export interface WorkflowSettings {
  autoCleanupAfterMerge: boolean;
  staleWorktreeDays: number;
  maxWorktreesWarning: number;
  showConflictRisks: boolean;
}

export interface StagedChange {
  taskId: string;
  specName: string;
  files: string[];
  stagedAt: string; // ISO date string
  mergeSource: string; // worktree path
}

export interface StagedChangesStore {
  version: number;
  changes: StagedChange[];
}

export interface StageResult {
  success: boolean;
  filesStaged: string[];
  worktreeCleaned: boolean;
  error?: string;
}

export interface WorktreeInfo {
  specName: string;
  path: string;
  branch: string;
  daysSinceActivity: number;
  diskUsageMb: number;
  hasConflicts: boolean;
  conflictFiles: string[];
}

export interface WorktreeHealthStatus {
  totalCount: number;
  staleCount: number;
  totalDiskUsageMb: number;
  worktrees: WorktreeInfo[];
  warningMessage?: string;
}

export interface ConflictRisk {
  worktreeA: string;
  worktreeB: string;
  conflictingFiles: string[];
  riskLevel: RiskLevel;
}

export interface ReviewIssue {
  file: string;
  line?: number;
  type: IssueType;
  message: string;
  suggestion?: string;
}

export interface TestResults {
  passed: number;
  failed: number;
  skipped: number;
  errors: string[];
  durationSeconds: number;
  success: boolean;
}

export interface ReviewReport {
  success: boolean;
  issues: ReviewIssue[];
  testResults?: TestResults;
  suggestions: string[];
  summary: string;
}

export interface CommitResult {
  success: boolean;
  commitHash?: string;
  message: string;
  filesCommitted: string[];
  error?: string;
}

export interface MergeOrderSuggestion {
  order: string[]; // spec names in suggested order
  reason: string;
  conflictGroups: ConflictRisk[];
}

// IPC request/response types
export interface StageWorktreeRequest {
  specName: string;
  taskId: string;
  autoCleanup?: boolean;
}

export interface CommitChangesRequest {
  mode: CommitMode;
  message?: string;
  taskMessages?: Record<string, string>; // for by_task mode
  selectedFiles?: string[]; // for partial mode
}

export interface DiscardChangesRequest {
  restoreWorktrees?: boolean;
}
