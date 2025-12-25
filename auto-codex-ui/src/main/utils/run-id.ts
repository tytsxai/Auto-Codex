import { randomUUID } from 'crypto';

/**
 * Generate a run ID for tracing executions across processes.
 */
export function createRunId(): string {
  try {
    return randomUUID();
  } catch {
    return `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
