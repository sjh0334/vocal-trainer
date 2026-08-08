---
feature_ids: [F001]
topics: [quality-gate, web-audio, browser-evidence]
doc_kind: review-note
created: 2026-08-08
---

# F001 Quality Gate Report

Spec: `docs/features/F001-realtime-pitch-trainer.md`  
原始需求: `README.md`, `feature-discussions/2026-08-07-f001-design/README.md`  
检查时间: 2026-08-08 15:20 Asia/Shanghai
Worktree: `/Users/sss/vocal-trainer-f001`  
验证 URL: `http://127.0.0.1:4173`（当前 feature worktree 的 Vite server）

## Verdict

实现与自动化门禁已达到跨猫 review 条件。Feature close 尚不可声明：AC-B3 仍需真实浏览器音频输入基准，AC-C5 仍需真实 Android Chrome 与 iOS Safari 设备验收。

## 愿景覆盖

| operator 原始需求 | AC | 实现状态 | 证据 |
|---|---|---|---|
| 音高检测准 | A1, A2 | ✅ | YIN 82.41–880 Hz 含谐波最大误差 0.099 cents；静音/低能量与质量门测试 |
| 实时反馈直观 | B2, B3 | ⚠️ | Canvas 与文字/位置/颜色反馈已实现；合成浏览器管线 p95 6.6 ms，真实输入基准待验收 |
| 评分能指路 | C1, C2 | ✅ | 颤音/恒偏回归、40/30/20/10 权重、原始指标与诊断 UI |
| 先内置简单旋律，试用后收敛为长音 | B1 | ✅ | A3/C4/E4 三个版本化 8 秒长音、明确音名/频率、准备页试听与开始录制 |
| 核心先闭环 | A1–C6 | ⚠️ | 自动化 Primary Journey 全绿；真实移动设备验收未执行 |
| 加入录音回放 | C3, C4 | ✅ | 单条原子记录、回放、轨迹游标、刷新恢复、单删/全删 |
| 删除上一版实现 | Current State | ✅ | 当前实现从空基线重新建设，提交链自 `2951600` 起 |
| 标题“听见你的声音” | B1 | ✅ | 文档标题、HTML title、首页视觉证据 |
| 试听音色不刺耳 | B1 | ✅（实现）/ 待主观确认 | 三角波、1400 Hz 低通、0.065 峰值增益、80/140 ms 渐入渐出由单测锁定；浏览器已可试听 |
| 试听与开始放在准备页，进入不自动开练 | A3, B1 | ✅ | E2E 断言进入准备页后 `getUserMedia` 调用为 0，点击“开始录制”后为 1 |
| 跑道速度慢、显示不抖、目标音明确 | B1, B2 | ✅ | 10 秒窗口、5 帧中值显示平滑、静音间隙重置与输入不变单测；A3/220 Hz 跨页面可见 |

## 功能验收

| AC | 状态 | 代码位置 | 测试/证据 |
|---|---|---|---|
| A1 | ✅ | `src/pitch/yin.js` | `tests/unit/yin.test.js`; 82.41/110/220/440/880 Hz 误差 0.000/0.002/0.015/0.068/0.099 cents |
| A2 | ✅ | `src/pitch/frame-quality.js` | `yin.test.js`, `frame-quality.test.js`, session 质量门测试 |
| A3 | ✅ | `src/audio/live-audio-session.js`, `src/session/practice-session-controller.js` | 双 start、权限迟到、设备/Worker 故障、页面隐藏、全资源 teardown |
| B1 | ✅ | `src/exercises/long-tones.js`, `src/exercises/practice-catalog.js`, `src/audio/demo-player.js`, `src/ui/app-view.js` | long-tone/demo player 单测；active/legacy catalog 数据兼容测试；准备页 E2E；麦克风调用计数；首页与准备页浏览器证据 |
| B2 | ✅ | `src/render/track-renderer.js`, `src/ui/app-view.js` | 10 秒窗口、5 帧中值平滑、输入不变、静音间隙重置单测；桌面/移动 Playwright |
| B3 | ⚠️ | `src/audio/live-audio-session.js`, `src/session/frame-assessment.js` | 133 帧合成浏览器管线 p95 6.6 ms；未覆盖真实音频设备与 native AudioWorklet 调度 |
| C1 | ✅ | `src/scoring/scoring-engine.js` | 对称 ±40 cents 主要扣稳定度；恒定 +30 cents 扣音准；跨音符不抵消 |
| C2 | ✅ | `src/scoring/diagnostics.js`, `src/render/report-renderer.js` | 低覆盖不强打分、四项分数、证据与下一步练法 |
| C3 | ✅ | `src/audio/recorder.js`, `src/playback/playback-controller.js` | E2E 完成录制→刷新→历史打开→播放→游标推进 |
| C4 | ✅ | `src/storage/session-repository.js` | Blob+轨迹+报告原子存储、无 `expiresAt`、URL revoke、单删/全删；源码无网络上传调用 |
| C5 | ⚠️ | browser acceptance | 桌面/移动 viewport Chromium 自动化通过；真实 Android Chrome 与 iOS Safari 未验收 |
| C6 | ✅ | `index.html`, `src/styles/responsive.css` | 响应式壳通过桌面/移动 E2E；源码无 Service Worker 注册 |

