import { shell } from 'electron';

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);

export function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

export async function safeOpenExternal(url: string): Promise<void> {
  if (!isSafeExternalUrl(url)) {
    console.warn('[safeOpenExternal] Blocked external URL:', url);
    return;
  }
  await shell.openExternal(url);
}
