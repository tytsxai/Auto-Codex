import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import path from 'path';

const TEST_DIR = '/tmp/task-run-state-test';
const USER_DATA_DIR = `/tmp/test-app-data-${
  process.env.VITEST_WORKER_ID ?? process.env.VITEST_POOL_ID ?? process.pid
}`;
const PROJECT_PATH = path.join(TEST_DIR, 'project');
const SPEC_ID = '001-test-task';

vi.mock('../project-initializer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../project-initializer')>();
  return {
    ...actual,
    checkGitStatus: vi.fn(() => ({
      isGitRepo: true,
      hasCommits: true,
      currentBranch: 'main'
    }))
  };
});

vi.mock('../codex-profile-manager', () => ({
  getCodexProfileManager: vi.fn(() => ({
    hasValidAuth: vi.fn(() => true)
  }))
}));

vi.mock('../file-watcher', () => ({
  fileWatcher: {
    watch: vi.fn(),
    unwatch: vi.fn()
  }
}));

describe('task run_state writing', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    if (existsSync(USER_DATA_DIR)) {
      rmSync(USER_DATA_DIR, { recursive: true, force: true });
    }
    mkdirSync(path.join(PROJECT_PATH, '.auto-codex', 'specs', SPEC_ID), { recursive: true });
    vi.resetModules();
  });

  afterEach(async () => {
    const { ipcMain } = await import('electron');
    ipcMain.removeAllListeners();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    if (existsSync(USER_DATA_DIR)) {
      rmSync(USER_DATA_DIR, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  it('writes run_state.json and updates implementation_plan.json on task start', async () => {
    const specDir = path.join(PROJECT_PATH, '.auto-codex', 'specs', SPEC_ID);
    const planPath = path.join(specDir, 'implementation_plan.json');
    const specPath = path.join(specDir, 'spec.md');

    writeFileSync(specPath, '# Spec\n\n## Overview\nTest task overview\n');
    writeFileSync(planPath, JSON.stringify({
      workflow_type: 'test',
      phases: [],
      final_acceptance: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      spec_file: 'spec.md'
    }, null, 2));

    const { projectStore } = await import('../project-store');
    const { registerTaskExecutionHandlers } = await import('../ipc-handlers/task/execution-handlers');
    const { IPC_CHANNELS } = await import('../../shared/constants');
    const { ipcMain, BrowserWindow } = await import('electron');

    const project = projectStore.addProject(PROJECT_PATH);
    const mockAgentManager = {
      startSpecCreation: vi.fn(),
      startTaskExecution: vi.fn(),
      killTask: vi.fn()
    };

    registerTaskExecutionHandlers(
      mockAgentManager as never,
      () => new BrowserWindow()
    );

    ipcMain.emit(IPC_CHANNELS.TASK_START, {}, SPEC_ID);

    const runStatePath = path.join(specDir, 'run_state.json');
    expect(existsSync(runStatePath)).toBe(true);
    const runState = JSON.parse(readFileSync(runStatePath, 'utf-8'));
    const plan = JSON.parse(readFileSync(planPath, 'utf-8'));

    expect(runState.task_id).toBe(SPEC_ID);
    expect(runState.project_id).toBe(project.id);
    expect(typeof runState.run_id).toBe('string');
    expect(runState.run_id.length).toBeGreaterThan(0);
    expect(runState.run_id).toBe(plan.run_id);
    expect(typeof plan.run_started_at).toBe('string');
    expect(typeof plan.updated_at).toBe('string');
  });
});
