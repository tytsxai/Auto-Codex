import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import { AgentState } from '../agent/agent-state';
import { AgentEvents } from '../agent/agent-events';
import { AgentProcessManager } from '../agent/agent-process';

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn();
}

let spawnedProcess: FakeChildProcess | null = null;

vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    spawnedProcess = new FakeChildProcess();
    return spawnedProcess as unknown as ChildProcess;
  })
}));

vi.mock('../python-detector', () => ({
  findPythonCommand: () => 'python',
  parsePythonCommand: (command: string) => [command, []]
}));

describe('AgentProcessManager markers', () => {
  let emitter: EventEmitter;
  let progressEvents: Array<{ phase: string; message?: string; currentSubtask?: string }>;
  let logEvents: string[];

  beforeEach(() => {
    progressEvents = [];
    logEvents = [];
    emitter = new EventEmitter();
    emitter.on('execution-progress', (_taskId, progress) => {
      progressEvents.push(progress as { phase: string; message?: string; currentSubtask?: string });
    });
    emitter.on('log', (_taskId, log) => {
      logEvents.push(log);
    });

    const manager = new AgentProcessManager(new AgentState(), new AgentEvents(), emitter);
    manager.spawnProcess('task-1', '/tmp', ['script.py'], {}, 'task-execution');
  });

  afterEach(() => {
    spawnedProcess = null;
    vi.clearAllMocks();
  });

  it('updates progress from phase markers and removes marker lines from logs', () => {
    expect(spawnedProcess).not.toBeNull();
    const markerLine = '__TASK_LOG_PHASE_START__:' + JSON.stringify({ phase: 'coding' });
    spawnedProcess?.stdout.emit('data', Buffer.from(`${markerLine}\nHello world\n`));

    const lastProgress = progressEvents[progressEvents.length - 1];
    expect(lastProgress.phase).toBe('coding');
    expect(lastProgress.message).toBe('Starting coding...');
    expect(logEvents).toEqual(['Hello world']);
  });

  it('emits progress updates for TEXT markers without logging marker lines', () => {
    expect(spawnedProcess).not.toBeNull();
    const markerLine = '__TASK_LOG_TEXT__:' + JSON.stringify({
      content: 'Working on subtask',
      phase: 'coding',
      subtask_id: 'subtask-1'
    });
    spawnedProcess?.stdout.emit('data', Buffer.from(`${markerLine}\n`));

    const lastProgress = progressEvents[progressEvents.length - 1];
    expect(lastProgress.phase).toBe('coding');
    expect(lastProgress.message).toBe('Working on subtask');
    expect(lastProgress.currentSubtask).toBe('subtask-1');
    expect(logEvents).toEqual([]);
  });
});
