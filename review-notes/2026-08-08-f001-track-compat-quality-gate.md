---
feature_ids: [F001]
topics: [quality-gate, canvas, playback, compatibility]
doc_kind: review-note
created: 2026-08-08
---

# F001 跑道显示兼容修复 · Quality Gate

检查基线：`origin/main` @ `c1bd271`  
工作目录：`/Users/sss/vocal-trainer-f001-track-fix`  
验证实例：`http://127.0.0.1:4174`（独立 Vite 实例；未复用旧 feature 的 4173）

## 愿景与交付范围

本次只修复愿景守护报告中的 V1/V2，不宣称 F001 完成：

| 原始体验/反馈 | 对应实现 | 状态 |
|---|---|---|
| 报告页打开后应从录音起点显示，点击播放不应从尾段跳回开头 | `cursorMs` 使用空值回退，合法的 `0` 不再被末尾时间覆盖 | ✅ |
| 跑道是核心功能，缺少圆角矩形 API 时不应整块消失 | `roundRect` 不可用时在同一绘制边界退化为 `rect` | ✅ |
| 跑道显示修复不能污染检测、评分或持久化 | diff 仅触及报告时间投影、Canvas 路径与测试配置；原始轨迹和评分数据流未改 | ✅ |

AC-B3 真实麦克风 p95 延迟与 AC-C5 Android Chrome / iOS Safari 实机结论仍未验，F001 保持 `in-progress`。

## Red → Green

| Finding | Red | Green |
|---|---|---|
| V1 报告初始跑道跳尾 | 完整 E2E 记录 `report-track` 目标块 x=`-697.5px` | 独立 4174 实例上目标块 x≥0，完整练习/回放/删除通过 |
| V2 无 `roundRect` 时渲染中断 | `TrackRenderer.render()` 抛 `TypeError: context.roundRect is not a function` | 同一真实 renderer 在 fallback context 上完成两段目标块绘制 |

## Failure-mode sweep

- 这是此前 review 已出现过的同型 finding，已强制重扫 `src/`。
- `cursorMs` 的布尔回退只有报告轨迹这一处；其余 `||` 用于 CSS 空串、零尺寸 Canvas 和无效 DPR 的默认值，语义不同。
- `roundRect` 只有一个调用点；兼容分支收口在 Render ownership 内，没有第二套绘制路径。
- fallback layer：本文件新增 1 个 `roundRect → rect` 分支，低于三层门槛；仓库没有 `check-fallback-layers.mjs`，已人工核对。

## Architecture Ownership

- Architecture cell: `browser-vocal-trainer`
- Map delta: `none`
- Why: 只修正 Render 层时间投影与 Canvas 能力降级，不改变 session、audio、scoring、storage ownership。
- 仓库未配置 `check:architecture-ownership`，已对照 `docs/architecture/ownership/README.md`。

## 设计与运行证据

- `designs/**/*.pen`：无匹配；本次是既有 Canvas 行为修复，无独立设计稿。
- Browser Preview：已主动打开 worktree `vocal-trainer-f001-track-fix` 的 4174 端口。
- 截图：`test-results/.../preparation.png`、`live-runway.png`、`report.png`。
- 录屏：`/tmp/cat-cafe-evidence/f001-track-compat/test-results/.../video.webm`，桌面 18.88s、移动 17.28s。
- Dogfood 路径：选择 A3 → 开始录制 → 8 秒长音 → 报告初始跑道 → 播放录音 → 返回 → 删除记录；桌面和移动均通过。

## 验证命令

| 命令 | 结果 |
|---|---|
| `pnpm test` | 20 files / 85 passed / 0 failed |
| `E2E_PORT=4174 pnpm test:e2e` | desktop + mobile，4 passed |
| `pnpm check` | 56 files，0 errors |
| `pnpm build` | 26 modules，exit 0 |
| `git diff --check` | exit 0 |

## Artifact Hygiene

仓库根目录没有新增媒体/设计工件；截图留在忽略的 `test-results/`，录屏留在 `/tmp/cat-cafe-evidence/`。
