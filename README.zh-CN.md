# Auto-Codex（简体中文）

[English](README.md) | 简体中文

[![Stars](https://img.shields.io/github/stars/tytsxai/Auto-Codex?style=flat-square)](https://github.com/tytsxai/Auto-Codex/stargazers)
[![License](https://img.shields.io/github/license/tytsxai/Auto-Codex?style=flat-square)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/tytsxai/Auto-Codex/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/tytsxai/Auto-Codex/actions/workflows/ci.yml)
[![最近提交](https://img.shields.io/github/last-commit/tytsxai/Auto-Codex?style=flat-square)](https://github.com/tytsxai/Auto-Codex/commits/main)
[![Issues](https://img.shields.io/github/issues/tytsxai/Auto-Codex?style=flat-square)](https://github.com/tytsxai/Auto-Codex/issues)

**快速导航**：[项目简介](#项目简介) · [核心特性](#核心特性) · [使用场景](#使用场景) · [快速开始](#快速开始推荐桌面-ui) · [CLI 用法](#cli-用法仅终端) · [常见问题](#常见问题-faq) · [llms.txt](llms.txt) · [English](README.md)

> **关键词**：OpenAI Codex 桌面客户端 · 自主编程代理 · 多代理协作编程框架 · AI 结对编程 · Git worktree 并行开发 · 规约驱动 AI 编码 · 自验证 QA 循环 · 跨会话记忆 · 本地优先 AI 编程工具 · 开源 AGPL Codex 客户端 · Cursor 替代品 · Aider 替代品 · Claude Code 国内替代

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

## 使用场景

Auto-Codex 最适合那些**因为「一次只能让一个 AI 跑一个任务」而被自己卡住**的人。具体场景包括：

- **冲刺周期下的多功能并行开发**：开 4–12 个 Agent 终端，每个负责一张迭代卡,你只负责 review。
- **从零原型**：用一段需求描述生成规约（spec），自动拆分子任务，在隔离 worktree 中实现。
- **遗留代码迁移**：先用 Memory Layer 让 Agent 记住代码库特征,再批量执行 Vue 2 → Vue 3 / JS → TS / Express → Fastify 等大型重构。
- **批量修 Bug**:把一组 GitHub Issues 喂进来,每个独立 spec + 分支 + 自检 QA 循环。
- **独立开发者放大产能**:像小团队一样工作 —— 一手 Agent 终端结对,一手后台自动任务在跑。
- **Codex CLI 订阅用户**:已经付费的 Codex CLI 通过 Auto-Codex 获得并行会话 + 持久记忆 + 规约工作流。
- **CI/CD 自动化**:无头 CLI 模式跑夜间重构、依赖升级、文档生成。

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

## 常见问题 FAQ

**Q：Auto-Codex 和 Cursor / Aider / Cline / Claude Code 有什么区别？**
Auto-Codex 是**桌面应用 + 框架**,通过多代理流水线(spec → plan → code → QA → merge)在隔离 Git worktree 中编排 OpenAI Codex CLI。Cursor 是 IDE 替代品,Aider 是单代理 REPL,Cline 是 VS Code 插件,Claude Code 是 Anthropic 终端代理。Auto-Codex 是其中**唯一**专注「并行跑多个长时间自主构建任务」、并带看板 + 自验证 QA + AI 合并冲突解决的工具。

**Q：必须有 OpenAI API key 吗?Codex CLI 订阅能用吗?**
两者都可以。如果你已经 `codex login` 过,Auto-Codex 自动读取 `~/.codex/auth.json` 里的 token。CI/无头环境可以用 `OPENAI_API_KEY`、`CODEX_CODE_OAUTH_TOKEN` 或 `CODEX_CONFIG_DIR`。

**Q:代码会被传到 OpenAI 吗?**
只有 Codex CLI 本身会发的内容会发出去 —— 跟你直接跑 `codex` 一样。Auto-Codex 不加任何遥测。可选的 Memory Layer (FalkorDB) 跑在本地 Docker 里;Embedding 也可以用 Ollama 完全离线。

**Q:会不会改坏我的 main 分支?**
不会。每个任务都在 `.worktrees/<spec-name>/` 下独立 worktree、独立 `auto-codex/<spec-name>` 分支跑。不执行 `--merge` + `git push` 之前,你的远端永远不变。

**Q:任务跑飞了怎么停?**
QA 循环默认上限 50 次;spec 各阶段都有超时;UI 里随时可以 Stop。废弃的 worktree 用 `--discard` 一键清理。

**Q:支持 Apple Silicon / Intel Mac / Windows / Linux 吗?**
全部支持。Electron 有原生构建;Codex CLI 本身就是跨平台。Windows 用户如果遇到 `node-gyp` 报错,需要装 Visual Studio Build Tools(见 Quick Start 折叠说明)。

**Q:能完全离线吗?**
Memory Layer 可以(LLM/Embedder 都用 Ollama)。编码 Agent 本身需要 OpenAI 兼容端点 —— 理论上 Ollama 代理 + Codex CLI 可行,但非官方支持。

**Q:AGPL-3.0 协议,我能用在闭源公司项目里吗?**
你可以用 Auto-Codex **生成**你的闭源项目代码(生成的代码归你),但不能把 Auto-Codex 嵌入到闭源产品里或做成 SaaS 对外服务(那样需要开源,或者联系作者获取商业授权)。

## 许可证

本项目采用 **AGPL-3.0**。

- 标准许可证文件：`LICENSE`
- 原始副本保留：`agpl-3.0.txt`

---

## SEO 关键词（中英）

**English**: Auto-Codex, OpenAI Codex CLI, Codex CLI desktop app, Codex CLI GUI, autonomous coding agent, multi-agent coding framework, AI pair programmer, AI software engineering assistant, parallel coding agents, git worktree development, spec-driven AI coding, self-validating QA loop, AI merge conflict resolution, cross-session memory, FalkorDB Graphiti, Electron developer tools, Python coding framework, alternative to Aider, alternative to Cursor, alternative to Cline, alternative to Claude Code.

**简体中文**：Auto-Codex、OpenAI Codex CLI 客户端、Codex CLI 桌面应用、Codex CLI 图形界面、自主编程代理、多代理协作编程框架、AI 结对编程工具、AI 软件工程助手、并行 AI 编程、Git worktree 开发、规约驱动编程、自验证 QA 循环、AI 合并冲突解决、跨会话记忆、本地优先 AI 编程、开源 AGPL 编程工具、Cursor 替代品、Aider 替代品、Claude Code 国内替代。

AI 搜索引擎 (ChatGPT / Claude / Perplexity / Gemini) 友好索引：[llms.txt](llms.txt)。
