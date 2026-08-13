# 消息连接器

OpenWorker 可以通过双向连接器接收并回复来自消息平台（Slack、Telegram）的消息。

## 连接器的工作方式

启用消息连接器后，OpenWorker 会启动一个**监听器**，监控相应平台上的入站消息。收到消息时：

1. 监听器检查**允许列表**，判断发送者是否已获授权。
2. 如果已授权，消息会被路由给智能体处理。
3. 智能体的回复会作为同一线程/频道中的回复发回。

未授权的消息不会丢失，而是会停放在应用的连接器页面中，你可以稍后查看并回复。

## 允许列表（默认拒绝）

允许列表是入站安全防线。默认情况下列表**为空**，这意味着没有人可以通过连接器触达智能体。

### 添加自己

1. 打开 OpenWorker，进入连接器页面。
2. 在平台上找到自己的用户 ID，并将其加入允许列表。
3. 添加后，你的消息就会被路由给智能体。

如果确实希望接受任何人的消息，也可以将 `allow_all` 设为 `true`（不建议在生产环境使用）。

### 检查位置

参见 `coworker/connectors/config.py`：

```python
def is_authorized(settings: ConnectorSettings, source: SessionSource) -> bool:
    ...
```

## Telegram 配置

1. 在 Telegram 中通过 [BotFather](https://t.me/botfather) 创建机器人。
2. 复制机器人 token。
3. 在 OpenWorker 中进入“集成 > Telegram”，粘贴 token。
4. 启用连接器。
5. 将你的 Telegram 用户 ID 加入允许列表。

### Telegram 隐私模式

默认情况下，BotFather 会为机器人启用**隐私模式**。这意味着：

- **私信（DM）：** 机器人会收到所有消息，这是最可靠的测试方式。
- **群组：** 机器人只会收到以命令（`/`）开头、回复机器人消息或通过用户名提及它的消息。

如果机器人在群组中没有响应，请检查：

1. 是否启用了隐私模式？如有需要，用 BotFather 通过 `/setprivacy` 禁用。
2. 是否正确提及了机器人？（`@YourBotName your message`）

在群组测试前，务必先用私信测试。

## Slack 配置

1. 在 [Slack API 控制台](https://api.slack.com/apps) 创建 Slack 应用。
2. 添加所需的 bot token 权限范围。
3. 将应用安装到你的工作区。
4. 复制 bot token，并粘贴到 OpenWorker（“集成 > Slack”）。
5. 启用连接器。
6. 将你的 Slack 用户/成员 ID 加入允许列表。

### Socket Mode 与托管 relay

Slack 支持两种连接模式：

- **Socket Mode：** 完全在你的计算机上运行。启用 Socket Mode 的 Slack 应用，并粘贴 app-level token。
- **托管 relay（managed）：** 使用 OpenWorker 的 OAuth relay，配置更简单，但需要登录 OpenWorker 账户。

## 从源码运行

如果从源码运行 OpenWorker，需要安装消息功能额外依赖：

```bash
# 开发环境设置脚本会自动安装 [messaging] 额外依赖：
bash packaging/setup_dev_env.sh

# 如果手动设置，请安装带消息支持的依赖：
pip install -e ".[messaging]"
```

如果没有 `[messaging]` 额外依赖，监听器会因缺少 `slack-bolt`、`python-telegram-bot` 等包而启动失败。

## 故障排查：“已连接但收不到消息”

如果连接器显示已连接，但消息没有到达智能体：

1. **检查允许列表**——必须加入你的用户 ID（允许列表为空表示无人可通过）。
2. **检查连接器页面**——未授权消息会停放在那里。
3. **检查监听器状态**——确保监听器确实在运行（启动失败时也可能仍显示为“Live”）。
4. **检查额外依赖**——从源码运行时必须安装 `[messaging]`。
5. **使用私信测试**——可以避开平台特有的群组路由问题（Telegram 隐私模式、Slack 频道可见性）。
