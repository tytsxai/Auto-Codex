import path from 'path';
import { existsSync, mkdirSync, appendFileSync, readdirSync, readFileSync, writeFileSync, statSync, unlinkSync } from 'fs';

export interface LogSession {
  sessionId: string;
  startedAt: Date;
  endedAt?: Date;
  logFile: string;
  lineCount: number;
  sizeBytes: number;
}

export interface LogEntry {
  timestamp: Date;
  content: string;
}

const REDACTION_RULES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /(sk-[A-Za-z0-9_-]{10,})/g, replacement: '[REDACTED]' },
  { pattern: /(codex_oauth_[A-Za-z0-9._-]{10,})/g, replacement: '[REDACTED]' },
  { pattern: /(ghp_[A-Za-z0-9]{10,})/g, replacement: '[REDACTED]' },
  { pattern: /(gho_[A-Za-z0-9]{10,})/g, replacement: '[REDACTED]' },
  { pattern: /(ya29\.[A-Za-z0-9._-]{10,})/g, replacement: '[REDACTED]' },
  { pattern: /(Bearer\s+)(\S+)/gi, replacement: '$1[REDACTED]' },
  { pattern: /((?:api[_-]?key|token|secret|password)\s*[:=]\s*)([^\s]+)/gi, replacement: '$1[REDACTED]' }
];

function redactLogLine(line: string): string {
  let redacted = line;
  for (const rule of REDACTION_RULES) {
    redacted = redacted.replace(rule.pattern, rule.replacement);
  }
  return redacted;
}

/**
 * Service for persisting and retrieving task execution logs
 *
 * Log files are stored in {specDir}/logs/ with format:
 * - session-{ISO-timestamp}.log - Raw log output per execution session
 * - latest.log - Copy of most recent session's logs
 */
export class LogService {
  private activeSessions: Map<string, { sessionId: string; logPath: string; startedAt: Date }> = new Map();
  private logBuffers: Map<string, string[]> = new Map();
  private flushIntervals: Map<string, NodeJS.Timeout> = new Map();
  private warnedMissingSession: Set<string> = new Set();
  private truncatedTasks: Set<string> = new Set();

  // Flush logs to disk every 2 seconds to balance performance vs data safety
  private readonly FLUSH_INTERVAL_MS = 2000;
  // Maximum log file size before rotation (10MB)
  private readonly MAX_LOG_SIZE_BYTES = 10 * 1024 * 1024;
  // Keep last N sessions
  private readonly MAX_SESSIONS_TO_KEEP = 10;

  /**
   * Start a new log session for a task
   */
  startSession(taskId: string, specDir: string): string {
    const logsDir = path.join(specDir, 'logs');

    // Ensure logs directory exists
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }

    // Create session ID from timestamp
    const now = new Date();
    const sessionId = now.toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(logsDir, `session-${sessionId}.log`);

    // Write session header
    const header = [
      '=' .repeat(80),
      `LOG SESSION: ${sessionId}`,
      `Task: ${taskId}`,
      `Started: ${now.toISOString()}`,
      `Spec Directory: ${specDir}`,
      '='.repeat(80),
      ''
    ].join('\n');

    writeFileSync(logFile, header);

    // Track active session
    this.activeSessions.set(taskId, {
      sessionId,
      logPath: logFile,
      startedAt: now
    });

    // Ensure buffer exists for this task (may already contain pre-session logs)
    if (!this.logBuffers.has(taskId)) {
      this.logBuffers.set(taskId, []);
    }
    this.warnedMissingSession.delete(taskId);
    this.truncatedTasks.delete(taskId);

    // Set up periodic flush
    const flushInterval = setInterval(() => {
      this.flushBuffer(taskId);
    }, this.FLUSH_INTERVAL_MS);
    this.flushIntervals.set(taskId, flushInterval);

    // Flush any buffered logs that arrived before the session started
    this.flushBuffer(taskId);

    // Clean up old sessions
    this.cleanupOldSessions(logsDir);

