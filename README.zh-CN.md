# Auto-Codex（简体中文）

[English](README.md) | 简体中文

[![Stars](https://img.shields.io/github/stars/tytsxai/Auto-Codex?style=flat-square)](https://github.com/tytsxai/Auto-Codex/stargazers)
[![License](https://img.shields.io/github/license/tytsxai/Auto-Codex?style=flat-square)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/tytsxai/Auto-Codex/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/tytsxai/Auto-Codex/actions/workflows/ci.yml)
[![最近提交](https://img.shields.io/github/last-commit/tytsxai/Auto-Codex?style=flat-square)](https://github.com/tytsxai/Auto-Codex/commits/main)
[![Issues](https://img.shields.io/github/issues/tytsxai/Auto-Codex?style=flat-square)](https://github.com/tytsxai/Auto-Codex/issues)

**快速导航**：[项目简介](#项目简介) · [核心特性](#核心特性) · [快速开始](#快速开始推荐桌面-ui) · [CLI 用法](#cli-用法仅终端) · [安全模型](#安全模型) · [项目结构](#项目结构) · [贡献指南](#贡献指南) · [许可证](#许可证)

你的 AI 编程协作伙伴。通过可自治执行的智能体（Agent），自动完成任务规划、编码与验证，让你更快交付高质量功能。

![Auto-Codex 看板](.github/assets/Auto-Codex-Kanban.png)

## 项目简介

**Auto-Codex 是一个桌面应用，用于增强 AI 编程工作流。**

无论你是刚入门的开发者，还是经验丰富的工程师，都可以通过 Auto-Codex 获得更高效的多任务开发体验。

- **自主任务执行**：描述目标后，Agent 自动完成计划、实现与验证
- **多终端并行 Agent**：最多可同时运行 12 个 Codex CLI 终端
- **默认安全**：基于 Git Worktree 隔离任务，主分支不受干扰
- **自验证闭环**：内置 QA 流程，先检查再交付

## 核心特性

- 并行多 Agent 协作
- 上下文工程（Context Engineering）
- AI 冲突合并辅助
- 跨会话记忆层（Memory Layer）
- 跨平台桌面支持（macOS / Windows / Linux）
- 适用于 Web、API、CLI 等多种项目类型

## 快速开始（推荐桌面 UI）

### 前置要求

1. **Node.js 18+**
2. **Python 3.12+**
3. **Docker Desktop**（可选，用于记忆层）
4. **Codex CLI**：`npm install -g @openai/codex`
5. **OpenAI 账号**
6. **Git 仓库**（必须）

### Codex CLI 认证

```bash
# 检查安装
codex --version

# 交互式登录（推荐）
codex login
```

在 CI / 无头环境中，可使用以下任一方式：

```bash
export OPENAI_API_KEY=sk-...
# 或
export CODEX_CODE_OAUTH_TOKEN=...
# 或
export CODEX_CONFIG_DIR=/path/to/codex/config
```

### Git 初始化

Auto-Codex 通过 Git 分支与 Worktree 隔离每个任务。如果项目尚未初始化：

```bash
cd your-project
git init
git add .
git commit -m "Initial commit"
```

### 启动步骤（桌面版）

```bash
# 1) Python 后端
cd auto-codex
uv venv
uv pip install -r requirements.txt

# 2) 记忆层（可选）
docker compose up -d

# 3) Electron UI
cd ../auto-codex-ui
pnpm install
pnpm run dev
```

更多部署与运维说明：

- Docker 安装与故障排查：`guides/DOCKER-SETUP.md`
- 生产运维（备份/恢复/回滚）：`guides/OPERATIONS.md`

## CLI 用法（仅终端）

```bash
cd auto-codex

# 创建规范
python spec_orchestrator.py "实现一个用户登录 API"

# 执行某个规范
python run.py --spec specs/your-spec.md
```

## 安全模型

- 默认在独立 Git Worktree 中执行任务
- 支持审批与命令安全边界
- 提供安全策略与漏洞提交流程：`SECURITY.md`

## 项目结构

```text
Auto-Codex/
├── auto-codex/        # Python 后端（编排器/Agent/记忆/安全）
├── auto-codex-ui/     # Electron + React 桌面前端
├── guides/            # 用户文档与运维指南
├── tests/             # 自动化测试
└── README.md          # 英文说明
```

## 环境变量（示例）

- `OPENAI_API_KEY`
- `CODEX_CODE_OAUTH_TOKEN`
- `CODEX_CONFIG_DIR`
- `AUTO_CODEX_DISABLE_DEFAULT_CODEX_CONFIG_DIR`

## 贡献指南

- 贡献说明：`CONTRIBUTING.md`
- 安全策略：`SECURITY.md`
- 行为准则：`CODE_OF_CONDUCT.md`

## 许可证

本项目采用 **AGPL-3.0**。

- 标准许可证文件：`LICENSE`
- 原始副本保留：`agpl-3.0.txt`

---

## SEO 关键词（中英）

Auto-Codex, Codex CLI, AI Coding Agent, Multi-Agent Coding, Autonomous Coding,
Git Worktree, Electron AI IDE, Python Agent Framework, AI 编程代理, 多智能体编程,
自动化代码生成, 并行开发, AI 开发助手
