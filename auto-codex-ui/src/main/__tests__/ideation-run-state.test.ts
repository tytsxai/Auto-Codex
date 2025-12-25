import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, readFileSync, existsSync } from 'fs';
import path from 'path';

const TEST_DIR = '/tmp/ideation-run-state-test';
const USER_DATA_DIR = '/tmp/test-app-data';
const PROJECT_PATH = path.join(TEST_DIR, 'project');

describe('ideation run_state writing', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    if (existsSync(USER_DATA_DIR)) {
      rmSync(USER_DATA_DIR, { recursive: true, force: true });
    }
    mkdirSync(path.join(PROJECT_PATH, '.auto-codex'), { recursive: true });
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

  it('writes run_state.json when ideation starts', async () => {
    const { BrowserWindow } = await import('electron');
    const { AUTO_BUILD_PATHS } = await import('../../shared/constants');
    const { projectStore } = await import('../project-store');
    const { startIdeationGeneration } = await import('../ipc-handlers/ideation/generation-handlers');

    const project = projectStore.addProject(PROJECT_PATH);

    const mockAgentManager = {
      startIdeationGeneration: vi.fn()
    };
    const mainWindow = new BrowserWindow();

    startIdeationGeneration(
      {} as never,
      project.id,
      {
        enabledTypes: ['code_improvements'],
        includeRoadmapContext: true,
        includeKanbanContext: false,
        maxIdeasPerType: 3
      },
      mockAgentManager as never,
      mainWindow
    );

    const runStatePath = path.join(PROJECT_PATH, AUTO_BUILD_PATHS.IDEATION_DIR, 'run_state.json');
    expect(existsSync(runStatePath)).toBe(true);
    const runState = JSON.parse(readFileSync(runStatePath, 'utf-8'));
    expect(typeof runState.run_id).toBe('string');
    expect(runState.refresh).toBe(false);
  });
});
