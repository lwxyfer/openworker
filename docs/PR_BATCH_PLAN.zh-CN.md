# OpenWorker PR 批处理清单（可执行版）

> 数据快照：2026-08-10；来源：GitHub API / `gh pr list`，仓库 [andrewyng/openworker](https://github.com/andrewyng/openworker)。  
> 说明：上游 PR 仍保持 open；“已合并”表示已合入你的 fork `lwxyfer/openworker` 的 `main`。

## 1. 总量与互斥分组

| 分组 | 数量 | 当前动作 |
|---|---:|---|
| 上游 open PR 总数 | **237** | 全部纳入台账 |
| 已合入 fork main | **16** | 不重复处理 |
| 默认进入审查/合并队列（非 Draft、非 DIRTY、未合入） | **148** | 按批次处理；通过测试后合入 |
| 其中 GitHub 标记 CLEAN | **7** | 第一优先级，可先验证 |
| 其中 GitHub 标记 UNSTABLE | **141** | 仍可审查，但先跑 checks/测试 |
| 暂缓（Draft 或 DIRTY，去重后） | **73** | 不直接合并；等待作者 ready/rebase，或手工移植 |
| **合计** | **237** | 16 + 148 + 73 |

> GitHub 的 `mergeStateStatus` 只是当前分支相对 upstream/main 的状态，不等于代码质量。“UNSTABLE”不代表不能合并，“DIRTY”代表需要先解决冲突。  
> 73 个暂缓项中有 10 个 Draft、65 个 DIRTY，其中 #73/#74 同时属于 Draft+DIRTY，所以去重后是 73。

## 2. 已合入（16 个，A 批次）

| PR | 主题 | 说明 | 结果 | fork commit |
|---:|---|---|---|---|
| #458 | scheduler overlap | 调度重复执行 | 已合并 | 24c0f194 |
| #467 | Outlook pagination | 分页与 payload 上限 | 已合并 | f70012fe |
| #445 | inbox approval | 否定式审批安全 | 已合并 | c0efffe7 |
| #466 | context recovery | 上下文溢出恢复 | 已合并 | 26a169d4 |
| #477 | security policy | 安全政策文档 | 已合并 | cad2d2e5 |
| #448 | provider verification | Provider chat probe | 已合并 | 8c64f2fc |
| #449 | Qwen vision | Provider capability | 已合并 | 17cf1a92 |
| #482 | OpenRouter vision | Provider capability | 已合并 | a8f3debb |
| #439 | IME composition | 输入法提交 | 已合并 | 157624b2e |
| #476 | cloud sign-in | GUI 状态 | 已合并 | 5866ed34 |
| #452 | Tauri opener | 外部链接 | 已合并 | eae869c7 |
| #420 | artifact reveal | 会话目录与 artifact | 已合并 | f92ba6a1 |
| #418 | MCP/Skills docs | 文档 | 已合并 | 807f3b10 |
| #474 | self-wake | Agent 自唤醒契约 | 已合并 | d0f5013d |
| #433 | permissions TOCTOU | 权限安全 | 已合并 | 0f59face |
| #434 | LM Studio | 本地 Provider | 已合并 | 5c519f93 |

已做过的关键验证：A 批次的 fork main 定向 Python 测试为 **290 passed, 1 warning**；后续批处理在工作分支上继续完成并记录在 `docs/pr-ledger.md`。

## 2.1 本轮 B0/B1/B2 执行结果（2026-08-10）

| 方向 | 进入本轮 | 已适配/合入 | 暂缓/重复 | 结果摘要 |
|---|---:|---:|---:|---|
| B0 CLEAN | 7 | 6 | 1 | #19/#113/#246/#289/#297/#388；#15 因当前 API 已被替代而 superseded |
| B1 安全/可靠性/基础 | 52 | 约 39 | 约 13 | 追加 #79/#175/#219/#307/#406/#461；#281 由 #307 覆盖 |
| B2 Provider | 12 | 11（含 consolidated） | 1 | #86/#142/#152/#183/#233/#262/#303/#345/#360/#446/#447；#110 高范围 hold |
| B2 GUI/中文/交互 | 16 | 14 | 2 | #118/#126/#169/#176/#192/#212/#234/#245/#251/#312/#346/#348/#464/#475；#123/#199 属于重叠/冲突项 |

> “已适配/合入”均为当前工作分支的独立提交，尚未把上游 PR 状态改为 closed；推送到 fork main 前会再跑一次合并后的总回归。对 #110 这类近万行、涉及新协议和锁文件的 PR，不做无审查整包合并。

## 3. 批次执行顺序

### B0：CLEAN、低风险、可快速回滚（7 个）

先处理下面 7 个 CLEAN PR，每个 PR 单独验证、合入、记录：

- #15、#19、#113、#246、#289、#297、#388

建议顺序：安全/正确性（#289、#297）→ GUI 正确性（#113、#246、#388）→ 平台能力（#19）→ 测试稳定性（#15）。

### B1：安全、可靠性、开发基础（建议优先）

下面只列当前已进入第 5 节候选队列的 PR；B0 的 7 个 CLEAN PR 和第 4 节的冲突/Draft PR 不重复列入。它们不是“无条件合并”，而是先审查后合并：

- 安全边界：#55、#186、#190、#217、#242、#250、#281、#291、#301、#307、#310、#380、#400、#406、#461
- 可靠性/数据正确性：#61、#70、#159、#172、#175、#205、#209、#210、#216、#219、#222、#350、#363、#365、#368、#392、#430
- 维护基础/测试/文档：#12、#14、#20、#26、#48、#79、#92、#129、#138、#195、#196、#218、#236、#238、#243、#294、#305、#328、#343、#344

### B2：按你的产品方向选择

下列是主题索引，可能包含第 4 节暂缓项或已合入项；执行时以完整名单中的当前状态为准。

- 本地模型：#177、#178、#184（与已合入 #434 重叠，默认不再直接合）、#193、#273、#277、#334、#358、#385、#412、#473
- Provider/模型目录：#44、#59、#63、#66、#77、#86、#110、#137、#141、#142、#152、#183、#185、#201、#224、#233、#256、#262、#303、#345、#360、#447、#446
- GUI/中文/交互：#102、#112、#118、#123、#126、#127、#166、#169、#176、#192、#199、#212、#234、#245、#251、#306、#312、#324、#325、#326、#327、#332、#341、#346、#348、#349、#425、#435、#440、#459、#464、#475
- Connector/渠道/业务功能：#1、#23、#24、#45、#50、#52、#58、#60、#114、#133、#147、#173、#174、#197、#198、#203、#211、#214、#220、#221、#225、#229、#247、#252、#253、#258、#260、#266、#271、#285、#286、#299、#300、#361、#372、#376、#377、#378、#379、#387、#395、#396、#405、#442、#468、#470、#475、#480、#483、#484

> B1/B2 是“审查队列”，不是承诺全部合并。若 PR 与现有功能重复、测试不足、引入新协议或不符合你的产品方向，应在处理时标为 `hold` / `duplicate` / `superseded`。

### B3：重叠功能只选一个实现

这些主题存在明显重叠，不能整组直接 merge：

- IME Enter：#65、#74、#90、#306、#341、#439、#459 → 已合入 #439，其他默认先标 `duplicate/superseded`
- 中文 i18n：#127、#235、#324、#425、#435、#440 → 先统一方案；通常只保留一条完整 i18n 实现
- LM Studio/OpenAI-compatible：#177、#184、#224、#434 → #434 已合入，其他只挑增量
- OpenRouter/Groq/Provider reseller：#44、#141、#201、#224、#447 → 先统一 Provider 抽象
- NVIDIA NIM：#185、#385、#473 → 三选一或拆分
- SambaNova：#334、#357、#358 → 三选一或拆分
- Context compaction/guard：#76、#325、#395、#466 → #466 已合入，其他只吸收未覆盖的增量
- Scheduler overlap：#61、#379、#458 → #458 已合入，其他只吸收不同回归
- Web fetch 安全/下载：#147、#157、#170 → 按安全与性能拆开验证
- Artifact preview/annotation：#188、#225、#329、#374、#420 → #420 已合入，其他只吸收独立能力
- Tauri opener/external browser：#241、#271、#452 → #452 已合入，其他默认不再直接合并

## 4. 暂缓清单（73 个：Draft 或 DIRTY）

暂缓的原因是“当前不能直接安全合并”，不是永久拒绝。作者 rebase、转 ready，或我们手工移植后可重新进入队列。

- [#21](https://github.com/andrewyng/openworker/pull/21) — Fix two approval-safety bugs: shell allowlist bypass and reply-intent substring match（状态：DIRTY）
- [#44](https://github.com/andrewyng/openworker/pull/44) — feat(providers): add Groq and OpenRouter as first-class resellers（状态：DIRTY）
- [#46](https://github.com/andrewyng/openworker/pull/46) — feat(memory): add hybrid semantic vector search and top-k retrieval（状态：DIRTY）
- [#53](https://github.com/andrewyng/openworker/pull/53) — Normalize provider API keys on read（状态：DIRTY）
- [#58](https://github.com/andrewyng/openworker/pull/58) — feat(ux): Add web search provider management and UI integration（状态：DIRTY）
- [#59](https://github.com/andrewyng/openworker/pull/59) — Add Upstage (Solar) as an OpenAI-compatible model provider（状态：DIRTY）
- [#60](https://github.com/andrewyng/openworker/pull/60) — Add on-device Apple Foundation Models provider（状态：DIRTY）
- [#63](https://github.com/andrewyng/openworker/pull/63) — Add a self-hosted (GPU) OpenAI-compatible model provider（状态：DIRTY）
- [#65](https://github.com/andrewyng/openworker/pull/65) — Fix chat composer sending on Enter during IME composition（状态：DIRTY）
- [#66](https://github.com/andrewyng/openworker/pull/66) — Add "GLM (Z AI · coding plan)" provider (Z AI Anthropic endpoint)（状态：DIRTY）
- [#67](https://github.com/andrewyng/openworker/pull/67) — Retain oversized tool output for paged retrieval（状态：DIRTY）
- [#73](https://github.com/andrewyng/openworker/pull/73) — Fix GUI README paths（状态：DIRTY，Draft）
- [#74](https://github.com/andrewyng/openworker/pull/74) — Prevent IME candidate confirmation from sending（状态：DIRTY，Draft）
- [#76](https://github.com/andrewyng/openworker/pull/76) — feat(engine): add context window guard and rolling history trimmer for local models（状态：DIRTY）
- [#77](https://github.com/andrewyng/openworker/pull/77) — feat(providers): add AnyRouter provider（状态：DIRTY）
- [#90](https://github.com/andrewyng/openworker/pull/90) — fix: Python version check in setup_dev_env.sh + IME Enter key in Composer（状态：DIRTY）
- [#91](https://github.com/andrewyng/openworker/pull/91) — feat: add base_url support to Anthropic provider (#84)（状态：DIRTY）
- [#102](https://github.com/andrewyng/openworker/pull/102) — Make the composer's model pick stick to new sessions（状态：DIRTY）
- [#112](https://github.com/andrewyng/openworker/pull/112) — Peel inline <think> tags out of content for MiniMax M2 and R1-style models（状态：DIRTY）
- [#114](https://github.com/andrewyng/openworker/pull/114) — feat: add browser and desktop voice discussion mode（状态：DIRTY）
- [#127](https://github.com/andrewyng/openworker/pull/127) — Add GUI internationalization with English and Simplified Chinese（状态：DIRTY）
- [#133](https://github.com/andrewyng/openworker/pull/133) — Add live-follow side sessions（状态：DIRTY）
- [#137](https://github.com/andrewyng/openworker/pull/137) — Add Gemini Enterprise (Vertex AI) model provider（状态：DIRTY）
- [#141](https://github.com/andrewyng/openworker/pull/141) — Add OpenRouter as a model provider（状态：DIRTY）
- [#144](https://github.com/andrewyng/openworker/pull/144) — Harden delivery, runtime boundaries, and maintainability (75 → 92)（状态：DIRTY）
- [#147](https://github.com/andrewyng/openworker/pull/147) — Let web_fetch use the search provider's page scraper（状态：DIRTY）
- [#148](https://github.com/andrewyng/openworker/pull/148) — Provider error rewrites can name the wrong cause — persist the original（状态：DIRTY）
- [#157](https://github.com/andrewyng/openworker/pull/157) — fix(web): cap web_fetch downloads at a byte budget instead of buffering entire bodies（状态：DIRTY）
- [#166](https://github.com/andrewyng/openworker/pull/166) — [codex] Fix sidebar reveal button flicker（状态：UNSTABLE，Draft）
- [#170](https://github.com/andrewyng/openworker/pull/170) — Block SSRF in web_fetch: refuse non-public hosts on every hop（状态：DIRTY）
- [#175](https://github.com/andrewyng/openworker/pull/175) — Let users cancel ask_user questions（状态：DIRTY）
- [#177](https://github.com/andrewyng/openworker/pull/177) — Allow an optional API key for Ollama / local OpenAI-compatible servers（状态：DIRTY）
- [#184](https://github.com/andrewyng/openworker/pull/184) — Add LM Studio as a keyless local model provider.（状态：DIRTY）
- [#185](https://github.com/andrewyng/openworker/pull/185) — Add NVIDIA NIM provider support（状态：DIRTY）
- [#193](https://github.com/andrewyng/openworker/pull/193) — Add Nebius Token Factory provider（状态：DIRTY）
- [#194](https://github.com/andrewyng/openworker/pull/194) — docs: fix stale platform/ paths left over from monorepo extraction（状态：DIRTY）
- [#201](https://github.com/andrewyng/openworker/pull/201) — Add CLAUDE.md files for Claude Code guidance and add Groq/OpenRouter …（状态：DIRTY）
- [#221](https://github.com/andrewyng/openworker/pull/221) — Add New Relic MCP connector for on-call triage（状态：DIRTY）
- [#224](https://github.com/andrewyng/openworker/pull/224) — Add custom OpenAI-compatible providers（状态：DIRTY）
- [#226](https://github.com/andrewyng/openworker/pull/226) — Implement fan-out subagent guard middleware（状态：DIRTY）
- [#235](https://github.com/andrewyng/openworker/pull/235) — feat(i18n): add Chinese (zh-CN) language support（状态：DIRTY）
- [#244](https://github.com/andrewyng/openworker/pull/244) — fix(openai): fall back to Responses API for tool calls（状态：DIRTY）
- [#247](https://github.com/andrewyng/openworker/pull/247) — Add Apify connector with local dataset cache and keyword search（状态：DIRTY）
- [#254](https://github.com/andrewyng/openworker/pull/254) — Fix inbox routing allow/deny substring matching（状态：DIRTY）
- [#255](https://github.com/andrewyng/openworker/pull/255) — Make WakeStore robust against concurrent access and corrupt files（状态：DIRTY）
- [#256](https://github.com/andrewyng/openworker/pull/256) — feat: Venice support（状态：DIRTY）
- [#260](https://github.com/andrewyng/openworker/pull/260) — Fix Telegram/Slack inbound: bundle the messaging extra, and stop claiming a dead listener is Live (#257)（状态：DIRTY）
- [#263](https://github.com/andrewyng/openworker/pull/263) — Refactor README for better readability（状态：DIRTY）
- [#306](https://github.com/andrewyng/openworker/pull/306) — Add configurable composer Enter behavior（状态：DIRTY）
- [#313](https://github.com/andrewyng/openworker/pull/313) — Add Inwise local MCP connector and meeting prep（状态：UNSTABLE，Draft）
- [#318](https://github.com/andrewyng/openworker/pull/318) — [codex] Secure workspace trust persistence on Windows（状态：UNSTABLE，Draft）
- [#320](https://github.com/andrewyng/openworker/pull/320) — [codex] Clean up session-owned processes and stores（状态：UNSTABLE，Draft）
- [#322](https://github.com/andrewyng/openworker/pull/322) — [codex] Secure global MCP configuration writes（状态：UNSTABLE，Draft）
- [#324](https://github.com/andrewyng/openworker/pull/324) — Add Enligsh and Chinese languages（状态：DIRTY）
- [#325](https://github.com/andrewyng/openworker/pull/325) — Add manual and automatic context compaction（状态：DIRTY）
- [#326](https://github.com/andrewyng/openworker/pull/326) — Add inline skill chooser with exact-path injection（状态：DIRTY）
- [#327](https://github.com/andrewyng/openworker/pull/327) — Refresh compat-vendor matrix windows and expand Qwen catalog（状态：DIRTY）
- [#329](https://github.com/andrewyng/openworker/pull/329) — Add artifact annotation workflow for PDFs, Markdown, HTML, and images（状态：DIRTY）
- [#332](https://github.com/andrewyng/openworker/pull/332) — Add Ollama context-window bar, scroll-to-bottom, and chat model defaults（状态：DIRTY）
- [#339](https://github.com/andrewyng/openworker/pull/339) — Add Intel Mac (x86_64) build to release workflow（状态：DIRTY）
- [#341](https://github.com/andrewyng/openworker/pull/341) — feat: configurable Enter key behavior in composer（状态：DIRTY）
- [#349](https://github.com/andrewyng/openworker/pull/349) — fix(gui): restore Stop/thinking chrome after switching mid-turn sessions（状态：DIRTY）
- [#357](https://github.com/andrewyng/openworker/pull/357) — Add SambaNova as OpenAI-compatible provider（状态：UNSTABLE，Draft）
- [#361](https://github.com/andrewyng/openworker/pull/361) — feat: Browser Use CLI（状态：DIRTY）
- [#374](https://github.com/andrewyng/openworker/pull/374) — fix: HTML artifact preview - serve endpoint replaces truncated srcDoc（状态：DIRTY）
- [#394](https://github.com/andrewyng/openworker/pull/394) — Coerce ask_user options to strings — object-shaped options blank the desktop window（状态：DIRTY）
- [#396](https://github.com/andrewyng/openworker/pull/396) — Add shared in-app browser and browser-use tools（状态：DIRTY）
- [#425](https://github.com/andrewyng/openworker/pull/425) — feat(gui): add full Chinese (zh) localization via react-i18next（状态：DIRTY）
- [#435](https://github.com/andrewyng/openworker/pull/435) — docs: add Chinese localization resources（状态：UNSTABLE，Draft）
- [#440](https://github.com/andrewyng/openworker/pull/440) — i18n: Simplified Chinese (zh-CN) translation of the GUI（状态：DIRTY）
- [#442](https://github.com/andrewyng/openworker/pull/442) — feat: improve Feishu inbound workflows and connector-scoped automations（状态：DIRTY）
- [#450](https://github.com/andrewyng/openworker/pull/450) — ci: add a ruff (pyflakes) lint gate（状态：DIRTY）
- [#459](https://github.com/andrewyng/openworker/pull/459) — Fix IME Enter key submission（状态：UNSTABLE，Draft）

## 5. 默认审查/合并队列（148 个）

下面是去掉已合入、Draft 和 DIRTY 后的完整名单。执行时应按 B0 → B1 → B2；每个 PR 通过最小测试后再进入 fork main。

- [#1](https://github.com/andrewyng/openworker/pull/1) — port aisuite#381: Obsidian connector (local vault, no account)（状态：UNSTABLE）
- [#12](https://github.com/andrewyng/openworker/pull/12) — Fix setup_dev_env.sh on Windows (Scripts/ layout, python -m pip, rela… Closes #9（状态：UNSTABLE）
- [#14](https://github.com/andrewyng/openworker/pull/14) — Raise Python floor to 3.11 in docs and metadata（状态：UNSTABLE）
- [#15](https://github.com/andrewyng/openworker/pull/15) — Stabilize curated Ollama model test（状态：CLEAN）
- [#16](https://github.com/andrewyng/openworker/pull/16) — feat(gui): add visual diff previews to approval cards（状态：UNSTABLE）
- [#19](https://github.com/andrewyng/openworker/pull/19) — Add Linux support: AppImage distribution + voice input & keep-awake（状态：CLEAN）
- [#20](https://github.com/andrewyng/openworker/pull/20) — Fix ripgrep output parsing on Windows drive-letter paths（状态：UNSTABLE）
- [#23](https://github.com/andrewyng/openworker/pull/23) — fix(automation): align cron day-of-week labels with standard cron (0=Sunday)（状态：UNSTABLE）
- [#24](https://github.com/andrewyng/openworker/pull/24) — Parse inbox reply intent from the leading word, not substrings（状态：UNSTABLE）
- [#25](https://github.com/andrewyng/openworker/pull/25) — Add TrustedRouter model provider（状态：UNSTABLE）
- [#26](https://github.com/andrewyng/openworker/pull/26) — Clarify AI provider flexibility in README（状态：UNSTABLE）
- [#45](https://github.com/andrewyng/openworker/pull/45) — Confine browser_screenshot destination to the session's writable roots（状态：UNSTABLE）
- [#47](https://github.com/andrewyng/openworker/pull/47) — Add an opt-in macOS Keychain backend to the secret store（状态：UNSTABLE）
- [#48](https://github.com/andrewyng/openworker/pull/48) — tests: add cross-file consistency checks for LLM provider metadata（状态：UNSTABLE）
- [#50](https://github.com/andrewyng/openworker/pull/50) — Fix automation scheduling: DST-correct 'local' times and off-by-one weekday labels（状态：UNSTABLE）
- [#52](https://github.com/andrewyng/openworker/pull/52) — feat(connectors): add linear_update_issue and linear_add_comment tools（状态：UNSTABLE）
- [#55](https://github.com/andrewyng/openworker/pull/55) — Reject path-traversal session ids in the conversation store（状态：UNSTABLE）
- [#56](https://github.com/andrewyng/openworker/pull/56) — Tolerate a corrupt line when loading a conversation .jsonl（状态：UNSTABLE）
- [#61](https://github.com/andrewyng/openworker/pull/61) — Prevent duplicate overlapping scheduler runs（状态：UNSTABLE）
- [#69](https://github.com/andrewyng/openworker/pull/69) — Fix silent hangs: paused managed OAuth + upstream connection drops（状态：UNSTABLE）
- [#70](https://github.com/andrewyng/openworker/pull/70) — Make the conversation-log shrink rewrite atomic (prevent history loss on a mid-write crash)（状态：UNSTABLE）
- [#79](https://github.com/andrewyng/openworker/pull/79) — Fix sign-in behind corporate TLS interception (use OS trust store)（状态：UNSTABLE）
- [#86](https://github.com/andrewyng/openworker/pull/86) — Add Firecrawl as a web_search provider（状态：UNSTABLE）
- [#92](https://github.com/andrewyng/openworker/pull/92) — fix: tighten CORS ports, Windows venv path, and requires-python floor（状态：UNSTABLE）
- [#110](https://github.com/andrewyng/openworker/pull/110) — feat(providers): add OpenCode Zen + Go to the model picker (#109)（状态：UNSTABLE）
- [#113](https://github.com/andrewyng/openworker/pull/113) — Show a connection error when Settings cannot load（状态：CLEAN）
- [#118](https://github.com/andrewyng/openworker/pull/118) — Prevent IME confirmation from opening search results（状态：UNSTABLE）
- [#123](https://github.com/andrewyng/openworker/pull/123) — fix: handle Windows drive-letter paths in grep (ripgrep) output（状态：UNSTABLE）
- [#126](https://github.com/andrewyng/openworker/pull/126) — Show release notes + current version in the update UI（状态：UNSTABLE）
- [#129](https://github.com/andrewyng/openworker/pull/129) — Add Makefile for dev setup, server/GUI launch, and testing（状态：UNSTABLE）
- [#138](https://github.com/andrewyng/openworker/pull/138) — Create the sidecar resource dir in build.rs so a fresh clone builds（状态：UNSTABLE）
- [#140](https://github.com/andrewyng/openworker/pull/140) — Fix navigation state after hiding artifact preview（状态：UNSTABLE）
- [#142](https://github.com/andrewyng/openworker/pull/142) — Fall back to another usable model when the default provider's key is removed（状态：UNSTABLE）
- [#145](https://github.com/andrewyng/openworker/pull/145) — fix(secrets): create tmp files pre-restricted to close permission race（状态：UNSTABLE）
- [#146](https://github.com/andrewyng/openworker/pull/146) — Add fastCRW as a web_search provider（状态：UNSTABLE）
- [#152](https://github.com/andrewyng/openworker/pull/152) — Add SERPdive web search provider（状态：UNSTABLE）
- [#155](https://github.com/andrewyng/openworker/pull/155) — feat(stt): add Moonshine engine feature flag and MoonshineEngine implementation（状态：UNSTABLE）
- [#159](https://github.com/andrewyng/openworker/pull/159) — fix(selfwake): make WakeStore thread-safe on reads and durable on disk（状态：UNSTABLE）
- [#169](https://github.com/andrewyng/openworker/pull/169) — Refactor AddFolderForm to handle state updates（状态：UNSTABLE）
- [#172](https://github.com/andrewyng/openworker/pull/172) — fix: preserve exception chain in RelayHub.wait_dispatched（状态：UNSTABLE）
- [#173](https://github.com/andrewyng/openworker/pull/173) — Add Linux (Ubuntu) release artifacts: AppImage + .deb（状态：UNSTABLE）
- [#174](https://github.com/andrewyng/openworker/pull/174) — Add recurring Google Calendar and Outlook events（状态：UNSTABLE）
- [#176](https://github.com/andrewyng/openworker/pull/176) — Let Esc stop a running turn（状态：UNSTABLE）
- [#178](https://github.com/andrewyng/openworker/pull/178) — Let the composer's model picker accept a typed model id（状态：UNSTABLE）
- [#183](https://github.com/andrewyng/openworker/pull/183) — fix: add httpx2 dev dependency to silence Starlette TestClient deprec…（状态：UNSTABLE）
- [#186](https://github.com/andrewyng/openworker/pull/186) — security: create secret files owner-only from the first byte (#143)（状态：UNSTABLE）
- [#188](https://github.com/andrewyng/openworker/pull/188) — Enable Tauri CSP and isolate HTML artifact iframes（状态：UNSTABLE）
- [#190](https://github.com/andrewyng/openworker/pull/190) — Confine browser_upload_file sources to granted session roots（状态：UNSTABLE）
- [#192](https://github.com/andrewyng/openworker/pull/192) — fix(gui): keep a drag region reachable while onboarding is on screen（状态：UNSTABLE）
- [#195](https://github.com/andrewyng/openworker/pull/195) — docs: document web_search_provider and cloud_* keys in config example（状态：UNSTABLE）
- [#196](https://github.com/andrewyng/openworker/pull/196) — tests: cover OpenAI provider gaps — key resolution, Qwen XML salvage, stream edges（状态：UNSTABLE）
- [#197](https://github.com/andrewyng/openworker/pull/197) — Add a builtin Sales persona (markdown manifest)（状态：UNSTABLE）
- [#198](https://github.com/andrewyng/openworker/pull/198) — Add read-only git_blame and git_show tools（状态：UNSTABLE）
- [#199](https://github.com/andrewyng/openworker/pull/199) — fix: avoid Windows delay in voice settings（状态：UNSTABLE）
- [#203](https://github.com/andrewyng/openworker/pull/203) — Add WeChat ClawBot connector（状态：UNSTABLE）
- [#205](https://github.com/andrewyng/openworker/pull/205) — Don't let a corrupt JSON state file crash server startup (#204)（状态：UNSTABLE）
- [#209](https://github.com/andrewyng/openworker/pull/209) — test: fix flaky test_scheduler_runs_due_task_and_advances near minute boundaries（状态：UNSTABLE）
- [#210](https://github.com/andrewyng/openworker/pull/210) — test: fix flaky ui-refresh e2e by quiescing the auto-title call before mute assertions（状态：UNSTABLE）
- [#211](https://github.com/andrewyng/openworker/pull/211) — feat(web): add Serper.dev search provider & fix composer button layout overflow #208 and #207（状态：UNSTABLE）
- [#212](https://github.com/andrewyng/openworker/pull/212) — fix(gui): keep composer controls within narrow session layout (issue 208)（状态：UNSTABLE）
- [#214](https://github.com/andrewyng/openworker/pull/214) — Fix attachment de-dup stripping real digits from the filename（状态：UNSTABLE）
- [#216](https://github.com/andrewyng/openworker/pull/216) — test: fix flaky test_background_task_runs_and_exits near the exit tick（状态：UNSTABLE）
- [#217](https://github.com/andrewyng/openworker/pull/217) — deps: raise mcp floor to >=1.28.1 (PYSEC-2026-3481/3482/3483)（状态：UNSTABLE）
- [#218](https://github.com/andrewyng/openworker/pull/218) — ci: run backend + GUI unit tests on Linux arm64（状态：UNSTABLE）
- [#219](https://github.com/andrewyng/openworker/pull/219) — Recover truncated tool calls, and never pass a leaked one off as an answer（状态：UNSTABLE）
- [#220](https://github.com/andrewyng/openworker/pull/220) — providers: plumb anthropic base_url + surface MiniMax-M3（状态：UNSTABLE）
- [#222](https://github.com/andrewyng/openworker/pull/222) — fix: preserve exception chain in wait_dispatched timeout（状态：UNSTABLE）
- [#225](https://github.com/andrewyng/openworker/pull/225) — Fix artifact previews across granted roots（状态：UNSTABLE）
- [#229](https://github.com/andrewyng/openworker/pull/229) — fix: seed always_allowed_commands into permission engine for scheduled tasks（状态：UNSTABLE）
- [#233](https://github.com/andrewyng/openworker/pull/233) — Add Serper.dev search provider（状态：UNSTABLE）
- [#234](https://github.com/andrewyng/openworker/pull/234) — Fix control button UI overflow in top bar（状态：UNSTABLE）
- [#236](https://github.com/andrewyng/openworker/pull/236) — Fix macOS Python version check in setup_dev_env.sh (#42)（状态：UNSTABLE）
- [#237](https://github.com/andrewyng/openworker/pull/237) — Add timeout and error state to Settings tab getSettings() (#43)（状态：UNSTABLE）
- [#238](https://github.com/andrewyng/openworker/pull/238) — Add cross-file provider metadata consistency tests (#41)（状态：UNSTABLE）
- [#241](https://github.com/andrewyng/openworker/pull/241) — fix: wire up the Tauri opener plugin so external links actually open（状态：UNSTABLE）
- [#242](https://github.com/andrewyng/openworker/pull/242) — fix: apply_patch/apply_unified_diff can bypass permission-engine path scoping（状态：UNSTABLE）
- [#243](https://github.com/andrewyng/openworker/pull/243) — docs: add Claude Code guidance files（状态：UNSTABLE）
- [#245](https://github.com/andrewyng/openworker/pull/245) — fix(gui): keep sidebar toggle stable during artifact preview（状态：UNSTABLE）
- [#246](https://github.com/andrewyng/openworker/pull/246) — fix(gui): respect selected model readiness（状态：CLEAN）
- [#250](https://github.com/andrewyng/openworker/pull/250) — security: apply the Windows ACL protection to the workspace trust store（状态：UNSTABLE）
- [#251](https://github.com/andrewyng/openworker/pull/251) — fix: write gallery persona manifests as UTF-8（状态：UNSTABLE）
- [#252](https://github.com/andrewyng/openworker/pull/252) — test: stub Slack name resolution instead of relying on a dead port（状态：UNSTABLE）
- [#253](https://github.com/andrewyng/openworker/pull/253) — Fix Schedule.human() weekday: _DOW must be Sunday-indexed（状态：UNSTABLE）
- [#258](https://github.com/andrewyng/openworker/pull/258) — feat(connectors): add TinyFish as a one-click MCP connector（状态：UNSTABLE）
- [#262](https://github.com/andrewyng/openworker/pull/262) — Add You.com web search provider (keyless, with optional key)（状态：UNSTABLE）
- [#266](https://github.com/andrewyng/openworker/pull/266) — fix(inbox): a chat reply must not silently refuse a plan/directory prompt（状态：UNSTABLE）
- [#271](https://github.com/andrewyng/openworker/pull/271) — fix(gui): open external links in system browser (fixes #270)（状态：UNSTABLE）
- [#273](https://github.com/andrewyng/openworker/pull/273) — Add Novita AI provider（状态：UNSTABLE）
- [#277](https://github.com/andrewyng/openworker/pull/277) — fix: add friendly error guidance for Qwen API key authentication failures（状态：UNSTABLE）
- [#281](https://github.com/andrewyng/openworker/pull/281) — fix: block find -exec auto-run via shell allowlist（状态：UNSTABLE）
- [#285](https://github.com/andrewyng/openworker/pull/285) — setup_dev_env.sh: install the bedrock extra so a fresh env passes the test suite（状态：UNSTABLE）
- [#286](https://github.com/andrewyng/openworker/pull/286) — Fix platform-specific approval scope wording（状态：UNSTABLE）
- [#289](https://github.com/andrewyng/openworker/pull/289) — security: confine the browser connector's file tools to the session roots（状态：CLEAN）
- [#291](https://github.com/andrewyng/openworker/pull/291) — security: create secret files private, never chmod them after (#143)（状态：UNSTABLE）
- [#294](https://github.com/andrewyng/openworker/pull/294) — Added MCP setup doc（状态：UNSTABLE）
- [#295](https://github.com/andrewyng/openworker/pull/295) — security: keep OpenWorker's own sidecar token out of the shell environment（状态：UNSTABLE）
- [#297](https://github.com/andrewyng/openworker/pull/297) — security: give each default screenshot its own private temp file（状态：CLEAN）
- [#299](https://github.com/andrewyng/openworker/pull/299) — fix: try streamable_http_client first, fall back to old name for mcp>=2.0.0 compat（状态：UNSTABLE）
- [#300](https://github.com/andrewyng/openworker/pull/300) — fix: don't resolve plan/directory items from chat replies, route through resolve_inbox（状态：UNSTABLE）
- [#301](https://github.com/andrewyng/openworker/pull/301) — fix: exclude exec-risk tools from session_allow_tools shortcut（状态：UNSTABLE）
- [#303](https://github.com/andrewyng/openworker/pull/303) — Web: add Linkup as a web_search provider（状态：UNSTABLE）
- [#305](https://github.com/andrewyng/openworker/pull/305) — Fix MCP streamable-http import for mcp>=2.0 (fixes #298)（状态：UNSTABLE）
- [#307](https://github.com/andrewyng/openworker/pull/307) — security: hold back allowlist auto-run for interpreters, package managers and exec-delegating flags（状态：UNSTABLE）
- [#310](https://github.com/andrewyng/openworker/pull/310) — security: an allowlisted reader must not auto-run outside the granted roots（状态：UNSTABLE）
- [#312](https://github.com/andrewyng/openworker/pull/312) — Fix search modal misalignment when opened from collapsed sidebar (#282)（状态：UNSTABLE）
- [#328](https://github.com/andrewyng/openworker/pull/328) — fix: add coverage measurement and reporting to CI（状态：UNSTABLE）
- [#334](https://github.com/andrewyng/openworker/pull/334) — Providers: add SambaNova（状态：UNSTABLE）
- [#343](https://github.com/andrewyng/openworker/pull/343) — docs: add CLAUDE.md files for Claude Code guidance（状态：UNSTABLE）
- [#344](https://github.com/andrewyng/openworker/pull/344) — docs: add messaging connector setup guide（状态：UNSTABLE）
- [#345](https://github.com/andrewyng/openworker/pull/345) — fix: detect Ollama vision models from naming conventions（状态：UNSTABLE）
- [#346](https://github.com/andrewyng/openworker/pull/346) — Fix display scaling scroll issue in connector integration（状态：UNSTABLE）
- [#348](https://github.com/andrewyng/openworker/pull/348) — fix(gui): make right-rail Hide side panel clickable again（状态：UNSTABLE）
- [#350](https://github.com/andrewyng/openworker/pull/350) — fix: repair tool-call/result pairing on load to prevent unrecoverable 400 errors（状态：UNSTABLE）
- [#358](https://github.com/andrewyng/openworker/pull/358) — feat(providers): add SambaNova as an OpenAI-compatible model provider（状态：UNSTABLE）
- [#360](https://github.com/andrewyng/openworker/pull/360) — Add Exa web search provider（状态：UNSTABLE）
- [#363](https://github.com/andrewyng/openworker/pull/363) — fix(engine): stop replaying an abandoned partial turn on retry（状态：UNSTABLE）
- [#365](https://github.com/andrewyng/openworker/pull/365) — fix(gui): guard session WS onmessage JSON.parse against malformed frames（状态：UNSTABLE）
- [#368](https://github.com/andrewyng/openworker/pull/368) — fix(server): surface engine exceptions in WS turn path instead of swallowing them（状态：UNSTABLE）
- [#371](https://github.com/andrewyng/openworker/pull/371) — feat: add brokerless GitHub device authentication（状态：UNSTABLE）
- [#372](https://github.com/andrewyng/openworker/pull/372) — feat(connectors): add Matrix connector with E2EE and sync token persi…（状态：UNSTABLE）
- [#376](https://github.com/andrewyng/openworker/pull/376) — fix(shell): fold the user's login-shell env into run_shell (#362)（状态：UNSTABLE）
- [#377](https://github.com/andrewyng/openworker/pull/377) — fix(macos): declare Calendar/Reminders usage strings so EventKit tools work (#302)（状态：UNSTABLE）
- [#378](https://github.com/andrewyng/openworker/pull/378) — fix(macos): restore the hidden window on Dock-icon click (#248)（状态：UNSTABLE）
- [#379](https://github.com/andrewyng/openworker/pull/379) — fix: scheduled task can run twice when an approval lands on a tick（状态：UNSTABLE）
- [#380](https://github.com/andrewyng/openworker/pull/380) — security: secret files are born 0600 instead of chmod-after-write（状态：UNSTABLE）
- [#384](https://github.com/andrewyng/openworker/pull/384) — models: add Claude 5 family to Bedrock matrix（状态：UNSTABLE）
- [#385](https://github.com/andrewyng/openworker/pull/385) — Add NVIDIA NIM as a provider (OpenAI-compatible)（状态：UNSTABLE）
- [#387](https://github.com/andrewyng/openworker/pull/387) — fix(providers): surface a connected Ollama's pulled models in the picker（状态：UNSTABLE）
- [#388](https://github.com/andrewyng/openworker/pull/388) — fix(windows): stop Settings→Recent freeze from sync cmd /C ver（状态：CLEAN）
- [#392](https://github.com/andrewyng/openworker/pull/392) — perf(audit): use WAL journal to avoid fsync per commit on event loop（状态：UNSTABLE）
- [#395](https://github.com/andrewyng/openworker/pull/395) — fix(compaction, secrets): attachment token estimate, O(n) boundary search, atomic secret writes（状态：UNSTABLE）
- [#400](https://github.com/andrewyng/openworker/pull/400) — Require approval before opening browser URLs（状态：UNSTABLE）
- [#405](https://github.com/andrewyng/openworker/pull/405) — fix(telemetry): make product events opt-in（状态：UNSTABLE）
- [#406](https://github.com/andrewyng/openworker/pull/406) — fix(audit): redact nested credential arguments（状态：UNSTABLE）
- [#412](https://github.com/andrewyng/openworker/pull/412) — feat: add CC Switch local proxy provider（状态：UNSTABLE）
- [#430](https://github.com/andrewyng/openworker/pull/430) — fix(providers): fall back to Responses API for compatible endpoints（状态：UNSTABLE）
- [#446](https://github.com/andrewyng/openworker/pull/446) — feat: fetch provider models from the UI and one-click add to the composer picker（状态：UNSTABLE）
- [#447](https://github.com/andrewyng/openworker/pull/447) — Add Vercel AI Gateway as a first-class provider（状态：UNSTABLE）
- [#461](https://github.com/andrewyng/openworker/pull/461) — Risk overrides Phase 2: REST + GUI surface for per-tool MCP risk（状态：UNSTABLE）
- [#464](https://github.com/andrewyng/openworker/pull/464) — feat: (gui) implement DeleteConfirmModal for delete confirmations across the application（状态：UNSTABLE）
- [#468](https://github.com/andrewyng/openworker/pull/468) — feat: AI command intent analysis on approval prompts（状态：UNSTABLE）
- [#470](https://github.com/andrewyng/openworker/pull/470) — feat(linux): add .deb + AppImage builds, Linux CI, and sidecar resource_dir fix（状态：UNSTABLE）
- [#473](https://github.com/andrewyng/openworker/pull/473) — Add nvidia nim（状态：UNSTABLE）
- [#475](https://github.com/andrewyng/openworker/pull/475) — Inject knowledge-wiki index (wiki/INDEX.md) into session context（状态：UNSTABLE）
- [#479](https://github.com/andrewyng/openworker/pull/479) — fix(desktop): surface sidecar startup failures instead of hanging silently (#382)（状态：UNSTABLE）
- [#480](https://github.com/andrewyng/openworker/pull/480) — feat(packaging): wire Windows Authenticode signing, activated by repo secrets (#36, #37)（状态：UNSTABLE）
- [#483](https://github.com/andrewyng/openworker/pull/483) — fix(providers): correct GLM-5.2 context window to 1M（状态：UNSTABLE）
- [#484](https://github.com/andrewyng/openworker/pull/484) — Add default folders for new Cowork sessions（状态：UNSTABLE）

## 6. 给你的直接指令格式

你不需要逐个判断，可以直接下达：

- **“执行 B0”**：处理 7 个 CLEAN PR。
- **“执行 B1”**：按安全/可靠性/维护基础优先处理；遇冲突自动改为手工移植并记录。
- **“执行 B2-本地模型”** / **“执行 B2-中文”** / **“执行 B2-Provider”**：只处理对应产品方向。
- **“执行全部候选”**：按 B0 → B1 → B2 批量处理 148 个候选；每个 PR 仍会自动运行对应测试，失败的自动转入 hold，不会强行合并。
- **“重新扫描”**：重新读取 GitHub 状态并刷新数量，避免使用过期快照。

建议下一步：先执行 **B0**，然后执行 **B1**。这样你只需给批次级指令，不需要逐个 PR 做决定。
