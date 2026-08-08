# “听见你的声音” Web 练歌器 Implementation Plan

**Feature:** F001 — `docs/features/F001-realtime-pitch-trainer.md`
**Goal:** 用户在浏览器完成“选择简单旋律 → 准备页试听并明确开始 → 实时跟唱 → 看懂偏差 → 获得可解释评分 → 回放本地录音”的可信闭环。
**Acceptance Criteria:** AC-A1 82–880 Hz 测试音中位误差≤5 cents；AC-A2 静音/低置信度不入评分；AC-A3 音频资源严格单实例并可靠释放；AC-B1 至少两条版本化简单旋律，选择后进入独立准备页，试听音色柔和且仅在用户明确开始后请求麦克风；AC-B2 Canvas 同轴展示目标、轨迹、游标和文字反馈；AC-B3 p95 视觉反馈≤150 ms；AC-C1 音准/稳定度解耦；AC-C2 报告可解释且数据不足不强打分；AC-C3 录音回放与轨迹同步并可刷新恢复；AC-C4 本地 TTL=0 且可完整删除；AC-C5 Chromium/Android Chrome 实测并记录 Safari 结论；AC-C6 PWA-ready 但首版不注册 Service Worker。
**Architecture cell:** `browser-vocal-trainer`
**Map delta:** none
**Map delta why:** F001 kickoff 已创建 ownership cell，本计划只在已确认边界内实现。
**Architecture:** 原生浏览器 App，以 `PracticeSessionController` 作为唯一活动会话 owner；AudioWorklet 采集、Worker 运行 YIN、Canvas 只渲染、Scoring 只消费质量门后的未平滑帧。录音、报告和轨迹以一个 IndexedDB record 原子提交，播放 URL 只在内存派生。
**Tech Stack:** JavaScript ES modules、Web Audio API、AudioWorklet、Web Worker、MediaRecorder、Canvas、IndexedDB、Vite、Vitest、Playwright、Biome。
**前端验证:** Yes — reviewer 必须用 Playwright/Chromium 与真实 Chrome 页面检查；Safari 兼容性单独记录实测结论。

---

## 终点与非目标

终点 B：一个部署为静态资源的 Web App，在无后端情况下完成 Primary Journey，所有算法、状态机、存储与用户界面均有可复核证据。

不建设完整歌曲/歌词/伴奏版权系统、主旋律提取、账号、云同步、社交排行、AI 音色诊断和 Service Worker。每个 Task 产出均进入最终系统，不创建一次性 prototype。

## 终态目录

```text
index.html
package.json
vite.config.js
biome.json
src/
  app.js
  styles.css
  domain/{practice-definition,pitch-frame,session-report}.js
  exercises/long-tones.js
  audio/{audio-worklet,live-audio-session,recorder,demo-player}.js
  pitch/{yin,note,frame-quality,pitch-worker}.js
  session/practice-session-controller.js
  scoring/{score-rules,scoring-engine,diagnostics}.js
  render/{track-renderer,report-renderer}.js
  playback/playback-controller.js
  storage/session-repository.js
tests/
  unit/**/*.test.js
  integration/**/*.test.js
  e2e/practice-flow.spec.js
  fixtures/{generate-audio-fixtures.mjs,*.wav}
```

## 终态契约

```js
/** @typedef {{id:string, version:number, title:string, leadInMs:number,
 * segments: Array<{id:string,startMs:number,endMs:number,midiNote:number|null,label:string}>}} PracticeDefinition */

/** @typedef {{sessionId:string, sequence:number, timestampMs:number,
 * frequencyHz:number|null, midi:number|null, confidence:number, rms:number,
 * voiced:boolean}} PitchFrame */

/** @typedef {{targetSegmentId:string, signedCents:number|null,
 * classification:'accurate'|'sharp'|'flat'|'unvoiced'}} AssessmentFrame */

/** @typedef {{id:string, schemaVersion:1, practiceId:string, practiceVersion:number,
 * createdAt:string, durationMs:number, mimeType:string, audioBlob:Blob,
 * trajectory:Array<PitchFrame>, report:SessionReport}} PersistedSession */
```

当前目标音符、准/高/低、播放游标、实时总分均为纯投影，不独立持久化。持久报告保存 `scorerVersion` 与原始指标，避免规则升级篡改旧结果。

## Stateful Object Gate

### 对象普查与唯一 owner

