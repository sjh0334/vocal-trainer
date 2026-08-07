import { describe, expect, it } from "vitest";
import { validatePracticeDefinition } from "../../src/domain/practice-definition.js";
import { SIMPLE_MELODIES } from "../../src/exercises/simple-melodies.js";

describe("SIMPLE_MELODIES", () => {
  it("ships at least two versioned, valid and distinct exercises", () => {
    expect(SIMPLE_MELODIES.length).toBeGreaterThanOrEqual(2);
    expect(new Set(SIMPLE_MELODIES.map((practice) => practice.id)).size).toBe(
      SIMPLE_MELODIES.length,
    );
    for (const practice of SIMPLE_MELODIES) {
      expect(validatePracticeDefinition(practice)).toEqual(practice);
      expect(practice.version).toBe(1);
      expect(practice.segments.some((segment) => segment.midiNote === null)).toBe(true);
    }
  });
});
