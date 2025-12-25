import { ipcRenderer } from "electron";
import type { IPCResult } from "../../../shared/types";

/**
 * Utility type for IPC event listener cleanup function
 */
export type IpcListenerCleanup = () => void;

/**
 * Creates a typed IPC event listener with automatic cleanup
 *
 * @param channel - The IPC channel to listen on
 * @param callback - The callback function to execute when event is received
 * @returns Cleanup function to remove the listener
 */
export function createIpcListener<T extends unknown[]>(
  channel: string,
  callback: (...args: T) => void,
): IpcListenerCleanup {
  const handler = (_event: Electron.IpcRendererEvent, ...args: T): void => {
    callback(...args);
  };
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

/**
 * Invokes an IPC method with typed return value
 *
 * @param channel - The IPC channel to invoke
 * @param args - Arguments to pass to the IPC handler
 * @returns Promise with the typed result
 */
export function invokeIpc<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args);
}

const isIpcResult = (value: unknown): value is IPCResult => {
  return !!value && typeof value === "object" && "success" in value;
};

const normalizeIpcResult = <T>(
  result: IPCResult<T>,
  channel: string,
): IPCResult<T> => {
  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: result.error || "IPC request failed",
    errorCode: result.errorCode || "ipc_error",
    errorDetails: result.errorDetails ?? { channel },
  };
};

const buildIpcError = <T>(channel: string, error: unknown): IPCResult<T> => {
  const message = error instanceof Error ? error.message : "IPC invoke failed";
  return {
    success: false,
    error: message,
    errorCode: "ipc_invoke_failed",
    errorDetails: { channel },
  };
};

export async function invokeIpcResult<T>(
  channel: string,
  ...args: unknown[]
): Promise<IPCResult<T>> {
  try {
    const result = await ipcRenderer.invoke(channel, ...args);
    if (isIpcResult(result)) {
      return normalizeIpcResult(result as IPCResult<T>, channel);
    }
    return {
      success: false,
      error: "Invalid IPC response",
      errorCode: "invalid_ipc_response",
      errorDetails: { channel },
    };
  } catch (error) {
    return buildIpcError(channel, error);
  }
}

/**
 * Sends an IPC message without expecting a response
 *
 * @param channel - The IPC channel to send to
 * @param args - Arguments to pass to the IPC handler
 */
export function sendIpc(channel: string, ...args: unknown[]): void {
  ipcRenderer.send(channel, ...args);
}
