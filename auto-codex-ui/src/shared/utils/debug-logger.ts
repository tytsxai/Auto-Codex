/**
 * Debug Logger
 * Only logs when DEBUG=true in environment
 * Main-process logs are also persisted to disk with basic rotation.
 */

const LOG_MAX_BYTES = 5 * 1024 * 1024;
const LOG_FILES_TO_KEEP = 5;

type RequireFn = (id: string) => unknown;

const getRequire = (): RequireFn => {
  if (typeof require === 'function') {
    return require;
  }
  const globalRequire = (globalThis as { require?: RequireFn }).require;
  if (globalRequire) return globalRequire;
  throw new Error('require is not available');
};

const getProcessType = (): string | undefined => {
  if (typeof process !== 'undefined') {
    const type = (process as { type?: string }).type;
    if (type) return type;
  }
  if (typeof globalThis !== 'undefined') {
    return (globalThis as { process?: { type?: string } }).process?.type;
  }
  return undefined;
};

const normalizeDebugPath = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const lowered = trimmed.toLowerCase();
  if (lowered === 'undefined' || lowered === 'null') return undefined;
  return trimmed;
};

const getDebugLogOverride = (): string | undefined => {
  if (typeof process !== 'undefined' && process.env?.DEBUG_LOG_PATH) {
    return normalizeDebugPath(process.env.DEBUG_LOG_PATH);
  }
  if (typeof globalThis !== 'undefined') {
    return normalizeDebugPath(
      (globalThis as { process?: { env?: { DEBUG_LOG_PATH?: string } } }).process?.env?.DEBUG_LOG_PATH
    );
  }
  return undefined;
};

const isDebugEnabled = (): boolean => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.DEBUG === 'true';
  }
  if (typeof globalThis !== 'undefined') {
    return (globalThis as { process?: { env?: { DEBUG?: string } } }).process?.env?.DEBUG === 'true';
  }
  return false;
};

const isMainProcess = (): boolean => {
  if (getDebugLogOverride()) return true;
  return getProcessType() === 'browser';
};

const getLogPath = (): string | null => {
  if (!isMainProcess()) return null;
  const overridePath = getDebugLogOverride();
  if (overridePath) return overridePath;
  try {
    // Lazy require to avoid bundling fs/electron into the renderer.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = getRequire()('electron') as typeof import('electron');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = getRequire()('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = getRequire()('path') as typeof import('path');
    const logDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    return path.join(logDir, 'main.log');
  } catch {
    return null;
  }
};

const redactValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (/token|api[-_]?key|secret|password|oauth/i.test(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactValue(val);
      }
    }
    return result;
  }
  if (typeof value === 'string') {
    return value
      .replace(/(sk-[A-Za-z0-9_-]{10,})/g, '[REDACTED]')
      .replace(/(codex_oauth_[A-Za-z0-9._-]{10,})/g, '[REDACTED]')
      .replace(/(ghp_[A-Za-z0-9]{10,})/g, '[REDACTED]')
      .replace(/(gho_[A-Za-z0-9]{10,})/g, '[REDACTED]')
      .replace(/(ya29\.[A-Za-z0-9._-]{10,})/g, '[REDACTED]');
  }
  return value;
};

const formatArgs = (args: unknown[]): string => {
  return args
    .map((arg) => {
      const redacted = redactValue(arg);
      if (typeof redacted === 'string') return redacted;
      try {
        return JSON.stringify(redacted);
      } catch {
        return String(redacted);
      }
    })
    .join(' ');
};

const rotateLogsIfNeeded = (logPath: string): void => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = getRequire()('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = getRequire()('path') as typeof import('path');
    if (!fs.existsSync(logPath)) return;
    const size = fs.statSync(logPath).size;
    if (size < LOG_MAX_BYTES) return;

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedPath = logPath.replace(/\.log$/, `-${stamp}.log`);
    fs.renameSync(logPath, rotatedPath);

    const dir = path.dirname(logPath);
    const entries = fs.readdirSync(dir)
      .filter((name: string) => name.startsWith('main-') && name.endsWith('.log'))
      .map((name: string) => ({
        name,
        time: fs.statSync(path.join(dir, name)).mtimeMs
      }))
      .sort((a: { time: number }, b: { time: number }) => b.time - a.time);

    const toRemove = entries.slice(LOG_FILES_TO_KEEP);
    for (const entry of toRemove) {
      fs.unlinkSync(path.join(dir, entry.name));
    }
  } catch {
    // Ignore rotation failures
  }
};

const appendToLog = (level: 'log' | 'warn' | 'error', args: unknown[]): void => {
  const logPath = getLogPath();
  if (!logPath) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = getRequire()('fs') as typeof import('fs');
    rotateLogsIfNeeded(logPath);
    const line = `[${new Date().toISOString()}] [${level}] ${formatArgs(args)}\n`;
    fs.appendFileSync(logPath, line, 'utf8');
  } catch {
    // Ignore logging failures
  }
};

export const debugLog = (...args: unknown[]): void => {
  const redacted = args.map(redactValue);
  if (isDebugEnabled()) {
    console.warn(...redacted);
  }
  if (isMainProcess()) {
    appendToLog('log', redacted);
  }
};

export const debugWarn = (...args: unknown[]): void => {
  const redacted = args.map(redactValue);
  if (isDebugEnabled()) {
    console.warn(...redacted);
  }
  if (isMainProcess()) {
    appendToLog('warn', redacted);
  }
};

export const debugError = (...args: unknown[]): void => {
  const redacted = args.map(redactValue);
  if (isDebugEnabled()) {
    console.error(...redacted);
  }
  if (isMainProcess()) {
    appendToLog('error', redacted);
  }
};
