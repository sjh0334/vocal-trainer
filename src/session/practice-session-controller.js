import { targetAtTime } from "../domain/practice-definition.js";
import { PitchFrameGate } from "../pitch/frame-quality.js";
import { centsBetween, midiToFrequency } from "../pitch/note.js";
import { buildDiagnostics } from "../scoring/diagnostics.js";
import { scoreSession } from "../scoring/scoring-engine.js";

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

function classifyCents(signedCents) {
  if (signedCents === null) {
    return "unvoiced";
  }
  if (signedCents > 15) {
    return "sharp";
  }
  if (signedCents < -15) {
    return "flat";
  }
  return "accurate";
}

export class PracticeSessionController {
  #assessments = [];

  #audioSession;

  #calibrationMs;

  #clearTimer;

  #countdownMs;

  #delay;

  #error = null;

  #finalization = null;

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
    setTimer = globalThis.setTimeout,
    clearTimer = globalThis.clearTimeout,
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

  async start(practice) {
    if (ACTIVE_STATES.has(this.#state)) {
      throw new Error("a practice session is already active");
    }
    const generation = ++this.#generation;
    this.#sessionId = this.#idFactory();
    this.#practice = practice;
    this.#trajectory = [];
    this.#assessments = [];
    this.#record = null;
    this.#report = null;
    this.#error = null;
    this.#persistence = "none";
    this.#finalization = null;
    this.#frameGate.reset();
    this.#transition("requesting_permission");

    try {
      const stream = await this.#audioSession.start({
        sessionId: this.#sessionId,
        onFrame: (frame) => this.#handleFrame(frame, generation),
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
    if (generation !== this.#generation || this.#state !== "running") {
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
    const target = targetAtTime(this.#practice, timestampMs);
    const signedCents =
      quality === "accepted" && target?.midiNote !== null && target
        ? centsBetween(frame.frequencyHz, midiToFrequency(target.midiNote))
        : null;
    const trajectoryPoint = {
      timestampMs,
      frequencyHz: quality === "accepted" ? frame.frequencyHz : null,
      midi: quality === "accepted" ? frame.midi : null,
      confidence: frame.confidence,
      rms: frame.rms,
      voiced: quality === "accepted",
      targetSegmentId: target?.id ?? null,
      signedCents,
      classification: classifyCents(signedCents),
    };
    this.#trajectory.push(trajectoryPoint);

    if (target?.midiNote !== null && target) {
      this.#assessments.push({
        targetSegmentId: target.id,
        timestampMs,
        signedCents,
        rms: frame.rms,
        voiced: quality === "accepted",
      });
    }
    this.#transition("running");
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
    if (this.#timer !== null) {
      this.#clearTimer(this.#timer);
      this.#timer = null;
    }

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
    if (this.#timer !== null) {
      this.#clearTimer(this.#timer);
      this.#timer = null;
    }
    this.#recorder.abort();
    await this.#audioSession.stop();
    this.#sessionId = null;
    this.#practice = null;
    this.#trajectory = [];
    this.#assessments = [];
    this.#record = null;
    this.#report = null;
    this.#error = null;
    this.#persistence = "none";
    this.#finalization = null;
    this.#transition("idle");
    return this.snapshot();
  }

  reset() {
    if (ACTIVE_STATES.has(this.#state)) {
      throw new Error("cannot reset an active practice session");
    }
    this.#state = "idle";
    this.#sessionId = null;
    this.#practice = null;
    this.#trajectory = [];
    this.#assessments = [];
    this.#record = null;
    this.#report = null;
    this.#error = null;
    this.#persistence = "none";
    this.#finalization = null;
    this.#transition("idle");
  }
}
