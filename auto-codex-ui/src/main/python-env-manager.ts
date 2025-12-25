import { spawn } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { app } from 'electron';

export interface PythonEnvStatus {
  ready: boolean;
  pythonPath: string | null;
  venvExists: boolean;
  depsInstalled: boolean;
  error?: string;
}

/**
 * Manages the Python virtual environment for the auto-codex backend.
 * Automatically creates venv and installs dependencies if needed.
 */
export class PythonEnvManager extends EventEmitter {
  private autoBuildSourcePath: string | null = null;
  private pythonPath: string | null = null;
  private isInitializing = false;
  private isReady = false;

  /**
   * Return the directory where the venv should live.
   *
   * In packaged apps, the bundled `auto-codex` source is inside the app bundle
   * (often read-only / not safe to mutate). Use a userData location instead.
   */
  private getVenvDir(): string | null {
    if (!this.autoBuildSourcePath) return null;

    const sourcePath = path.resolve(this.autoBuildSourcePath);
    if (app.isPackaged) {
      const resourcesPath = path.resolve(process.resourcesPath);
      if (sourcePath.startsWith(resourcesPath + path.sep)) {
        return path.join(app.getPath('userData'), 'python-venv');
      }
    }

    return path.join(this.autoBuildSourcePath, '.venv');
  }

  /**
   * Get the path to the venv Python executable
   */
  private getVenvPythonPath(): string | null {
    const venvDir = this.getVenvDir();
    if (!venvDir) return null;

    const venvPython =
      process.platform === 'win32'
        ? path.join(venvDir, 'Scripts', 'python.exe')
        : path.join(venvDir, 'bin', 'python');

    return venvPython;
  }

  /**
   * Get the path to pip in the venv
   * Returns null - we use python -m pip instead for better compatibility
   * @deprecated Use getVenvPythonPath() with -m pip instead
   */
  private getVenvPipPath(): string | null {
    return null; // Not used - we use python -m pip
  }

  /**
   * Check if venv exists and is functional
   */
  private venvExists(): boolean {
    const venvPython = this.getVenvPythonPath();
    return venvPython ? existsSync(venvPython) : false;
  }

  /**
   * Check if venv is corrupted (exists but doesn't work)
   * Uses spawnSync to avoid shell quoting issues with paths containing spaces
   */
  private isVenvCorrupted(): boolean {
    const venvPython = this.getVenvPythonPath();
    if (!venvPython || !existsSync(venvPython)) return false;

    try {
      const { spawnSync } = require('child_process');
      const result = spawnSync(venvPython, ['--version'], {
        stdio: 'pipe',
        timeout: 5000
      });

      if (result.error || result.status !== 0) {
        console.warn('[PythonEnvManager] Venv appears corrupted');
        return true;
      }

      const version = result.stdout?.toString() || '';
      // Auto-Codex backend requires Python 3.10+ (uses modern typing features).
      const match = version.match(/Python\s+(\d+)\.(\d+)(?:\.(\d+))?/i);
      if (match) {
        const major = parseInt(match[1], 10);
        const minor = parseInt(match[2], 10);
        if (major < 3 || (major === 3 && minor < 10)) {
          console.warn('[PythonEnvManager] Venv Python too old:', version.trim());
          return true;
        }
      }
      return false;
    } catch {
      console.warn('[PythonEnvManager] Venv appears corrupted');
      return true;
    }
  }

  /**
   * Remove corrupted venv directory
   */
  private async removeCorruptedVenv(): Promise<boolean> {
    const venvPath = this.getVenvDir();
    if (!venvPath) return false;
    if (!existsSync(venvPath)) return true;

    this.emit('status', 'Removing corrupted virtual environment...');
    console.warn('[PythonEnvManager] Removing corrupted venv at:', venvPath);

    try {
      const { rm } = await import('fs/promises');
      await rm(venvPath, { recursive: true, force: true });
      console.warn('[PythonEnvManager] Corrupted venv removed');
      return true;
    } catch (err) {
      console.error('[PythonEnvManager] Failed to remove venv:', err);
      return false;
    }
  }

