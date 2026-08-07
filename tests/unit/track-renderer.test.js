import { describe, expect, it } from "vitest";

import { createTrackViewModel, midiToY, timeToX } from "../../src/render/track-renderer.js";

const PRACTICE = {
  id: "test",
  version: 1,
  title: "测试旋律",
  leadInMs: 0,
  segments: [
    { id: "c", startMs: 0, endMs: 1000, midiNote: 60, label: "C4" },
    { id: "d", startMs: 1000, endMs: 2000, midiNote: 62, label: "D4" },
  ],
};

describe("track geometry", () => {
  it("keeps the current time at the fixed playhead", () => {
    expect(timeToX(1500, { elapsedMs: 1500, playheadX: 240, pixelsPerMs: 0.1 })).toBe(240);
    expect(timeToX(1000, { elapsedMs: 1500, playheadX: 240, pixelsPerMs: 0.1 })).toBe(190);
  });

  it("places higher notes above lower notes", () => {
    const c4 = midiToY(60, { centerMidi: 60, centerY: 100, pixelsPerSemitone: 10 });
    const e4 = midiToY(64, { centerMidi: 60, centerY: 100, pixelsPerSemitone: 10 });
    expect(e4).toBeLessThan(c4);
  });

  it("projects target segments, user points and current feedback on one timeline", () => {
    const model = createTrackViewModel({
      practice: PRACTICE,
      trajectory: [
        { timestampMs: 1200, midi: 62.1, classification: "accurate" },
        { timestampMs: 1400, midi: 62.4, classification: "sharp" },
      ],
      elapsedMs: 1400,
      width: 800,
      height: 320,
    });

    expect(model.currentTarget.id).toBe("d");
    expect(model.segments.find((segment) => segment.id === "d").x1).toBeLessThan(model.playheadX);
    expect(model.points.at(-1)).toMatchObject({ classification: "sharp" });
    expect(model.points.at(-1).x).toBe(model.playheadX);
  });
});
