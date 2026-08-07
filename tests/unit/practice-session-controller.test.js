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

function setup({
  startPromise,
  recordingStopPromise,
  audioStopPromise,
  savePromise,
  saveError,
  delay = async () => {},
  useDefaultTimers = false,
} = {}) {
  let onFrame;
  let onError;
  let audioStopCalls = 0;
  const stream = { id: "stream" };
  const audioSession = {
    currentTimeMs: 1000,
    start: vi.fn(async (options) => {
      onFrame = options.onFrame;
      onError = options.onError;
      return startPromise ? startPromise.promise : stream;
    }),
    stop: vi.fn(() => {
      audioStopCalls += 1;
      return audioStopPromise && audioStopCalls === 1
        ? audioStopPromise.promise
        : Promise.resolve();
    }),
  };
  const recorder = {
    start: vi.fn(),
    stop: vi.fn(() =>
      recordingStopPromise
        ? recordingStopPromise.promise
        : Promise.resolve({
            audioBlob: new Blob(["audio"], { type: "audio/webm" }),
            mimeType: "audio/webm",
          }),
    ),
    abort: vi.fn(),
  };
  const repository = {
    save: vi.fn(async () => {
      if (savePromise) {
        return savePromise.promise;
      }
      if (saveError) {
        throw saveError;
      }
    }),
  };
  const scheduled = [];
  const controllerOptions = {
    audioSession,
    recorder,
    repository,
    calibrationMs: 0,
    countdownMs: 0,
    delay,
    idFactory: () => "session-a",
    now: () => new Date("2026-08-08T00:00:00.000Z"),
  };
  if (!useDefaultTimers) {
    controllerOptions.setTimer = (callback, milliseconds) => {
      scheduled.push({ callback, milliseconds });
      return scheduled.length;
    };
    controllerOptions.clearTimer = vi.fn();
  }
  const controller = new PracticeSessionController(controllerOptions);
  return {
    audioSession,
    controller,
    emit: (frame) => onFrame(frame),
    failAudio: (error) => onError(error),
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

  it("calls browser timer APIs with their required global receiver", async () => {
    const nativeSetTimer = globalThis.setTimeout;
    const nativeClearTimer = globalThis.clearTimeout;
    const setTimer = vi.spyOn(globalThis, "setTimeout").mockImplementation(function () {
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }
      return nativeSetTimer(() => {}, 60_000);
    });
    const clearTimer = vi.spyOn(globalThis, "clearTimeout").mockImplementation(function (timer) {
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }
      return nativeClearTimer(timer);
    });
    const { controller } = setup({ useDefaultTimers: true });

    await controller.start(PRACTICE);
    await controller.stop("user");

    expect(setTimer).toHaveBeenCalledOnce();
    expect(clearTimer).toHaveBeenCalledOnce();
  });

  it("measures the noise floor during calibration and gates quieter running frames", async () => {
    const calibration = deferred();
    const { controller, emit } = setup({ delay: () => calibration.promise });
    const starting = controller.start(PRACTICE);
    await vi.waitFor(() => expect(controller.snapshot().state).toBe("calibrating"));
    emit(
      pitchFrame(0, {
        voiced: false,
        frequencyHz: null,
        midi: null,
        confidence: 0,
        rms: 0.02,
      }),
    );
    emit(
      pitchFrame(1, {
        voiced: false,
        frequencyHz: null,
        midi: null,
        confidence: 0,
        rms: 0.04,
      }),
    );
    calibration.resolve();
    await starting;

    expect(controller.snapshot().calibration).toMatchObject({
      status: "noisy",
      sampleCount: 2,
      noiseFloorRms: 0.03,
      peakRms: 0.04,
      gateRms: 0.06,
    });

    emit(pitchFrame(2, { rms: 0.05 }));
    emit(pitchFrame(3, { rms: 0.1 }));
    const snapshot = await controller.stop("user");
    expect(snapshot.report.dataQuality).toMatchObject({ totalFrames: 2, voicedFrames: 1 });
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

  it("abandons finalization without saving when the session is aborted", async () => {
    const recordingStop = deferred();
    const { audioSession, controller, recorder, repository } = setup({
      recordingStopPromise: recordingStop,
    });
    await controller.start(PRACTICE);

    const finalizing = controller.stop("user");
    await vi.waitFor(() => expect(controller.snapshot().state).toBe("finalizing"));
    await controller.abort();
    recordingStop.resolve({
      audioBlob: new Blob(["late audio"], { type: "audio/webm" }),
      mimeType: "audio/webm",
    });

    await expect(finalizing).resolves.toMatchObject({ state: "idle" });
    expect(controller.snapshot().state).toBe("idle");
    expect(repository.save).not.toHaveBeenCalled();
    expect(recorder.abort).toHaveBeenCalledOnce();
    expect(audioSession.stop).toHaveBeenCalledOnce();
  });

  it("does not resume finalization after an abort interrupts audio teardown", async () => {
    const audioStop = deferred();
    const { audioSession, controller, recorder, repository } = setup({
      audioStopPromise: audioStop,
    });
    await controller.start(PRACTICE);

    const finalizing = controller.stop("user");
    await vi.waitFor(() => expect(audioSession.stop).toHaveBeenCalledOnce());
    await controller.abort();
    audioStop.resolve();

    await expect(finalizing).resolves.toMatchObject({ state: "idle" });
    expect(controller.snapshot().state).toBe("idle");
    expect(repository.save).not.toHaveBeenCalled();
    expect(recorder.abort).toHaveBeenCalledOnce();
    expect(audioSession.stop).toHaveBeenCalledTimes(2);
  });

  it("cancels persistence and stays idle when aborted while saving", async () => {
    const saving = deferred();
    const { controller, recorder, repository } = setup({ savePromise: saving });
    await controller.start(PRACTICE);

    const finalizing = controller.stop("user");
    const finalized = expect(finalizing).resolves.toMatchObject({ state: "idle" });
    await vi.waitFor(() => expect(repository.save).toHaveBeenCalledOnce());
    const saveOptions = repository.save.mock.calls[0][1];
    await controller.abort();
    saving.reject(new DOMException("operation aborted", "AbortError"));

    await finalized;
    expect(saveOptions.signal.aborted).toBe(true);
    expect(controller.snapshot()).toMatchObject({ state: "idle", record: null, report: null });
    expect(recorder.abort).toHaveBeenCalledOnce();
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

  it("releases the whole session when the microphone or worker fails", async () => {
    const { audioSession, controller, failAudio, recorder } = setup();
    await controller.start(PRACTICE);

    failAudio(new Error("microphone disconnected"));
    await vi.waitFor(() => expect(controller.snapshot().state).toBe("error"));

    expect(controller.snapshot().error).toBe("microphone disconnected");
    expect(recorder.abort).toHaveBeenCalledOnce();
    expect(audioSession.stop).toHaveBeenCalledOnce();
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