| 对象 | Owner | 禁止的旁路操作 |
|------|-------|----------------|
| Practice session | `PracticeSessionController` | UI 不得直接 start/stop MediaStream、Worker 或 recorder |
| Media recording | `Recorder`，仅由 session controller 调用 | 不暴露 generic `setState`；不能在 `recording` 时再次 start |
| Persisted session | `SessionRepository` | 不提供部分更新 Blob/report/trajectory 的 API；只允许整条 `save/get/list/delete/clear` |
| Playback | `PlaybackController` | UI 不直接创建或撤销 Blob URL；删除记录前必须由 controller 停止播放 |

### 状态 × 事件转移

| 对象 | 当前状态 | 事件 | 下一状态 | 副作用 |
|------|----------|------|----------|--------|
| Session | idle | start | requesting_permission | 建 generation token，拒绝第二次 start |
| Session | requesting_permission | granted | calibrating | 创建唯一 AudioContext/stream/worker |
| Session | requesting_permission | denied/abort | error/idle | 失效 token，释放迟到资源 |
| Session | calibrating | ready | countdown | 固化噪声门限，清空旧帧 |
| Session | countdown | elapsed | running | 同时启动检测计时与 recorder |
| Session | running | melodyEnded/stop | finalizing | 停 recorder，冻结帧，释放音频资源 |
| Session | finalizing | saved/saveFailed | report | 成功则持久化；失败仍保留内存回放并提示 |
| Session | any active | deviceLost/workerError/leave | finalizing/error | 幂等 teardown，迟到回调按 token 丢弃 |
| Recorder | idle | start(stream) | recording | 建 MediaRecorder，收集 chunks |
| Recorder | recording | stop | stopping | 只调用一次 MediaRecorder.stop |
| Recorder | stopping | data+stop | complete | 生成一个 Blob；resolve 一次 |
| Recorder | any | error/abort | error/idle | 清 chunks，不提交半 Blob |
| Storage | absent | save(record) | committing | 单 object-store transaction 写整条 record |
| Storage | committing | complete/fail | committed/absent | 完成或整体回滚 |
| Storage | committed | delete | deleting | 先等待 playback stop，再删除整条记录 |
| Playback | idle | load(record) | ready | 创建唯一 object URL |
| Playback | ready/paused | play | playing | 订阅 audio timeupdate/rAF |
| Playback | playing | pause/ended | paused/ended | 游标由 currentTime 纯投影 |
| Playback | any loaded | unload/delete | idle | pause、移除事件、revokeObjectURL |

### 不变量与测试矩阵

| INV | 不变量 | 自动验证 |
|-----|--------|----------|
| INV-1 | 最多一个活动 session/stream/recorder | `practice-session-controller.test.js` 双击 start/deviceLost |
| INV-2 | 仅 running 且质量合格帧进入评分 | `practice-session-controller.test.js`, `frame-quality.test.js` |
| INV-3 | audioBlob、trajectory、report 整条提交或不提交 | `session-repository.test.js` transaction failure |
| INV-4 | 记录默认 TTL=0，无后台过期删除 | `session-repository.test.js` reopen/list |
| INV-5 | 删除后 record、Blob URL、轨迹均不可访问 | repository + playback integration test |
| INV-6 | 示范播放与录音不重叠 | controller test with fake demo/recorder |
| INV-7 | practiceVersion 随报告持久化 | repository round-trip test |
| INV-8 | 重度 UI 平滑结果不进入 scorer | scoring integration test with divergent display frames |
| INV-9 | stale/乱序 Worker frame 不进入新 session | controller generation-token test |

### 对抗场景

- 快速双击开始、权限 Promise 迟到、设备中断、Worker 崩溃、tab 离开。
- recorder stop/error/dataavailable 顺序变化，stop 被调用两次。
- IndexedDB quota/transaction failure、刷新后恢复、删除与播放并发。
- 旧 session 帧进入新 session、乱序 sequence、示范尾音污染第一帧。

以上每项必须先写失败测试，再写实现。

## Task 1: 工程基线与领域契约

**Files:** Create `package.json`, `pnpm-lock.yaml`, `vite.config.js`, `biome.json`, `index.html`, `src/app.js`, `src/styles.css`, `src/domain/*.js`; Test `tests/unit/practice-definition.test.js`.

