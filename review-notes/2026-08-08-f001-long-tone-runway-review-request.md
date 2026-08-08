---
feature_ids: [F001]
topics: [review-request, long-tone, pitch-runway]
doc_kind: review-note
created: 2026-08-08
---

# Review Request: F001 长音反馈跑道增量

Review-Target-ID: f001
Branch: `feat/f001-web-realtime-trainer`
Previously reviewed baseline: `2846e46`
Plan SHA: `d6146a5`
Code delta SHAs: `819d279`, `d79da69`

## What

- 新练习入口只提供 A3（220 Hz）、C4（261.63 Hz）、E4（329.63 Hz）三个 8 秒长音目标，目标音名与频率跨页面持续可见。
- 跑道窗口从 5.2 秒放慢到 10 秒，游标移到 18% 位置，使完整 8 秒目标在开始时可见。
- Canvas 使用 5 帧中值的显示专用平滑；静音或超过 250 ms 的间隙重置窗口，原始 trajectory 不变，评分与持久化路径未改。
- 新 active/legacy practice catalog：旧多音记录仍能按原定义打开，但旧旋律不再出现在新练习入口。
- 统一实时反馈格式化逻辑，当前音高显示 `A3` 等音名，不再显示 MIDI 数字 `57`。

## Why

operator 实际试用后指出：当前跑道速度太快，音高轨迹在自己的音域内看起来很抖；现阶段应先用一个明确长音验证最核心的反馈跑道，只保留试听、录制和播放，并明确目标音。

## Original Requirements（必填）

> “现在做最核心的音高反馈跑道。当前跑道速度有点快，在我的音高范围内很抖；先不做多音练习，先做一个长音，支持试听、录制和播放，并明确目标音是哪一个音。”

- 来源：`feature-discussions/2026-08-07-f001-design/README.md`
- **请对照上面的摘录判断交付物是否解决了 operator 的问题。**

## Tradeoff

- 没做自动声部判断或动态选音；首版提供低/中/高三个明确目标，默认入口为 A3。这样用户可以立即理解和选择，避免引入不透明校准。
- 只平滑 Canvas 投影，不平滑评分输入。视觉会更稳定，但不会用 UI 美化掩盖真实音准抖动。
- 旧旋律定义保留在只读 catalog 仅用于历史 readback，不能启动新的入口；这是 TTL=0 用户数据兼容所需，不是并行练习产品面。

## Architecture Ownership（必填）

Architecture cell: `browser-vocal-trainer`
Map delta: `none`
Why: 复用现有 PracticeDefinition、session controller、renderer、repository 与 playback owner，只更换 active practice catalog 和 Canvas 纯投影。

请 reviewer 检查：

- diff 是否与 `Map delta` 一致；
- `smoothTrajectoryForDisplay` 是否只影响 Canvas，未泄漏到评分或持久化；
- legacy catalog 是否既保留旧记录可读性，又不会重新暴露多音练习入口；
- 10 秒窗口和 18% 游标是否确实降低速度并完整展示 8 秒目标；
- 实时音名格式化是否只保留一个实现来源。

## Open Questions

### 技术 OQ（给 reviewer）

1. 5 帧中值窗口与 250 ms 重置是否有遗漏的静音/乱序输入边界？
2. `ACTIVE_PRACTICES` 与只读 legacy lookup 的边界是否足够清楚；旧记录的“再练一次”是否可靠回到 A3 准备页而不启动旧练习？
3. 目标音三档与 8 秒时长是否在移动端布局、MediaRecorder 和既有结束计时器中保持一致？

### 价值 OQ（给 operator，如有）

无。目标音集合、时长和显示平滑参数均集中且可单提交回滚；operator 可在当前 Browser Preview 中继续调校听感和速度。

## Next Action

请对 `2846e46..d79da69` 做正式增量 review，重点核验原始试用反馈、原始/显示轨迹隔离、旧记录数据兼容和长音试听→录制→播放闭环，并给出 `APPROVE` 或 `REQUEST-CHANGES`。

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
- AC-B1/B2 和 R11 已更新为单一长音、明确音名/频率、10 秒慢速窗口和显示专用平滑。
- 原始 trajectory 的 controller/scorer/repository 路径未改；输入不变测试锁定投影边界。
- Architecture cell: `browser-vocal-trainer`; Map delta: `none`。

### Red→Green

- 长音定义/页面：模块不存在、旧旋律文案 → `long-tones.test.js` / `app-view.test.js` 通过。
- 慢速平滑：5.2 秒窗口、无平滑函数 → `track-renderer.test.js` 6/6 通过。
- legacy readback：catalog 不存在 → `practice-catalog.test.js` 通过。
- 实时读数：Browser screenshot 显示 `57` → `live-feedback.test.js` 2/2 与 E2E `#live-note=A3` 通过。

### 测试结果

```bash
pnpm check          # 56 files, 0 errors
pnpm test:coverage  # 20 files / 83 tests, 0 failed; 70.12% statements
pnpm build          # 26 modules, exit 0
pnpm test:e2e       # desktop + mobile, 4/4 passed
git diff --check    # clean
```

### 浏览器证据

- 长音选择：`/tmp/cat-cafe-evidence/F001-long-tone/home-desktop.png`
- A3 准备页：`/tmp/cat-cafe-evidence/F001-long-tone/preparation.png`
- A3/220 Hz 慢速实时跑道：`/tmp/cat-cafe-evidence/F001-long-tone/live-runway.png`

### 工件与落点

- `.pen` 扫描：无匹配设计稿；按既有视觉系统实现。
- 根目录媒体/设计工件扫描：工作树与 `origin/main...HEAD` 均无命中。
- 当前 dev server：`/Users/sss/vocal-trainer-f001` / `http://127.0.0.1:4173`，HTTP 200；Hub Browser Preview 已打开。

### 相关文档

- Plan: `feature-specs/2026-08-08-web-realtime-pitch-trainer.md`
- Discussion: `feature-discussions/2026-08-07-f001-design/README.md`
- Feature: `docs/features/F001-realtime-pitch-trainer.md`

[砚砚/gpt-5.6-sol🐾]
