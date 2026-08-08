---
feature_ids: [F001]
topics: [review-request, preparation-flow, demo-audio]
doc_kind: review-note
created: 2026-08-08
---

# Review Request: F001 练习准备页与柔和试听增量

Review-Target-ID: f001
Branch: `feat/f001-web-realtime-trainer`
Previously approved baseline: `c5f7ade`
Code delta SHA: `1e2a8d2`

## What

- 产品标题改为“听见你的声音”。
- 首页旋律卡只进入独立练习准备页；准备页分别提供“试听旋律”和“开始练习”。
- 只有用户明确点击“开始练习”才调用 `getUserMedia`；取消练习返回准备页。
- 示范音从高增益正弦波改为低增益三角波，经 1400 Hz 低通滤波并使用 80/140 ms 渐入渐出。
- 更新单元/E2E 回归测试、Design Gate、feature spec 与 quality-gate 证据。

## Why

operator 试用后指出：原标题不符合预期，示范音有些刺耳，而且选择旋律后不应直接进入练习。此增量把试听和开始练习放到同一个明确的准备阶段，保留用户控制权，并柔化合成试听音。

## Original Requirements（必填）

> “把标题改成听见你的声音；播放的音频有点刺耳；试听应该在进入练习的页面里，我可以点击试听，再点击开始练习，而不是进入页面就立马开始。”

- 来源：`feature-discussions/2026-08-07-f001-design/README.md`
- **请对照上面的摘录判断交付物是否解决了 operator 的问题。**

## Tradeoff

没有引入预录乐器采样或新的音频依赖。首版继续使用 Web Audio 的确定性合成音，以低增益、低通和包络改善听感；这样体积小、离线可用、测试可复现，但“更悦耳”仍需要 operator 人耳最终确认。

## Architecture Ownership（必填）

Architecture cell: `browser-vocal-trainer`
Map delta: `none`
Why: 变更仅调整既有 UI 路由和 `DemoPlayer` 音色参数，没有新增 owner、存储、队列、路由器或跨 cell 边界。

请 reviewer 检查：

- diff 是否与 `Map delta` 一致；
- 是否意外建立新的音频生命周期 owner；
- `DemoPlayer.play()` 与用户并发点击“开始练习”时，停止和关闭 AudioContext 是否仍可靠；
- 进入准备页、试听以及返回选择页是否都不会提前申请麦克风。

## Open Questions

### 技术 OQ（给 reviewer）

1. `prepare → preview → begin-practice` 的路由与音频清理是否存在竞态或残留示范音？
2. 三角波 + 低通 + 低峰值增益 + 渐入渐出的实现是否在支持 Web Audio 的目标浏览器上安全？
3. E2E 的 `getUserMedia` 调用计数是否足以阻止“进入页面自动开练”回归？

### 价值 OQ（给 operator，如有）

无。当前音色参数可单提交回滚；主观听感由 operator 在实时预览中确认。

## Next Action

请对 `c5f7ade..1e2a8d2` 做正式增量 review，重点核验原始反馈、麦克风权限边界、示范音生命周期与桌面/移动准备页可用性，给出 `APPROVE` 或 `REQUEST-CHANGES`。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f001/opus`
- Start Command: `pnpm exec vite --host 127.0.0.1 --port 3201`
- Ports: `web=3201`, `api=N/A`

### 沙盒 Bootstrap

```bash
unset NODE_ENV
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
```

## 自检证据

### Spec 合规

- Quality gate: `review-notes/F001-quality-gate.md`
- AC-B1 已细化为：选择后进入独立准备页，进入时不请求麦克风，试听和开始由用户分别触发。
- 原始反馈 R8/R9/R10 已逐条映射到页面标题、音色参数测试和麦克风调用 E2E。
- Architecture cell: `browser-vocal-trainer`; Map delta: `none`。

### 测试结果

```bash
pnpm check          # 52 files, 0 errors
pnpm test:coverage  # 18 files / 77 tests, 0 failed; 69.42% statements
pnpm build          # 24 modules, exit 0
pnpm test:e2e       # desktop + mobile, 4/4 passed
git diff --check    # clean
```

### 浏览器证据

- 新标题与选择页：`/tmp/cat-cafe-evidence/F001-feedback-round/home-title.png`
- 独立练习准备页：`/tmp/cat-cafe-evidence/F001-feedback-round/preparation.png`
- 选择 → 准备 → 试听录屏：`/tmp/cat-cafe-evidence/F001-feedback-round/page@98f5b71357910b1ddd286e04660a26c8.webm`

### 工件与落点

- 根目录媒体/设计工件扫描：工作树与 `origin/main...HEAD` 均无命中。
- 功能改动仅在 `/Users/sss/vocal-trainer-f001`；主 worktree 仍在 `main`，其既有未跟踪治理文件未触碰。

### 相关文档

- Plan: `feature-specs/2026-08-08-web-realtime-pitch-trainer.md`
- Discussion: `feature-discussions/2026-08-07-f001-design/README.md`
- Feature: `docs/features/F001-realtime-pitch-trainer.md`

[砚砚/gpt-5.6-sol🐾]
