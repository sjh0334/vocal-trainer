const DEFAULTS = {
  minRms: 0.01,
  minConfidence: 0.7,
  minFrequency: 65,
  maxFrequency: 1000,
};

export class PitchFrameGate {
  #lastSequence = -1;

  #options;

  constructor(options = {}) {
    this.#options = { ...DEFAULTS, ...options };
  }

  accept(frame, activeSessionId) {
    if (!frame || frame.sessionId !== activeSessionId) {
      return false;
    }
    if (!Number.isInteger(frame.sequence) || frame.sequence <= this.#lastSequence) {
      return false;
    }
    this.#lastSequence = frame.sequence;

    return Boolean(
      frame.voiced &&
        Number.isFinite(frame.frequencyHz) &&
        frame.frequencyHz >= this.#options.minFrequency &&
        frame.frequencyHz <= this.#options.maxFrequency &&
        frame.rms >= this.#options.minRms &&
        frame.confidence >= this.#options.minConfidence,
    );
  }

  reset() {
    this.#lastSequence = -1;
  }
}
