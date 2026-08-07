import { describe, expect, it } from "vitest";

import { scoreSession } from "../../src/scoring/scoring-engine.js";

const SEGMENTS = [
  { id: "a", startMs: 0, endMs: 1000, midiNote: 60, label: "C4" },
  { id: "b", startMs: 1000, endMs: 2000, midiNote: 62, label: "D4" },
];

function assessment(segmentId, timestampMs, signedCents, rms = 0.2) {
  return {
    targetSegmentId: segmentId,
    timestampMs,
    signedCents,
    rms,
    voiced: signedCents !== null,
  };
}

function repeated(segmentId, values, startMs = 0, rmsValues = []) {
  return values.map((value, index) =>
    assessment(segmentId, startMs + index * 100, value, rmsValues[index] ?? 0.2),
  );
}

describe("scoreSession", () => {
  it("penalizes symmetric vibrato through stability, not accuracy", () => {
    const frames = repeated("a", [-40, 40, -40, 40, -40, 40, -40, 40]);
    const report = scoreSession({ segments: [SEGMENTS[0]], assessments: frames });

    expect(report.status).toBe("scored");
    expect(report.components.accuracy.score).toBeGreaterThanOrEqual(95);
    expect(report.components.stability.score).toBeLessThan(50);
  });

  it("penalizes a constant signed bias through accuracy", () => {
    const centered = scoreSession({
      segments: [SEGMENTS[0]],
      assessments: repeated("a", [0, 0, 0, 0, 0, 0]),
    });
    const sharp = scoreSession({
      segments: [SEGMENTS[0]],
      assessments: repeated("a", [30, 30, 30, 30, 30, 30]),
    });

    expect(sharp.components.accuracy.raw.biasCents).toBeCloseTo(30, 6);
    expect(sharp.components.accuracy.score).toBeLessThan(centered.components.accuracy.score);
    expect(sharp.components.stability.score).toBeGreaterThanOrEqual(95);
  });

  it("does not cancel opposite biases across target segments", () => {
    const report = scoreSession({
      segments: SEGMENTS,
      assessments: [
        ...repeated("a", [30, 30, 30, 30, 30], 0),
        ...repeated("b", [-30, -30, -30, -30, -30], 1000),
      ],
    });

    expect(report.components.accuracy.raw.biasCents).toBeCloseTo(30, 6);
    expect(report.components.accuracy.score).toBeLessThan(90);
  });

  it("returns insufficient instead of a misleading total for low voiced coverage", () => {
    const report = scoreSession({
      segments: [SEGMENTS[0]],
      assessments: repeated("a", [null, null, null, 0, null, null, null, null]),
    });

    expect(report.status).toBe("insufficient");
    expect(report.totalScore).toBeNull();
    expect(report.dataQuality.voicedCoverage).toBeCloseTo(0.125, 6);
  });

  it("detects breath gaps and sustained volume decay", () => {
    const report = scoreSession({
      segments: [SEGMENTS[0]],
      assessments: repeated(
        "a",
        [0, 0, null, null, null, 0, 0, 0],
        0,
        [0.4, 0.34, 0, 0, 0, 0.14, 0.1, 0.07],
      ),
    });

    expect(report.components.breathContinuity.raw.longestGapMs).toBeGreaterThanOrEqual(300);
    expect(report.components.volumeDecay.raw.slopeDbPerSecond).toBeLessThan(0);
  });

  it("uses the declared 40/30/20/10 component weights", () => {
    const report = scoreSession({
      segments: [SEGMENTS[0]],
      assessments: repeated("a", [0, 0, 0, 0, 0, 0, 0, 0]),
    });
    const expected =
      report.components.stability.score * 0.4 +
      report.components.accuracy.score * 0.3 +
      report.components.breathContinuity.score * 0.2 +
      report.components.volumeDecay.score * 0.1;

    expect(report.totalScore).toBeCloseTo(expected, 6);
    expect(report.scorerVersion).toBe(1);
  });
});
