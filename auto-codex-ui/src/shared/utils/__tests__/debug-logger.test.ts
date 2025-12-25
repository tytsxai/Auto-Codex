/**
 * Unit tests for debug logger utilities
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync
} from 'fs';
import path from 'path';
import os from 'os';

const originalDebug = process.env.DEBUG;
const originalDebugLogPath = process.env.DEBUG_LOG_PATH;
const originalProcessTypeDescriptor = Object.getOwnPropertyDescriptor(process, 'type');

const setProcessType = (value?: string): void => {
  if (value === undefined) {
    delete (process as { type?: string }).type;
    return;
  }
  (process as { type?: string }).type = value;
  Object.defineProperty(process, 'type', { value, writable: true, configurable: true });
};

afterEach(() => {
  process.env.DEBUG = originalDebug;
  process.env.DEBUG_LOG_PATH = originalDebugLogPath;
  if (originalProcessTypeDescriptor) {
    Object.defineProperty(process, 'type', originalProcessTypeDescriptor);
  } else {
    delete (process as { type?: string }).type;
  }
  vi.useRealTimers();
});

const loadLogger = async () => import('../debug-logger');

describe('debug logger', () => {
  it('redacts sensitive values and logs when DEBUG=true', async () => {
    process.env.DEBUG = 'true';
    setProcessType(undefined);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { debugLog } = await loadLogger();

    debugLog(
      'sk-abcdefghijklmnopqrstuvwxyz',
      {
        password: 'secret',
        nested: { apiKey: 'key-123', ok: 'fine' },
        note: 'safe'
      },
      ['ghp_1234567890', 'safe']
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [arg1, arg2, arg3] = warnSpy.mock.calls[0];
    expect(arg1).toBe('[REDACTED]');
    expect(arg2).toEqual({
      password: '[REDACTED]',
      nested: { apiKey: '[REDACTED]', ok: 'fine' },
      note: 'safe'
    });
    expect(arg3).toEqual(['[REDACTED]', 'safe']);
  });

  it('skips console logging when DEBUG is not true', async () => {
    process.env.DEBUG = 'false';
    setProcessType(undefined);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { debugWarn } = await loadLogger();

    debugWarn('quiet');

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs errors to console when DEBUG=true', async () => {
    process.env.DEBUG = 'true';
    setProcessType(undefined);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { debugError } = await loadLogger();

    debugError('codex_oauth_abcdefghijklmnopqrstuvwxyz');

    expect(errorSpy).toHaveBeenCalledWith('[REDACTED]');
  });

  it('writes to disk and rotates logs in the main process', async () => {
    process.env.DEBUG = 'false';
    setProcessType('browser');

    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'debug-logger-'));
    const logPathOverride = path.join(tempDir, 'logs', 'main.log');
    process.env.DEBUG_LOG_PATH = logPathOverride;
    rmSync(path.dirname(logPathOverride), { recursive: true, force: true });
    mkdirSync(path.dirname(logPathOverride), { recursive: true });

    const { debugLog, debugWarn } = await loadLogger();
    debugLog('initial');
    const logDir = path.dirname(logPathOverride);
    expect(existsSync(logDir)).toBe(true);

    const logPath = path.join(logDir, 'main.log');
    writeFileSync(logPath, Buffer.alloc(5 * 1024 * 1024 + 1, 'a'));

    for (let i = 1; i <= 6; i += 1) {
      const file = path.join(logDir, `main-${i}.log`);
      writeFileSync(file, `old-${i}`);
      const time = new Date(Date.UTC(2020, 0, i));
      utimesSync(file, time, time);
    }

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-02T03:04:05.678Z'));

    debugWarn({ ok: true }, BigInt(42), 'sk-abcdefghijklmnopqrstuvwxyz');

    const rotated = path.join(logDir, 'main-2025-01-02T03-04-05-678Z.log');
    expect(existsSync(rotated)).toBe(true);
    expect(existsSync(path.join(logDir, 'main-1.log'))).toBe(false);
    expect(existsSync(path.join(logDir, 'main-2.log'))).toBe(false);

    const logContents = readFileSync(logPath, 'utf8');
    expect(logContents).toContain('[warn]');
    expect(logContents).toContain('{"ok":true} 42 [REDACTED]');

    rmSync(tempDir, { recursive: true, force: true });
  });
});
