---
feature_ids: [F001]
topics: [review-request, web-audio, vocal-training]
doc_kind: review-note
created: 2026-08-08
---

# Review Request: F001 Web 实时音高练歌器

Review-Target-ID: f001  
Branch: `feat/f001-web-realtime-trainer`  
Code baseline: `9efc4bb`；正式 review 以请求消息所列远端 branch tip 为准

## What

从确认后的空基线实现完整浏览器练歌闭环：两条内置旋律与试听、麦克风环境校准、AudioWorklet→YIN Worker、Canvas 目标/轨迹/游标、四项可解释评分、MediaRecorder 录音、IndexedDB 永久本地记录、刷新恢复、回放同步和删除。

会话、录音、存储、播放分别有唯一 owner；设备/Worker 故障、权限迟到、双 start、页面隐藏、存储失败和播放中删除均有明确生命周期测试。

## Why

README 的地基是“音高检测准、实时反馈直观、评分能指路”；operator 进一步确认首版先内置简单旋律、先闭核心环、加入录音回放，并删除上一版未确认实现。本分支直接交付可部署的静态 Web App，不建设曲库平台或云服务。

## Original Requirements

> “核心价值不是功能多，音高检测准+实时反馈直观+评分能指路，这三个是地基。”  
> “1、先内置简单旋律  2、核心先闭环  3、加入录音回放  4、把上一版实现的代码删掉吧”

- 来源：`README.md`, `feature-discussions/2026-08-07-f001-design/README.md`
- **请对照上面的摘录判断交付物是否解决了 operator 的问题。**

## Tradeoff

- 采用原生 ES modules + Web APIs，避免框架进入实时音频关键链，但 UI 状态编排由 `app.js` 显式承担。
- 录音、轨迹、报告整条写入一个 IndexedDB object store，换取原子性；首版不拆元数据索引。
- E2E 用确定性合成媒体替身验证 Worker/评分/存储/回放全链，避免 headless Chrome 的 native 音频时钟冻结；真实设备兼容和真实输入延迟仍明确留在 release acceptance，未打勾冒充完成。
- 保持 PWA-ready 的静态资源边界，但首版不注册 Service Worker。

## Architecture Ownership

Architecture cell: `browser-vocal-trainer`  
Map delta: `none`（cell 已在 F001 kickoff 创建）  
Why: 本实现落入既有 Web App ownership cell，没有新增跨 cell 的 Store/Queue/Router。

请 reviewer 检查：

- diff 是否与 `Map delta` 一致；
- 是否出现并行 lifecycle owner 或旁路存储/播放操作；
- `PracticeSessionController`、`Recorder`、`SessionRepository`、`PlaybackController` 的边界是否守住。

## Open Questions

### 技术 OQ（给 reviewer）

1. 请重点审查 session generation token、设备/Worker error、stop/abort/finalize 竞态是否仍有资源泄漏或重复提交路径。
2. 请验证 YIN/质量门/动态噪声门限与“评分只吃原始合格帧”的数据流没有混线。
3. 请检查 IndexedDB 原子记录、Blob URL revoke、刷新恢复与删除路径的数据安全。
4. 请判断 Canvas/报告在桌面和窄屏是否真正直观，并核对 AC-B3、AC-C5 保持未勾选是否合理。

### 价值 OQ（给 operator）

无。

## Fresh-Context Findings

Sonnet 与 Fable 预扫因对应模型不可用未启动；Gold/Siamese 在正式 review 请求前未返回。没有产生 finding list，也不把预扫当作任何放行依据。正式 reviewer 请独立审查，delta 标记用 `[FC:N/A]`。

## Next Action

请对远端分支 `feat/f001-web-realtime-trainer` 的请求时 branch tip 做正式独立 review，给出 `APPROVE` 或 `REQUEST-CHANGES` verdict；每个 finding 请附文件/行号、严重度和独立验证证据。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f001/opus`
- Bootstrap: `unset NODE_ENV && pnpm install --frozen-lockfile`
- Start Command: `pnpm exec vite --host 127.0.0.1 --port 4201`
- Ports: `web=4201`, `api=N/A`（不使用 3003/3004）

Reviewer 请在 detached HEAD / read-only sandbox 中验证；如需改代码，转 TAKEOVER，不直接修改作者 worktree。

## 自检证据

### Spec 合规

完整报告：`review-notes/F001-quality-gate.md`。

- 已验证：A1/A2/A3、B1/B2、C1/C2/C3/C4/C6。
- 外部验收未签字：B3 真实输入延迟、C5 真实 Android Chrome / iOS Safari。
- 合成管线 133 帧 p95 6.6 ms；YIN 82.41–880 Hz 含谐波最大误差 0.099 cents。

### 测试结果

```bash
unset NODE_ENV
pnpm install --frozen-lockfile
pnpm check                             # 52 files, 0 errors
pnpm test:coverage                     # 18 files, 70 tests, 0 failures
pnpm -r --if-present run build         # 24 modules, exit 0
pnpm test:e2e                          # desktop/mobile viewport, 4/4 passed
```

### 浏览器证据

- `/tmp/cat-cafe-evidence/F001/home-desktop.png`
- `/tmp/cat-cafe-evidence/F001/home-mobile.png`
- `/tmp/cat-cafe-evidence/F001/report-desktop.png`
- `/tmp/cat-cafe-evidence/F001/page@cb85a9c1146fe1f0d46e8bb2d2c5ea74.webm`（6.76 秒）

### 工件与落点

- feature worktree 在请求前干净，远端分支与本地 HEAD 一致。
- 根目录媒体工件扫描：工作树与 `origin/main...HEAD` 均无命中。
- 主 worktree 仍有 operator/治理系统预先存在的未跟踪文件；本分支未提交、移动或删除它们。

### 相关文档

- Plan: `feature-specs/2026-08-08-web-realtime-pitch-trainer.md`
- Feature: `docs/features/F001-realtime-pitch-trainer.md`
- Design Gate: `feature-discussions/2026-08-07-f001-design/README.md`
- Architecture: `docs/architecture/ownership/README.md`
