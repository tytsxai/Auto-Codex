/**
 * Token Encryption Module
 * Handles OAuth token encryption/decryption using OS keychain
 */

import { safeStorage } from 'electron';

const allowInsecureTokenStorage = (): boolean => process.env.AUTO_CODEX_ALLOW_INSECURE_TOKEN_STORAGE === 'true';

/**
 * Encrypt a token using the OS keychain (safeStorage API).
 * Returns base64-encoded encrypted data, or the raw token if encryption unavailable.
 */
export function encryptToken(token: string): string {
  const allowInsecure = allowInsecureTokenStorage();
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token);
      // Prefix with 'enc:' to identify encrypted tokens
      return 'enc:' + encrypted.toString('base64');
    }
    if (allowInsecure) {
      console.warn('[TokenEncryption] Encryption unavailable, storing token as-is (AUTO_CODEX_ALLOW_INSECURE_TOKEN_STORAGE=true).');
      return token;
    }
    console.error('[TokenEncryption] Secure storage unavailable; refusing to persist token.');
    return '';
  } catch (error) {
    if (allowInsecure) {
      console.warn('[TokenEncryption] Encryption failed, storing token as-is (AUTO_CODEX_ALLOW_INSECURE_TOKEN_STORAGE=true):', error);
      return token;
    }
    console.error('[TokenEncryption] Encryption failed; refusing to persist token:', error);
    return '';
  }
}

/**
 * Decrypt a token. Handles both encrypted (enc:...) and legacy plain tokens.
 */
export function decryptToken(storedToken: string): string {
  const allowInsecure = allowInsecureTokenStorage();
  try {
    if (storedToken.startsWith('enc:') && safeStorage.isEncryptionAvailable()) {
      const encryptedData = Buffer.from(storedToken.slice(4), 'base64');
      return safeStorage.decryptString(encryptedData);
    }
  } catch (error) {
    console.error('[TokenEncryption] Failed to decrypt token:', error);
    return ''; // Return empty string on decryption failure
  }
  if (!safeStorage.isEncryptionAvailable() && !allowInsecure) {
    console.warn('[TokenEncryption] Secure storage unavailable; refusing to use plaintext token.');
    return '';
  }
  // Return as-is for legacy unencrypted tokens
  return storedToken;
}

/**
 * Check if a token is encrypted
 */
export function isTokenEncrypted(storedToken: string): boolean {
  return storedToken.startsWith('enc:');
}

export function isInsecureTokenStorageAllowed(): boolean {
  return allowInsecureTokenStorage();
}
