import { describe, expect, it } from "vitest";

import { validatePracticeDefinition } from "../../src/domain/practice-definition.js";
import { LONG_TONE_PRACTICES, longToneTarget } from "../../src/exercises/long-tones.js";

describe("LONG_TONE_PRACTICES", () => {
  it("ships three explicit eight-second single-tone targets", () => {
    expect(LONG_TONE_PRACTICES).toHaveLength(3);
    expect(LONG_TONE_PRACTICES.map(longToneTarget)).toEqual([
      { noteName: "A3", frequencyHz: 220 },
      { noteName: "C4", frequencyHz: 261.63 },
      { noteName: "E4", frequencyHz: 329.63 },
    ]);

    for (const practice of LONG_TONE_PRACTICES) {
      expect(validatePracticeDefinition(practice)).toEqual(practice);
      expect(practice.version).toBe(1);
      expect(practice.segments).toHaveLength(1);
      expect(practice.segments[0]).toMatchObject({ startMs: 0, endMs: 8000 });
      expect(practice.segments[0].label).toBe(longToneTarget(practice).noteName);
    }
  });
});
