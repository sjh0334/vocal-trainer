---
feature_ids: [F001]
topics: [browser-runtime, session-lifecycle, regression]
doc_kind: bug-report
created: 2026-08-08
---

# Browser timer `Illegal invocation`

## 报告人

砚砚在 Playwright Primary Journey 中发现：点击开始后停留在麦克风检查页，无法进入实时跑道。

## 复现步骤

1. 在 Chromium 打开首页并点击“开始实时练习”。
2. 麦克风、AudioWorklet、Worker 和录音器均成功创建。
3. 期望进入 `running`；实际会话转入 `error`，消息为 `Illegal invocation`。

## 根因分析

`PracticeSessionController` 把 `window.setTimeout` 直接保存到私有字段，再以控制器实例为接收者调用。浏览器宿主方法要求 `this === window`，因此在设置旋律结束计时器时抛错。Node 测试中的计时器不要求该接收者，原测试未暴露问题。

## 修复方案

默认依赖改为闭包，由闭包通过 `globalThis.setTimeout(...)` 和 `globalThis.clearTimeout(...)` 调用宿主方法。保留计时器依赖注入，测试仍可使用确定性实现。

## 验证方式

- 单元回归测试用接收者敏感的计时器替身复现红灯，修复后转绿。
- Chromium Primary Journey 成功完成开始、实时跑道、报告、录音回放、刷新恢复和删除。

