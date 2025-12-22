import { Settings2, Save, Loader2 } from 'lucide-react';
import { LinearTaskImportModal } from '../LinearTaskImportModal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { GeneralSettings } from './GeneralSettings';
import { EnvironmentSettings } from './EnvironmentSettings';
import { IntegrationSettings } from './IntegrationSettings';
import { SecuritySettings } from './SecuritySettings';
import { useProjectSettings } from './hooks/useProjectSettings';
import type { Project } from '../../../shared/types';

interface ProjectSettingsProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectSettings({ project, open, onOpenChange }: ProjectSettingsProps) {
  const hook = useProjectSettings(project, open);

  const {
    settings,
    setSettings,
    isSaving,
    error,
    versionInfo,
    isCheckingVersion,
    isUpdating,
    envConfig,
    isLoadingEnv,
    envError,
    isSavingEnv,
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
    expandedSections,
    toggleSection,
    gitHubConnectionStatus,
    isCheckingGitHub,
    isCheckingClaudeAuth,
    claudeAuthStatus,
    showLinearImportModal,
    setShowLinearImportModal,
    linearConnectionStatus,
    isCheckingLinear,
    handleInitialize,
    handleUpdate,
    handleClaudeSetup,
    handleSave
  } = hook;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Settings2 className="h-5 w-5" />
            项目设置
          </DialogTitle>
          <DialogDescription>
            配置 {project.name} 的设置
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 -mx-6 overflow-y-auto">
          <div className="px-6 py-4 space-y-6">
            {/* 通用设置（Auto-Build、智能体配置、通知） */}
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

            {/* 环境配置 - 仅在初始化后显示 */}
            {project.autoBuildPath && (
              <>
                <Separator />

                {/* Claude 认证 */}
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
                  expanded={expandedSections.claude}
                  onToggle={() => toggleSection('claude')}
                />

                <Separator />

                {/* Linear 和 GitHub 集成 */}
                <IntegrationSettings
                  envConfig={envConfig}
                  updateEnvConfig={updateEnvConfig}
                  project={project}
                  settings={settings}
                  setSettings={setSettings}
                  showLinearKey={showLinearKey}
                  setShowLinearKey={setShowLinearKey}
                  linearConnectionStatus={linearConnectionStatus}
                  isCheckingLinear={isCheckingLinear}
                  linearExpanded={expandedSections.linear}
                  onLinearToggle={() => toggleSection('linear')}
                  onOpenLinearImport={() => setShowLinearImportModal(true)}
                  showGitHubToken={showGitHubToken}
                  setShowGitHubToken={setShowGitHubToken}
                  gitHubConnectionStatus={gitHubConnectionStatus}
                  isCheckingGitHub={isCheckingGitHub}
                  githubExpanded={expandedSections.github}
                  onGitHubToggle={() => toggleSection('github')}
                />

                <Separator />

                {/* 记忆后端（Graphiti） */}
                <SecuritySettings
                  envConfig={envConfig}
                  settings={settings}
                  setSettings={setSettings}
                  updateEnvConfig={updateEnvConfig}
                  showOpenAIKey={showOpenAIKey}
                  setShowOpenAIKey={setShowOpenAIKey}
                  showFalkorPassword={showFalkorPassword}
                  setShowFalkorPassword={setShowFalkorPassword}
                  expanded={expandedSections.graphiti}
                  onToggle={() => toggleSection('graphiti')}
                />
              </>
            )}

            {/* 错误显示 */}
            {(error || envError) && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                {error || envError}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => handleSave(() => onOpenChange(false))} disabled={isSaving || isSavingEnv}>
            {isSaving || isSavingEnv ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                保存设置
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Linear 任务导入弹窗 */}
      <LinearTaskImportModal
        projectId={project.id}
        open={showLinearImportModal}
        onOpenChange={setShowLinearImportModal}
        onImportComplete={(result) => {
          console.warn('Import complete:', result);
        }}
      />
    </Dialog>
  );
}
