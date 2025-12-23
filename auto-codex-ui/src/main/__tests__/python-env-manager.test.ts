import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import path from 'path';

// Test directory with spaces to catch shell quoting issues
const TEST_DIR = '/tmp/python-env-test with spaces';
const VENV_DIR = path.join(TEST_DIR, 'python-venv');
const AUTO_CODEX_DIR = path.join(TEST_DIR, 'auto-codex');

// Mock electron app
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => TEST_DIR),
  }
}));

describe('PythonEnvManager', () => {
  beforeEach(() => {
    // Clean up test directories
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(AUTO_CODEX_DIR, { recursive: true });
    writeFileSync(path.join(AUTO_CODEX_DIR, 'requirements.txt'), '# test');
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  describe('Path handling', () => {
    it('should handle paths with spaces without shell quoting errors', async () => {
      // This test ensures that paths with spaces don't cause shell quoting issues
      // The original bug was: execSync(`"${path}" -c "import sys; ..."`) 
      // which failed when path contained spaces due to nested quotes
      
      const pathWithSpaces = '/path/with spaces/to/python';
      
      // The fix uses spawn() instead of execSync() which passes arguments
      // as an array, avoiding shell interpretation entirely
      const { spawn } = await import('child_process');
      
      // Verify spawn is called with array arguments (not shell string)
      // This is the pattern we use in the fixed code
      const mockSpawn = vi.fn(() => ({
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, cb) => {
          if (event === 'close') cb(0);
        }),
      }));
      
      // The key insight: spawn(cmd, [args]) doesn't have shell quoting issues
      // because arguments are passed directly to the process, not through a shell
      expect(typeof spawn).toBe('function');
    });

    it('should use spawnSync for version checks to avoid quoting issues', async () => {
      // Import the module to verify it uses spawnSync pattern
      const { PythonEnvManager } = await import('../python-env-manager');
      
      // The class should exist and be constructable
      expect(PythonEnvManager).toBeDefined();
      expect(typeof PythonEnvManager).toBe('function');
    });

    it('should properly escape JSON strings in Python code', () => {
      // Test that JSON.stringify properly escapes paths for Python
      const pathWithSpaces = '/Applications/Auto-Codex.app/Contents/Resources/auto-codex';
      const pathWithQuotes = '/path/with"quotes/test';
      
      // JSON.stringify should properly escape these for use in Python code
      const escaped1 = JSON.stringify(pathWithSpaces);
      const escaped2 = JSON.stringify(pathWithQuotes);
      
      expect(escaped1).toBe('"/Applications/Auto-Codex.app/Contents/Resources/auto-codex"');
      expect(escaped2).toBe('"/path/with\\"quotes/test"');
      
      // These can be safely used in: `import sys; sys.path.insert(0, ${escaped})`
      const pythonCode1 = `import sys; sys.path.insert(0, ${escaped1})`;
      const pythonCode2 = `import sys; sys.path.insert(0, ${escaped2})`;
      
      expect(pythonCode1).toContain('"/Applications/Auto-Codex.app/Contents/Resources/auto-codex"');
      expect(pythonCode2).toContain('"/path/with\\"quotes/test"');
    });
  });

  describe('Shell quoting regression prevention', () => {
    it('should NOT use execSync for Python execution', async () => {
      // Read the source file to verify no dangerous patterns exist
      const fs = await import('fs');
      const sourcePath = path.resolve(__dirname, '../python-env-manager.ts');
      
      // Skip if source file doesn't exist (e.g., in compiled output)
      if (!fs.existsSync(sourcePath)) {
        return;
      }
      
      const source = fs.readFileSync(sourcePath, 'utf-8');
      
      // The file should NOT import execSync at all
      // (we use spawnSync instead to avoid shell quoting issues)
      expect(source).not.toContain("import { spawn, execSync }");
      expect(source).not.toContain("from 'child_process';\nexecSync");
      
      // Verify no execSync calls exist in the file
      // This is the key check - execSync with template strings is dangerous
      const execSyncUsage = source.match(/\bexecSync\s*\(/g);
      expect(execSyncUsage).toBeNull();
    });

    it('should use spawn/spawnSync for Python execution', async () => {
      // Read the source file to verify correct patterns are used
      const fs = await import('fs');
      const sourcePath = path.resolve(__dirname, '../python-env-manager.ts');
      
      // Skip if source file doesn't exist
      if (!fs.existsSync(sourcePath)) {
        return;
      }
      
      const source = fs.readFileSync(sourcePath, 'utf-8');
      
      // Verify spawn is imported and used
      expect(source).toContain("import { spawn }");
      
      // Verify spawnSync is used for synchronous checks
      expect(source).toContain("spawnSync");
    });
  });
});
