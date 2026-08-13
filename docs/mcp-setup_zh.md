# 向 OpenWorker 添加 MCP 服务器

OpenWorker 支持通过配置文件接入 Model Context Protocol（MCP）服务器，从而使用任何符合标准的 MCP 服务器提供的工具来扩展智能体能力。

## 配置文件

OpenWorker 会在以下两个位置查找 `mcp.json`：

1. **工作区专属：** `<workspace>/.coworker/mcp.json`（覆盖全局设置）。
2. **全局：** `~/.config/coworker/mcp.json`

## 配置格式

配置遵循标准 MCP 格式：

```json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["/path/to/server/index.js"],
      "env": {
        "API_KEY": "your_key"
      }
    }
  }
}
```

## 主要特性

- **自动检测：** 系统根据配置自动识别传输层（`stdio` 或 `HTTP` / `SSE`）。
- **变量展开：** 可在 `command`、`args`、`env`、`url` 和 `headers` 中使用 `${VAR}`；加载时从系统环境和 `.env` 文件解析。
- **工具过滤：** 可限制向智能体公开的工具：
  - `include_tools`：明确允许的工具名称列表。
  - `exclude_tools`：禁止的工具名称列表。

## 快速开始示例

要添加本地服务器，请在项目根目录创建 `.coworker/mcp.json`：

```json
{
  "mcpServers": {
    "my-tool": {
      "command": "python",
      "args": ["/path/to/server.py"],
      "env": {
        "DEBUG": "true"
      }
    }
  }
}
```

智能体会在下一次运行时立即识别这些工具。
