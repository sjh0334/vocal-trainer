import { describe, expect, it } from "vitest";

import { PitchFrameGate } from "../../src/pitch/frame-quality.js";

function frame(overrides = {}) {
  return {
    sessionId: "session-a",
    sequence: 1,
    timestampMs: 100,
    frequencyHz: 220,
    midi: 57,
    confidence: 0.95,
    rms: 0.2,
    voiced: true,
    ...overrides,
  };
}

describe("PitchFrameGate", () => {
  it("accepts only ordered frames from the active session", () => {
    const gate = new PitchFrameGate();

    expect(gate.accept(frame(), "session-a")).toBe(true);
    expect(gate.accept(frame({ sequence: 1, timestampMs: 101 }), "session-a")).toBe(false);
    expect(gate.accept(frame({ sessionId: "old", sequence: 2 }), "session-a")).toBe(false);
    expect(gate.accept(frame({ sequence: 2 }), "session-a")).toBe(true);
  });

  it.each([
    ["unvoiced", { voiced: false }],
    ["quiet", { rms: 0.001 }],
    ["uncertain", { confidence: 0.3 }],
    ["too low", { frequencyHz: 40 }],
    ["too high", { frequencyHz: 1400 }],
  ])("rejects %s frames", (_name, overrides) => {
    const gate = new PitchFrameGate();
    expect(gate.accept(frame(overrides), "session-a")).toBe(false);
  });

  it("reset allows a new generation to start at sequence zero", () => {
    const gate = new PitchFrameGate();
    gate.accept(frame({ sequence: 20 }), "session-a");
    gate.reset();

    expect(gate.accept(frame({ sessionId: "session-b", sequence: 0 }), "session-b")).toBe(true);
  });

  it("distinguishes an ordered unvoiced marker from stale data", () => {
    const gate = new PitchFrameGate();

    expect(gate.evaluate(frame({ voiced: false, frequencyHz: null }), "session-a")).toBe(
      "unvoiced",
    );
    expect(gate.evaluate(frame({ sequence: 0 }), "session-a")).toBe("rejected");
  });
});
