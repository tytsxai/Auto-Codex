import { IPC_CHANNELS } from "../../shared/constants";
import type { IPCResult } from "../../shared/types";
import { invokeIpcResult } from "./modules/ipc-utils";

export interface FileAPI {
  // File Explorer Operations
  listDirectory: (
    dirPath: string,
  ) => Promise<IPCResult<import("../../shared/types").FileNode[]>>;
}

export const createFileAPI = (): FileAPI => ({
  // File Explorer Operations
  listDirectory: (
    dirPath: string,
  ): Promise<IPCResult<import("../../shared/types").FileNode[]>> =>
    invokeIpcResult(IPC_CHANNELS.FILE_EXPLORER_LIST, dirPath),
});
