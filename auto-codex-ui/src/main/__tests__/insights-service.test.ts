/**
 * Unit tests for InsightsService
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { InsightsService } from '../insights-service';
import type { InsightsChatMessage } from '../../shared/types';

function makeAutoCodexDir(baseDir: string): string {
  const autoCodexPath = path.join(baseDir, 'auto-codex');
  mkdirSync(autoCodexPath, { recursive: true });
  writeFileSync(path.join(autoCodexPath, 'requirements.txt'), '# test');
  return autoCodexPath;
}

describe('InsightsService', () => {
  let tempDir: string;
  let projectPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'insights-service-'));
    projectPath = path.join(tempDir, 'project');
    mkdirSync(projectPath, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('emits error when auto-codex source is missing', async () => {
    const service = new InsightsService();
    const errors: string[] = [];
    service.on('error', (_projectId, error) => errors.push(error));

    await service.sendMessage('project-1', projectPath, 'Hello');

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Auto Codex source not found');
  });

  it('creates a session and stores assistant response', async () => {
    const service = new InsightsService();
    const autoCodexPath = makeAutoCodexDir(tempDir);

    service.configure('/usr/bin/python3', autoCodexPath);

    const executor = (service as unknown as { executor: { execute: Function } }).executor;
    vi.spyOn(executor, 'execute').mockResolvedValue({
      fullResponse: 'All good',
      suggestedTask: {
        title: 'Improve logging',
        description: 'Add structured logs',
        metadata: { category: 'feature' }
      } as InsightsChatMessage['suggestedTask'],
      toolsUsed: []
    });

    await service.sendMessage('project-1', projectPath, 'Hello insights');

    const session = service.loadSession('project-1', projectPath);
    expect(session).not.toBeNull();
    expect(session?.messages).toHaveLength(2);
    expect(session?.messages[0].role).toBe('user');
    expect(session?.messages[1].role).toBe('assistant');
    expect(session?.messages[1].suggestedTask?.title).toBe('Improve logging');
    expect(session?.title).toContain('Hello insights');
  });
});
