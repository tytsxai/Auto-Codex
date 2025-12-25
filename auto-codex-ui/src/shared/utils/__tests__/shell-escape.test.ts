/**
 * Unit tests for shell escaping utilities
 */
import { describe, it, expect } from 'vitest';
import {
  escapeShellArg,
  escapeShellPath,
  buildCdCommand,
  escapeShellArgWindows,
  isPathSafe
} from '../shell-escape';

describe('escapeShellArg', () => {
  it('wraps simple strings in single quotes', () => {
    expect(escapeShellArg('hello')).toBe("'hello'");
  });

  it('handles empty strings', () => {
    expect(escapeShellArg('')).toBe("''");
  });

  it('preserves spaces and special characters', () => {
    const input = 'hello world $(rm -rf /)';
    expect(escapeShellArg(input)).toBe("'hello world $(rm -rf /)'");
  });

  it('escapes single quotes safely', () => {
    expect(escapeShellArg("it's fine")).toBe("'it'\\''s fine'");
  });

  it('preserves newlines inside the quoted string', () => {
    const input = 'line1\nline2';
    expect(escapeShellArg(input)).toBe("'line1\nline2'");
  });
});

describe('escapeShellPath', () => {
  it('delegates to escapeShellArg for paths', () => {
    const path = "/tmp/it's here";
    expect(escapeShellPath(path)).toBe("'/tmp/it'\\''s here'");
  });

  it('handles empty path strings', () => {
    expect(escapeShellPath('')).toBe("''");
  });
});

describe('buildCdCommand', () => {
  it('returns empty string when path is undefined', () => {
    expect(buildCdCommand(undefined)).toBe('');
  });

  it('returns empty string when path is empty', () => {
    expect(buildCdCommand('')).toBe('');
  });

  it('builds a safe cd command with escaped path', () => {
    const path = "./path with 'quotes'";
    expect(buildCdCommand(path)).toBe(`cd ${escapeShellPath(path)} && `);
  });

  it('preserves newlines in the escaped path', () => {
    const path = 'dir\nsubdir';
    expect(buildCdCommand(path)).toBe("cd 'dir\nsubdir' && ");
  });
});

describe('escapeShellArgWindows', () => {
  it('escapes cmd.exe special characters', () => {
    const input = '^"&|<>%';
    expect(escapeShellArgWindows(input)).toBe('^^^"^&^|^<^>%%');
  });

  it('leaves normal text unchanged', () => {
    expect(escapeShellArgWindows('plain-text_123')).toBe('plain-text_123');
  });

  it('handles empty strings', () => {
    expect(escapeShellArgWindows('')).toBe('');
  });

  it('preserves newlines', () => {
    const input = 'line1\nline2';
    expect(escapeShellArgWindows(input)).toBe('line1\nline2');
  });
});

describe('isPathSafe', () => {
  it('returns true for normal paths', () => {
    expect(isPathSafe('/Users/me/projects/app')).toBe(true);
    expect(isPathSafe('C:\\Users\\me\\app')).toBe(true);
  });

  it('returns true for empty strings', () => {
    expect(isPathSafe('')).toBe(true);
  });

  it('flags suspicious patterns', () => {
    expect(isPathSafe('$(rm -rf /)')).toBe(false);
    expect(isPathSafe('`whoami`')).toBe(false);
    expect(isPathSafe('path|more')).toBe(false);
    expect(isPathSafe('path; rm -rf /')).toBe(false);
    expect(isPathSafe('path && echo hi')).toBe(false);
    expect(isPathSafe('path || echo hi')).toBe(false);
    expect(isPathSafe('path > out.txt')).toBe(false);
    expect(isPathSafe('path < in.txt')).toBe(false);
    expect(isPathSafe('line1\nline2')).toBe(false);
    expect(isPathSafe('line1\rline2')).toBe(false);
  });
});