1. 写失败测试：拒绝重叠 segment、非法 MIDI、无 version 的练习定义；合法定义冻结并按时间查询目标音符。
2. Run: `pnpm vitest run tests/unit/practice-definition.test.js`；Expected: FAIL（模块不存在）。
3. 配置 Vite/Vitest/Biome/Playwright scripts，最小页面只挂载 app root；实现 `validatePracticeDefinition` 与 `targetAtTime`。
4. Run: `pnpm test && pnpm check && pnpm build`；Expected: PASS，`dist/` 生成。
5. Commit: `chore(F001): establish web app contracts [砚砚/gpt-5.6-sol🐾]`，body 写 Why。

## Task 2: YIN、音符换算与质量门

**Files:** Create `src/pitch/yin.js`, `note.js`, `frame-quality.js`; Test `tests/unit/{yin,note,frame-quality}.test.js`, `tests/fixtures/generate-audio-fixtures.mjs`.

1. 生成 82.41/110/220/440/880 Hz 的 sine、谐波、静音和低能量噪声 Float32 fixtures；测试返回 `{frequencyHz, confidence, voiced}`。
2. Run targeted tests；Expected: FAIL（detector 不存在）。
3. 实现单声道 YIN difference/CMND/absolute threshold/parabolic interpolation；实现 Hz↔MIDI/cents；质量门同时检查 RMS、confidence、范围和 sequence。
4. Run: `pnpm vitest run tests/unit/yin.test.js tests/unit/note.test.js tests/unit/frame-quality.test.js`；Expected: clean/harmonic 中位误差≤5 cents，静音无 voiced。
5. Commit: `feat(F001): add verified YIN pitch detection [砚砚/gpt-5.6-sol🐾]`。

## Task 3: 评分与诊断

**Files:** Create `src/scoring/{score-rules,scoring-engine,diagnostics}.js`; Test `tests/unit/{scoring-engine,diagnostics}.test.js`.

1. 写失败测试：目标内对称 ±40 cents 的 accuracy 接近 100 且 stability 降低；恒定 +30 cents 降 accuracy；跨目标音符 +30/-30 不互相抵消；低 coverage 返回 insufficient。
2. Run targeted tests；Expected: FAIL。
3. 实现 per-segment signed mean→abs 的 accuracy、围绕 segment mean 的 robust MAD stability、voiced coverage/internal gaps、持续段 dB/s 衰减；以版本化规则映射 0–100，再按 40/30/20/10 汇总。
4. 实现基于原始指标的诊断规则，每条携带 `metric`, `evidence`, `action`。
5. Run targeted tests；Expected: PASS；Commit `feat(F001): add explainable scoring engine [砚砚/gpt-5.6-sol🐾]`。

## Task 4: 原子本地存储与播放生命周期

**Files:** Create `src/storage/session-repository.js`, `src/playback/playback-controller.js`; Test `tests/integration/{session-repository,playback-controller}.test.js`.

1. 用 `fake-indexeddb` 写 round-trip、TTL=0、transaction failure、delete/clear、delete while playing 的失败测试。
2. Run targeted tests；Expected: FAIL。
3. 实现单 object store `sessions`，每条 record 含 Blob+trajectory+report；实现 playback URL 的 create/revoke 唯一所有权和 currentTime→trajectory cursor 投影。
4. Run targeted tests；Expected: PASS 且 INV-3/4/5/7 绿。
5. Commit: `feat(F001): persist and replay complete sessions [砚砚/gpt-5.6-sol🐾]`。

## Task 5: 浏览器音频管线、录音与示范音

**Files:** Create `src/audio/{audio-worklet,live-audio-session,recorder,demo-player}.js`, `src/pitch/pitch-worker.js`; Test `tests/unit/recorder.test.js`, `tests/integration/live-audio-session.test.js`.

1. 写失败测试：2048 sample frame+hop overlap、sessionId/sequence、stale frame 丢弃、MediaRecorder MIME 协商、stop 幂等、示范停止后才能录音。
2. Run targeted tests；Expected: FAIL。
3. Worklet 只累积/发帧；module Worker 运行 YIN；main session 只路由结构化 PitchFrame。Recorder 用 `MediaRecorder.isTypeSupported` 从 `webm/opus`, `ogg/opus`, `mp4` 选择，均不支持则给可见错误。
4. DemoPlayer 使用低增益三角波、低通滤波和渐入渐出包络按目标 segment 播放，结束时 disconnect/close 并等待短暂缓冲清空；单测锁定音色、峰值增益和包络参数。
5. Run targeted tests；Expected: PASS；Commit `feat(F001): build single-owner audio pipeline [砚砚/gpt-5.6-sol🐾]`。

