# 使用 MCP 服务器

OpenWorker 可以使用任何通过 [MCP](https://modelcontextprotocol.io/)（Model Context Protocol，模型上下文协议）可访问的工具。服务器工具会加入智能体工具箱，名称格式为 `mcp__<server>__<tool>`，并与其他有影响的工具一样经过审批流程。

## 配置位置

| 文件 | 范围 | 生效条件 |
|---|---|---|
| `<state-dir>/mcp.json` | 全局——所有会话 | 始终生效 |
| `<workspace>/.coworker/mcp.json` | 单个项目 | 仅在信任该工作区后生效 |

macOS/Linux 上的 `<state-dir>` 是 `~/.config/coworker`，Windows 上是 `%APPDATA%\\coworker`；任何平台都可以用 `$COWORKER_STATE_DIR` 覆盖它。

有两条安全规则：

- **绝不读取不受信任的工作区。** stdio 服务器会在会话打开时启动进程，仅仅克隆下来的仓库不能定义服务器。信任该文件夹后，工作区配置才会生效；仓库的 `allowed_commands` 也使用同一信任门槛。
- **名称冲突时全局配置优先。** 即使仓库已受信任，也不能通过复用名称悄悄重定义全局服务器。

应用的 MCP 页面编辑全局文件。为内置连接器提供支持的服务器（例如 Jira 或 monday.com）从“集成”页面管理，不会出现在 MCP 页面中。

## 文件格式

标准的 `mcpServers` JSON——已经用于 Claude Desktop、Cursor 或 Codex 的配置可以原样粘贴：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/notes"]
    },
    "internal-api": {
      "url": "https://mcp.example.com/mcp",
      "headers": {"Authorization": "Bearer ${INTERNAL_API_TOKEN}"},
      "include_tools": ["search", "read_doc"],
      "requires_approval": false
    },
    "issue-tracker": {
      "url": "https://mcp.tracker.example/mcp",
      "auth": "oauth"
    }
  }
}
```

每个服务器支持的字段：

- `command`、`args`、`env`、`cwd`：在本地启动的 stdio 服务器。
- `url`、`headers`：HTTP 服务器（`streamable-http`/`sse`）；`type` 可显式指定传输方式，否则出现 `url` 即表示 HTTP。
- `enabled`：设为 `false` 可保留配置但不启用服务器。
- `include_tools` / `exclude_tools`：限制向智能体提供的工具。
- `requires_approval`：默认值为 `true`，每次调用前都会询问。只有在信任服务器可自行执行操作时才设为 `false`；也可以在 `<state-dir>/risk_overrides.json` 中按模式放宽特定工具的限制。
- `auth: "oauth"`：为 HTTP 服务器启用浏览器登录。

`${VAR}` 引用会在加载时从环境变量和 `<state-dir>/.env` 解析，因此无需把令牌直接写入 `mcp.json`。

## OAuth 服务器

声明 `auth: "oauth"` 的服务器使用带 PKCE 和动态客户端注册的 OAuth 2.1：无需预先注册 client id，broker 不保存任何内容，流程完全在你的计算机与服务器之间完成。可从 MCP 页面连接；浏览器负责完成登录，令牌会写入 OpenWorker 的本地密钥存储，绝不会写入 `mcp.json`。

会话不会自行启动浏览器：如果服务器在回合执行期间需要重新认证，会跳过该服务器并在 MCP 页面标记状态；会话会在没有这些工具的情况下继续运行，直到你重新连接。退出登录会同时忘记令牌和动态客户端注册信息。

## MCP 页面上的状态

`connected`（可访问，已列出工具）· `authorizing`（浏览器流程进行中）· `needs_auth`（需要重新连接登录）· `configured`（已定义，尚未探测）· `disabled`（`enabled: false`）。每个服务器会单独显示连接错误。

## API 用户

sidecar 通过 REST 暴露相同操作（需要 token 请求头）：`GET/POST /v1/mcp`、`PATCH/DELETE /v1/mcp/{name}`、`GET /v1/mcp/{name}/tools`、`POST /v1/mcp/{name}/connect`、`POST /v1/mcp/{name}/signout`、`POST /v1/mcp/reload`。这些接口只编辑**全局**文件。
