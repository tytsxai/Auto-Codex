# Implementation Plan: Third-Party Auth Stability

## Overview

本实现计划旨在彻底解决第三方激活渠道认证问题，确保洞察、路线图、创意三个核心功能在任何环境下都能稳定运行。

## Tasks

- [x] 1. 增强 Auth Hydrator 确保早期调用
  - [x] 1.1 在 `core/auth.py` 中添加 `ensure_auth_hydrated()` 函数
    - 封装 `_hydrate_env_from_codex_auth_json()` 调用
    - 添加日志记录认证来源
    - 返回认证状态信息
    - _Requirements: 1.1, 1.2, 1.3, 5.1_

  - [x] 1.2 编写属性测试：凭证加载优先级
    - **Property 1: Credential Loading Priority**
    - **Validates: Requirements 1.1, 1.4, 4.1**

  - [x] 1.3 编写属性测试：凭证提取完整性
    - **Property 2: Credential Extraction Completeness**
    - **Validates: Requirements 1.2, 1.3**

- [x] 2. 更新 Insights Runner 添加启动认证验证
  - [x] 2.1 在 `runners/insights_runner.py` 的 `main()` 函数开头调用 `ensure_auth_hydrated()`
    - 在 `load_dotenv()` 之后立即调用
    - 记录认证来源到 debug 日志
    - _Requirements: 3.2, 5.1, 5.2_

  - [x] 2.2 改进认证失败时的错误消息
    - 提供可操作的指导
    - 列出已检查的认证来源
    - _Requirements: 3.1, 5.3_

- [x] 3. 更新 Roadmap Runner 添加启动认证验证
  - [x] 3.1 在 `runners/roadmap_runner.py` 的 `main()` 函数开头调用 `ensure_auth_hydrated()`
    - 在 `load_dotenv()` 之后立即调用
    - 记录认证来源到 debug 日志
    - _Requirements: 3.3, 5.1, 5.2_

  - [x] 3.2 改进认证失败时的错误消息
    - 提供可操作的指导
    - 列出已检查的认证来源
    - _Requirements: 3.1, 5.3_

- [x] 4. 更新 Ideation Runner 添加启动认证验证
  - [x] 4.1 在 `runners/ideation_runner.py` 的 `main()` 函数开头调用 `ensure_auth_hydrated()`
    - 在 `load_dotenv()` 之后立即调用
    - 记录认证来源到 debug 日志
    - _Requirements: 3.4, 5.1, 5.2_

  - [x] 4.2 改进认证失败时的错误消息
    - 提供可操作的指导
    - 列出已检查的认证来源
    - _Requirements: 3.1, 5.3_

- [x] 5. 编写属性测试：Runner 启动验证
  - **Property 5: Runner Startup Verification**
  - 验证所有三个 runner 在启动时调用认证 hydration
  - **Validates: Requirements 3.2, 3.3, 3.4, 5.1**

- [x] 6. Checkpoint - 确保所有测试通过
  - 运行所有单元测试和属性测试
  - 验证三个 runner 的认证流程
  - 如有问题请询问用户

- [x] 7. 添加健康检查功能
  - [x] 7.1 在 `core/auth.py` 中添加 `check_auth_health()` 函数
    - 返回 `AuthStatus` 数据类
    - 检查认证状态和来源
    - 检查 Codex CLI 可用性
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 7.2 更新 `scripts/healthcheck.sh` 使用新的健康检查函数
    - 调用 Python 健康检查
    - 显示认证来源
    - _Requirements: 6.2_

- [x] 8. 编写属性测试：Shell 独立性
  - **Property 3: Shell Independence**
  - 验证在没有 shell 环境变量的情况下凭证加载正常
  - **Validates: Requirements 2.1, 2.3, 4.3**

- [x] 9. 编写属性测试：GUI PATH 完整性
  - **Property 4: GUI PATH Completeness**
  - 验证 `get_gui_env()` 返回的 PATH 包含所有必要目录
  - **Validates: Requirements 2.2**

- [x] 10. Final Checkpoint - 确保所有测试通过
  - 运行完整测试套件
  - 验证所有属性测试通过
  - 如有问题请询问用户

## Notes

- All tasks are required for comprehensive testing
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
