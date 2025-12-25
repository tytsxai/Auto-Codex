import { spawn } from 'child_process';
import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { app } from 'electron';
import { EventEmitter } from 'events';
import { AgentState } from './agent-state';
import { AgentEvents } from './agent-events';
import { ProcessType, ExecutionProgressData } from './types';
import { detectRateLimit, createSDKRateLimitInfo, getProfileEnv, detectAuthFailure } from '../rate-limit-detector';
import { projectStore } from '../project-store';
import { getCodexProfileManager } from '../codex-profile-manager';
import { findPythonCommand, parsePythonCommand } from '../python-detector';

/**
 * Process spawning and lifecycle management
 */
export class AgentProcessManager {
  private state: AgentState;
  private events: AgentEvents;
  private emitter: EventEmitter;
  // Auto-detect Python command on initialization
  private pythonPath: string = findPythonCommand() || 'python';
  private autoBuildSourcePath: string = '';

  constructor(state: AgentState, events: AgentEvents, emitter: EventEmitter) {
    this.state = state;
    this.events = events;
    this.emitter = emitter;
  }

  /**
   * Configure paths for Python and auto-codex source
   */
  configure(pythonPath?: string, autoBuildSourcePath?: string): void {
    if (pythonPath) {
      this.pythonPath = pythonPath;
    }
    if (autoBuildSourcePath) {
      this.autoBuildSourcePath = autoBuildSourcePath;
    }
  }

  /**
   * Get the configured Python path
   */
  getPythonPath(): string {
    return this.pythonPath;
  }

  /**
   * Get the auto-codex source path (detects automatically if not configured)
   */
  getAutoBuildSourcePath(): string | null {
    // If manually configured, use that
    if (this.autoBuildSourcePath && existsSync(this.autoBuildSourcePath)) {
      return this.autoBuildSourcePath;
    }

    // Auto-detect from app location
    const possiblePaths = [
      // Dev mode: from dist/main -> ../../auto-codex (sibling to __AUTO_CODEX_UI__)
      path.resolve(__dirname, '..', '..', '..', 'auto-codex'),
      // Alternative: from app root
      path.resolve(app.getAppPath(), '..', 'auto-codex'),
      // If running from repo root
      path.resolve(process.cwd(), 'auto-codex')
    ];

    for (const p of possiblePaths) {
      // Use requirements.txt as marker - it always exists in auto-codex source
      if (existsSync(p) && existsSync(path.join(p, 'requirements.txt'))) {
        return p;
      }
    }
    return null;
  }

  /**
   * Get project-specific environment variables based on project settings
   */
  private getProjectEnvVars(projectPath: string): Record<string, string> {
    const env: Record<string, string> = {};

    // Find project by path
    const projects = projectStore.getProjects();
    const project = projects.find((p) => p.path === projectPath);

    if (project?.settings) {
      // Graphiti MCP integration
      if (project.settings.graphitiMcpEnabled) {
        const graphitiUrl = project.settings.graphitiMcpUrl || 'http://localhost:8000/mcp/';
        env['GRAPHITI_MCP_URL'] = graphitiUrl;
      }
    }

    return env;
  }

