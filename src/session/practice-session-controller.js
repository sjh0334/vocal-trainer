import { pendingCalibration, summarizeCalibration } from "../audio/calibration.js";
import { PitchFrameGate } from "../pitch/frame-quality.js";
import { buildDiagnostics } from "../scoring/diagnostics.js";
import { scoreSession } from "../scoring/scoring-engine.js";
import { assessPitchFrame } from "./frame-assessment.js";

const ACTIVE_STATES = new Set([
  "requesting_permission",
  "calibrating",
  "countdown",
  "running",
  "finalizing",
]);

function defaultDelay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
function defaultIdFactory() {
  return crypto.randomUUID();
}
export class PracticeSessionController {
  #assessments = [];

  #audioSession;

  #calibrationMs;

  #calibration = pendingCalibration();

  #calibrationSamples = [];

  #clearTimer;

  #countdownMs;

  #delay;

  #error = null;

  #finalization = null;

  #failure = null;

  #frameGate = new PitchFrameGate();

  #generation = 0;

  #idFactory;

  #listeners = new Set();

  #now;

  #persistence = "none";

  #practice = null;

  #record = null;

  #recorder;

  #report = null;

  #repository;

  #runOriginMs = 0;

  #sessionId = null;

  #setTimer;

  #state = "idle";

  #timer = null;

  #trajectory = [];

  constructor({
    audioSession,
    recorder,
    repository,
    calibrationMs = 800,
    countdownMs = 3000,
    delay = defaultDelay,
    idFactory = defaultIdFactory,
    now = () => new Date(),
    setTimer = (callback, milliseconds) => globalThis.setTimeout(callback, milliseconds),
    clearTimer = (timer) => globalThis.clearTimeout(timer),
  }) {
    this.#audioSession = audioSession;
    this.#recorder = recorder;
    this.#repository = repository;
    this.#calibrationMs = calibrationMs;
    this.#countdownMs = countdownMs;
    this.#delay = delay;
    this.#idFactory = idFactory;
    this.#now = now;
    this.#setTimer = setTimer;
    this.#clearTimer = clearTimer;
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    listener(this.snapshot());
    return () => this.#listeners.delete(listener);
  }

  snapshot() {
    return {
      state: this.#state,
      sessionId: this.#sessionId,
      practice: this.#practice,
      calibration: this.#calibration,
      trajectory: this.#trajectory,
      report: this.#report,
      record: this.#record,
      persistence: this.#persistence,
      error: this.#error,
    };
  }

