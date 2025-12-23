import type { Project, ProjectSettings as ProjectSettingsType, AutoBuildVersionInfo, ProjectEnvConfig, LinearSyncStatus, GitHubSyncStatus } from '../../../../shared/types';
import { SettingsSection } from '../SettingsSection';
import { GeneralSettings } from '../../project-settings/GeneralSettings';
import { EnvironmentSettings } from '../../project-settings/EnvironmentSettings';
import { SecuritySettings } from '../../project-settings/SecuritySettings';
import { LinearIntegration } from '../integrations/LinearIntegration';
import { GitHubIntegration } from '../integrations/GitHubIntegration';
import { InitializationGuard } from '../common/InitializationGuard';
import type { ProjectSettingsSection } from '../ProjectSettingsContent';

interface SectionRouterProps {
  activeSection: ProjectSettingsSection;
  project: Project;
  settings: ProjectSettingsType;
  setSettings: React.Dispatch<React.SetStateAction<ProjectSettingsType>>;
  versionInfo: AutoBuildVersionInfo | null;
  isCheckingVersion: boolean;
  isUpdating: boolean;
  envConfig: ProjectEnvConfig | null;
  isLoadingEnv: boolean;
  envError: string | null;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;
  showCodexToken: boolean;
  setShowCodexToken: React.Dispatch<React.SetStateAction<boolean>>;
  showLinearKey: boolean;
  setShowLinearKey: React.Dispatch<React.SetStateAction<boolean>>;
  showOpenAIKey: boolean;
  setShowOpenAIKey: React.Dispatch<React.SetStateAction<boolean>>;
  showFalkorPassword: boolean;
  setShowFalkorPassword: React.Dispatch<React.SetStateAction<boolean>>;
  showGitHubToken: boolean;
  setShowGitHubToken: React.Dispatch<React.SetStateAction<boolean>>;
  gitHubConnectionStatus: GitHubSyncStatus | null;
  isCheckingGitHub: boolean;
  isCheckingCodexAuth: boolean;
  codexAuthStatus: 'checking' | 'authenticated' | 'not_authenticated' | 'error';
  linearConnectionStatus: LinearSyncStatus | null;
  isCheckingLinear: boolean;
  handleInitialize: () => Promise<void>;
  handleUpdate: () => Promise<void>;
  handleCodexSetup: () => Promise<void>;
  onOpenLinearImport: () => void;
}

/**
 * Routes to the appropriate settings section based on activeSection.
 * Handles initialization guards and section-specific configurations.
 */
export function SectionRouter({
  activeSection,
  project,
  settings,
  setSettings,
  versionInfo,
  isCheckingVersion,
  isUpdating,
  envConfig,
  isLoadingEnv,
  envError,
  updateEnvConfig,
  showCodexToken,
  setShowCodexToken,
  showLinearKey,
  setShowLinearKey,
  showOpenAIKey,
  setShowOpenAIKey,
  showFalkorPassword,
  setShowFalkorPassword,
  showGitHubToken,
  setShowGitHubToken,
  gitHubConnectionStatus,
  isCheckingGitHub,
  isCheckingCodexAuth,
  codexAuthStatus,
  linearConnectionStatus,
  isCheckingLinear,
  handleInitialize,
  handleUpdate,
  handleCodexSetup,
  onOpenLinearImport
}: SectionRouterProps) {
  switch (activeSection) {
    case 'general':
      return (
        <SettingsSection
          title="通用"
          description={`配置 ${project.name} 的 Auto-Build、智能体模型和通知`}
        >
          <GeneralSettings
            project={project}
            settings={settings}
            setSettings={setSettings}
            versionInfo={versionInfo}
            isCheckingVersion={isCheckingVersion}
            isUpdating={isUpdating}
            handleInitialize={handleInitialize}
            handleUpdate={handleUpdate}
          />
        </SettingsSection>
      );

    case 'codex':
      return (
        <SettingsSection
          title="Codex 认证"
          description="此项目使用全局 Codex 认证（在 设置 → 集成 管理）"
        >
          <InitializationGuard
            initialized={!!project.autoBuildPath}
            title="Codex 认证"
            description="使用全局 Codex 认证"
            onInitialize={handleInitialize}
            isInitializing={isUpdating}
          >
            <EnvironmentSettings
              envConfig={envConfig}
              isLoadingEnv={isLoadingEnv}
              envError={envError}
              updateEnvConfig={updateEnvConfig}
              isCheckingCodexAuth={isCheckingCodexAuth}
              codexAuthStatus={codexAuthStatus}
              handleCodexSetup={handleCodexSetup}
              showCodexToken={showCodexToken}
              setShowCodexToken={setShowCodexToken}
              expanded={true}
              onToggle={() => {}}
            />
          </InitializationGuard>
        </SettingsSection>
      );

    case 'linear':
      return (
        <SettingsSection
          title="Linear 集成"
          description="连接 Linear 进行问题跟踪和任务导入"
        >
          <InitializationGuard
            initialized={!!project.autoBuildPath}
            title="Linear 集成"
            description="与 Linear 同步进行问题跟踪"
            onInitialize={handleInitialize}
            isInitializing={isUpdating}
          >
            <LinearIntegration
              envConfig={envConfig}
              updateEnvConfig={updateEnvConfig}
              showLinearKey={showLinearKey}
              setShowLinearKey={setShowLinearKey}
              linearConnectionStatus={linearConnectionStatus}
              isCheckingLinear={isCheckingLinear}
              onOpenLinearImport={onOpenLinearImport}
            />
          </InitializationGuard>
        </SettingsSection>
      );

    case 'github':
      return (
        <SettingsSection
          title="GitHub 集成"
          description="连接 GitHub 进行问题跟踪"
        >
          <InitializationGuard
            initialized={!!project.autoBuildPath}
            title="GitHub 集成"
            description="与 GitHub Issues 同步"
            onInitialize={handleInitialize}
            isInitializing={isUpdating}
          >
            <GitHubIntegration
              envConfig={envConfig}
              updateEnvConfig={updateEnvConfig}
              showGitHubToken={showGitHubToken}
              setShowGitHubToken={setShowGitHubToken}
              gitHubConnectionStatus={gitHubConnectionStatus}
              isCheckingGitHub={isCheckingGitHub}
              projectPath={project.path}
            />
          </InitializationGuard>
        </SettingsSection>
      );

    case 'memory':
      return (
        <SettingsSection
          title="记忆后端"
          description="配置智能体存储和检索记忆的方式"
        >
          <InitializationGuard
            initialized={!!project.autoBuildPath}
            title="记忆后端"
            description="配置智能体记忆存储"
            onInitialize={handleInitialize}
            isInitializing={isUpdating}
          >
            <SecuritySettings
              envConfig={envConfig}
              settings={settings}
              setSettings={setSettings}
              updateEnvConfig={updateEnvConfig}
              showOpenAIKey={showOpenAIKey}
              setShowOpenAIKey={setShowOpenAIKey}
              showFalkorPassword={showFalkorPassword}
              setShowFalkorPassword={setShowFalkorPassword}
              expanded={true}
              onToggle={() => {}}
            />
          </InitializationGuard>
        </SettingsSection>
      );

    default:
      return null;
  }
}