## Close Gate 与尾项扫描

- 当前阶段是 implementation review，不是 feature close，因此未生成 CloseGateReport。
- 未满足项均属于本机无法替代的 release acceptance：真实输入延迟与真实移动设备兼容性；未发现用低优先级标签掩盖实现缺口的文本。
- Tips Contribution: spec 已记录 `tips_exempt`，理由为独立 Web App 无 Cat Café Tips 基础设施，用户提示属于 Primary Journey UI。

## Fallback Layer Check

仓库没有自动扫描脚本，已人工检查 `main...HEAD`。`app.js` 中的默认练习、运行时配置和空轨迹兜底分别保护独立输入边界，并非同一失败上的多层补偿；session controller 的 generation/state 判断是并发不变量。未发现同一错误路径叠加三层 fallback。

## Architecture Ownership

- Architecture cell: `browser-vocal-trainer`
- Map delta: `none`（cell 已在 F001 kickoff 建立）
- Why: 本实现落入既有 Web App ownership cell；未新增跨 cell Store/Queue/Router。
- 自动 ownership 命令：此独立仓库未配置；已人工核对 `docs/architecture/ownership/README.md`。

## Dogfood-Your-Slice

Scope verdict: ✅ 必做。

端到端路径：选择 A3（220 Hz）长音 → 进入准备页（不请求麦克风）→ 试听 → 明确开始录制 → 麦克风/环境状态 → 8 秒慢速跑道 → 自动结束 → 四项报告 → 播放录音 → 刷新恢复 → 历史打开 → 删除。

实际证据：Playwright 在桌面和移动 viewport 各完成一次长音全路径；Browser Preview 已打开当前 worktree 的 `127.0.0.1:4173`。本轮截图 dogfood 发现实时读数仍显示 MIDI `57`，根因是两份反馈格式化逻辑漂移；已抽成 `formatLiveFeedback` 单一投影并以红绿测试修复，现在实时读数显示 `A3`。

## 视觉证据映射

| 需求 | 证据 |
|---|---|
| 旋律选择、隐私边界、桌面布局 | `/tmp/cat-cafe-evidence/F001/home-desktop.png` |
| 窄屏可读性 | `/tmp/cat-cafe-evidence/F001/home-mobile.png` |
| 四项评分、诊断、录音轨迹与删除 | `/tmp/cat-cafe-evidence/F001/report-desktop.png` |
| 实时练习到报告与播放 | `/tmp/cat-cafe-evidence/F001/page@cb85a9c1146fe1f0d46e8bb2d2c5ea74.webm`（6.76 秒） |
| 新标题与选择页入口 | `/tmp/cat-cafe-evidence/F001-feedback-round/home-title.png` |
| 独立准备页、试听与明确开始 | `/tmp/cat-cafe-evidence/F001-feedback-round/preparation.png` |
| 本轮选择→准备→试听交互 | `/tmp/cat-cafe-evidence/F001-feedback-round/page@98f5b71357910b1ddd286e04660a26c8.webm` |
| 长音目标选择与明确频率 | `/tmp/cat-cafe-evidence/F001-long-tone/home-desktop.png` |
| A3 准备页、试听与开始录制 | `/tmp/cat-cafe-evidence/F001-long-tone/preparation.png` |
| A3/220 Hz 慢速跑道与 A3 实时读数 | `/tmp/cat-cafe-evidence/F001-long-tone/live-runway.png` |

`.pen` 扫描结果：无匹配设计稿；本次 UI 按批准的文字 wireframe 实现，因此标记“⚠️ 无 .pen 设计稿”。

## 验证命令

| 命令 | 本次结果 |
|---|---|
| `pnpm check` | 56 files，0 errors ✅ |
| `pnpm test:coverage` | 20 files / 83 tests，0 failures ✅ |
| `pnpm -r --if-present run build` | 26 modules，exit 0；worker 独立 bundle 已生成 ✅ |
| `pnpm test:e2e` | desktop + mobile viewport，4/4 passed ✅ |
| Playwright latency attachment | 133 frames，p95 6.6 ms（合成管线） ✅ |

Coverage 总体 70.26%；入口 `app.js` 由 Playwright 覆盖但未并入 Vitest v8 数据。会话控制器 85.67%、评分引擎 97.46%、长音定义与 legacy readback 核心路径有独立单元/集成测试。正式 review 修复另覆盖 recorder stop、audio teardown、IndexedDB save 三个 abort 竞态边界；后续试用修订覆盖准备页麦克风边界、柔和示范音、慢速窗口、显示专用平滑和实时音名投影。

## Artifact Hygiene

工作树与 `main...HEAD` 根目录媒体扫描均无命中；截图和录屏仅存在 `/tmp/cat-cafe-evidence/F001/` 与 `/tmp/cat-cafe-evidence/F001-feedback-round/`。提交前 Git 工作树仅包含本轮预期代码、测试和文档变更。
