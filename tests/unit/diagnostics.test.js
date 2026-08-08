import { describe, expect, it } from "vitest";

import { buildDiagnostics } from "../../src/scoring/diagnostics.js";

function report(overrides = {}) {
  return {
    status: "scored",
    dataQuality: { voicedCoverage: 0.9 },
    components: {
      accuracy: { raw: { signedBiasCents: 0, biasCents: 0 } },
      stability: { raw: { deviationCents: 5 } },
      breathContinuity: { raw: { longestGapMs: 0 } },
      volumeDecay: { raw: { slopeDbPerSecond: 0 } },
    },
    ...overrides,
  };
}

describe("buildDiagnostics", () => {
  it("explains a consistently sharp landing with evidence and an action", () => {
    const input = report();
    input.components.accuracy.raw.signedBiasCents = 28;

    expect(buildDiagnostics(input)).toContainEqual(
      expect.objectContaining({
        metric: "accuracy.signedBiasCents",
        tone: "warning",
        evidence: expect.stringMatching(/28/),
        action: expect.any(String),
      }),
    );
  });

  it("prioritizes data quality when a score would be unreliable", () => {
    const diagnostics = buildDiagnostics(
      report({ status: "insufficient", dataQuality: { voicedCoverage: 0.2 } }),
    );

    expect(diagnostics[0]).toMatchObject({ metric: "dataQuality.voicedCoverage", tone: "info" });
  });
});
