---
feature_ids: [F001]
topics: [review-request, demo-tone, audio]
doc_kind: review-note
created: 2026-08-08
---

# Review Request: F001 示范音清晰度修订

Review-Target-ID: f001
Branch: `feat/f001-web-realtime-trainer`
Previously reviewed baseline: `6d0d615`
Behavior delta SHA: `8852b33`

## What

- 示范音仍使用三角波和渐入渐出，但低通截止从 1400 Hz 提升到 2400 Hz，让长音保留更多泛音。
- 滤波 Q 从 0.7 降为 0.55、峰值增益从 0.065 降为 0.06，避免增加清晰度时恢复刺耳峰值。
- 起音从 80 ms 缩短为 55 ms，让音头更明确；140 ms 释音不变。
- `filterQ` 进入不可变 schedule，由 `DemoPlayer` 按 schedule 设置，参数边界有单测。

## Why

operator 在真实试听后反馈“示范声音有点闷”。代码检查确认三角波叠加 1400 Hz 低通会压低 A3/C4/E4 的较高泛音，80 ms 起音也使音头偏钝。

## Original Requirements

> “我感觉现在的示范声音有点闷。”

- 来源：`feature-discussions/2026-08-07-f001-design/README.md`
- 请对照该反馈判断改动是否在不恢复刺耳听感的前提下提高了清晰度。

## Tradeoff

- 没改用锯齿波或方波，因为它们会显著增加高次谐波，容易回到上一轮“刺耳”的问题。
- 没移除低通，只提高截止频率并降低 Q；保留对高频刺激的控制。
- 主观听感由 operator 在 Browser Preview 最终验收；自动化只锁定音频图、参数和生命周期。

## Architecture Ownership

Architecture cell: `browser-vocal-trainer`
Map delta: `none`
Why: 只调整现有 `DemoPlayer` 的音色参数与 schedule 字段，不改变音频、会话或存储 owner 边界。

## Open Questions

### 技术 OQ（给 reviewer）

1. `filterQ` 从 schedule 到 BiquadFilter 的数据流是否完整且不会影响 stop/teardown？
2. 55 ms 起音与 140 ms 释音在短音边界仍受既有 min/max 保护吗？
3. 这次 delta 是否严格不触碰麦克风、录音、检测、评分和存储路径？

### 价值 OQ（给 operator）

无待决技术方案；“是否仍偏闷”由 operator 当前实际试听继续校准。

## Next Action

请增量 review `6d0d615..8852b33`；本请求信将作为其上的 doc-only commit，请以 PR 当前 HEAD 为 continuity 终点，明确给出 `APPROVE` 或 `REQUEST-CHANGES`。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f001/jinge`
- Start Command: `pnpm exec vite --host 127.0.0.1 --port 3202`
- Ports: `web=3202`, `api=N/A`

### 沙盒 Bootstrap

```bash
unset NODE_ENV
pnpm install --frozen-lockfile
```

## 自检证据

- Red: `demo-player.test.js` 期望 2400 Hz/Q 0.55/0.06/55 ms，实际仍为 1400 Hz/0.065/80 ms，按预期失败。
- Green: 示范音 targeted test 1/1；review 文案回归 test 6/6；全量测试 84/84；E2E 4/4；Biome 56 files；build 26 modules。
- Dogfood: 真实 Chromium 完整播放 A3 示范音 8 秒，按钮正常恢复，`pageErrors=[]`；Hub Browser Preview 已打开供 operator 试听。
- 根目录媒体/设计工件：无；`.pen`：无。
- Quality gate: `review-notes/F001-quality-gate.md`。

[砚砚/gpt-5.6-sol🐾]
