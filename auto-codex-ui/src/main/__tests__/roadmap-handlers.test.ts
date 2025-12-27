import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import path from 'path';

const TEST_DIR = '/tmp/roadmap-handlers-test';
const USER_DATA_DIR = `/tmp/test-app-data-${
  process.env.VITEST_WORKER_ID ?? process.env.VITEST_POOL_ID ?? process.pid
}`;
const PROJECT_PATH = path.join(TEST_DIR, 'project');

describe('roadmap handlers', () => {
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

  it('blocks competitor analysis when riskPolicy is conservative', async () => {
    const { app, ipcMain, BrowserWindow } = await import('electron');
    const { IPC_CHANNELS } = await import('../../shared/constants');
    const { projectStore } = await import('../project-store');
    const { registerRoadmapHandlers } = await import('../ipc-handlers/roadmap-handlers');

    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    mkdirSync(path.dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify({ riskPolicy: 'conservative' }, null, 2));

    const project = projectStore.addProject(PROJECT_PATH);

    const mockAgentManager = {
      startRoadmapGeneration: vi.fn(),
      stopRoadmap: vi.fn(),
      isRoadmapRunning: vi.fn(() => false),
      configure: vi.fn(),
      on: vi.fn()
    };
    const mockPythonEnvManager = {
      isEnvReady: vi.fn(() => true),
      getPythonPath: vi.fn(() => '/usr/bin/python3')
    };
    const mainWindow = new BrowserWindow();
    registerRoadmapHandlers(
      mockAgentManager as never,
      mockPythonEnvManager as never,
      () => mainWindow
    );

    ipcMain.emit(IPC_CHANNELS.ROADMAP_GENERATE, {}, project.id, true, false);

    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      IPC_CHANNELS.ROADMAP_ERROR,
      project.id,
      expect.stringMatching(/risk policy|\u98ce\u9669\u7b56\u7565/)
    );
    expect(mockAgentManager.startRoadmapGeneration).not.toHaveBeenCalled();
  });

  it('writes run_state.json when roadmap generation starts', async () => {
    const { app, ipcMain, BrowserWindow } = await import('electron');
    const { IPC_CHANNELS, AUTO_BUILD_PATHS } = await import('../../shared/constants');
    const { projectStore } = await import('../project-store');
    const { registerRoadmapHandlers } = await import('../ipc-handlers/roadmap-handlers');

    const autoBuildSource = path.resolve(process.cwd(), 'auto-codex');
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    mkdirSync(path.dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify({
      riskPolicy: 'permissive',
      autoBuildPath: autoBuildSource
    }, null, 2));

    const project = projectStore.addProject(PROJECT_PATH);

    const mockAgentManager = {
      startRoadmapGeneration: vi.fn(),
      stopRoadmap: vi.fn(),
      isRoadmapRunning: vi.fn(() => false),
      configure: vi.fn(),
      on: vi.fn()
    };
    const mockPythonEnvManager = {
      isEnvReady: vi.fn(() => true),
      getPythonPath: vi.fn(() => '/usr/bin/python3')
    };
    const mainWindow = new BrowserWindow();
    registerRoadmapHandlers(
      mockAgentManager as never,
      mockPythonEnvManager as never,
      () => mainWindow
    );

    ipcMain.emit(IPC_CHANNELS.ROADMAP_GENERATE, {}, project.id, true, false);

    const runStatePath = path.join(PROJECT_PATH, AUTO_BUILD_PATHS.ROADMAP_DIR, 'run_state.json');
    expect(existsSync(runStatePath)).toBe(true);
    const runState = JSON.parse(readFileSync(runStatePath, 'utf-8'));
    expect(typeof runState.run_id).toBe('string');
    expect(runState.enable_competitor_analysis).toBe(true);
    expect(mockAgentManager.startRoadmapGeneration).toHaveBeenCalledTimes(1);
  });
});
