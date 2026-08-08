---
feature_ids: [F001]
topics: [canvas, playback, compatibility]
doc_kind: bug-report
created: 2026-08-08
---

# F001 跑道回放起点与 Canvas 兼容性

### Bug 诊断胶囊：报告跑道初始跳尾与旧浏览器绘制中断

| 栏位 | 内容 |
|------|------|
| **1. 现象** | 报告页播放游标为 `0` 时，跑道按录音末尾绘制；开始播放后跳回开头。缺少 `CanvasRenderingContext2D.roundRect` 时，目标长音块绘制抛错。 |
| **2. 证据** | `src/app.js` 用 `cursorMs || fallback`，把合法的 `0` 当缺失；`src/render/track-renderer.js` 无条件调用 `context.roundRect`。愿景核对 V1/V2 复现了两条路径。 |
| **3. 问题假设或根因** | 根因已确认：零值语义被布尔回退覆盖；Canvas 可选能力没有单一绘制边界。两者均发生在显示层，不涉及检测或评分数据。 |
| **4. 诊断策略** | 用浏览器测试记录报告 Canvas 首个目标块的 x 坐标；用不提供 `roundRect` 的最小 2D context 运行真实 `TrackRenderer.render()`。 |
| **5. 超时策略** | 30 分钟内无法稳定复现则停止实现，保留最小浏览器复现并回到愿景核对者澄清。 |
| **6. 预警策略** | 若修复需要改变评分轨迹、录音时序或增加两层以上兼容 fallback，说明越过显示层边界，立即停止。 |
| **7. 用户可见交互修正** | 报告页打开即显示长音起点，点击播放不再跳变；缺少圆角矩形 API 时仍显示矩形目标带。 |
| **8. 验收** | Red：报告目标块初始 x 为负、无 `roundRect` 时抛错。Green：初始 x 位于画布内、fallback context 完成绘制；全量 unit/E2E/check/build 无回归。 |