  /**
   * Check if codex-agent-sdk is installed
   * Uses spawnSync to avoid shell quoting issues with paths containing spaces
   */
  private async checkDepsInstalled(): Promise<boolean> {
    const venvPython = this.getVenvPythonPath();
    if (!venvPython || !existsSync(venvPython)) return false;

    try {
      const { spawnSync } = require('child_process');
      // Check if required runtime deps can be imported.
      // `python-dotenv` is required by all runners (insights/roadmap/ideation).
      const result = spawnSync(venvPython, ['-c', 'import dotenv'], {
        stdio: 'pipe',
        timeout: 10000
      });
      return result.status === 0;
    } catch {
      return false;
    }
  }

  /**
   * Find system Python3
   * Uses spawnSync to avoid shell quoting issues
   */
  private findSystemPython(): string | null {
    const { spawnSync } = require('child_process');
    const isWindows = process.platform === 'win32';

    const isUsablePython = (versionText: string): boolean => {
      const match = versionText.match(/Python\s+(\d+)\.(\d+)(?:\.(\d+))?/i);
      if (!match) return false;
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      return major === 3 && minor >= 10;
    };

    // Windows candidates - py launcher is handled specially
    // Unix candidates - prefer modern python3.x explicitly
    const unixCandidates = [
      'python3.13',
      'python3.12',
      'python3.11',
      'python3.10',
      '/opt/homebrew/bin/python3.13',
      '/opt/homebrew/bin/python3.12',
      '/opt/homebrew/bin/python3.11',
      '/opt/homebrew/bin/python3.10',
      '/opt/homebrew/bin/python3',
      '/usr/local/bin/python3.13',
      '/usr/local/bin/python3.12',
      '/usr/local/bin/python3.11',
      '/usr/local/bin/python3.10',
      '/usr/local/bin/python3',
      '/usr/bin/python3',
      'python3',
      'python'
    ];

    const candidates = isWindows ? ['python', 'python3'] : unixCandidates;

    // On Windows, try the py launcher first (most reliable)
    if (isWindows) {
      try {
        // py -3 runs Python 3, verify it works
        const versionResult = spawnSync('py', ['-3', '--version'], {
          stdio: 'pipe',
          timeout: 5000
        });
        if (versionResult.status === 0) {
          const version = versionResult.stdout?.toString() || '';
          if (isUsablePython(version)) {
            // Get the actual executable path
            const pathResult = spawnSync('py', ['-3', '-c', 'import sys; print(sys.executable)'], {
              stdio: 'pipe',
              timeout: 5000
            });
            if (pathResult.status === 0) {
              return pathResult.stdout?.toString().trim() || null;
            }
          }
        }
      } catch {
        // py launcher not available, continue with other candidates
      }
    }

    for (const cmd of candidates) {
      try {
        // Skip missing absolute paths
        if (cmd.startsWith('/') && !existsSync(cmd)) {
          continue;
        }

        const versionResult = spawnSync(cmd, ['--version'], {
          stdio: 'pipe',
          timeout: 5000
        });

        if (versionResult.status !== 0) continue;

        const version = versionResult.stdout?.toString() || '';
        if (isUsablePython(version)) {
          // Absolute paths don't need resolution
          if (cmd.startsWith('/')) {
            return cmd;
          }

          // On Windows, use Python itself to get the path
          if (isWindows) {
            const pathResult = spawnSync(cmd, ['-c', 'import sys; print(sys.executable)'], {
              stdio: 'pipe',
              timeout: 5000
            });
            if (pathResult.status === 0) {
              return pathResult.stdout?.toString().trim() || null;
            }
            continue;
          }

          // On Unix, use 'which' to resolve the path
          const whichResult = spawnSync('which', [cmd], {
            stdio: 'pipe',
            timeout: 5000
          });
          if (whichResult.status === 0) {
            return whichResult.stdout?.toString().trim() || null;
          }
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  /**
   * Create the virtual environment
   */
  private async createVenv(): Promise<boolean> {
    const venvPath = this.getVenvDir();
    if (!this.autoBuildSourcePath || !venvPath) return false;

    const systemPython = this.findSystemPython();
    if (!systemPython) {
      this.emit('error', 'Python 3.10+ not found. Please install Python 3.10+ (recommended: 3.12+)');
      return false;
    }

    this.emit('status', 'Creating Python virtual environment...');
    console.warn('[PythonEnvManager] Creating venv with:', systemPython);

    return new Promise((resolve) => {
      const proc = spawn(systemPython, ['-m', 'venv', venvPath], {
        cwd: this.autoBuildSourcePath!,
        stdio: 'pipe'
      });

      let stderr = '';
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          console.warn('[PythonEnvManager] Venv created successfully');
          resolve(true);
        } else {
          console.error('[PythonEnvManager] Failed to create venv:', stderr);
          this.emit('error', `Failed to create virtual environment: ${stderr}`);
          resolve(false);
        }
      });

      proc.on('error', (err) => {
        console.error('[PythonEnvManager] Error creating venv:', err);
        this.emit('error', `Failed to create virtual environment: ${err.message}`);
        resolve(false);
      });
    });
  }

  /**
   * Bootstrap pip in the venv using ensurepip
   */
  private async bootstrapPip(): Promise<boolean> {
    const venvPython = this.getVenvPythonPath();
    if (!venvPython || !existsSync(venvPython)) {
      return false;
    }

    console.warn('[PythonEnvManager] Bootstrapping pip...');
    return new Promise((resolve) => {
      const proc = spawn(venvPython, ['-m', 'ensurepip'], {
        cwd: this.autoBuildSourcePath!,
        stdio: 'pipe'
      });

      let stderr = '';
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          console.warn('[PythonEnvManager] Pip bootstrapped successfully');
          resolve(true);
        } else {
          console.error('[PythonEnvManager] Failed to bootstrap pip:', stderr);
          resolve(false);
        }
      });

      proc.on('error', (err) => {
        console.error('[PythonEnvManager] Error bootstrapping pip:', err);
        resolve(false);
      });
    });
  }

  private getPythonVersionInfo(pythonPath: string): { major: number; minor: number; version: string } | null {
    try {
      const { spawnSync } = require('child_process');
      const result = spawnSync(pythonPath, ['--version'], {
        stdio: 'pipe',
        timeout: 5000
      });

      if (result.error || result.status !== 0) {
        return null;
      }

      const output = (result.stdout?.toString() || result.stderr?.toString() || '').trim();
      const match = output.match(/Python\s+(\d+)\.(\d+)(?:\.(\d+))?/i);
      if (!match) {
        return null;
      }

      return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        version: output
      };
    } catch {
      return null;
    }
  }

  private selectRequirementsFile(pythonPath: string): {
    path: string;
    source: 'lock' | 'requirements';
    label: string;
    pythonVersion?: string;
  } | null {
    if (!this.autoBuildSourcePath) return null;

    const requirementsPath = path.join(this.autoBuildSourcePath, 'requirements.txt');
    const versionInfo = this.getPythonVersionInfo(pythonPath);

    if (versionInfo) {
      const lockName = `requirements-py${versionInfo.major}${versionInfo.minor}.lock`;
      const lockPath = path.join(this.autoBuildSourcePath, lockName);

      if (existsSync(lockPath)) {
        return {
          path: lockPath,
          source: 'lock',
          label: lockName,
          pythonVersion: versionInfo.version
        };
      }

      console.warn(`[PythonEnvManager] Lockfile ${lockName} not found; falling back to requirements.txt`);
    }

    if (existsSync(requirementsPath)) {
      return {
        path: requirementsPath,
        source: 'requirements',
        label: 'requirements.txt',
        pythonVersion: versionInfo?.version
      };
    }

    return null;
  }

  private recordDependencyInstall(selection: {
    path: string;
    source: 'lock' | 'requirements';
    label: string;
    pythonVersion?: string;
  }): void {
    const venvDir = this.getVenvDir();
    if (!venvDir) return;

    const record = {
      installedAt: new Date().toISOString(),
      pythonVersion: selection.pythonVersion || 'unknown',
      requirementsFile: selection.label,
      requirementsPath: selection.path,
      source: selection.source
    };

    try {
      writeFileSync(path.join(venvDir, '.auto-codex-deps.json'), JSON.stringify(record, null, 2));
    } catch (err) {
      console.warn('[PythonEnvManager] Failed to write dependency record:', err);
    }
  }

  /**
   * Install dependencies from requirements.txt using python -m pip
   */
  private async installDeps(): Promise<boolean> {
    if (!this.autoBuildSourcePath) return false;

    const venvPython = this.getVenvPythonPath();
    const selection = venvPython ? this.selectRequirementsFile(venvPython) : null;

    if (!venvPython || !existsSync(venvPython)) {
      this.emit('error', 'Python not found in virtual environment');
      return false;
    }

    if (!selection) {
      this.emit('error', 'Requirements file not found');
      return false;
    }

    // Bootstrap pip first if needed
    await this.bootstrapPip();

    this.emit('status', `Installing Python dependencies from ${selection.label} (this may take a minute)...`);
    console.warn('[PythonEnvManager] Installing dependencies from:', selection.path);

    return new Promise((resolve) => {
      // Use python -m pip for better compatibility across Python versions
      const proc = spawn(venvPython, ['-m', 'pip', 'install', '-r', selection.path], {
        cwd: this.autoBuildSourcePath!,
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
        // Emit progress updates for long-running installations
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.includes('Installing') || line.includes('Successfully')) {
            this.emit('status', line.trim());
          }
        }
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          console.warn('[PythonEnvManager] Dependencies installed successfully');
          this.emit('status', 'Dependencies installed successfully');
          this.recordDependencyInstall(selection);
          resolve(true);
        } else {
          console.error('[PythonEnvManager] Failed to install deps:', stderr || stdout);
          this.emit('error', `Failed to install dependencies: ${stderr || stdout}`);
          resolve(false);
        }
      });

      proc.on('error', (err) => {
        console.error('[PythonEnvManager] Error installing deps:', err);
        this.emit('error', `Failed to install dependencies: ${err.message}`);
        resolve(false);
      });
    });
  }

  /**
   * Preflight check to ensure the backend can actually start under this venv.
   * This catches common regressions:
   * - Python < 3.10 (auto-codex uses modern typing syntax)
   * - Missing required imports after dependency installation
   */
  private async runBackendPreflight(): Promise<{ ok: boolean; error?: string }> {
    const venvPython = this.getVenvPythonPath();
    if (!venvPython || !existsSync(venvPython) || !this.autoBuildSourcePath) {
      return { ok: false, error: 'Python environment not found' };
    }

    // Use spawn instead of execSync to avoid shell quoting issues
    return new Promise((resolve) => {
      const pythonCode = `import sys; sys.path.insert(0, ${JSON.stringify(this.autoBuildSourcePath)}); import dotenv; import core.auth`;
      const proc = spawn(venvPython, ['-c', pythonCode], {
        cwd: this.autoBuildSourcePath!,
        stdio: 'pipe',
        timeout: 15000
      });

      let stderr = '';
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ ok: true });
        } else {
          resolve({ ok: false, error: stderr || `Exit code ${code}` });
        }
      });

      proc.on('error', (err) => {
        resolve({ ok: false, error: err.message });
      });
    });
  }

  /**
   * Initialize the Python environment.
   * Creates venv and installs deps if needed.
   */
  async initialize(autoBuildSourcePath: string): Promise<PythonEnvStatus> {
    if (this.isInitializing) {
      return {
        ready: false,
        pythonPath: null,
        venvExists: false,
        depsInstalled: false,
        error: 'Already initializing'
      };
    }

    this.isInitializing = true;
    this.autoBuildSourcePath = autoBuildSourcePath;

    console.warn('[PythonEnvManager] Initializing with path:', autoBuildSourcePath);

    try {
      // Check if venv is corrupted and needs rebuild
      if (this.venvExists() && this.isVenvCorrupted()) {
        console.warn('[PythonEnvManager] Venv corrupted, rebuilding...');
        this.emit('status', 'Detected corrupted environment, rebuilding...');
        const removed = await this.removeCorruptedVenv();
        if (!removed) {
          this.emit('error', 'Failed to remove corrupted virtual environment');
          this.isInitializing = false;
          return {
            ready: false,
            pythonPath: null,
            venvExists: this.venvExists(),
            depsInstalled: false,
            error: 'Failed to remove corrupted virtual environment'
          };
        }
      }

      // Check if venv exists
      if (!this.venvExists()) {
        console.warn('[PythonEnvManager] Venv not found, creating...');
        const created = await this.createVenv();
        if (!created) {
          this.isInitializing = false;
          return {
            ready: false,
            pythonPath: null,
            venvExists: false,
            depsInstalled: false,
            error: 'Failed to create virtual environment'
          };
        }
      } else {
        console.warn('[PythonEnvManager] Venv already exists');
      }

      // Check if deps are installed
      const depsInstalled = await this.checkDepsInstalled();
      if (!depsInstalled) {
        console.warn('[PythonEnvManager] Dependencies not installed, installing...');
        const installed = await this.installDeps();
        if (!installed) {
          this.isInitializing = false;
          return {
            ready: false,
            pythonPath: this.getVenvPythonPath(),
            venvExists: true,
            depsInstalled: false,
            error: 'Failed to install dependencies'
          };
        }
      } else {
        console.warn('[PythonEnvManager] Dependencies already installed');
      }

      this.pythonPath = this.getVenvPythonPath();
      this.isReady = true;
      this.isInitializing = false;

      // Final sanity check: ensure backend imports work (prevents "code 1" silent exits).
      const preflight = await this.runBackendPreflight();
      if (!preflight.ok) {
        this.isReady = false;
        const message = preflight.error || 'Backend preflight failed';
        console.error('[PythonEnvManager] Backend preflight failed:', message);
        this.emit('error', message);
        return {
          ready: false,
          pythonPath: this.pythonPath,
          venvExists: true,
          depsInstalled: true,
          error: message
        };
      }

      this.emit('ready', this.pythonPath);
      console.warn('[PythonEnvManager] Ready with Python path:', this.pythonPath);

      return {
        ready: true,
        pythonPath: this.pythonPath,
        venvExists: true,
        depsInstalled: true
      };
    } catch (error) {
      this.isInitializing = false;
      const message = error instanceof Error ? error.message : String(error);
      return {
        ready: false,
        pythonPath: null,
        venvExists: this.venvExists(),
        depsInstalled: false,
        error: message
      };
    }
  }

  /**
   * Get the Python path (only valid after initialization)
   */
  getPythonPath(): string | null {
    return this.pythonPath;
  }

  /**
   * Check if the environment is ready
   */
  isEnvReady(): boolean {
    return this.isReady;
  }

  /**
   * Get current status
   */
  async getStatus(): Promise<PythonEnvStatus> {
    const venvExists = this.venvExists();
    const depsInstalled = venvExists ? await this.checkDepsInstalled() : false;

    return {
      ready: this.isReady,
      pythonPath: this.pythonPath,
      venvExists,
      depsInstalled
    };
  }
}

// Singleton instance
export const pythonEnvManager = new PythonEnvManager();
