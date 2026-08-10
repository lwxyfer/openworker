# OpenWorker Pull Request 筛选与自维护方案

> 目标：把 andrewyng/openworker fork 成自己的维护分支，按可验证的价值逐步吸收上游 PR。
> 批量清单快照：2026-08-10；完整数量、分组和 PR 链接见 [PR_BATCH_PLAN.zh-CN.md](PR_BATCH_PLAN.zh-CN.md)。

## 1. 结论先行

截至 2026-08-10，GitHub API 返回上游有 **237 个 open PR**。列表同时包含运行时可靠性、安全、Provider、Connector、Linux 打包、GUI 和中文本地化，不能按提交时间直接批量合并。来源：[上游 Pull Request 列表](https://github.com/andrewyng/openworker/pulls)。

第一批候选建议：

| 优先级 | PR | 建议 | 依据 |
|---|---:|---|---|
| P0 | [#458](https://github.com/andrewyng/openworker/pull/458) | 优先验证 | scheduled task 重复执行，可能产生重复外部副作用 |
| P0 | [#466](https://github.com/andrewyng/openworker/pull/466) | 优先验证 | context-window overflow 影响长任务和本地模型 |
| P0 | [#467](https://github.com/andrewyng/openworker/pull/467) | 优先验证 | Outlook 分页和 payload 上限关系到结果完整性与内存 |
| P0 | [#445](https://github.com/andrewyng/openworker/pull/445) | 先做安全回归 | 否定式 allow 被误判为批准会造成意外授权 |
| P1 | [#448](https://github.com/andrewyng/openworker/pull/448) | 建议吸收 | Provider Test 真正调用 chat completions |
| P1 | [#450](https://github.com/andrewyng/openworker/pull/450) | 建议吸收 | lint gate 降低后续维护成本 |
| P1 | [#449](https://github.com/andrewyng/openworker/pull/449) | 可单独吸收 | Qwen vision capability 边界较小 |
| P1 | [#474](https://github.com/andrewyng/openworker/pull/474) | 与 self-wake 测试一起审 | sleep 工具契约决定 Agent 是否结束 turn |
| P1 | [#434](https://github.com/andrewyng/openworker/pull/434) | 视本地模型需求 | LM Studio 对本地模型用户有直接价值 |
| P1 | [#440](https://github.com/andrewyng/openworker/pull/440) | 视中文产品目标 | 简体中文 GUI 对中文用户有直接价值 |

这是“第一轮排序”，不是已批准合并。当前环境不能稳定读取每个 PR 的完整 diff、checks 和 review thread；最终判定必须在 fork 中拉取分支并跑测试。

## 2. 先建立正确基线

本地 checkout 和 GitHub 页面可能不是同一天的代码。当前本地 main 是 2026-08-01 的提交，而上游 PR 列表已到 2026-08-09。PR 的 diff 必须以最新 upstream/main 重新计算。

    git status --short
    git log -1 --oneline --decorate
    git remote -v

如果工作区有自己的文档或开发改动，先放到独立分支或 worktree，不要混入 PR 分析。

## 3. Fork 后的远程布局

创建 fork 后，推荐把原仓库命名为 upstream，把自己的 fork 命名为 origin：

    git remote rename origin upstream
    git remote add origin https://github.com/<your-name>/openworker.git
    git fetch upstream --prune
    git fetch origin --prune
    git remote -v

最终：

    upstream = andrewyng/openworker   # 只读参考
    origin   = 你的 fork               # 发布和维护分支

建议分支：

    main                 你的稳定维护分支
    integration/pr-458   正在评估的单个 PR
    integration/batch-01 已验证的一小批 PR
    feature/<your-work>  你的新功能

不要在 main 上直接试验 PR。一个 PR 一个分支，便于回滚、比较和 bisect。

## 4. 一条 PR 的标准审查流程

### 4.1 获取元数据

有 GitHub CLI 时：

    gh pr view 458 --repo andrewyng/openworker \
      --json number,title,body,author,labels,state,isDraft,mergeable,reviewDecision,statusCheckRollup,files

至少记录标题、描述、作者、labels、draft 状态、review、checks 和变更文件。

### 4.2 拉取 PR 分支

    git fetch upstream pull/458/head:refs/remotes/upstream/pr-458
    git switch --create integration/pr-458 upstream/pr-458

如果 head ref 不可用，使用 PR 页面显示的 head repository 和 branch：

    git fetch https://github.com/<author>/<repo>.git <branch>
    git switch --create integration/pr-458 FETCH_HEAD

### 4.3 看 diff，再看代码

    git diff --stat upstream/main...integration/pr-458
    git diff --name-status upstream/main...integration/pr-458
    git log --oneline --decorate upstream/main..integration/pr-458
    git diff --find-renames upstream/main...integration/pr-458 -- coworker surfaces/gui tests

重点问：

1. 问题是否真实存在于你的产品场景？
2. 改动是否落在正确的层？
3. 是否改变权限、持久化、事件协议或 Provider contract？
4. 是否带有针对回归的测试？

### 4.4 最小验证

Python：

    .venv/bin/pytest tests/test_engine.py -q
    .venv/bin/pytest tests/test_server.py -q
    .venv/bin/pytest tests/test_automation.py tests/test_inbox.py -q

GUI：

    cd surfaces/gui
    npm test
    npm run build
    npm run e2e

Connector / Provider 还要跑对应的 tests/test_<area>.py。不要以“本地没依赖”代替合并判断；先运行 packaging/setup_dev_env.sh 和 npm install。

### 4.5 评分

每个 PR 记录 0–3 分：

| 维度 | 0 分 | 3 分 |
|---|---|---|
| 用户价值 | 与产品无关 | 直接解决高频核心场景 |
| 正确性/安全 | 偏好改动 | 修复数据错、重复副作用或授权风险 |
| 边界 | 大面积耦合 | 小范围、职责清楚 |
| 测试 | 无测试 | 有回归和边界测试 |
| 维护成本 | 新服务或新协议 | 复用现有抽象 |
| 可逆性 | 迁移/破坏性协议 | 可独立回滚 |

安全或数据正确性问题即使总分不高也可能优先；大功能若测试和边界不足，应先 hold。

## 5. 第一轮分组与审查重点

### A. 可靠性和安全，优先验证

**#458 scheduled task 重复执行**

检查 scheduler 是否存在 check-then-act race、skip-on-overlap 是否只在内存中判断、run 是否先落盘再启动 Engine、异常/重启/stale lock 是否恢复，以及是否有两个并发 tick 的回归测试。手动 Run-now 不能被误判成 scheduled overlap。

**#466 custom model context-window overflow recovery**

检查是否使用 Provider 实际 context window；截断后 assistant tool_calls 和 tool result 是否配对；recovery 是否无限重试；model switch、retry、durable resume 是否仍工作；是否覆盖 tool-use loop 中的 overflow。至少验证一个 OpenAI-compatible custom endpoint，并证明不会重复执行工具。

**#467 Outlook 分页和 payload bound**

检查 continuation token、重复页、page size、总结果数、message body、HTML、附件和 API error。截断必须让 Agent / UI 知道，而不是静默丢数据。测试应覆盖空页、重复 token、多页、超大 body。

**#445 Inbox 否定式 allow**

审批解析应 fail-closed。检查 no、don't allow、deny、中文“不要/拒绝”、模糊文本、first-responder-wins 和 durable resume。无法判断时应拒绝或继续要求明确选择，而不是放行。

**#461 MCP per-tool risk overrides**

这是安全功能，不是普通 Settings UI。检查 override 是否只能来自用户本地配置；MCP、Persona、模型不能自授予；是否能把 shell/write/external 降级成低风险；审计是否记录原始与覆盖后风险；plan/discuss 是否仍 fail-closed。没有完整安全审查前不建议直接合并。

### B. 小范围高性价比

- **#448**：只访问 /models 不能证明 chat/tool-call 可用；检查 timeout、401、429、模型不存在以及 OpenAI-compatible provider。
- **#450**：检查 lint 是否排除 .venv、生成目录和 Tauri build，且本地可复现。
- **#449**：确认 model ID、provider prefix、capability cache、UI matrix 一致，并有静态映射测试。
- **#474**：检查 sleep_for、sleep_until、wake_on 和真实 resume 测试；只有 prompt 没有测试时，优先级低于 #458。

### C. 按产品方向选择

- **#434 LM Studio**：对本地模型用户有价值；检查 ProviderRouter、secret profile、model prefix、model discovery 和 capability。
- **#440 简体中文 GUI**：确认是统一 i18n message key，而不是 JSX 硬编码中文；检查英文默认、长文本、审批卡、connector 名称和 E2E selector。
- **#442 Feishu inbound + connector-scoped automations**：对中国团队有价值，但涉及 Connector、Inbox 和 automation 交叉边界，排在核心可靠性之后。
- **#470 Linux .deb + AppImage**：只有明确服务 Linux 用户才提前；重点审 sidecar resource_dir、Tauri capabilities、CI 和自动更新策略。
- **#473 NVIDIA NIM、#447 Vercel AI Gateway**：特定 Provider 需求，通常晚于 #448 和 #434。

### D. 低风险但不要打断核心路线

| PR | 建议 |
|---:|---|
| #477 security policy | 建议吸收；这是文档，不是漏洞修复 |
| #476 cloud sign-in status | GUI 测试通过后吸收 |
| #464 DeleteConfirmModal | 检查所有 destructive action 是否覆盖一致 |
| #452 Tauri opener | 检查 plugin 配置和浏览器 fallback |
| #459、#439 IME Enter | 先确认重复关系，只保留一个实现；必须做中文/日文 IME E2E |
| #446 provider models UI | 便利性功能，不应阻塞稳定性 |
| #475 wiki index context | 产品特定，除非你的产品依赖 wiki/INDEX.md，否则不默认合并 |
| #468 AI command intent analysis | 可能扩大审批自动化范围，没有 fail-closed 证明不建议吸收 |
| #435 Chinese docs | 与 #440 的本地化资源策略统一后再合并 |

## 6. 推荐合并批次

### Batch 0：维护基础

1. #450 lint gate；
2. #477 security policy；
3. #452、#464、#476 等低风险 GUI 修复；
4. #459 / #439 中经过验证的一个 IME 修复。

### Batch 1：可靠性和安全

1. #458 scheduler overlap；
2. #467 Outlook payload / pagination；
3. #445 Inbox refusal semantics；
4. #466 context overflow recovery；
5. #461 risk overrides（额外安全审查后）。

每合并一个 PR 都在 main 上重新跑测试；不要累积五个 PR 后才第一次验证。

### Batch 2：模型和本地运行

按用户画像选择 #434 LM Studio、#448 Provider verification、#449 Qwen vision，再评估 #473 / #447。

### Batch 3：中文产品和平台

先处理 #440 / #435 的重叠，再评估 #442 Feishu，最后独立处理 #470 Linux 打包。

## 7. merge、cherry-pick 还是手工移植

直接 merge 适合基于近期 main、提交完整、边界清楚且你想保留原历史的 PR。

维护 fork 更推荐在 integration 分支验证后 cherry-pick：

    git switch main
    git pull --ff-only origin main
    git cherry-pick <validated-pr-commit>

当上游已重构、PR 只想吸收一个 bug fix 或存在大量冲突时，手工移植更安全：

1. 阅读 diff 和测试；
2. 在自己的分支重写最小行为；
3. 保留或重写回归测试；
4. 记录 derived from PR #N。

目标不是保留全部上游提交，而是保留经过产品验证的行为。

## 8. PR ledger

建议维护 docs/pr-ledger.md：

    | PR | 领域 | 价值 | 风险 | 决定 | 分支/提交 | 测试 | 复审日期 |
    |---:|---|---:|---:|---|---|---|---|
    | #458 | automation | 3 | 3 | accept | main @ 24c0f194 | 19 passed; 1 warning | 2026-08-09 |
    | #466 | engine/context | 3 | 3 | accept | main @ 26a169d4 | 42 Python passed; GUI build + 111 unit passed | 2026-08-09 |
    | #467 | Outlook | 3 | 3 | accept | main @ f70012fe | 62 passed; 1 warning | 2026-08-09 |
    | #445 | inbox/security | 3 | 3 | accept | main @ c0efffe7 | 21 passed | 2026-08-09 |
    | #448 | provider | 2 | 2 | accept | main @ 8c64f2fc | 42 passed; upstream CI green | 2026-08-09 |
    | #449 | provider matrix | 2 | 1 | accept | main @ 17cf1a92 | 26 passed | 2026-08-09 |
    | #477 | security policy | 2 | 1 | accept | main @ cad2d2e5 | upstream CI green | 2026-08-09 |
    | #482 | provider matrix | 2 | 1 | accept | main @ a8f3debb | 27 passed | 2026-08-10 |
    | #439 | GUI/IME | 2 | 1 | accept | main @ 157624b2 | 111 GUI passed; build passed | 2026-08-10 |
    | #476 | GUI/cloud | 2 | 1 | accept | main @ 5866ed34 | 111 GUI passed; build passed | 2026-08-10 |
    | #452 | GUI/Tauri | 2 | 2 | accept | main @ eae869c7 | 112 GUI passed; build passed; cargo blocked by registry | 2026-08-10 |
    | #420 | GUI/artifacts | 2 | 1 | accept | main @ f92ba6a1 | 113 GUI passed; build passed | 2026-08-10 |
    | #418 | docs/MCP/skills | 2 | 1 | accept | main @ 807f3b10 | docs-only | 2026-08-10 |
    | #474 | self-wake | 2 | 2 | accept | main @ d0f5013d | 10 passed | 2026-08-10 |
    | #433 | permissions/security | 3 | 3 | accept | main @ 0f59face | 63 passed; upstream CI green | 2026-08-10 |
    | #434 | provider/LM Studio | 3 | 2 | accept | main @ 5c519f93 | 71 Python passed; 115 GUI passed; build passed | 2026-08-10 |

决定固定使用：

- pending：还没拉取或证据不足；
- accept：已通过 fork 测试；
- adapt：吸收思路并手工移植；
- hold：有价值但等待依赖/需求；
- reject：方向冲突或风险不可接受；
- duplicate：与另一个 PR 重复；
- superseded：被上游新提交覆盖。

## 9. 前端开发者的审查地图

GUI PR 沿这条链路读：

    React component
      → api.ts REST / Session WS
      → server/app.py endpoint or WS message
      → manager.py state transition
      → engine / connector / store
      → tests and replay path

特别注意两类“看起来只改 UI，实际上改变后端行为”的 PR：

1. 审批、Inbox、unattended、automation：必须检查后端权限和持久化。
2. model/provider、context、tool card：必须检查实时事件和历史重放。

OpenWorker 没有 OpenAPI 自动生成 TypeScript 类型。修改字段、事件名或消息 role 时，同时检查：

- surfaces/gui/src/types.ts
- surfaces/gui/src/api.ts
- surfaces/gui/src/App.tsx 的 handleEvent
- surfaces/gui/src/itemsFromMessages.ts
- tests/ 和 surfaces/gui/e2e/

## 10. 每个合并 PR 的验收清单

    [ ] 不是 duplicate / superseded
    [ ] 已读描述、diff、变更文件、checks、review thread
    [ ] 已基于最新 upstream/main 重算 diff
    [ ] 没有 secret、生成物或不必要依赖
    [ ] 已读懂权限、持久化和事件协议影响
    [ ] 已验证或补齐回归测试
    [ ] Python tests 通过
    [ ] GUI build / relevant E2E 通过
    [ ] 已做运行时 smoke test
    [ ] ledger 记录决定、提交、测试和限制
    [ ] 合并后可单独 revert

## 11. 现在可以执行的第一轮命令

这些命令只准备分析分支，不向上游提交：

    git remote rename origin upstream
    git remote add origin https://github.com/<your-name>/openworker.git
    git fetch upstream --prune

    git switch --create integration/pr-458 upstream/main
    git fetch upstream pull/458/head:refs/remotes/upstream/pr-458
    git diff --stat upstream/main...upstream/pr-458
    git diff --name-status upstream/main...upstream/pr-458

确认 #458 后，按同样方式分析 #467、#445、#466。一次只分析一个 PR；修改相同文件的 PR 先标记为可能冲突，不要同时 cherry-pick。

## 12. 和项目导览的关系

先读 [PROJECT_GUIDE.zh-CN.md](PROJECT_GUIDE.zh-CN.md)，再用本文做 PR 审查。项目导览解释 SessionManager、TurnEngine、权限、Provider 和前后端事件链；本文解释如何判断上游 patch 是否值得进入你的产品分支。
