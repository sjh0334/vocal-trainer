import { beforeEach, describe, expect, it, vi } from "vitest";

import { PracticeSessionController } from "../../src/session/practice-session-controller.js";

const PRACTICE = {
  id: "short-melody",
  version: 1,
  title: "短旋律",
  leadInMs: 0,
  segments: [{ id: "a", startMs: 0, endMs: 1000, midiNote: 57, label: "A3" }],
};

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, reject, resolve };
}

function setup({ startPromise, saveError } = {}) {
  let onFrame;
  const stream = { id: "stream" };
  const audioSession = {
    currentTimeMs: 1000,
    start: vi.fn(async (options) => {
      onFrame = options.onFrame;
      return startPromise ? startPromise.promise : stream;
    }),
    stop: vi.fn(async () => {}),
  };
  const recorder = {
    start: vi.fn(),
    stop: vi.fn(async () => ({
      audioBlob: new Blob(["audio"], { type: "audio/webm" }),
      mimeType: "audio/webm",
    })),
    abort: vi.fn(),
  };
  const repository = {
    save: vi.fn(async () => {
      if (saveError) {
        throw saveError;
      }
    }),
  };
  const scheduled = [];
  const controller = new PracticeSessionController({
    audioSession,
    recorder,
    repository,
    calibrationMs: 0,
    countdownMs: 0,
    delay: async () => {},
    idFactory: () => "session-a",
    now: () => new Date("2026-08-08T00:00:00.000Z"),
    setTimer: (callback, milliseconds) => {
      scheduled.push({ callback, milliseconds });
      return scheduled.length;
    },
    clearTimer: vi.fn(),
  });
  return {
    audioSession,
    controller,
    emit: (frame) => onFrame(frame),
    recorder,
    repository,
    scheduled,
    stream,
  };
}

function pitchFrame(sequence, overrides = {}) {
  return {
    sessionId: "session-a",
    sequence,
    timestampMs: 1100 + sequence * 100,
    frequencyHz: 220,
    midi: 57,
    confidence: 0.95,
    rms: 0.2,
    voiced: true,
    ...overrides,
  };
}

describe("PracticeSessionController", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("owns the permission → calibration → countdown → running transition", async () => {
    const { audioSession, controller, recorder, scheduled, stream } = setup();
    const states = [];
    controller.subscribe((snapshot) => states.push(snapshot.state));

    await controller.start(PRACTICE);

    expect(states).toEqual([
      "idle",
      "requesting_permission",
      "calibrating",
      "countdown",
      "running",
    ]);
    expect(audioSession.start).toHaveBeenCalledOnce();
    expect(recorder.start).toHaveBeenCalledWith(stream);
    expect(scheduled[0].milliseconds).toBe(1000);
    await expect(controller.start(PRACTICE)).rejects.toThrow(/active/i);
  });

  it("scores only ordered frames from the running active session", async () => {
    const { controller, emit, repository } = setup();
    await controller.start(PRACTICE);
    emit(pitchFrame(0, { sessionId: "old" }));
    emit(pitchFrame(1));
    emit(pitchFrame(2, { voiced: false, frequencyHz: null, midi: null, rms: 0.001 }));
    emit(pitchFrame(3));
    emit(pitchFrame(4));
    emit(pitchFrame(3));

    const snapshot = await controller.stop("user");

    expect(snapshot.state).toBe("report");
    expect(snapshot.report.dataQuality).toMatchObject({ totalFrames: 4, voicedFrames: 3 });
    expect(snapshot.record.trajectory).toHaveLength(4);
    expect(repository.save).toHaveBeenCalledOnce();
  });

  it("makes concurrent stop calls share one finalization", async () => {
    const { audioSession, controller, emit, recorder, repository } = setup();
    await controller.start(PRACTICE);
    emit(pitchFrame(0));
    emit(pitchFrame(1));
    emit(pitchFrame(2));

    const first = controller.stop("user");
    const second = controller.stop("melodyEnded");
    expect(first).toBe(second);
    await first;

    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(audioSession.stop).toHaveBeenCalledOnce();
    expect(repository.save).toHaveBeenCalledOnce();
  });

  it("cleans up a rejected permission request and exposes the error", async () => {
    const rejection = new Error("permission denied");
    const pending = deferred();
    pending.reject(rejection);
    const { audioSession, controller, recorder } = setup({ startPromise: pending });

    await expect(controller.start(PRACTICE)).rejects.toThrow("permission denied");
    expect(controller.snapshot()).toMatchObject({ state: "error", error: "permission denied" });
    expect(audioSession.stop).toHaveBeenCalledOnce();
    expect(recorder.abort).toHaveBeenCalledOnce();
  });

  it("invalidates a late permission result after abort", async () => {
    const pending = deferred();
    const { audioSession, controller, recorder, stream } = setup({ startPromise: pending });
    const starting = controller.start(PRACTICE);
    await controller.abort();
    pending.resolve(stream);
    await starting;

    expect(controller.snapshot().state).toBe("idle");
    expect(recorder.start).not.toHaveBeenCalled();
    expect(audioSession.stop).toHaveBeenCalled();
  });

  it("keeps an in-memory report when persistent storage fails", async () => {
    const { controller, emit } = setup({ saveError: new Error("quota exceeded") });
    await controller.start(PRACTICE);
    emit(pitchFrame(0));
    emit(pitchFrame(1));
    emit(pitchFrame(2));

    const snapshot = await controller.stop("user");

    expect(snapshot).toMatchObject({ state: "report", persistence: "failed" });
    expect(snapshot.record.audioBlob).toBeInstanceOf(Blob);
    expect(snapshot.error).toMatch(/quota exceeded/);
  });
});
