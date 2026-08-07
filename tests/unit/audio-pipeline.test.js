import { describe, expect, it } from "vitest";

import { FrameAccumulator } from "../../src/audio/live-audio-session.js";
import { analyzePitchFrame } from "../../src/pitch/pitch-worker.js";

describe("FrameAccumulator", () => {
  it("emits fixed-size overlapped analysis frames", () => {
    const frames = [];
    const accumulator = new FrameAccumulator({
      frameSize: 8,
      hopSize: 4,
      onFrame: (frame) => frames.push([...frame]),
    });

    accumulator.push(Float32Array.from([0, 1, 2, 3, 4]));
    accumulator.push(Float32Array.from([5, 6, 7, 8, 9, 10, 11]));

    expect(frames).toEqual([
      [0, 1, 2, 3, 4, 5, 6, 7],
      [4, 5, 6, 7, 8, 9, 10, 11],
    ]);
  });
});

describe("analyzePitchFrame", () => {
  it("preserves session identity, ordering and timestamps", () => {
    const samples = Float32Array.from({ length: 4096 }, (_, index) =>
      Math.sin((2 * Math.PI * 220 * index) / 48_000),
    );
    const frame = analyzePitchFrame({
      sessionId: "session-a",
      sequence: 7,
      timestampMs: 1234,
      capturedAtMs: 1200,
      sampleRate: 48_000,
      samples,
    });

    expect(frame).toMatchObject({
      sessionId: "session-a",
      sequence: 7,
      timestampMs: 1234,
      capturedAtMs: 1200,
      voiced: true,
    });
    expect(frame.frequencyHz).toBeCloseTo(220, 0);
    expect(frame.midi).toBeCloseTo(57, 0);
  });
});
