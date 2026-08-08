import { describe, expect, it } from "vitest";

import { buildDemoSchedule } from "../../src/audio/demo-player.js";

describe("buildDemoSchedule", () => {
  it("turns sounding segments into an absolute oscillator schedule and skips rests", () => {
    const schedule = buildDemoSchedule(
      {
        segments: [
          { id: "c", startMs: 0, endMs: 500, midiNote: 60 },
          { id: "rest", startMs: 500, endMs: 750, midiNote: null },
          { id: "d", startMs: 750, endMs: 1250, midiNote: 62 },
        ],
      },
      10,
    );

    expect(schedule).toHaveLength(2);
    expect(schedule[0]).toMatchObject({
      id: "c",
      startAt: 10,
      stopAt: 10.5,
      waveform: "triangle",
      peakGain: 0.06,
      lowpassHz: 2400,
      filterQ: 0.55,
    });
    expect(schedule[0].attackEndAt - schedule[0].startAt).toBeGreaterThanOrEqual(0.05);
    expect(schedule[0].attackEndAt - schedule[0].startAt).toBeLessThan(0.07);
    expect(schedule[0].stopAt - schedule[0].releaseStartAt).toBeGreaterThanOrEqual(0.13);
    expect(schedule[1]).toMatchObject({ id: "d", startAt: 10.75, stopAt: 11.25 });
  });
});
