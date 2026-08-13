# coworker/ —— Python 后端

FastAPI 服务器，包含智能体引擎、LLM Provider、连接器和工具。

## 主要目录

- `server/` —— FastAPI 应用、管理器、CLI 入口
- `providers/` —— LLM Provider（OpenAI、Anthropic、Gemini、Bedrock、Vertex、Ollama）
- `connectors/` —— 外部服务集成（Slack、Telegram、GitHub、邮件、浏览器等）
- `agents/` —— 智能体实现（chat、code、cowork）
- `tools/` —— 内置智能体工具（shell、文件、git、搜索、网页等）
- `mcp/` —— Model Context Protocol 客户端
- `memory/` —— 基于 SQLite 的会话记忆
- `automation/` —— 基于 Cron 的计划任务
- `web/` —— 网页抓取与浏览工具
- `personas/` —— Persona 系统（由 YAML 定义的智能体配置）
- `skills/` —— 智能体技能框架
- `testing/` —— 测试工具（模拟 Slack 服务器）

## 约定

- 所有公共 API 都必须包含类型提示。
- 使用 Google 风格的文档字符串：`"""Summary.（空行）Details."""`
- 尽可能使用异步（asyncio）。
- 偏好设置通过 `manager.py` 中的 `_prefs` 字典存储在 `prefs.json` 中。
- 密钥通过 `SecretStore` 存储（静态加密）。
- 新设置遵循以下链路：`manager.py` getter/setter → `app.py` 路由 → `api.ts` 前端 API。
