/**
 * Workflow Mock
 * Mock implementations for workflow operations (smart worktree management)
 */

import type { WorkflowAPI } from '../../../preload/api/workflow-api';

export const workflowMock: WorkflowAPI = {
  stageWorktree: async () => ({
    success: true,
    data: {
      success: true,
      filesStaged: [],
      worktreeCleaned: false
    }
  }),

  getStagedChanges: async () => ({
    success: true,
    data: []
  }),

  commitChanges: async () => ({
    success: true,
    data: {
      success: true,
      message: 'Mock commit',
      filesCommitted: [],
      commitHash: 'abc123'
    }
  }),

  discardChanges: async () => ({
    success: true,
    data: { success: true }
  }),

  getHealthStatus: async () => ({
    success: true,
    data: {
      totalCount: 0,
      staleCount: 0,
      totalDiskUsageMb: 0,
      worktrees: []
    }
  }),

  getConflictRisks: async () => ({
    success: true,
    data: []
  }),

  getMergeOrder: async () => ({
    success: true,
    data: {
      order: [],
      reason: 'No worktrees',
      conflictGroups: []
    }
  }),

  aiReview: async () => ({
    success: true,
    data: {
      success: true,
      issues: [],
      suggestions: [],
      summary: 'No issues found'
    }
  }),

  cleanupStale: async () => ({
    success: true,
    data: { cleaned: [] }
  }),

  generateCommitMessage: async () => ({
    success: true,
    data: { message: 'chore: update' }
  })
};
