---
feature_ids: [F001]
topics: [review-request, canvas, playback, compatibility]
doc_kind: review-note
created: 2026-08-08
---

# Review Request: F001 报告跑道起点与 Canvas 兼容性

Review-Target-ID: `f001-track-compat`  
Branch: `fix/f001-track-compat`

## What

- 报告页把播放游标 `0` 视为有效时间，首次渲染从录音起点显示。
- Canvas 目标块在 `roundRect` 不可用时退化为普通 `rect`，不中断整条跑道。
- E2E 记录报告目标块初始 x；unit 用无 `roundRect` 的 context 跑真实 `TrackRenderer`。
- Playwright 支持 `E2E_PORT`，防止并行 worktree 误复用 4173 的旧服务。

## Why

愿景守护在 PR #1 合入后确认两条遗留显示问题：报告轨迹首次显示尾段并在播放时跳变；旧 Safari 类环境缺少 `roundRect` 时目标跑道会抛错。跑道是 README 明确的核心功能，不能把已知显示中断留给实机验收兜底。

## Original Requirements

> “我们现在做最核心的东西就是音高的反馈跑道……当前的这个跑道速度有点快，在我的音高范围内很抖……先来做一个长音的练习……支持录制播放，然后目标音是哪一个音？”

- 来源：thread `thread_msi6je07bb15qzyy`；真相源 `README.md`
- 请对照该摘录判断修复是否保持“长音 + 慢跑道 + 录制回放”的核心闭环。

## Tradeoff

- 缺少圆角 API 时保留正确几何和可见性，放弃圆角装饰；没有引入 polyfill 或手写曲线路径。
- 没有借机改评分、轨迹平滑或播放状态机。
- V1/V2 同轮修复；AC-B3/C5 的真实设备验收仍保持开放，不用自动化替代实测。

## Architecture Ownership

Architecture cell: `browser-vocal-trainer`  
Map delta: `none`  
Why: 只修正 Render 层时间投影和 Canvas 能力边界。

请 reviewer 检查：

- diff 是否与 `Map delta: none` 一致；
- 是否误触 session/audio/scoring/storage；
- 单层 `roundRect → rect` 是否足够且没有隐藏异常路径。

## Open Questions

### 技术 OQ

1. `cursorMs ?? fallback` 是否准确表达“0 是合法播放位置，只有缺失才回退”？
2. `rect` fallback 是否在不扩大兼容层的前提下守住核心可见性？
3. E2E 的 Canvas 调用记录是否真实覆盖报告首次渲染，而非只验证播放后状态？
4. `E2E_PORT` 是否正确消除了并行 worktree 的旧服务串线？

### 价值 OQ

无。本次选择可单 commit 回滚，不改变产品范围或外部契约。

## Failure-Mode Sweep Report

- Pattern A：合法零值被布尔回退吞掉。扫描全部 `cursorMs` 和 `||`；只修报告时间投影，CSS 空串、Canvas 零尺寸与 DPR 默认值均为语义正确的 fallback。
- Pattern B：Canvas 可选 API 无能力检查。扫描全部 `roundRect` 调用，仅此一处；兼容分支留在 Render owner 内。
- fallback 层数：新增 1 层，未达到三层自检阈值。

## Next Action

请以代码 SHA `ef7ce96` 和包含本请求信的最终分支 tip 为审查范围，独立复跑 targeted unit、全量测试和独立端口 E2E，并实际查看报告跑道；给出 `APPROVE` 或 `REQUEST-CHANGES`。前端改动请勿只做静态代码审查。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f001-track-compat/{reviewer-handle}`
- Bootstrap: `env -u NODE_ENV pnpm install --frozen-lockfile`
- Start/Validation: `E2E_PORT=4177 pnpm test:e2e`；手工预览可运行 `pnpm exec vite --host 127.0.0.1 --port 4177`
- Ports: `web=4177`, `api=N/A`

## 自检证据

### Spec 合规

- Quality Gate：`review-notes/2026-08-08-f001-track-compat-quality-gate.md`
- Feature：`docs/features/F001-realtime-pitch-trainer.md`
- Bug diagnosis：`docs/bug-report/f001-track-rendering-compat/bug-report.md`
- F001 仍为 `in-progress`；本次不关闭 AC-B3/C5。

### 测试结果

```text
pnpm test                         -> 20 files / 85 passed / 0 failed
E2E_PORT=4174 pnpm test:e2e      -> desktop + mobile / 4 passed
pnpm check                        -> 56 files / 0 errors
pnpm build                        -> 26 modules / exit 0
git diff --check                  -> exit 0
```

### 浏览器证据

- 当前 worktree Browser Preview：`http://127.0.0.1:4174`
- 截图：准备页、实时跑道、修复后的报告页，共 3 张，位于忽略的 `test-results/`。
- 录屏：桌面 18.88s、移动 17.28s，位于 `/tmp/cat-cafe-evidence/f001-track-compat/`。
- 根目录媒体/设计工件：无。
