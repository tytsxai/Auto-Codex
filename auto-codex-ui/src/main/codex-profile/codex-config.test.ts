import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  buildProviderEnvFromConfig,
  getCredentialFromAuthJson,
  getProviderEnvInfoFromConfigToml,
  readAuthJson
} from './codex-config';

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'auto-codex-ui-codex-config-'));
}

describe('codex-config', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTempDir();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads provider env_key from config.toml', () => {
    writeFileSync(
      join(dir, 'config.toml'),
      [
        'model_provider = "yunyi"',
        '',
        '[model_providers.yunyi]',
        'env_key = "YUNYI_KEY"',
      ].join('\n')
    );

    expect(getProviderEnvInfoFromConfigToml(dir)).toEqual({
      provider: 'yunyi',
      envKey: 'YUNYI_KEY',
      preferredAuthMethod: undefined
    });
  });

  it('prefers env_key credential from auth.json when present', () => {
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

    const { envKey } = getProviderEnvInfoFromConfigToml(dir);
    const auth = readAuthJson(dir);
    expect(getCredentialFromAuthJson(auth, envKey)).toBe('DTFXFDZC_TEST_TOKEN_1234567890');
  });

  it('builds provider env override from auth.json if not already in env', () => {
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

    const providerEnv = buildProviderEnvFromConfig(dir, {});
    expect(providerEnv).toEqual({ YUNYI_KEY: 'DTFXFDZC_TEST_TOKEN_1234567890' });

    const alreadySet = buildProviderEnvFromConfig(dir, { YUNYI_KEY: 'already' });
    expect(alreadySet).toEqual({});
  });

  it('returns empty override if config dir is missing required files', () => {
    mkdirSync(dir, { recursive: true });
    expect(buildProviderEnvFromConfig(dir, {})).toEqual({});
  });
});
