import { ProjectAPI, createProjectAPI } from './project-api';
import { TerminalAPI, createTerminalAPI } from './terminal-api';
import { TaskAPI, createTaskAPI } from './task-api';
import { SettingsAPI, createSettingsAPI } from './settings-api';
import { FileAPI, createFileAPI } from './file-api';
import { AgentAPI, createAgentAPI } from './agent-api';
import { IdeationAPI, createIdeationAPI } from './modules/ideation-api';
import { InsightsAPI, createInsightsAPI } from './modules/insights-api';
import { RoadmapAPI, createRoadmapAPI } from './modules/roadmap-api';
import { LinearAPI, createLinearAPI } from './modules/linear-api';
import { GitHubAPI, createGitHubAPI } from './modules/github-api';
import { ChangelogAPI, createChangelogAPI } from './modules/changelog-api';
import { AutoBuildAPI, createAutoBuildAPI } from './modules/autobuild-api';
import { ShellAPI, createShellAPI } from './modules/shell-api';
import { AppUpdateAPI, createAppUpdateAPI } from './app-update-api';
import { WorkflowAPI, createWorkflowAPI } from './workflow-api';

export interface ElectronAPI extends
  ProjectAPI,
  TerminalAPI,
  TaskAPI,
  SettingsAPI,
  FileAPI,
  AgentAPI,
  IdeationAPI,
  InsightsAPI,
  RoadmapAPI,
  LinearAPI,
  GitHubAPI,
  ChangelogAPI,
  AutoBuildAPI,
  ShellAPI,
  AppUpdateAPI,
  WorkflowAPI {}

export const createElectronAPI = (): ElectronAPI => ({
  ...createProjectAPI(),
  ...createTerminalAPI(),
  ...createTaskAPI(),
  ...createSettingsAPI(),
  ...createFileAPI(),
  ...createAgentAPI(),
  ...createIdeationAPI(),
  ...createInsightsAPI(),
  ...createRoadmapAPI(),
  ...createLinearAPI(),
  ...createGitHubAPI(),
  ...createChangelogAPI(),
  ...createAutoBuildAPI(),
  ...createShellAPI(),
  ...createAppUpdateAPI(),
  ...createWorkflowAPI()
});

// Export individual API creators for potential use in tests or specialized contexts
export {
  createProjectAPI,
  createTerminalAPI,
  createTaskAPI,
  createSettingsAPI,
  createFileAPI,
  createAgentAPI,
  createIdeationAPI,
  createInsightsAPI,
  createRoadmapAPI,
  createLinearAPI,
  createGitHubAPI,
  createChangelogAPI,
  createAutoBuildAPI,
  createShellAPI,
  createAppUpdateAPI,
  createWorkflowAPI
};

export type {
  ProjectAPI,
  TerminalAPI,
  TaskAPI,
  SettingsAPI,
  FileAPI,
  AgentAPI,
  IdeationAPI,
  InsightsAPI,
  RoadmapAPI,
  LinearAPI,
  GitHubAPI,
  ChangelogAPI,
  AutoBuildAPI,
  ShellAPI,
  AppUpdateAPI,
  WorkflowAPI
};
