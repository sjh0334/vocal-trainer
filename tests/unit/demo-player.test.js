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
    expect(schedule[0]).toMatchObject({ id: "c", startAt: 10, stopAt: 10.5 });
    expect(schedule[1]).toMatchObject({ id: "d", startAt: 10.75, stopAt: 11.25 });
  });
});