  /**
   * Load environment variables from auto-codex .env file
   */
  loadAutoBuildEnv(): Record<string, string> {
    const autoBuildSource = this.getAutoBuildSourcePath();
    if (!autoBuildSource) {
      return {};
    }

    const envPath = path.join(autoBuildSource, '.env');
    if (!existsSync(envPath)) {
      return {};
    }

    try {
      const envContent = readFileSync(envPath, 'utf-8');
      const envVars: Record<string, string> = {};

      // Handle both Unix (\n) and Windows (\r\n) line endings
      for (const line of envContent.split(/\r?\n/)) {
        const trimmed = line.trim();
        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex).trim();
          let value = trimmed.substring(eqIndex + 1).trim();

          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }

          envVars[key] = value;
        }
      }

      return envVars;
    } catch {
      return {};
    }
  }

  /**
   * Spawn a Python process for task execution
   */
  spawnProcess(
    taskId: string,
    cwd: string,
    args: string[],
    extraEnv: Record<string, string> = {},
    processType: ProcessType = 'task-execution'
  ): void {
    const isSpecRunner = processType === 'spec-creation';
    // Kill existing process for this task if any
    this.killProcess(taskId);

    // Generate unique spawn ID for this process instance
    const spawnId = this.state.generateSpawnId();

    // Get active Codex profile environment (CODEX_CONFIG_DIR if not default)
    const profileEnv = getProfileEnv();

    // Parse Python command to handle space-separated commands like "py -3"
    const [pythonCommand, pythonBaseArgs] = parsePythonCommand(this.pythonPath);
    const childProcess = spawn(pythonCommand, [...pythonBaseArgs, ...args], {
      cwd,
      env: {
        ...process.env,
        ...extraEnv,
        ...profileEnv, // Include active Codex profile config
        PYTHONUNBUFFERED: '1', // Ensure real-time output
        PYTHONIOENCODING: 'utf-8', // Ensure UTF-8 encoding on Windows
        PYTHONUTF8: '1' // Force Python UTF-8 mode on Windows (Python 3.7+)
      }
    });

    this.state.addProcess(taskId, {
      taskId,
      process: childProcess,
      startedAt: new Date(),
      spawnId
    });

    // Track execution progress
    let currentPhase: ExecutionProgressData['phase'] = isSpecRunner ? 'planning' : 'planning';
    let phaseProgress = 0;
    let currentSubtask: string | undefined;
    let lastMessage: string | undefined;
    let stdoutBuffer = '';
    let stderrBuffer = '';
    // Collect all output for rate limit detection
    let allOutput = '';

    // Emit initial progress
    this.emitter.emit('execution-progress', taskId, {
      phase: currentPhase,
      phaseProgress: 0,
      overallProgress: this.events.calculateOverallProgress(currentPhase, 0),
      message: isSpecRunner ? 'Starting spec creation...' : 'Starting build process...'
    });

    const emitProgress = (options: {
      phase?: ExecutionProgressData['phase'];
      message?: string;
      currentSubtask?: string;
      phaseProgress?: number;
      increment?: number;
    }) => {
      const phaseChanged = options.phase && options.phase !== currentPhase;
      if (options.phase) {
        currentPhase = options.phase;
      }
      if (options.currentSubtask) {
        currentSubtask = options.currentSubtask;
      }
      if (options.message) {
        lastMessage = options.message;
      }

      if (phaseChanged) {
        phaseProgress = options.phaseProgress ?? 10;
      } else if (typeof options.phaseProgress === 'number') {
        phaseProgress = options.phaseProgress;
      } else if (options.increment) {
        phaseProgress = Math.min(90, phaseProgress + options.increment);
      }

      const overallProgress = this.events.calculateOverallProgress(currentPhase, phaseProgress);

      this.emitter.emit('execution-progress', taskId, {
        phase: currentPhase,
        phaseProgress,
        overallProgress,
        currentSubtask,
        message: lastMessage
      });
    };

    const handleTaskLogMarker = (markerType: string, data: Record<string, unknown>) => {
      const phaseRaw = typeof data.phase === 'string' ? data.phase : undefined;
      const mappedPhase = phaseRaw ? this.events.mapTaskLogPhaseToExecutionPhase(phaseRaw) : null;

      if (markerType === 'PHASE_START') {
        if (mappedPhase) {
          emitProgress({
            phase: mappedPhase,
            message: `Starting ${mappedPhase}...`,
            phaseProgress: 10
          });
        }
        return;
      }

      if (markerType === 'PHASE_END') {
        const success = data.success === undefined ? true : Boolean(data.success);
        if (!success) {
          emitProgress({
            phase: 'failed',
            message: `Phase ${phaseRaw || 'unknown'} failed`,
            phaseProgress: 0
          });
          return;
        }
        if (mappedPhase) {
          emitProgress({
            phase: mappedPhase,
            message: `Completed ${mappedPhase} phase`,
            phaseProgress: 100
          });
        }
        return;
      }

      if (markerType === 'TEXT') {
        const content = typeof data.content === 'string' ? data.content : undefined;
        const subtaskId = typeof data.subtask_id === 'string' ? data.subtask_id : undefined;
        emitProgress({
          phase: mappedPhase || currentPhase,
          message: content,
          currentSubtask: subtaskId,
          increment: 2
        });
        return;
      }

      if (markerType === 'TOOL_START' || markerType === 'TOOL_END') {
        const toolName = typeof data.name === 'string' ? data.name : 'tool';
        emitProgress({
          message: `Tool: ${toolName}`,
          increment: 1
        });
        return;
      }

      if (markerType === 'SUBPHASE_START') {
        const subphase = typeof data.subphase === 'string' ? data.subphase : 'subphase';
        emitProgress({
          message: `Starting ${subphase}`,
          increment: 2
        });
        return;
      }
    };

    const processLogChunk = (log: string, source: 'stdout' | 'stderr'): string => {
      // Collect output for rate limit detection (keep last 10KB)
      allOutput = (allOutput + log).slice(-10000);

      const buffer = source === 'stdout' ? stdoutBuffer : stderrBuffer;
      const combined = buffer + log;
      const hasNewline = combined.includes('\n');
      const lines = combined.split('\n');
      let remainder = lines.pop() ?? '';

      const cleanedLines: string[] = [];

      const processLine = (line: string): void => {
        const trimmed = line.trim();
        if (!trimmed) {
          cleanedLines.push(line);
          return;
        }

        const marker = this.events.parseTaskLogMarker(trimmed);
        if (marker) {
          handleTaskLogMarker(marker.markerType, marker.data);
          return;
        }

        cleanedLines.push(line);

        // Parse for phase transitions using legacy heuristics
        const phaseUpdate = this.events.parseExecutionPhase(trimmed, currentPhase, isSpecRunner);
        if (phaseUpdate) {
          const phaseChanged = phaseUpdate.phase !== currentPhase;
          emitProgress({
            phase: phaseUpdate.phase,
            currentSubtask: phaseUpdate.currentSubtask,
            message: phaseUpdate.message,
            phaseProgress: phaseChanged ? 10 : undefined,
            increment: phaseChanged ? undefined : 5
          });
        }
      };

      for (const line of lines) {
        processLine(line);
      }

      if (!hasNewline && remainder) {
        const trimmed = remainder.trim();
        if (!trimmed) {
          remainder = '';
        } else {
          const marker = this.events.parseTaskLogMarker(trimmed);
          if (marker) {
            handleTaskLogMarker(marker.markerType, marker.data);
            remainder = '';
          } else if (!trimmed.startsWith('__TASK_LOG_')) {
            processLine(remainder);
            remainder = '';
          }
        }
      }

      if (source === 'stdout') {
        stdoutBuffer = remainder;
      } else {
        stderrBuffer = remainder;
      }

      return cleanedLines.join('\n');
    };

    // Handle stdout - explicitly decode as UTF-8 for cross-platform Unicode support
    childProcess.stdout?.on('data', (data: Buffer) => {
      const log = data.toString('utf8');
      const cleaned = processLogChunk(log, 'stdout');
      if (cleaned.trim()) {
        this.emitter.emit('log', taskId, cleaned);
      }
      // Print to console when DEBUG is enabled (visible in pnpm dev terminal)
      if (['true', '1', 'yes', 'on'].includes(process.env.DEBUG?.toLowerCase() ?? '')) {
        console.warn(`[Agent:${taskId}] ${cleaned.trim()}`);
      }
    });

    // Handle stderr - explicitly decode as UTF-8 for cross-platform Unicode support
    childProcess.stderr?.on('data', (data: Buffer) => {
      const log = data.toString('utf8');
      // Some Python output goes to stderr (like progress bars)
      // so we treat it as log, not error
      const cleaned = processLogChunk(log, 'stderr');
      if (cleaned.trim()) {
        this.emitter.emit('log', taskId, cleaned);
      }
      // Print to console when DEBUG is enabled (visible in pnpm dev terminal)
      if (['true', '1', 'yes', 'on'].includes(process.env.DEBUG?.toLowerCase() ?? '')) {
        console.warn(`[Agent:${taskId}] ${cleaned.trim()}`);
      }
    });

    // Handle process exit
    childProcess.on('exit', (code: number | null) => {
      this.state.deleteProcess(taskId);

      // Check if this specific spawn was killed (vs exited naturally)
      // If killed, don't emit exit event to prevent race condition with new process
      if (this.state.wasSpawnKilled(spawnId)) {
        this.state.clearKilledSpawn(spawnId);
        return;
      }

      // Flush any buffered stdout/stderr lines that didn't end with a newline
      if (stdoutBuffer) {
        const cleaned = processLogChunk('\n', 'stdout');
        if (cleaned.trim()) {
          this.emitter.emit('log', taskId, cleaned);
        }
      }
      if (stderrBuffer) {
        const cleaned = processLogChunk('\n', 'stderr');
        if (cleaned.trim()) {
          this.emitter.emit('log', taskId, cleaned);
        }
      }

      // Check for rate limit if process failed
      if (code !== 0) {
        const rateLimitDetection = detectRateLimit(allOutput);
        if (rateLimitDetection.isRateLimited) {
          // Check if auto-swap is enabled
          const profileManager = getCodexProfileManager();
          const autoSwitchSettings = profileManager.getAutoSwitchSettings();

          if (autoSwitchSettings.enabled && autoSwitchSettings.autoSwitchOnRateLimit) {
            const currentProfileId = rateLimitDetection.profileId;
            const bestProfile = profileManager.getBestAvailableProfile(currentProfileId);

            if (bestProfile) {
              // Switch active profile
              profileManager.setActiveProfile(bestProfile.id);

              // Emit swap info (for modal)
              const source = processType === 'spec-creation' ? 'task' : 'task';
              const rateLimitInfo = createSDKRateLimitInfo(source, rateLimitDetection, {
                taskId
              });
              rateLimitInfo.wasAutoSwapped = true;
              rateLimitInfo.swappedToProfile = {
                id: bestProfile.id,
                name: bestProfile.name
              };
              rateLimitInfo.swapReason = 'reactive';
              this.emitter.emit('sdk-rate-limit', rateLimitInfo);

              // Restart task
              this.emitter.emit('auto-swap-restart-task', taskId, bestProfile.id);
              return;
            }
          }

          // Fall back to manual modal (no auto-swap or no alternative profile)
          const source = processType === 'spec-creation' ? 'task' : 'task';
          const rateLimitInfo = createSDKRateLimitInfo(source, rateLimitDetection, {
            taskId
          });
          this.emitter.emit('sdk-rate-limit', rateLimitInfo);
        } else {
          // Not rate limited - check for authentication failure
          const authFailureDetection = detectAuthFailure(allOutput);
          if (authFailureDetection.isAuthFailure) {
            this.emitter.emit('auth-failure', taskId, {
              profileId: authFailureDetection.profileId,
              failureType: authFailureDetection.failureType,
              message: authFailureDetection.message,
              originalError: authFailureDetection.originalError
            });
          }
        }
      }

      // Emit final progress
      const finalPhase = code === 0 ? 'complete' : 'failed';
      this.emitter.emit('execution-progress', taskId, {
        phase: finalPhase,
        phaseProgress: 100,
        overallProgress: code === 0 ? 100 : this.events.calculateOverallProgress(currentPhase, phaseProgress),
        message: code === 0 ? 'Process completed successfully' : `Process exited with code ${code}`
      });

      this.emitter.emit('exit', taskId, code, processType);
    });

    // Handle process error
    childProcess.on('error', (err: Error) => {
      console.error('[AgentProcess] Process error:', err.message);
      this.state.deleteProcess(taskId);

      this.emitter.emit('execution-progress', taskId, {
        phase: 'failed',
        phaseProgress: 0,
        overallProgress: 0,
        message: `Error: ${err.message}`
      });

      this.emitter.emit('error', taskId, err.message);
    });
  }

  /**
   * Kill a specific task's process
   */
  killProcess(taskId: string): boolean {
    const agentProcess = this.state.getProcess(taskId);
    if (agentProcess) {
      try {
        // Mark this specific spawn as killed so its exit handler knows to ignore
        this.state.markSpawnAsKilled(agentProcess.spawnId);

        // Send SIGTERM first for graceful shutdown
        agentProcess.process.kill('SIGTERM');

        // Force kill after timeout
        setTimeout(() => {
          if (!agentProcess.process.killed) {
            agentProcess.process.kill('SIGKILL');
          }
        }, 5000);

        this.state.deleteProcess(taskId);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Kill all running processes
   */
  async killAllProcesses(): Promise<void> {
    const killPromises = this.state.getRunningTaskIds().map((taskId) => {
      return new Promise<void>((resolve) => {
        this.killProcess(taskId);
        resolve();
      });
    });
    await Promise.all(killPromises);
  }

  /**
   * Get combined environment variables for a project
   */
  getCombinedEnv(projectPath: string): Record<string, string> {
    const autoBuildEnv = this.loadAutoBuildEnv();
    const projectEnv = this.getProjectEnvVars(projectPath);
    return { ...autoBuildEnv, ...projectEnv };
  }
}
