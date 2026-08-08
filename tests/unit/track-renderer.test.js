import { describe, expect, it, vi } from "vitest";

import {
  createTrackViewModel,
  midiToY,
  smoothTrajectoryForDisplay,
  TrackRenderer,
  timeToX,
} from "../../src/render/track-renderer.js";

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

  it("uses a slower ten-second default runway", () => {
    const practice = {
      ...PRACTICE,
      segments: [{ id: "a3", startMs: 0, endMs: 8000, midiNote: 57, label: "A3" }],
    };
    const model = createTrackViewModel({
      practice,
      trajectory: [],
      elapsedMs: 0,
      width: 1000,
      height: 320,
    });

    expect(model.segments[0].x2 - model.segments[0].x1).toBe(800);
    expect(model.segments[0].x2).toBeLessThanOrEqual(1000);
  });

  it("smooths display jitter without mutating raw trajectory", () => {
    const raw = [
      { timestampMs: 0, midi: 57, classification: "accurate" },
      { timestampMs: 40, midi: 57.04, classification: "accurate" },
      { timestampMs: 80, midi: 58.2, classification: "sharp" },
      { timestampMs: 120, midi: 56.98, classification: "accurate" },
      { timestampMs: 160, midi: 57.02, classification: "accurate" },
    ];
    const snapshot = structuredClone(raw);

    const displayed = smoothTrajectoryForDisplay(raw);

    expect(displayed.at(-1).midi).toBeCloseTo(57.02, 2);
    expect(displayed[2].midi).toBeLessThan(57.1);
    expect(raw).toEqual(snapshot);
  });

  it("resets display smoothing after a silent gap", () => {
    const displayed = smoothTrajectoryForDisplay([
      { timestampMs: 0, midi: 57, classification: "accurate" },
      { timestampMs: 40, midi: 57.1, classification: "accurate" },
      { timestampMs: 500, midi: 60, classification: "sharp" },
    ]);

    expect(displayed.at(-1).midi).toBe(60);
  });

  it("renders the target with a rectangular fallback when roundRect is unavailable", () => {
    const context = {
      setTransform: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      rect: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
    };
    const canvas = {
      clientWidth: 800,
      clientHeight: 320,
      getContext: () => context,
    };

    expect(() =>
      new TrackRenderer(canvas).render({ practice: PRACTICE, trajectory: [], elapsedMs: 0 }),
    ).not.toThrow();
    expect(context.rect).toHaveBeenCalledTimes(2);
  });
});
