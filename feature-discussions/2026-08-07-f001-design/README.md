---
feature_ids: [F001]
topics: [design-gate, vocal-training, web-audio]
doc_kind: discussion
created: 2026-08-07
---

# F001 Web 实时音高练歌器 — Design Gate

> **Status**: approved by operator on 2026-08-07

## Operator Experience

需求锚点：

> “核心价值不是功能多，音高检测准+实时反馈直观+评分能指路，这三个是地基。”

设计确认：

> “1、先内置简单旋律  2、核心先闭环  3、加入录音回放  4、把上一版实现的代码删掉吧”

试用反馈（2026-08-08）：

> “把标题改成听见你的声音；播放的音频有点刺耳；试听应该在进入练习的页面里，我可以点击试听，再点击开始练习，而不是进入页面就立马开始。”

## Scope Decision

- 首版目标是完成一次可信的浏览器练习 session，不是建设歌曲平台。
- 内置简单旋律既提供目标音高时间轴，也在独立练习准备页提供录音前试听。
- 进入练习准备页不请求麦克风、不自动倒计时；只有用户明确点击“开始练习”才进入音频会话。
- 示范音采用柔和的低增益音色、低通滤波和渐入渐出，减少高频刺激与音符切换的点击感。
- 核心闭环包括麦克风检查、YIN 检测、Canvas 跑道、四项评分、诊断、录音回放和本地恢复。
- PWA 保持可演进边界，核心闭环验收前不注册 Service Worker。
- 完整歌曲、主旋律提取、歌词、账号、云同步和 AI 唱法诊断不在 F001。

## User Journey Wireframe

```text
┌──────────────── 练习选择 ────────────────┐
│  简单旋律卡片：音域 / 时长 / [进入练习]    │
└──────────────────┬──────────────────────┘
                   ▼
┌─────────────── 练习准备 ────────────────┐
│ 旋律信息 · [试听旋律] · [开始练习]         │
│ 进入此页不请求麦克风，不自动开始            │
└──────────────────┬──────────────────────┘
                   ▼（明确点击开始练习）
┌────────────── 麦克风检查 ───────────────┐
│ 权限 · 输入音量 · 环境噪声 · 设备状态     │
└──────────────────┬──────────────────────┘
                   ▼
┌─────────────── 实时练习 ────────────────┐
│ 当前音名 / ± cents / 准·高·低             │
│ ──目标音符块──│中央游标│──用户音高曲线──  │
│                         [结束练习]         │
└──────────────────┬──────────────────────┘
                   ▼
┌────────────── 报告与回放 ───────────────┐
│ 总分 · 四项分 · 数据质量 · 诊断建议       │
│ [播放录音] ─────●──── 音高轨迹            │
│ [再练一次] [删除记录]                     │
└─────────────────────────────────────────┘
```

## Architecture Decision

```text
PracticeDefinition ───────────────┐
                                  ▼
麦克风 → AudioWorklet → YIN Worker → 音高质量门 → 时间对齐器
              └→ MediaRecorder                     ├→ 实时反馈 → Canvas
                                                   └→ 会话聚合 → 评分 → 报告
MediaRecorder ───────────────────────────────────────────────→ IndexedDB
```

- `PracticeSessionController` 是麦克风、检测、录音与终止流程的唯一 lifecycle owner。
- 显示平滑与评分数据分流：Canvas 可平滑，评分不能消费重度平滑结果。
- 录音与报告只存本机 IndexedDB，TTL=0，用户主动删除；无上传路径。
- 录音结束后才以完整记录提交，避免报告指向不存在的 Blob。

Architecture cell: `browser-vocal-trainer`

Map delta: `new cell created`

Why: 独立 Web App 尚无既有 ownership map；本次直接建立最终边界，不做临时分层。

## Stateful Object Census

| 对象 | 唯一 owner | 生命周期 |
|------|------------|----------|
| Practice session | `PracticeSessionController` | idle → permission → calibration → countdown → running → finalizing → report/error |
| Media recording | `PracticeSessionController` | absent → recording → stopping → persisted/discarded |
| Persisted session record | `SessionRepository` | absent → committed → loaded → deleted |
| Playback | `PlaybackController` | idle → loading → playing/paused → ended/error |

派生状态（当前目标音符、准/高/低、播放游标位置）全部由时间轴与帧数据纯投影，不独立持久化。

## Invariants

- INV-1：同一时刻最多一个活动 session 和一个麦克风流。
- INV-2：只有 `running` 区间的质量合格帧进入评分。
- INV-3：录音、报告、轨迹作为一个 session record 提交或全部不提交。
- INV-4：用户记录默认 TTL=0，仅主动删除。
- INV-5：删除 session 后，录音 Blob、轨迹、报告和播放 URL 均不可恢复访问。
- INV-6：示范播放与录音阶段不重叠。
- INV-7：练习定义以版本号随报告保存，旧报告不被新旋律定义重新解释。

## Adversarial Scenarios

- 快速双击开始：第二次请求被幂等拒绝，不创建第二个流。
- 权限拒绝后重试：旧 AudioContext、Worker 和 recorder 不残留。
- 录音 `stop` 与页面离开并发：最多提交一次完整记录，不出现半报告。
- IndexedDB 写入失败：显示保存失败，内存中的录音仍可立即回放或由用户放弃。
- 删除与播放并发：先停止播放并撤销 URL，再原子删除记录。
- Worker 帧乱序或迟到：过期帧不进入当前 session 或评分。
- 设备断开或 tab 隐藏：停止并明确说明本次数据是否足够生成报告。

## Meta-Aesthetics Check

方案通过“采集 / 检测 / 对齐 / 渲染 / 评分 / 录音持久化”六个稳定职责拆分问题，显示平滑与评分原始数据只在分叉点分离；没有为未知浏览器建立多层 fallback。复杂度来自真实音频生命周期和用户数据安全，不是补丁堆叠。

## Design Gate Verdict

APPROVED。User Journey、范围、数据边界、状态对象、不变量和 operator 决策均已落盘；2026-08-08 试用反馈已作为原 Design Gate 的交互细化同步，不扩大 F001 范围。
