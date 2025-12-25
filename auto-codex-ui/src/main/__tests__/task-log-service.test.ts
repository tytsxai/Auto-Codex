/**
 * Unit tests for TaskLogService
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { TaskLogService } from '../task-log-service';
import type { TaskLogs } from '../../shared/types';

function createLogs(overrides: Partial<TaskLogs> = {}): TaskLogs {
  return {
    spec_id: '001-test',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    phases: {
      planning: {
        phase: 'planning',
        status: 'pending',
        started_at: null,
        completed_at: null,
        entries: []
      },
      coding: {
        phase: 'coding',
        status: 'pending',
        started_at: null,
        completed_at: null,
        entries: []
      },
      validation: {
        phase: 'validation',
        status: 'pending',
        started_at: null,
        completed_at: null,
        entries: []
      }
    },
    ...overrides
  } as TaskLogs;
}

describe('TaskLogService', () => {
  let tempDir: string;
  let service: TaskLogService;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'task-log-service-'));
    service = new TaskLogService();
  });

  afterEach(() => {
    service.stopAllWatching();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads logs from path and redacts secrets', () => {
    const specDir = path.join(tempDir, 'spec-1');
    mkdirSync(specDir, { recursive: true });

    const logs = createLogs({
      phases: {
        ...createLogs().phases,
        planning: {
          phase: 'planning',
          status: 'active',
          started_at: new Date().toISOString(),
          completed_at: null,
          entries: [
            {
              timestamp: new Date().toISOString(),
              type: 'text',
              content: 'sk-1234567890secret',
              phase: 'planning',
              tool_input: 'Bearer supertoken',
              detail: 'token=leak'
            }
          ]
        }
      }
    });

    writeFileSync(path.join(specDir, 'task_logs.json'), JSON.stringify(logs, null, 2));

    const loaded = service.loadLogsFromPath(specDir);
    expect(loaded).not.toBeNull();
    const entry = loaded?.phases.planning.entries[0];

    expect(entry?.content).toContain('[REDACTED]');
    expect(entry?.tool_input).toContain('[REDACTED]');
    expect(entry?.detail).toContain('[REDACTED]');
  });

  it('returns cached logs when JSON is corrupted', () => {
    const specDir = path.join(tempDir, 'spec-2');
    mkdirSync(specDir, { recursive: true });

    const logs = createLogs();
    writeFileSync(path.join(specDir, 'task_logs.json'), JSON.stringify(logs, null, 2));

    const first = service.loadLogsFromPath(specDir);
    expect(first).not.toBeNull();

    // Corrupt the file
    writeFileSync(path.join(specDir, 'task_logs.json'), '{bad json');

    const second = service.loadLogsFromPath(specDir);
    expect(second).toEqual(first);
  });

  it('merges main and worktree logs', () => {
    const specId = '001-merge-test';
    const projectPath = tempDir;
    const specsRelPath = '.auto-codex/specs';
    const mainSpecDir = path.join(tempDir, specsRelPath, specId);
    const worktreeSpecDir = path.join(tempDir, '.worktrees', specId, specsRelPath, specId);

    mkdirSync(mainSpecDir, { recursive: true });
    mkdirSync(worktreeSpecDir, { recursive: true });

    const mainLogs = createLogs({
      spec_id: specId,
      updated_at: '2024-01-01T00:00:00.000Z',
      phases: {
        ...createLogs().phases,
        planning: {
          phase: 'planning',
          status: 'active',
          started_at: '2024-01-01T00:00:00.000Z',
          completed_at: null,
          entries: [
            {
              timestamp: '2024-01-01T00:00:00.000Z',
              type: 'text',
              content: 'planning log',
              phase: 'planning'
            }
          ]
        }
      }
    });

    const worktreeLogs = createLogs({
      spec_id: specId,
      updated_at: '2024-02-01T00:00:00.000Z',
      phases: {
        ...createLogs().phases,
        coding: {
          phase: 'coding',
          status: 'active',
          started_at: '2024-02-01T00:00:00.000Z',
          completed_at: null,
          entries: [
            {
              timestamp: '2024-02-01T00:00:00.000Z',
              type: 'text',
              content: 'coding log',
              phase: 'coding'
            }
          ]
        },
        validation: {
          phase: 'validation',
          status: 'active',
          started_at: '2024-02-01T00:00:00.000Z',
          completed_at: null,
          entries: [
            {
              timestamp: '2024-02-01T00:00:00.000Z',
              type: 'text',
              content: 'validation log',
              phase: 'validation'
            }
          ]
        }
      }
    });

    writeFileSync(path.join(mainSpecDir, 'task_logs.json'), JSON.stringify(mainLogs, null, 2));
    writeFileSync(path.join(worktreeSpecDir, 'task_logs.json'), JSON.stringify(worktreeLogs, null, 2));

    const merged = service.loadLogs(mainSpecDir, projectPath, specsRelPath, specId);

    expect(merged?.phases.planning.entries[0].content).toBe('planning log');
    expect(merged?.phases.coding.entries[0].content).toBe('coding log');
    expect(merged?.phases.validation.entries[0].content).toBe('validation log');
    expect(merged?.updated_at).toBe('2024-02-01T00:00:00.000Z');
  });

  it('detects active phase', () => {
    const specDir = path.join(tempDir, 'spec-3');
    mkdirSync(specDir, { recursive: true });

    const logs = createLogs({
      phases: {
        ...createLogs().phases,
        planning: {
          phase: 'planning',
          status: 'active',
          started_at: new Date().toISOString(),
          completed_at: null,
          entries: []
        }
      }
    });

    writeFileSync(path.join(specDir, 'task_logs.json'), JSON.stringify(logs, null, 2));

    expect(service.getActivePhase(specDir)).toBe('planning');
  });
});
