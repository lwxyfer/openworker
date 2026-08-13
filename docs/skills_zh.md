# 使用技能

技能是智能体在任务需要时加载的一组指令——格式与 Anthropic 工具的 `SKILL.md` 相同，因此为 Claude Code 编写的技能也可以在这里使用，反之亦然。技能可以教会 OpenWorker 一套可重复的流程，例如报告格式、部署检查清单、特定表格的填写方式或客户邮件的写作规范。

从“**设置 ▸ 技能**”管理技能：可以直接创建和编辑、上传、在不同范围间移动、启用/禁用，或在磁盘中打开所在文件夹。文件夹才是事实来源——无论技能来自应用还是手动放入目录，以下行为都相同。

## 范围

| 目录 | 范围 |
|---|---|
| `<state-dir>/skills/<skill-name>/` | 全局——所有会话 |
| `<workspace>/.coworker/skills/<skill-name>/` | 项目——该工作区中的会话 |

macOS/Linux 上的 `<state-dir>` 是 `~/.config/coworker`，Windows 上是 `%APPDATA%\\coworker`；任何平台都可以用 `$COWORKER_STATE_DIR` 覆盖它。项目技能位于仓库中，因此提交 `.coworker/skills/` 就可以与团队成员共享。如果项目技能与全局技能同名，以项目副本为准。

技能名称会成为文件夹名称，因此只能使用字母、数字、点、短横线和下划线，最多 64 个字符。

## 格式

```markdown
---
name: weekly-report
description: Write the weekly status report. Use when asked for the weekly report or a status update.
---

# Weekly report

1. Read `template.md` in this skill's folder for the section layout.
2. Pull last week's numbers with the `github` and `linear` tools.
3. Keep the summary under 200 words; numbers go in the table, not the prose.
```

Frontmatter：

- `name`——技能 ID（默认使用文件夹名称）。
- `description`——**模型最先看到的一行内容**，因此要同时说明技能做什么以及何时使用；描述含糊会导致技能永远不被加载。
- `source`——来源标记（上传的技能使用 `uploaded`）；省略表示在本地创建。
- `allowed-tools`——可选的逗号分隔列表。为兼容共享格式而解析，但目前仅供参考：智能体真正能做什么由 OpenWorker 的权限模式和审批机制决定，而不是由此列表决定。

正文是自由格式的 Markdown。可以用相对名称引用技能文件夹中随技能提供的文件（模板、示例、脚本）；加载技能后，智能体会得到文件夹路径，并使用普通文件工具读取这些文件。技能附带的脚本仍然会像其他命令一样经过 shell 工具的审批门槛。

## 智能体如何使用技能——渐进式披露

技能正文不会塞进每个提示词。会话开始时，智能体只看到一个目录，其中包含每个已启用技能的名称和描述。任务匹配后，智能体调用 `load_skill` 工具，获得完整指令和文件夹路径。因此可以安装很多技能而不会让每次会话都变得沉重；始终存在的上下文只有描述行。

这也意味着描述负责路由。如果技能没有被选中，应当把描述改得更明确（例如加入“Use when …”），而不是不断扩充正文。会话中途创建的技能可以立即加载（`load_skill` 在未命中时会重新扫描）；它的目录行会从下一次会话开始出现。

## 关闭技能

有两个开关，且都属于个人设置：

- **设置 ▸ 技能**会在所有位置禁用技能。开关位于 `<state-dir>/skills-settings.json`，特意不放在技能文件夹内——项目技能会随仓库流转，个人禁用设置不应提交给团队成员。
- **每个会话**都可以只为当前对话静音某个技能。

任何一个开关关闭都会生效：设置中的禁用不能被会话开关重新启用。如果技能指令已经加载到正在运行的对话中，禁用技能还会通知该对话停止遵循它；否则历史中已有的指令仍可能继续影响模型。

## 添加技能

- **在应用中创建**——设置 ▸ 技能 ▸ 新建：填写名称、描述和指令。
- **上传**——上传一个只包含一个技能的 `.zip`（根目录或一级文件夹中有 `SKILL.md`，资源文件可一并携带），或上传一个 frontmatter 带有名称的裸 `SKILL.md`。上传内容会先暂存并预览，确认前不会进入范围目录。
- **手动放入文件夹**——将文件夹直接放入某个范围目录。
- **让智能体创建**——在对话中确定流程后，智能体可以通过 `save_skill` 工具提议保存。保存需要审批：卡片会在写入前展示完整名称、描述、指令和随附文件；随附文件只能来自当前会话自己的文件夹。

## 技能、`AGENTS.md` 与 persona

- `AGENTS.md`（`<state-dir>` 中的全局文件，以及工作区根目录中的项目文件）是注入**每个**会话的长期指引，适合存放始终成立的偏好。技能适合只在部分任务中生效的流程，按需加载。
- persona 是更大的单元：它定义智能体**是谁**（系统提示词、工具、连接器），也可以推荐技能；技能只是教授一套流程。

## API 用户

sidecar 通过 REST 提供管理接口（需要 token 请求头）：`GET /v1/skills?workspace=…`（返回范围、来源、启用状态和文件数量）、`POST /v1/skills`、`PATCH/DELETE /v1/skills/{name}`、`POST /v1/skills/{name}/move`、`POST /v1/skills/upload` + `/upload/confirm`（暂存），以及每个会话的开关 `GET/POST /v1/sessions/{id}/skills`。
