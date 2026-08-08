import { describe, expect, it } from "vitest";

import { formatLiveFeedback } from "../../src/ui/live-feedback.js";

describe("formatLiveFeedback", () => {
  it("shows a note name instead of a MIDI number", () => {
    expect(formatLiveFeedback({ classification: "accurate", signedCents: 2, midi: 57.02 })).toEqual(
      { className: "accurate", label: "准确 +2¢", cents: 2, note: "A3" },
    );
  });

  it("shows an explicit waiting state for unvoiced input", () => {
    expect(formatLiveFeedback(null)).toEqual({
      className: "unvoiced",
      label: "等待发声",
      cents: "—",
      note: "—",
    });
  });
});