  #transition(state) {
    this.#state = state;
    const snapshot = this.snapshot();
    for (const listener of this.#listeners) {
      listener(snapshot);
    }
  }

  #clearEndTimer() {
    if (this.#timer !== null) {
      this.#clearTimer(this.#timer);
      this.#timer = null;
    }
  }

  #clearSessionData() {
    this.#sessionId = null;
    this.#practice = null;
    this.#trajectory = [];
    this.#assessments = [];
    this.#calibration = pendingCalibration();
    this.#calibrationSamples = [];
    this.#frameGate = new PitchFrameGate();
    this.#record = null;
    this.#report = null;
    this.#error = null;
    this.#persistence = "none";
    this.#finalization = null;
    this.#failure = null;
  }

  async start(practice) {
    if (ACTIVE_STATES.has(this.#state)) {
      throw new Error("a practice session is already active");
    }
    const generation = ++this.#generation;
    this.#clearSessionData();
    this.#sessionId = this.#idFactory();
    this.#practice = practice;
    this.#transition("requesting_permission");

    try {
      const stream = await this.#audioSession.start({
        sessionId: this.#sessionId,
        onFrame: (frame) => this.#handleFrame(frame, generation),
        onError: (error) => this.#handleAudioError(error, generation),
      });
      if (generation !== this.#generation) {
        await this.#audioSession.stop();
        return this.snapshot();
      }

      this.#transition("calibrating");
      await this.#delay(this.#calibrationMs);
      if (generation !== this.#generation) {
        return this.snapshot();
      }

      this.#calibration = summarizeCalibration(this.#calibrationSamples);
      this.#frameGate = new PitchFrameGate({ minRms: this.#calibration.gateRms });

      this.#transition("countdown");
      await this.#delay(this.#countdownMs);
      if (generation !== this.#generation) {
        return this.snapshot();
      }

      this.#runOriginMs = this.#audioSession.currentTimeMs;
      this.#recorder.start(stream);
      this.#transition("running");
      const durationMs = practice.segments.at(-1)?.endMs ?? 0;
      this.#timer = this.#setTimer(() => {
        this.stop("melodyEnded").catch(() => {});
      }, durationMs);
      return this.snapshot();
    } catch (error) {
      if (generation !== this.#generation) {
        await this.#audioSession.stop();
        return this.snapshot();
      }
      this.#recorder.abort();
      await this.#audioSession.stop();
      this.#error = error instanceof Error ? error.message : String(error);
      this.#transition("error");
      throw error;
    }
  }

  #handleFrame(frame, generation) {
    if (generation !== this.#generation) {
      return;
    }
    if (this.#state === "calibrating") {
      const quality = this.#frameGate.evaluate(frame, this.#sessionId);
      if (quality !== "rejected" && Number.isFinite(frame.rms)) {
        this.#calibrationSamples.push(frame.rms);
      }
      return;
    }
    if (this.#state !== "running") {
      return;
    }
    const quality = this.#frameGate.evaluate(frame, this.#sessionId);
    if (quality === "rejected") {
      return;
    }
    const timestampMs = frame.timestampMs - this.#runOriginMs;
    if (timestampMs < 0) {
      return;
    }
    const { assessment, trajectoryPoint } = assessPitchFrame({
      frame,
      quality,
      practice: this.#practice,
      timestampMs,
    });
    this.#trajectory.push(trajectoryPoint);
    if (assessment) {
      this.#assessments.push(assessment);
    }
    this.#transition("running");
  }

  #handleAudioError(error, generation) {
    if (
      generation !== this.#generation ||
      !ACTIVE_STATES.has(this.#state) ||
      this.#finalization ||
      this.#failure
    ) {
      return;
    }
    this.#failure = this.#failAudio(error, generation);
  }

  async #failAudio(error, generation) {
    if (generation !== this.#generation) {
      return;
    }
    const failureGeneration = ++this.#generation;
    this.#clearEndTimer();
    this.#recorder.abort();
    await this.#audioSession.stop();
    if (failureGeneration !== this.#generation) {
      return;
    }
    this.#error = error instanceof Error ? error.message : String(error);
    this.#transition("error");
  }

  stop(reason = "user") {
    if (this.#finalization) {
      return this.#finalization;
    }
    if (this.#state !== "running") {
      return Promise.reject(new Error("no running practice session"));
    }
    this.#finalization = this.#finalize(reason);
    return this.#finalization;
  }

  async #finalize(reason) {
    this.#transition("finalizing");
    this.#clearEndTimer();

    try {
      const recording = await this.#recorder.stop();
      await this.#audioSession.stop();
      const score = scoreSession({
        segments: this.#practice.segments,
        assessments: this.#assessments,
      });
      this.#report = {
        ...score,
        stopReason: reason,
        diagnostics: buildDiagnostics(score),
      };
      const durationMs = this.#practice.segments.at(-1)?.endMs ?? 0;
      this.#record = {
        id: this.#sessionId,
        schemaVersion: 1,
        practiceId: this.#practice.id,
        practiceVersion: this.#practice.version,
        createdAt: this.#now().toISOString(),
        durationMs,
        mimeType: recording.mimeType,
        audioBlob: recording.audioBlob,
        trajectory: [...this.#trajectory],
        report: this.#report,
      };
      try {
        await this.#repository.save(this.#record);
        this.#persistence = "saved";
        this.#error = null;
      } catch (error) {
        this.#persistence = "failed";
        this.#error = error instanceof Error ? error.message : String(error);
      }
      this.#transition("report");
      return this.snapshot();
    } catch (error) {
      await this.#audioSession.stop();
      this.#error = error instanceof Error ? error.message : String(error);
      this.#transition("error");
      throw error;
    }
  }

  async abort() {
    if (this.#state === "idle") {
      return this.snapshot();
    }
    this.#generation += 1;
    this.#clearEndTimer();
    this.#recorder.abort();
    await this.#audioSession.stop();
    this.#clearSessionData();
    this.#transition("idle");
    return this.snapshot();
  }

  reset() {
    if (ACTIVE_STATES.has(this.#state)) {
      throw new Error("cannot reset an active practice session");
    }
    this.#clearSessionData();
    this.#transition("idle");
  }
}