## Task 6: PracticeSessionController 状态机

**Files:** Create `src/session/practice-session-controller.js`; Test `tests/unit/practice-session-controller.test.js`.

1. 按完整 transition table 写失败测试，覆盖双 start、权限迟到、cancel、deviceLost、workerError、stop 双调用、save failure、generation token。
2. Run targeted tests；Expected: FAIL。
3. 实现依赖注入的 controller；所有 teardown 走同一幂等路径；只在 running 收帧；finalizing 冻结 snapshot 后生成 report 和完整 record。
4. Run targeted tests；Expected: PASS 且 INV-1/2/6/8/9 全绿。
5. Commit: `feat(F001): orchestrate resilient practice sessions [砚砚/gpt-5.6-sol🐾]`。

## Task 7: 简单旋律、Canvas 跑道与应用 UI

**Files:** Create `src/exercises/simple-melodies.js`, `src/render/{track-renderer,report-renderer}.js`; Modify `src/app.js`, `src/styles.css`, `index.html`; Test `tests/unit/track-renderer.test.js`, `tests/e2e/practice-flow.spec.js`.

1. 写两条版本化简单旋律（音阶往返、短句跳进），目标 segment 含 rest；写 Canvas viewport/time→x/midi→y 纯函数测试。
2. 写 Playwright 失败路径：选择→准备页（麦克风调用仍为 0）→试听→明确开始→权限/环境→倒计时→实时轨迹→报告。
3. 实现标题“听见你的声音”、响应式选择页和练习准备页、明确错误/空状态、Canvas target blocks/user line/playhead/tolerance band；准备页分别提供“试听旋律”和“开始练习”，准高低同时用位置、文字和颜色表达。
4. Run: `pnpm vitest run tests/unit/track-renderer.test.js && pnpm test:e2e`；Expected: PASS，窄屏/桌面截图生成到 `project-evidence/F001/`。
5. Commit: `feat(F001): deliver realtime melody runway [砚砚/gpt-5.6-sol🐾]`。

## Task 8: 报告、录音回放与历史

**Files:** Modify `src/app.js`, `src/render/report-renderer.js`, `src/styles.css`; Test `tests/e2e/{practice-flow,history-and-delete}.spec.js`.

1. 写失败 E2E：报告四项+原始指标+诊断、数据不足、不刷新丢失、播放游标同步、单删/全删、storage failure 可见。
2. Run E2E；Expected: FAIL。
3. 实现报告/历史/回放 UI；对象 URL 仅加载时产生，离页/删除 revoke；显示音频大小与本地存储声明。
4. Run E2E；Expected: PASS；Commit `feat(F001): complete reports recording playback and history [砚砚/gpt-5.6-sol🐾]`。

## Task 9: 全量门禁与真实浏览器证据

**Files:** Create/modify `playwright.config.js`, `tests/e2e/practice-flow.spec.js`, `project-evidence/F001/*`; Modify `docs/features/F001-realtime-pitch-trainer.md` only after evidence exists.

1. 生成 Chromium fake-audio WAV，测 processing latency histogram，断言 p95≤150 ms；补资源计数诊断断言。
2. Run: `pnpm check && pnpm test -- --coverage && pnpm build && pnpm test:e2e`；Expected: 全绿。
3. 用 Chrome 真实页面走 Primary Journey，保存≤3张截图和≤15秒录屏；Android Chrome 与 iOS Safari 记录支持结论，不能测则明确 not verified。
4. 对照 AC-A1～C6 和 requirements checklist，只用实际证据打勾；不满足项立即修，不写 deferred。
5. Commit: `test(F001): prove realtime trainer acceptance [砚砚/gpt-5.6-sol🐾]`。

## 2026-08-08 试用修订：长音反馈跑道

**Finish line:** 用户只选择一个舒适的长音目标，页面明确显示音名与频率；可试听、明确开始、看慢速且稳定的实时轨迹，结束后播放本地录音。

**Acceptance Criteria:**

- LT-1：首页只提供 A3（220 Hz）、C4（261.6 Hz）、E4（329.6 Hz）三个 8 秒长音目标；每次 session 只有一个目标音，音名和频率在选择页、准备页与练习页持续可见。
- LT-2：进入准备页不请求麦克风；可先试听目标长音，只有点击“开始录制”才进入麦克风与录音会话。
- LT-3：跑道时间窗覆盖完整 8 秒长音；Canvas 使用纯投影的显示平滑轨迹降低抖动，但持久化与评分仍消费质量门后的原始帧。
- LT-4：长音结束后可播放本次录音，刷新后仍能从本地历史恢复并删除。

