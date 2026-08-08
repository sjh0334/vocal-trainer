import { describe, expect, it } from "vitest";

import { SIMPLE_MELODIES } from "../../src/exercises/simple-melodies.js";
import { renderScreen } from "../../src/ui/app-view.js";

describe("renderScreen", () => {
  it("renders the product title and routes melody choices into preparation", () => {
    const html = renderScreen({
      route: "home",
      practices: SIMPLE_MELODIES,
      selectedPracticeId: SIMPLE_MELODIES[0].id,
      history: [],
    });

    expect(html).toContain("听见你的声音");
    expect(html).toContain("五声音阶往返");
    expect(html).toContain('data-action="prepare"');
    expect(html).not.toContain('data-action="preview"');
    expect(html).not.toContain('data-action="begin-practice"');
    expect(html).toContain("本地保存，不上传");
  });

  it("renders preview and explicit start actions on the preparation page", () => {
    const html = renderScreen({
      route: "prepare",
      practice: SIMPLE_MELODIES[0],
    });

    expect(html).toContain("五声音阶往返");
    expect(html).toContain("先听一遍旋律");
    expect(html).toContain('data-action="preview"');
    expect(html).toContain('data-action="begin-practice"');
    expect(html).toContain('data-action="home"');
  });

  it("renders running feedback with text in addition to color", () => {
    const html = renderScreen({
      route: "session",
      practice: SIMPLE_MELODIES[0],
      session: {
        state: "running",
        trajectory: [{ classification: "sharp", signedCents: 28, midi: 60.2 }],
      },
    });

    expect(html).toContain("偏高 +28¢");
    expect(html).toContain("实时音高跑道");
    expect(html).toContain('data-action="stop"');
  });

  it("shows the measured environment result before the countdown", () => {
    const html = renderScreen({
      route: "session",
      practice: SIMPLE_MELODIES[0],
      session: {
        state: "countdown",
        trajectory: [],
        calibration: { status: "noisy", noiseFloorRms: 0.03 },
      },
    });

    expect(html).toContain("环境音较高");
    expect(html).toContain("3%");
  });

  it("renders explainable scores, diagnostics and recording controls", () => {
    const html = renderScreen({
      route: "report",
      practice: SIMPLE_MELODIES[0],
      session: {
        state: "report",
        persistence: "saved",
        record: { audioBlob: new Blob([new Uint8Array(1024)]) },
        report: {
          status: "scored",
          totalScore: 86.2,
          dataQuality: { voicedCoverage: 0.9 },
          components: {
            stability: { score: 80, raw: { deviationCents: 12 } },
            accuracy: { score: 94, raw: { signedBiasCents: 3, biasCents: 3 } },
            breathContinuity: { score: 84, raw: { longestGapMs: 100 } },
            volumeDecay: { score: 88, raw: { slopeDbPerSecond: -1 } },
          },
          diagnostics: [{ title: "落点不错", evidence: "平均偏差 3 cents", action: "继续保持" }],
        },
      },
      playback: { state: "idle", cursorMs: 0 },
    });

    expect(html).toContain("86");
    expect(html).toContain("稳定度");
    expect(html).toContain("平均偏差 3 cents");
    expect(html).toContain('data-action="play"');
    expect(html).toContain("1.0 KB");
    expect(html).toContain("录音只保存在这台设备");
  });
});
