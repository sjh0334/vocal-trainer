import { describe, expect, it } from "vitest";
import { centsBetween } from "../../src/pitch/note.js";
import { detectPitch } from "../../src/pitch/yin.js";

const SAMPLE_RATE = 48_000;

function signal(frequency, { length = 4096, harmonic = false, amplitude = 0.8 } = {}) {
  return Float32Array.from({ length }, (_, index) => {
    const phase = (2 * Math.PI * frequency * index) / SAMPLE_RATE;
    return amplitude * Math.sin(phase) + (harmonic ? 0.22 * Math.sin(phase * 2) : 0);
  });
}

describe("detectPitch", () => {
  it.each([82.41, 110, 220, 440, 880])("detects %f Hz within five cents", (frequency) => {
    const result = detectPitch(signal(frequency), SAMPLE_RATE);

    expect(result.voiced).toBe(true);
    expect(Math.abs(centsBetween(result.frequencyHz, frequency))).toBeLessThanOrEqual(5);
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it("keeps the fundamental when harmonics are present", () => {
    const result = detectPitch(signal(220, { harmonic: true }), SAMPLE_RATE);

    expect(result.voiced).toBe(true);
    expect(Math.abs(centsBetween(result.frequencyHz, 220))).toBeLessThanOrEqual(5);
  });

  it("marks silence and low energy as unvoiced", () => {
    expect(detectPitch(new Float32Array(4096), SAMPLE_RATE)).toMatchObject({
      voiced: false,
      frequencyHz: null,
      rms: 0,
    });
    expect(detectPitch(signal(220, { amplitude: 0.0001 }), SAMPLE_RATE).voiced).toBe(false);
  });
});