    console.warn(`[LogService] Started session ${sessionId} for task ${taskId}`);
    return sessionId;
  }

  /**
   * Append a log entry for a task
   */
  appendLog(taskId: string, content: string): void {
    const session = this.activeSessions.get(taskId);
    if (!session && !this.warnedMissingSession.has(taskId)) {
      console.warn(
        `[LogService] No active session for task ${taskId}, buffering logs until session starts`
      );
      this.warnedMissingSession.add(taskId);
    }

    // Add timestamp prefix for each line
    const timestamp = new Date().toISOString();
    const lines = content.split('\n').filter(line => line.length > 0);
    const timestampedLines = lines.map(line => `[${timestamp}] ${redactLogLine(line)}`);

    // Add to buffer
    const buffer = this.logBuffers.get(taskId) || [];
    buffer.push(...timestampedLines);
    this.logBuffers.set(taskId, buffer);

    // Flush immediately if buffer is large
    if (buffer.length > 100) {
      this.flushBuffer(taskId);
    }
  }

  /**
   * Flush buffered logs to disk
   */
  private flushBuffer(taskId: string): void {
    const session = this.activeSessions.get(taskId);
    const buffer = this.logBuffers.get(taskId);

    if (!session || !buffer || buffer.length === 0) {
      return;
    }

    try {
      const content = buffer.join('\n') + '\n';

      if (this.truncatedTasks.has(taskId)) {
        this.logBuffers.set(taskId, []);
        return;
      }

      const currentSize = statSync(session.logPath).size;
      const contentBytes = Buffer.byteLength(content, 'utf8');
      if (currentSize >= this.MAX_LOG_SIZE_BYTES || currentSize + contentBytes > this.MAX_LOG_SIZE_BYTES) {
        const truncationNotice = `[${new Date().toISOString()}] [LogService] LOG TRUNCATED: log exceeded ${this.MAX_LOG_SIZE_BYTES} bytes (further output dropped)\n`;
        if (currentSize + Buffer.byteLength(truncationNotice, 'utf8') <= this.MAX_LOG_SIZE_BYTES + 256) {
          appendFileSync(session.logPath, truncationNotice);
        }
        this.truncatedTasks.add(taskId);
        this.logBuffers.set(taskId, []);
        console.warn(`[LogService] Truncated logs for task ${taskId} (file size limit reached)`);
        return;
      }

      appendFileSync(session.logPath, content);
      this.logBuffers.set(taskId, []); // Clear buffer
    } catch (error) {
      console.error(`[LogService] Failed to flush logs for task ${taskId}:`, error);
    }
  }

  /**
   * Flush all buffers to disk
   */
  flushAll(): void {
    for (const taskId of this.logBuffers.keys()) {
      this.flushBuffer(taskId);
    }
  }

  /**
   * Stop timers and flush logs (call on app shutdown)
   */
  shutdown(): void {
    this.flushAll();
    for (const interval of this.flushIntervals.values()) {
      clearInterval(interval);
    }
    this.flushIntervals.clear();
  }

  /**
   * End a log session
   */
  endSession(taskId: string, exitCode?: number | null): void {
    // Flush remaining buffer
    this.flushBuffer(taskId);

    const session = this.activeSessions.get(taskId);
    if (!session) {
      return;
    }

    // Write session footer
    const now = new Date();
    const duration = now.getTime() - session.startedAt.getTime();
    const durationStr = this.formatDuration(duration);

    const footer = [
      '',
      '='.repeat(80),
      `SESSION ENDED: ${now.toISOString()}`,
      `Duration: ${durationStr}`,
      `Exit Code: ${exitCode ?? 'unknown'}`,
      '='.repeat(80)
    ].join('\n');

    try {
      appendFileSync(session.logPath, footer);

      // Update latest.log symlink/copy
      const logsDir = path.dirname(session.logPath);
      const latestPath = path.join(logsDir, 'latest.log');
      const logContent = readFileSync(session.logPath, 'utf-8');
      writeFileSync(latestPath, logContent);
    } catch (error) {
      console.error(`[LogService] Failed to end session for task ${taskId}:`, error);
    }

    // Clean up
    const interval = this.flushIntervals.get(taskId);
    if (interval) {
      clearInterval(interval);
      this.flushIntervals.delete(taskId);
    }
    this.activeSessions.delete(taskId);
    this.logBuffers.delete(taskId);
    this.warnedMissingSession.delete(taskId);
    this.truncatedTasks.delete(taskId);

    console.warn(`[LogService] Ended session for task ${taskId}, exit code: ${exitCode}`);
  }

  /**
   * Get list of log sessions for a task
   */
  getSessions(specDir: string): LogSession[] {
    const logsDir = path.join(specDir, 'logs');

    if (!existsSync(logsDir)) {
      return [];
    }

    const files = readdirSync(logsDir)
      .filter(f => f.startsWith('session-') && f.endsWith('.log'))
      .sort()
      .reverse(); // Most recent first

    return files.map(file => {
      const filePath = path.join(logsDir, file);
      const stats = statSync(filePath);
      const sessionId = file.replace('session-', '').replace('.log', '');

      // Parse session ID back to date
      const dateStr = sessionId.replace(/-/g, (match, offset) => {
        // Replace first 2 dashes with actual dashes, rest with colons
        if (offset < 10) return '-';
        if (offset === 10) return 'T';
        return ':';
      }).replace(/-(\d{3})Z$/, '.$1Z');

      const startedAt = new Date(dateStr);

      // Count lines (approximate)
      const content = readFileSync(filePath, 'utf-8');
      const lineCount = content.split('\n').length;

      return {
        sessionId,
        startedAt,
        logFile: filePath,
        lineCount,
        sizeBytes: stats.size
      };
    });
  }

  /**
   * Load logs from a specific session
   */
  loadSessionLogs(specDir: string, sessionId?: string): string {
    const logsDir = path.join(specDir, 'logs');

    if (!existsSync(logsDir)) {
      return '';
    }

    let logFile: string;
    if (sessionId) {
      logFile = path.join(logsDir, `session-${sessionId}.log`);
    } else {
      // Load latest
      logFile = path.join(logsDir, 'latest.log');
    }

    if (!existsSync(logFile)) {
      // Try to find most recent session
      const sessions = this.getSessions(specDir);
      if (sessions.length > 0) {
        logFile = sessions[0].logFile;
      } else {
        return '';
      }
    }

    try {
      return readFileSync(logFile, 'utf-8');
    } catch (error) {
      console.error(`[LogService] Failed to load logs from ${logFile}:`, error);
      return '';
    }
  }

  /**
   * Load recent logs (last N lines) - useful for UI display
   */
  loadRecentLogs(specDir: string, maxLines: number = 1000): string[] {
    const content = this.loadSessionLogs(specDir);
    if (!content) {
      return [];
    }

    const isMetaLine = (line: string): boolean => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (/^=+$/.test(trimmed)) return true;
      return (
        trimmed.startsWith('LOG SESSION:') ||
        trimmed.startsWith('Task:') ||
        trimmed.startsWith('Started:') ||
        trimmed.startsWith('Spec Directory:') ||
        trimmed.startsWith('SESSION ENDED:') ||
        trimmed.startsWith('Duration:') ||
        trimmed.startsWith('Exit Code:')
      );
    };

    const lines = content.split('\n').filter(line => !isMetaLine(line));
    return lines.slice(-maxLines);
  }

  /**
   * Clean up old log sessions, keeping only the most recent N
   */
  private cleanupOldSessions(logsDir: string): void {
    try {
      const files = readdirSync(logsDir)
        .filter(f => f.startsWith('session-') && f.endsWith('.log'))
        .sort()
        .reverse();

      // Keep MAX_SESSIONS_TO_KEEP, delete the rest
      const toDelete = files.slice(this.MAX_SESSIONS_TO_KEEP);

      for (const file of toDelete) {
        const filePath = path.join(logsDir, file);
        try {
          unlinkSync(filePath);
          console.warn(`[LogService] Deleted old log session: ${file}`);
        } catch (_e) {
          // Ignore deletion errors
        }
      }
    } catch (_error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Format duration in human readable format
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Check if a task has an active log session
   */
  hasActiveSession(taskId: string): boolean {
    return this.activeSessions.has(taskId);
  }

  /**
   * Get the current log file path for a task (if session is active)
   */
  getCurrentLogPath(taskId: string): string | null {
    const session = this.activeSessions.get(taskId);
    return session?.logPath ?? null;
  }
}

// Singleton instance
export const logService = new LogService();
