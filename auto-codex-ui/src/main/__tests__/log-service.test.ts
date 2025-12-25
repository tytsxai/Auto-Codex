/**
 * Unit tests for LogService
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { LogService } from '../log-service';

function readFileSafe(filePath: string): string {
  return readFileSync(filePath, 'utf-8');
}

describe('LogService', () => {
  let tempDir: string;
  let service: LogService;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'log-service-'));
    service = new LogService();
  });

  afterEach(() => {
    service.shutdown();
    rmSync(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('creates sessions, writes logs, and updates latest.log', () => {
    const sessionId = service.startSession('task-1', tempDir);

    service.appendLog('task-1', 'hello world');
    service.flushAll();
    service.endSession('task-1', 0);

    const logPath = path.join(tempDir, 'logs', `session-${sessionId}.log`);
    const latestPath = path.join(tempDir, 'logs', 'latest.log');

    expect(existsSync(logPath)).toBe(true);
    expect(existsSync(latestPath)).toBe(true);

    const content = readFileSafe(logPath);
    expect(content).toContain('LOG SESSION');
    expect(content).toContain('hello world');
    expect(content).toContain('SESSION ENDED');

    const latest = readFileSafe(latestPath);
    expect(latest).toContain('LOG SESSION');
    expect(latest).toContain('SESSION ENDED');
  });

  it('buffers logs before session starts and flushes on start', () => {
    service.appendLog('task-2', 'pre-session log');

    const sessionId = service.startSession('task-2', tempDir);
    const logPath = path.join(tempDir, 'logs', `session-${sessionId}.log`);

    const content = readFileSafe(logPath);
    expect(content).toContain('pre-session log');

    service.endSession('task-2');
  });

  it('redacts secrets in log output', () => {
    const sessionId = service.startSession('task-3', tempDir);
    service.appendLog('task-3', 'sk-1234567890secret');
    service.appendLog('task-3', 'Bearer realtoken');
    service.flushAll();
    service.endSession('task-3');

    const logPath = path.join(tempDir, 'logs', `session-${sessionId}.log`);
    const content = readFileSafe(logPath);

    expect(content).not.toContain('sk-1234567890secret');
    expect(content).not.toContain('realtoken');
    expect(content).toContain('[REDACTED]');
  });

  it('truncates logs when max size is exceeded', () => {
    // Force a small max size for test
    (service as unknown as { MAX_LOG_SIZE_BYTES: number }).MAX_LOG_SIZE_BYTES = 512;

    const sessionId = service.startSession('task-4', tempDir);
    service.appendLog('task-4', 'x'.repeat(1000));
    service.flushAll();

    const logPath = path.join(tempDir, 'logs', `session-${sessionId}.log`);
    const content = readFileSafe(logPath);

    expect(content).toContain('LOG TRUNCATED');
    service.endSession('task-4');
  });

  it('lists sessions and loads recent logs', () => {
    const sessionId = service.startSession('task-5', tempDir);
    service.appendLog('task-5', 'line 1');
    service.appendLog('task-5', 'line 2');
    service.flushAll();
    service.endSession('task-5');

    const sessions = service.getSessions(tempDir);
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].sessionId).toBe(sessionId);

    const recent = service.loadRecentLogs(tempDir, 2);
    expect(recent.join('\n')).toContain('line 2');
  });
});
