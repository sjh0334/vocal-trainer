import { describe, expect, it } from "vitest";

import { targetAtTime, validatePracticeDefinition } from "../../src/domain/practice-definition.js";

const VALID_PRACTICE = {
  id: "stepwise-warmup",
  version: 1,
  title: "五声音阶",
  leadInMs: 1000,
  segments: [
    { id: "c4", startMs: 0, endMs: 1000, midiNote: 60, label: "C4" },
    { id: "rest", startMs: 1000, endMs: 1250, midiNote: null, label: "休止" },
    { id: "d4", startMs: 1250, endMs: 2250, midiNote: 62, label: "D4" },
  ],
};

describe("validatePracticeDefinition", () => {
  it("returns an immutable normalized definition", () => {
    const result = validatePracticeDefinition(VALID_PRACTICE);

    expect(result).toEqual(VALID_PRACTICE);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.segments)).toBe(true);
  });

  it("rejects overlapping segments", () => {
    const overlapping = structuredClone(VALID_PRACTICE);
    overlapping.segments[1].startMs = 900;

    expect(() => validatePracticeDefinition(overlapping)).toThrow(/overlap/i);
  });

  it.each([
    ["missing version", { ...VALID_PRACTICE, version: undefined }],
    [
      "out-of-range midi",
      { ...VALID_PRACTICE, segments: [{ ...VALID_PRACTICE.segments[0], midiNote: 128 }] },
    ],
    [
      "negative duration",
      { ...VALID_PRACTICE, segments: [{ ...VALID_PRACTICE.segments[0], endMs: -1 }] },
    ],
  ])("rejects %s", (_name, definition) => {
    expect(() => validatePracticeDefinition(definition)).toThrow();
  });
});

describe("targetAtTime", () => {
  const practice = validatePracticeDefinition(VALID_PRACTICE);

  it("finds notes and rests using half-open time ranges", () => {
    expect(targetAtTime(practice, 999)?.id).toBe("c4");
    expect(targetAtTime(practice, 1000)?.id).toBe("rest");
    expect(targetAtTime(practice, 2250)).toBeNull();
  });
});
