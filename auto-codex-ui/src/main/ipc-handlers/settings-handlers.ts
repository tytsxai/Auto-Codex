import { ipcMain, dialog, app, safeStorage } from "electron";
import { existsSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import path from "path";
import { is } from "@electron-toolkit/utils";
import {
  APP_PROTOCOL_MIN_VERSION,
  APP_PROTOCOL_VERSION,
  IPC_CHANNELS,
} from "../../shared/constants";
import type {
  AppSettings,
  AppProtocolInfo,
  IPCResult,
} from "../../shared/types";
import { AgentManager } from "../agent";
import type { BrowserWindow } from "electron";
import { getEffectiveVersion } from "../auto-codex-updater";
import { atomicWriteFileSync } from "../utils/atomic-write";
import {
  loadSettingsWithDecryptedSecrets,
  prepareSettingsForSave,
  SENSITIVE_SETTINGS_FIELDS,
} from "../utils/secure-settings";
import { safeOpenExternal } from "../utils/safe-external";

const settingsPath = path.join(app.getPath("userData"), "settings.json");

const isValidAutoBuildSourcePath = (p: string): boolean => {
  if (!p) return false;
  if (!existsSync(p)) return false;
  // Prefer analyzer.py (used directly), fall back to requirements.txt marker.
  return (
    existsSync(path.join(p, "analyzer.py")) ||
    existsSync(path.join(p, "requirements.txt"))
  );
};

/**
 * Auto-detect the auto-codex source path relative to the app location.
 * Works across platforms (macOS, Windows, Linux) in both dev and production modes.
 */
const detectAutoBuildSourcePath = (): string | null => {
  const possiblePaths: string[] = [];

  // Development mode paths
  if (is.dev) {
    // In dev, __dirname is typically __AUTO_CODEX_UI__/out/main
    // We need to go up to the project root to find auto-codex/
    possiblePaths.push(
      path.resolve(__dirname, "..", "..", "..", "auto-codex"), // From out/main up 3 levels
      path.resolve(__dirname, "..", "..", "auto-codex"), // From out/main up 2 levels
      path.resolve(process.cwd(), "auto-codex"), // From cwd (project root)
      path.resolve(process.cwd(), "..", "auto-codex"), // From cwd parent (if running from __AUTO_CODEX_UI__/)
    );
  } else {
    // Production mode paths (packaged app)
    // On Windows/Linux/macOS, the app might be installed anywhere
    // We check common locations relative to the app bundle
    const appPath = app.getAppPath();
    possiblePaths.push(
      // electron-builder `extraResources` land inside `process.resourcesPath`
      path.join(process.resourcesPath, "auto-codex"),
      path.resolve(appPath, "..", "auto-codex"), // Sibling to app
      path.resolve(appPath, "..", "..", "auto-codex"), // Up 2 from app
      path.resolve(appPath, "..", "..", "..", "auto-codex"), // Up 3 from app
      path.resolve(process.resourcesPath, "..", "auto-codex"), // Relative to resources
      path.resolve(process.resourcesPath, "..", "..", "auto-codex"),
    );
  }

  // Add process.cwd() as last resort on all platforms
  possiblePaths.push(path.resolve(process.cwd(), "auto-codex"));

  // Enable debug logging with DEBUG=1
  const debug = process.env.DEBUG === "1" || process.env.DEBUG === "true";

  if (debug) {
    console.warn("[detectAutoBuildSourcePath] Platform:", process.platform);
    console.warn("[detectAutoBuildSourcePath] Is dev:", is.dev);
    console.warn("[detectAutoBuildSourcePath] __dirname:", __dirname);
    console.warn(
      "[detectAutoBuildSourcePath] app.getAppPath():",
      app.getAppPath(),
    );
    console.warn("[detectAutoBuildSourcePath] process.cwd():", process.cwd());
    console.warn("[detectAutoBuildSourcePath] Checking paths:", possiblePaths);
  }

  for (const p of possiblePaths) {
    const exists = isValidAutoBuildSourcePath(p);

    if (debug) {
      console.warn(
        `[detectAutoBuildSourcePath] Checking ${p}: ${exists ? "✓ FOUND" : "✗ not found"}`,
      );
    }

    if (exists) {
      console.warn(
        `[detectAutoBuildSourcePath] Auto-detected source path: ${p}`,
      );
      return p;
    }
  }

  console.warn(
    "[detectAutoBuildSourcePath] Could not auto-detect Auto Codex source path. Please configure manually in settings.",
  );
  console.warn(
    "[detectAutoBuildSourcePath] Set DEBUG=1 environment variable for detailed path checking.",
  );
  return null;
};

/**
 * Register all settings-related IPC handlers
 */
export function registerSettingsHandlers(
  agentManager: AgentManager,
  getMainWindow: () => BrowserWindow | null,
): void {
  // ============================================
  // Settings Operations
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_GET,
    async (): Promise<IPCResult<AppSettings>> => {
      const loadResult = loadSettingsWithDecryptedSecrets(settingsPath);
      let settings = loadResult.settings;
      let needsSave = false;
      const encryptionAvailable = safeStorage.isEncryptionAvailable();

      // Migration: collapse old model shorthands (opus/sonnet/haiku) to 'codex'
      const migrateModel = (value: unknown): "codex" | undefined => {
        if (value === "codex") return "codex";
        if (value === "opus" || value === "sonnet" || value === "haiku")
          return "codex";
        return undefined;
      };

      // Migration: normalize thinking level values to runtime reasoning effort names.
      // Valid values: none/low/medium/high/xhigh (legacy: ultrathink).
      const migrateThinkingLevel = (
        value: unknown,
      ): "none" | "low" | "medium" | "high" | "xhigh" | undefined => {
        if (typeof value !== "string") return undefined;
        const normalized = value.trim().toLowerCase();
        if (!normalized) return undefined;
        if (
          normalized === "ultrathink" ||
          normalized === "ultra" ||
          normalized === "ultra think" ||
          normalized === "uitra"
        ) {
          return "xhigh";
        }
        if (
          normalized === "none" ||
          normalized === "low" ||
          normalized === "medium" ||
          normalized === "high" ||
          normalized === "xhigh"
        ) {
          return normalized;
        }
        return undefined;
      };

      const migratedDefaultModel = migrateModel(settings.defaultModel);
      if (
        migratedDefaultModel &&
        settings.defaultModel !== migratedDefaultModel
      ) {
        settings.defaultModel = migratedDefaultModel;
        needsSave = true;
      }

      if (settings.customPhaseModels) {
        const phases = ["spec", "planning", "coding", "qa"] as const;
        for (const phase of phases) {
          const migrated = migrateModel(settings.customPhaseModels[phase]);
          if (migrated && settings.customPhaseModels[phase] !== migrated) {
            settings.customPhaseModels[phase] = migrated;
            needsSave = true;
          }
        }
      }

      if (settings.featureModels) {
        const features = ["insights", "ideation", "roadmap"] as const;
        for (const feature of features) {
          const migrated = migrateModel(settings.featureModels[feature]);
          if (migrated && settings.featureModels[feature] !== migrated) {
            settings.featureModels[feature] = migrated;
            needsSave = true;
          }
        }
      }

      // Migration: thinking levels (custom phase + feature thinking)
      if (settings.customPhaseThinking) {
        const phases = ["spec", "planning", "coding", "qa"] as const;
        for (const phase of phases) {
          const migrated = migrateThinkingLevel(
            settings.customPhaseThinking[phase],
          );
          if (migrated && settings.customPhaseThinking[phase] !== migrated) {
            settings.customPhaseThinking[phase] = migrated;
            needsSave = true;
          }
        }
      }
      if (settings.featureThinking) {
        const features = ["insights", "ideation", "roadmap"] as const;
        for (const feature of features) {
          const migrated = migrateThinkingLevel(
            settings.featureThinking[feature],
          );
          if (migrated && settings.featureThinking[feature] !== migrated) {
            settings.featureThinking[feature] = migrated;
            needsSave = true;
          }
        }
      }

      // Migration: Set agent profile to 'auto' for users who haven't made a selection (one-time)
      // This ensures new users get the optimized 'auto' profile as the default
      // while preserving existing user preferences
      if (!settings._migratedAgentProfileToAuto) {
        // Only set 'auto' if user hasn't made a selection yet
        if (!settings.selectedAgentProfile) {
          settings.selectedAgentProfile = "auto";
        }
        settings._migratedAgentProfileToAuto = true;
        needsSave = true;
      }

      // If no manual autoBuildPath is set, try to auto-detect
      if (
        settings.autoBuildPath &&
        !isValidAutoBuildSourcePath(settings.autoBuildPath)
      ) {
        settings.autoBuildPath = undefined;
        needsSave = true;
      }
      if (!settings.autoBuildPath) {
        const detectedPath = detectAutoBuildSourcePath();
        if (detectedPath) {
          settings.autoBuildPath = detectedPath;
          needsSave = true;
        }
      }

      if (loadResult.hadPlaintextSecrets && encryptionAvailable) {
        needsSave = true;
      }

      // Persist migration changes
      if (needsSave) {
        try {
          const saveResult = prepareSettingsForSave(settings);
          atomicWriteFileSync(
            settingsPath,
            JSON.stringify(saveResult.settings, null, 2),
          );
        } catch (error) {
          console.error("[SETTINGS_GET] Failed to persist migration:", error);
          // Continue anyway - settings will be migrated in-memory for this session
        }
      }

      if (
        loadResult.requiresReauth ||
        (loadResult.hadPlaintextSecrets && !encryptionAvailable)
      ) {
        const mainWindow = getMainWindow();
        if (mainWindow) {
          const detailLines: string[] = [];
          if (loadResult.requiresReauth) {
            detailLines.push(
              "Some saved credentials could not be decrypted and must be re-entered.",
            );
          }
          if (loadResult.hadPlaintextSecrets && !encryptionAvailable) {
            detailLines.push(
              "Secure storage is unavailable; existing API keys remain stored in plaintext on disk.",
            );
          }
          void dialog.showMessageBox(mainWindow, {
            type: "warning",
            title: "Security Notice",
            message: "API keys require attention.",
            detail: detailLines.join(" ") || "Review API keys in Settings.",
            buttons: ["OK"],
          });
        }
      }

      return { success: true, data: settings as AppSettings };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SAVE,
    async (_, settings: Partial<AppSettings>): Promise<IPCResult> => {
      try {
        const loadResult = loadSettingsWithDecryptedSecrets(settingsPath);
        const currentSettings = loadResult.settings;
        const rawSettings = loadResult.rawSettings;
        const newSettings = { ...currentSettings, ...settings };

        for (const field of SENSITIVE_SETTINGS_FIELDS) {
          const hasUpdate = Object.prototype.hasOwnProperty.call(
            settings,
            field,
          );
          if (!hasUpdate && rawSettings[field]) {
            newSettings[field] = rawSettings[field];
          }
        }
        const saveResult = prepareSettingsForSave(newSettings as AppSettings);

        if (saveResult.blockedSecrets) {
          const mainWindow = getMainWindow();
          const options = {
            type: "warning" as const,
            title: "Secure Storage Required",
            message: "Secure storage is unavailable. Secrets were not saved.",
            detail:
              "Set AUTO_CODEX_ALLOW_INSECURE_TOKEN_STORAGE=true to allow plaintext storage (not recommended).",
            buttons: ["OK"],
          };
          if (mainWindow) {
            await dialog.showMessageBox(mainWindow, options);
          } else {
            await dialog.showMessageBox(options);
          }
        }

        if (saveResult.wrotePlaintext) {
          const mainWindow = getMainWindow();
          const options = {
            type: "warning" as const,
            title: "Unsafe Secret Storage",
            message: "Secure storage is unavailable on this system.",
            detail:
              "API keys will be stored in plaintext on disk. Re-enter these credentials later to migrate once secure storage is available.",
            buttons: ["Save Anyway", "Cancel"],
            defaultId: 1,
            cancelId: 1,
          };
          const result = mainWindow
            ? await dialog.showMessageBox(mainWindow, options)
            : await dialog.showMessageBox(options);
          if (result.response === 1) {
            return {
              success: false,
              error: "Save canceled to avoid plaintext secret storage",
            };
          }
        }

        atomicWriteFileSync(
          settingsPath,
          JSON.stringify(saveResult.settings, null, 2),
        );

        // Apply Python path if changed
        if ("pythonPath" in settings || "autoBuildPath" in settings) {
          agentManager.configure(
            newSettings.pythonPath,
            newSettings.autoBuildPath,
          );
        }

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to save settings",
        };
      }
    },
  );

  // ============================================
  // Dialog Operations
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.DIALOG_SELECT_DIRECTORY,
    async (): Promise<string | null> => {
      const mainWindow = getMainWindow();
      if (!mainWindow) return null;

      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"],
        title: "Select Project Directory",
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      return result.filePaths[0];
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.DIALOG_CREATE_PROJECT_FOLDER,
    async (
      _,
      location: string,
      name: string,
      initGit: boolean,
    ): Promise<
      IPCResult<{ path: string; name: string; gitInitialized: boolean }>
    > => {
      try {
        // Validate inputs
        if (!location || !name) {
          return { success: false, error: "Location and name are required" };
        }

        // Sanitize project name (convert to kebab-case, remove invalid chars)
        const sanitizedName = name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-_]/g, "")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");

        if (!sanitizedName) {
          return { success: false, error: "Invalid project name" };
        }

        const projectPath = path.join(location, sanitizedName);

        // Check if folder already exists
        if (existsSync(projectPath)) {
          return {
            success: false,
            error: `Folder "${sanitizedName}" already exists at this location`,
          };
        }

        // Create the directory
        mkdirSync(projectPath, { recursive: true });

        // Initialize git if requested
        let gitInitialized = false;
        if (initGit) {
          try {
            execSync("git init", { cwd: projectPath, stdio: "ignore" });
            gitInitialized = true;
          } catch {
            // Git init failed, but folder was created - continue without git
            console.warn("Failed to initialize git repository");
          }
        }

        return {
          success: true,
          data: {
            path: projectPath,
            name: sanitizedName,
            gitInitialized,
          },
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to create project folder",
        };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.DIALOG_GET_DEFAULT_PROJECT_LOCATION,
    async (): Promise<string | null> => {
      try {
        // Return user's home directory + common project folders
        const homeDir = app.getPath("home");
        const commonPaths = [
          path.join(homeDir, "Projects"),
          path.join(homeDir, "Developer"),
          path.join(homeDir, "Code"),
          path.join(homeDir, "Documents"),
        ];

        // Return the first one that exists, or Documents as fallback
        for (const p of commonPaths) {
          if (existsSync(p)) {
            return p;
          }
        }

        return path.join(homeDir, "Documents");
      } catch {
        return null;
      }
    },
  );

  // ============================================
  // App Info
  // ============================================

  ipcMain.handle(IPC_CHANNELS.APP_VERSION, async (): Promise<string> => {
    // Use effective version which accounts for source updates
    const version = getEffectiveVersion();
    console.warn("[settings-handlers] APP_VERSION returning:", version);
    return version;
  });

  ipcMain.handle(
    IPC_CHANNELS.APP_PROTOCOL_INFO,
    async (): Promise<IPCResult<AppProtocolInfo>> => {
      return {
        success: true,
        data: {
          version: APP_PROTOCOL_VERSION,
          minVersion: APP_PROTOCOL_MIN_VERSION,
        },
      };
    },
  );

  // ============================================
  // Shell Operations
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.SHELL_OPEN_EXTERNAL,
    async (_, url: string): Promise<void> => {
      await safeOpenExternal(url);
    },
  );
}
