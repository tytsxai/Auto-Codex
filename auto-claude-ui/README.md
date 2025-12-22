# Auto-Codex UI

使用 Auto-Codex 自主编码框架管理 AI 驱动开发任务的桌面应用程序。

## 快速开始

```bash
# 1. 克隆仓库（如果尚未克隆）
git clone https://github.com/tytsxai/Auto-Codex.git
cd Auto-Codex/auto-claude-ui

# 2. 安装依赖
npm install

# 3. 构建桌面应用
npm run package:win    # Windows
npm run package:mac    # macOS
npm run package:linux  # Linux

# 4. 运行应用
# Windows: .\\dist\\win-unpacked\\Auto-Codex.exe
# macOS:   open dist/mac-arm64/Auto\\ Codex.app
# Linux:   ./dist/linux-unpacked/auto-codex
```

## 前置要求

- Node.js 18+
- npm 或 pnpm
- Python 3.10+（用于 auto-claude 后端）
- **仅 Windows**：Visual Studio Build Tools 2022，需安装"使用 C++ 的桌面开发"工作负载
- **仅 Windows**：启用开发者模式（设置 → 系统 → 开发者选项）

## 运行方式

### 构建生产版本（推荐）

为您的平台构建 Electron 桌面应用：

```bash
# 构建 Windows 版本
npm run package:win

# 构建 macOS 版本
npm run package:mac

# 构建 Linux 版本
npm run package:linux
```

### 运行生产版本

构建完成后，从 `dist` 文件夹运行应用程序：

```bash
# Windows - 运行可执行文件
.\dist\win-unpacked\Auto-Codex.exe

# Windows - 或使用安装程序
.\dist\Auto-Codex Setup X.X.X.exe

# macOS
open dist/mac-arm64/Auto\ Codex.app

# Linux
./dist/linux-unpacked/auto-codex
```

### 开发模式

用于带热重载的开发（可选）：

```bash
npm run dev
```

> **注意**：某些功能（如自动更新）仅在打包版本中可用。

## 分发文件

打包后，`dist` 文件夹包含：

| 平台 | 文件 |
|------|------|
| macOS | `Auto-Codex.app`、`.dmg`、`.zip` |
| Windows | `Auto-Codex Setup X.X.X.exe`（安装程序）、`.zip`、`win-unpacked/` |
| Linux | `.AppImage`、`.deb`、`linux-unpacked/` |

## 测试

```bash
# 运行测试
npm run test
```

## 代码检查

```bash
# 运行 ESLint
npm run lint

# 运行类型检查
npm run typecheck
```

## 功能特性

- **项目管理**：添加、配置和切换多个项目
- **看板**：可视化任务板，包含规划中、进行中、AI 审核、人工审核和已完成列
- **任务创建向导**：基于表单的任务创建界面
- **实时进度**：智能体执行期间的实时更新
- **人工审核流程**：审核 QA 结果并提供反馈
- **主题支持**：浅色和深色模式
- **自动更新**：自动更新通知

## 技术栈

- **框架**：Electron + React 18（TypeScript）
- **构建工具**：electron-vite + electron-builder
- **UI 组件**：Radix UI（shadcn/ui 模式）
- **样式**：TailwindCSS
- **状态管理**：Zustand

## 环境变量

- `OPENAI_API_KEY`：OpenAI Codex CLI 的 API Key（来自 auto-claude/.env）
- `FALKORDB_URL`：FalkorDB 连接 URL（可选）

## 许可证

AGPL-3.0
