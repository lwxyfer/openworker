# PR Ledger

用于记录 fork 对上游 Pull Request 的审查结果。详细筛选规则见 [PR_TRIAGE.zh-CN.md](PR_TRIAGE.zh-CN.md)。

| PR | 领域 | 价值 | 风险 | 决定 | 分支/提交 | 测试 | 复审日期 |
|---:|---|---:|---:|---|---|---|---|
| #458 | automation | 3 | 3 | accept | `main` @ `24c0f194` | 19 passed; 1 warning | 2026-08-09 |
| #466 | engine/context | 3 | 3 | accept | `main` @ `26a169d4` | 42 Python passed; GUI build + 111 unit passed | 2026-08-09 |
| #467 | Outlook | 3 | 3 | accept | `main` @ `f70012fe` | 62 passed; 1 warning | 2026-08-09 |
| #445 | inbox/security | 3 | 3 | accept | `main` @ `c0efffe7` | 21 passed | 2026-08-09 |
| #448 | provider | 2 | 2 | accept | `main` @ `8c64f2fc` | 42 passed; upstream CI green | 2026-08-09 |
| #449 | provider matrix | 2 | 1 | accept | `main` @ `17cf1a92` | 26 passed | 2026-08-09 |
| #477 | security policy | 2 | 1 | accept | `main` @ `cad2d2e5` | upstream CI green | 2026-08-09 |
| #482 | provider matrix | 2 | 1 | accept | `main` @ `a8f3debb` | 27 passed | 2026-08-10 |
| #439 | GUI/IME | 2 | 1 | accept | `main` @ `157624b2` | 111 GUI passed; build passed | 2026-08-10 |
| #476 | GUI/cloud | 2 | 1 | accept | `main` @ `5866ed34` | 111 GUI passed; build passed | 2026-08-10 |
| #452 | GUI/Tauri | 2 | 2 | accept | `main` @ `eae869c7` | 112 GUI passed; build passed; cargo blocked by registry | 2026-08-10 |
| #420 | GUI/artifacts | 2 | 1 | accept | `main` @ `f92ba6a1` | 113 GUI passed; build passed | 2026-08-10 |
| #418 | docs/MCP/skills | 2 | 1 | accept | `main` @ `807f3b10` | docs-only | 2026-08-10 |
| #474 | self-wake | 2 | 2 | accept | `main` @ `d0f5013d` | 10 passed | 2026-08-10 |
| #433 | permissions/security | 3 | 3 | accept | `main` @ `0f59face` | 63 passed; upstream CI green | 2026-08-10 |
| #434 | provider/LM Studio | 3 | 2 | accept | `main` @ `5c519f93` | 71 Python passed; 115 GUI passed; build passed | 2026-08-10 |
| #19 | Linux/AppImage/STT | 3 | 2 | adapt | `main` @ `910fd02` | bash/python checks passed; cargo blocked by unavailable rsproxy registry | 2026-08-10 |
| #113 | GUI/Settings | 2 | 1 | accept | `main` @ `72a5cdc` | 115 GUI passed; build passed | 2026-08-10 |
| #246 | GUI/model readiness | 3 | 2 | adapt | `main` @ `04c2bb0` | 32 Python passed; 115 GUI passed; build passed | 2026-08-10 |
| #289 | browser/security | 3 | 3 | adapt | `main` @ `f6c73ff` | 58 security/path tests passed | 2026-08-10 |
| #297 | browser/security | 3 | 3 | adapt | `main` @ `e17f640` | 12 browser-path tests passed | 2026-08-10 |
| #388 | Windows/voice | 2 | 2 | adapt | `main` @ `9f5ba41` | rustfmt checked; Windows target test unavailable locally; duplicate scheduler commit excluded | 2026-08-10 |
| #15 | Ollama/test | 1 | 1 | superseded | — | current fork already uses `_local_alive`; raw patch failed against current API | 2026-08-10 |
| #55/#70/#92/#129/#138/#159/#195/#196/#205/#209/#210/#216/#217/#218/#222/#238/#242/#250/#291/#294/#305/#310/#328/#343/#344/#350/#363/#365/#368/#392/#400/#430 | B1 reliability/security | 2–3 | 1–3 | adapt/accept | `codex/batch-b1-provider-gui` | targeted B1 suite: 392 passed; 2 environment failures | 2026-08-10 |
| #406 | B1 audit/security | 3 | 3 | adapt | `e0c4c86` + coverage fix `07d042d` | 9 audit tests passed | 2026-08-10 |
| #307 (covers #281) | B1 permissions/security | 3 | 3 | adapt; #281 superseded | `285cac1` | 69 permission tests passed | 2026-08-10 |
| #79 | B1 cloud/TLS | 3 | 2 | adapt | `79be4cd` | cloud tests passed; one server test blocked by sandbox path permission | 2026-08-10 |
| #175 | B1 GUI/interaction | 3 | 2 | adapt | `b4d7cb4` | backend interaction tests + 129 GUI tests + build passed | 2026-08-10 |
| #219 | B1 engine/provider reliability | 3 | 3 | adapt | `c7e83ef` | 61 engine/provider tests passed | 2026-08-10 |
| #461 | B1 MCP/security | 3 | 3 | adapt | `43ce1b5` | 48 risk/provider tests passed; GUI build passed | 2026-08-10 |
| #86/#152/#233/#262/#303/#360 | B2 Provider/web search | 3 | 2 | consolidated adapt | `8135778` + `62e4e02` | 10 web-search tests passed | 2026-08-10 |
| #142 | B2 Provider | 3 | 2 | adapt | `d3ed4a9` | 38 provider-router tests passed | 2026-08-10 |
| #345 | B2 Provider/Ollama vision | 2 | 2 | adapt | `357c747` | provider-router tests passed | 2026-08-10 |
| #183 | B2 Provider/dev | 2 | 1 | adapt | `7a1b6fb` | dependency metadata checked | 2026-08-10 |
| #446 | B2 Provider/GUI | 2 | 1 | adapt | `31dcf72` | provider + GUI suites passed | 2026-08-10 |
| #447 | B2 Provider | 3 | 2 | adapt | `cbe2f43` | 31 provider tests passed; GUI build passed | 2026-08-10 |
| #110 | B2 Provider/OpenCode | 3 | 3 | hold/high-scope | — | 9.7k additions, new protocol/contract/locks; requires dedicated review | 2026-08-10 |
| #118/#126/#169/#192/#212/#234/#245/#251/#312/#346/#348/#464/#475 | B2 GUI/交互 | 2–3 | 1–2 | adapt | individual commits; #464=`14143f5` | 129 GUI tests + build passed | 2026-08-10 |
| #176 | B2 GUI/交互 | 3 | 2 | adapt | `b321d78` | 127 GUI tests + build passed | 2026-08-10 |
| #12/#14/#26/#48/#61/#172/#186/#190/#236/#243/#301/#380 | B1 overlap/冲突 | — | — | hold/superseded | — | #61/#190 superseded by accepted security changes; #12/#14/#48/#172/#243/#380 overlap selected implementations; #26/#236/#301 require separate cleanup | 2026-08-10 |
| #450 | CI/lint | 2 | 1 | pending | — | missing | 2026-08-09 |
| #440 | zh-CN GUI | 3 | 2 | pending | — | missing | 2026-08-09 |

决定枚举：`pending`、`accept`、`adapt`、`hold`、`reject`、`duplicate`、`superseded`。