**Not building:** 本轮不提供多音旋律、音阶或快速换音练习；不增加自动选音、声部判断、伴奏或云端能力。

### Stateful Object Gate

| 对象 | Owner | 状态/事件变化 | 不变量 |
|---|---|---|---|
| 长音练习定义 | `LONG_TONE_PRACTICES` | 选择目标后作为不可变 `PracticeDefinition` 传入既有 session controller | 每条定义只有一个 8 秒 sounding segment，版本随记录持久化 |
| 原始轨迹 | `PracticeSessionController` | 只在 running 接收质量合格帧，结束时随记录原子保存 | 不因 UI 平滑被覆盖、回写或降采样 |
| 显示轨迹 | `smoothTrajectoryForDisplay` 纯函数 | render 时从原始轨迹投影；unvoiced/长间隙重置平滑窗口 | 零存储、零跨 session 状态、不能进入 scorer/repository |

对抗场景：目标选择后试听与开始并发时先停止示范音；显示轨迹出现离群点时平滑但原始记录不变；静音间隙后首个 voiced 点不得被间隙前历史拖拽；刷新后播放的仍是完整录音与原始轨迹。

### Task 10: 长音定义与目标音可见性

**Files:** Create `src/exercises/long-tones.js`, `src/exercises/practice-catalog.js`; Delete `src/exercises/simple-melodies.js`; Modify `src/app.js`, `src/ui/app-view.js`; Test `tests/unit/long-tones.test.js`, `tests/unit/practice-catalog.test.js`, `tests/unit/app-view.test.js`, `tests/e2e/practice-flow.spec.js`.

1. 先写失败测试：仅有三个单音 8 秒练习；A3=57/220 Hz；首页与准备页显示目标音名、频率、时长，不再出现多音旋律。
2. Run targeted tests；Expected: FAIL（长音定义和新文案尚不存在）。
3. 实现不可变长音定义并替换 UI 数据源；删除旧旋律生成器，但在只读 catalog 中保留旧 ID 的解析定义，确保已持久化记录仍可正确打开且不出现在新练习入口。
4. Run targeted tests；Expected: PASS。

### Task 11: 慢速跑道与显示专用平滑

**Files:** Modify `src/render/track-renderer.js`, `src/ui/app-view.js`; Create `src/ui/live-feedback.js`; Test `tests/unit/track-renderer.test.js`, `tests/unit/live-feedback.test.js`.

1. 先写失败测试：8 秒 segment 在默认 viewport 内完整可见；离群抖动被 5 帧中值投影压低；输入数组不变；超过 250 ms 静音间隙后平滑重置。
2. Run targeted test；Expected: FAIL。
3. 实现 `smoothTrajectoryForDisplay` 纯函数，并仅在 `createTrackViewModel` 的 Canvas points 路径使用；默认 window 改为 10 秒。
4. Run targeted test + scoring/session tests；Expected: PASS，scorer 与 repository 仍接收原始 trajectory。

### Task 12: 长音录制播放闭环

**Files:** Modify `tests/e2e/practice-flow.spec.js`, `src/ui/app-view.js`, `src/styles.css`; Test desktop/mobile Playwright.

1. 先写失败 E2E：选择 A3→准备页目标为 A3/220 Hz→试听→开始前 getUserMedia=0→明确开始后=1→慢速跑道→报告→播放录音。
2. 实现长音专用文案与目标徽标，不改既有 recorder/playback ownership。
3. Run `pnpm check && pnpm test:coverage && pnpm build && pnpm test:e2e`；Expected: 全绿，并在 Browser Preview 人工走完整路径。

## 技术 OQ（实现中自决）

- OQ-T1：MediaRecorder MIME 以运行时 `isTypeSupported` 选择，不引入转码依赖。
- OQ-T2：iOS Safari 若缺少当前环境设备，结论必须写 `not verified`，不能基于 Chromium 推断。
- OQ-T3：评分映射阈值保存在 `score-rules.js` 的 `scorerVersion: 1`；任何调整必须由夹具测试驱动。

无待 operator 决策的价值 OQ；范围已在 2026-08-07 Design Gate 批准。
