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
  showClaudeToken: boolean;
  setShowClaudeToken: React.Dispatch<React.SetStateAction<boolean>>;
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
  isCheckingClaudeAuth: boolean;
  claudeAuthStatus: 'checking' | 'authenticated' | 'not_authenticated' | 'error';
  linearConnectionStatus: LinearSyncStatus | null;
  isCheckingLinear: boolean;
  handleInitialize: () => Promise<void>;
  handleUpdate: () => Promise<void>;
  handleClaudeSetup: () => Promise<void>;
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
  showClaudeToken,
  setShowClaudeToken,
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
  isCheckingClaudeAuth,
  claudeAuthStatus,
  linearConnectionStatus,
  isCheckingLinear,
  handleInitialize,
  handleUpdate,
  handleClaudeSetup,
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

    case 'claude':
      return (
        <SettingsSection
          title="Claude 认证"
          description="配置此项目的 Claude CLI 认证"
        >
          <InitializationGuard
            initialized={!!project.autoBuildPath}
            title="Claude 认证"
            description="配置 Claude CLI 认证"
          >
            <EnvironmentSettings
              envConfig={envConfig}
              isLoadingEnv={isLoadingEnv}
              envError={envError}
              updateEnvConfig={updateEnvConfig}
              isCheckingClaudeAuth={isCheckingClaudeAuth}
              claudeAuthStatus={claudeAuthStatus}
              handleClaudeSetup={handleClaudeSetup}
              showClaudeToken={showClaudeToken}
              setShowClaudeToken={setShowClaudeToken}
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
