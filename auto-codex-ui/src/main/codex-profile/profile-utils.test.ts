import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { CodexProfile } from '../../shared/types';
import { isProfileAuthenticated } from './profile-utils';

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'auto-codex-ui-profile-utils-'));
}

describe('profile-utils auth detection', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTempDir();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('treats provider env_key credential in auth.json as authenticated', () => {
    writeFileSync(
      join(dir, 'config.toml'),
      [
        'model_provider = "yunyi"',
        '',
        '[model_providers.yunyi]',
        'env_key = "YUNYI_KEY"',
      ].join('\n')
    );
    writeFileSync(join(dir, 'auth.json'), JSON.stringify({ YUNYI_KEY: 'DTFXFDZC_TEST_TOKEN_1234567890' }));

    const profile: CodexProfile = {
      id: 'p1',
      name: 'Test',
      configDir: dir,
      isDefault: false,
      createdAt: new Date()
    };

    expect(isProfileAuthenticated(profile)).toBe(true);
  });

  it('does not treat URL fields as credentials', () => {
    writeFileSync(join(dir, 'config.toml'), 'model_provider = "openai"');
    writeFileSync(join(dir, 'auth.json'), JSON.stringify({ api_base_url: 'https://example.com' }));

    const profile: CodexProfile = {
      id: 'p1',
      name: 'Test',
      configDir: dir,
      isDefault: false,
      createdAt: new Date()
    };

    expect(isProfileAuthenticated(profile)).toBe(false);
  });
});
