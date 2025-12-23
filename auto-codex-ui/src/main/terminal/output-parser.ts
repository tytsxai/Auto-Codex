/**
 * Output Parser Module
 * Handles parsing and pattern detection in terminal output
 */

/**
 * Regex patterns to capture Codex session ID from output
 */
const CODEX_SESSION_PATTERNS = [
  /Session(?:\s+ID)?:\s*([a-zA-Z0-9_-]+)/i,
  /session[_-]?id["\s:=]+([a-zA-Z0-9_-]+)/i,
  /Resuming session:\s*([a-zA-Z0-9_-]+)/i,
  /conversation[_-]?id["\s:=]+([a-zA-Z0-9_-]+)/i,
];

/**
 * Regex pattern to detect Codex CLI rate limit messages
 * Matches: "Limit reached · resets Dec 17 at 6am (Europe/Oslo)"
 */
const RATE_LIMIT_PATTERN = /Limit reached\s*[·•]\s*resets\s+(.+?)$/m;

/**
 * Regex pattern to capture OAuth token from Codex auth output
 */
const OAUTH_TOKEN_PATTERN = /(sk-ant-oat01-[A-Za-z0-9_-]+)/;

/**
 * Pattern to detect email in Codex output
 */
const EMAIL_PATTERN = /(?:Authenticated as|Logged in as|email[:\s]+)([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;

/**
 * Extract an OAuth authentication URL from output.
 * Used when Codex prints a fallback URL ("If your browser does not open, visit: ...").
 */
export function extractOAuthAuthUrl(data: string): string | null {
  const match = data.match(/https:\/\/[^\s]+/i);
  if (!match) return null;
  return match[0].replace(/[),.;\]]+$/g, '');
}

/**
 * Extract Codex session ID from output
 */
export function extractCodexSessionId(data: string): string | null {
  for (const pattern of CODEX_SESSION_PATTERNS) {
    const match = data.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Extract rate limit reset time from output
 */
export function extractRateLimitReset(data: string): string | null {
  const match = data.match(RATE_LIMIT_PATTERN);
  return match ? match[1].trim() : null;
}

/**
 * Extract OAuth token from output
 */
export function extractOAuthToken(data: string): string | null {
  const match = data.match(OAUTH_TOKEN_PATTERN);
  return match ? match[1] : null;
}

/**
 * Extract email from output
 */
export function extractEmail(data: string): string | null {
  const match = data.match(EMAIL_PATTERN);
  return match ? match[1] : null;
}

/**
 * Check if output contains a rate limit message
 */
export function hasRateLimitMessage(data: string): boolean {
  return RATE_LIMIT_PATTERN.test(data);
}

/**
 * Check if output contains an OAuth token
 */
export function hasOAuthToken(data: string): boolean {
  return OAUTH_TOKEN_PATTERN.test(data);
}
