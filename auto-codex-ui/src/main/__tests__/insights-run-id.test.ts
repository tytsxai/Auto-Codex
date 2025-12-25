import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import path from 'path';
import { InsightsService } from '../insights-service';
import { InsightsExecutor } from '../insights/insights-executor';

const TEST_DIR = '/tmp/insights-run-id-test';
const PROJECT_PATH = path.join(TEST_DIR, 'project');

vi.mock('../python-detector', () => ({
  findPythonCommand: () => 'python'
}));

describe('insights runId', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(path.join(PROJECT_PATH, '.auto-codex'), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it('assigns a runId to both user and assistant messages', async () => {
    vi.spyOn(InsightsExecutor.prototype, 'execute').mockResolvedValue({
      fullResponse: 'OK',
      toolsUsed: []
    });

    const service = new InsightsService();
    service.configure(undefined, path.resolve(process.cwd(), '..', 'auto-codex'));
    await service.sendMessage('project-1', PROJECT_PATH, 'Hello');

    const session = service.loadSession('project-1', PROJECT_PATH);
    expect(session).not.toBeNull();
    expect(session?.messages.length).toBe(2);
    const [userMessage, assistantMessage] = session!.messages;
    expect(userMessage.runId).toBeTruthy();
    expect(userMessage.runId).toBe(assistantMessage.runId);
  });
});
