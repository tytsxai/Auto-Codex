/**
 * Common utility types shared across the application
 */

// IPC Types
export interface IPCResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  errorDetails?: unknown;
}

export interface AppProtocolInfo {
  version: number;
  minVersion: number;
}
