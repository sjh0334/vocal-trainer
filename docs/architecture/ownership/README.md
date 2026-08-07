---
feature_ids: [F001]
topics: [architecture, ownership]
doc_kind: note
created: 2026-08-07
---

# Architecture Ownership

| Cell ID | Owner | Responsibility | Canonical anchors |
|---------|-------|----------------|-------------------|
| `browser-vocal-trainer` | Web App | 麦克风采集、YIN 音高检测、目标时间轴、Canvas 反馈、评分、录音回放与本地持久化 | `docs/features/F001-realtime-pitch-trainer.md`, `src/` |

## `browser-vocal-trainer`

- 唯一 session lifecycle owner：`PracticeSessionController`。
- 音频采集层不拥有评分或 UI 状态。
- Pitch 层输出带时间戳和质量信息的检测帧，不拥有目标旋律。
- Scoring 层消费目标对齐后的质量合格帧，不消费显示平滑结果。
- Storage 层拥有已提交的 session records，不拥有活动麦克风或播放状态。
- Render 层只消费投影后的显示模型，不修改 domain 数据。

