import { IPC_CHANNELS } from "../../shared/constants";
import type {
  AppSettings,
  AppProtocolInfo,
  IPCResult,
  SourceEnvConfig,
  SourceEnvCheckResult,
} from "../../shared/types";
import { invokeIpc, invokeIpcResult } from "./modules/ipc-utils";

export interface SettingsAPI {
  // App Settings
  getSettings: () => Promise<IPCResult<AppSettings>>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<IPCResult>;

  // App Info
  getAppVersion: () => Promise<string>;
  getProtocolInfo: () => Promise<IPCResult<AppProtocolInfo>>;

  // Auto-Build Source Environment
  getSourceEnv: () => Promise<IPCResult<SourceEnvConfig>>;
  updateSourceEnv: (config: { codexOAuthToken?: string }) => Promise<IPCResult>;
  checkSourceToken: () => Promise<IPCResult<SourceEnvCheckResult>>;
}

export const createSettingsAPI = (): SettingsAPI => ({
  // App Settings
  getSettings: (): Promise<IPCResult<AppSettings>> =>
    invokeIpcResult(IPC_CHANNELS.SETTINGS_GET),

  saveSettings: (settings: Partial<AppSettings>): Promise<IPCResult> =>
    invokeIpcResult(IPC_CHANNELS.SETTINGS_SAVE, settings),

  // App Info
  getAppVersion: (): Promise<string> => invokeIpc(IPC_CHANNELS.APP_VERSION),

  getProtocolInfo: (): Promise<IPCResult<AppProtocolInfo>> =>
    invokeIpcResult(IPC_CHANNELS.APP_PROTOCOL_INFO),

  // Auto-Build Source Environment
  getSourceEnv: (): Promise<IPCResult<SourceEnvConfig>> =>
    invokeIpcResult(IPC_CHANNELS.AUTOBUILD_SOURCE_ENV_GET),

  updateSourceEnv: (config: { codexOAuthToken?: string }): Promise<IPCResult> =>
    invokeIpcResult(IPC_CHANNELS.AUTOBUILD_SOURCE_ENV_UPDATE, config),

  checkSourceToken: (): Promise<IPCResult<SourceEnvCheckResult>> =>
    invokeIpcResult(IPC_CHANNELS.AUTOBUILD_SOURCE_ENV_CHECK_TOKEN),
});
