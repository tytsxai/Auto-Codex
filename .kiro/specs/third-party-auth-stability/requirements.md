# Requirements Document

## Introduction

本规范旨在彻底解决第三方激活渠道（如 yunyi）登录的 Codex CLI 认证问题，确保三个核心功能（洞察 Insights、路线图 Roadmap、创意 Ideation）在任何环境下都能稳定运行，包括重新开发或安装后不会反复出现认证问题。

## Glossary

- **Auth_System**: 认证系统，负责从多个来源获取和验证认证凭证
- **Third_Party_Auth**: 第三方激活渠道认证，通过 `~/.codex/auth.json` 和 `~/.codex/config.toml` 存储凭证
- **GUI_App**: 图形界面应用程序，从 Finder 启动时不继承 shell 环境变量
- **Insights_Runner**: 洞察功能运行器
- **Roadmap_Runner**: 路线图功能运行器
- **Ideation_Runner**: 创意功能运行器
- **Codex_CLI**: Codex 命令行工具

## Requirements

### Requirement 1: 认证凭证自动加载

**User Story:** As a developer using third-party activation channels, I want the system to automatically load authentication credentials from `~/.codex/auth.json` and `~/.codex/config.toml`, so that I don't need to manually configure environment variables.

#### Acceptance Criteria

1. WHEN the Auth_System initializes, THE Auth_System SHALL check for credentials in `~/.codex/auth.json` before checking environment variables
2. WHEN `~/.codex/auth.json` contains valid credentials (OPENAI_API_KEY, api_key, apiKey, key, or token), THE Auth_System SHALL populate the process environment with these credentials
3. WHEN `~/.codex/auth.json` contains `api_base_url`, THE Auth_System SHALL set both `OPENAI_BASE_URL` and `OPENAI_API_BASE` environment variables
4. IF explicit environment variables are already set, THEN THE Auth_System SHALL NOT override them with file-based credentials

### Requirement 2: GUI 应用环境变量继承

**User Story:** As a developer using the Desktop UI, I want the application to work correctly even when launched from Finder, so that I don't need to launch it from terminal.

#### Acceptance Criteria

1. WHEN a GUI_App is launched from Finder, THE Auth_System SHALL still be able to locate and load credentials from `~/.codex/auth.json`
2. WHEN the Codex_CLI is invoked, THE system SHALL provide a PATH environment that includes common binary locations (`/opt/homebrew/bin`, `/usr/local/bin`, etc.)
3. WHEN credentials are loaded from files, THE system SHALL NOT depend on shell environment variables from `.zshrc`

### Requirement 3: 认证状态验证

**User Story:** As a developer, I want clear feedback when authentication fails, so that I can quickly diagnose and fix issues.

#### Acceptance Criteria

1. WHEN authentication fails, THE Auth_System SHALL provide a specific error message indicating which authentication sources were checked
2. WHEN the Insights_Runner starts, THE Insights_Runner SHALL verify authentication before attempting to run queries
3. WHEN the Roadmap_Runner starts, THE Roadmap_Runner SHALL verify authentication before attempting to generate roadmaps
4. WHEN the Ideation_Runner starts, THE Ideation_Runner SHALL verify authentication before attempting to generate ideas

### Requirement 4: 认证持久化和恢复

**User Story:** As a developer, I want authentication to persist across reinstalls and updates, so that I don't need to reconfigure after each update.

#### Acceptance Criteria

1. THE Auth_System SHALL prioritize file-based credentials (`~/.codex/auth.json`) over environment variables for third-party authentication
2. WHEN the application is reinstalled or updated, THE Auth_System SHALL automatically detect existing credentials in `~/.codex/`
3. THE Auth_System SHALL NOT require any manual configuration if valid credentials exist in `~/.codex/auth.json`

### Requirement 5: 启动时认证预检

**User Story:** As a developer, I want the system to verify authentication at startup, so that I know immediately if there are any issues.

#### Acceptance Criteria

1. WHEN any runner (Insights, Roadmap, Ideation) starts, THE runner SHALL call `_hydrate_env_from_codex_auth_json()` to ensure credentials are loaded
2. WHEN credentials are successfully loaded, THE runner SHALL log the authentication source for debugging
3. IF credentials cannot be loaded, THEN THE runner SHALL provide actionable guidance on how to configure authentication

### Requirement 6: 健康检查集成

**User Story:** As a developer, I want a health check command that verifies all authentication sources, so that I can diagnose issues quickly.

#### Acceptance Criteria

1. THE system SHALL provide a health check function that verifies authentication status
2. WHEN the health check runs, THE system SHALL report which authentication source is being used
3. WHEN the health check runs, THE system SHALL verify that the Codex_CLI is accessible and functional
