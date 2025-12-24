### Context7 MCP 使用指南

Context7 是查询外部库文档的首选工具，提供最新的官方文档。

#### 何时使用 Context7

使用 Context7 当：
- 实现 API 集成 (Stripe, Auth0, AWS, etc.)
- 使用代码库中尚未存在的新库
- 不确定正确的函数签名或模式
- Spec 引用了需要正确使用的库
- 验证第三方 API 使用是否正确

#### 使用步骤

**Step 1: 解析库 ID**

首先找到正确的 Context7 库 ID：

```
Tool: mcp__context7__resolve-library-id
Input: { "libraryName": "[库名]" }
```

示例：
```
Tool: mcp__context7__resolve-library-id
Input: { "libraryName": "nextjs" }
→ 返回: "/vercel/next.js"
```

**Step 2: 获取相关文档**

使用库 ID 获取特定主题的文档：

```
Tool: mcp__context7__get-library-docs
Input: {
  "context7CompatibleLibraryID": "[library-id]",
  "topic": "[具体功能]",
  "mode": "code"
}
```

**mode 参数说明：**
- `"code"` - 获取 API 示例和代码片段
- `"info"` - 获取概念说明和指南

#### 研究主题建议

针对每个集成，研究以下主题：
- `"getting started"` / `"installation"` - 安装和设置模式
- `"api"` / `"reference"` - 函数签名
- `"configuration"` / `"config"` - 环境变量和配置选项
- `"examples"` - 常见使用模式
- 与任务相关的特定功能主题

#### 从 Context7 提取的信息

对于每个集成，提取：
1. **正确的包名** - 实际的 npm/pip 包名
2. **导入语句** - 如何在代码中导入
3. **初始化代码** - 设置模式
4. **关键 API 函数** - 你需要的函数签名
5. **配置选项** - 环境变量、配置文件
6. **常见陷阱** - 文档中提到的问题

#### 失败回退

如果 Context7 查找失败：

1. **使用 Web Search 作为备选**
   - 搜索 `"[library] official documentation"`
   - 搜索 `"[library] npm"` 或 `"[library] pypi"` 验证包名

2. **在输出中记录回退**
   ```json
   {
     "name": "[library]",
     "verified_package": {
       "verified": false,
       "fallback_source": "web_search",
       "reason": "Not found in Context7"
     }
   }
   ```

3. **标记信息为 "unverified"**

#### 示例工作流

如果任务涉及 "Add Stripe payment integration"：

```
1. resolve-library-id with "stripe"
   → Returns "/stripe/stripe-node" or similar

2. get-library-docs with topic "payments" or "checkout"
   → Returns API patterns, initialization code

3. get-library-docs with topic "webhooks"
   → Returns webhook handling patterns

4. Use exact patterns from documentation in implementation
```

**这可以防止：**
- 使用已弃用的 API
- 错误的函数签名
- 缺少必需的配置
- 安全反模式
