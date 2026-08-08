import { describe, expect, it } from "vitest";

import {
  centsBetween,
  frequencyToMidi,
  midiToFrequency,
  midiToNoteName,
} from "../../src/pitch/note.js";

describe("note conversions", () => {
  it("round-trips A4", () => {
    expect(frequencyToMidi(440)).toBeCloseTo(69, 8);
    expect(midiToFrequency(69)).toBeCloseTo(440, 8);
    expect(midiToNoteName(69)).toBe("A4");
  });

  it("returns signed cents", () => {
    expect(centsBetween(440, 440)).toBeCloseTo(0, 8);
    expect(centsBetween(880, 440)).toBeCloseTo(1200, 8);
    expect(centsBetween(220, 440)).toBeCloseTo(-1200, 8);
  });

  it.each([0, -1, Number.NaN])("rejects invalid frequency %s", (frequency) => {
    expect(() => frequencyToMidi(frequency)).toThrow(/frequency/i);
  });
});
