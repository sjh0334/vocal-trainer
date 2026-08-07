import { midiToFrequency } from "../pitch/note.js";

export function buildDemoSchedule(practice, startAt) {
  return practice.segments
    .filter((segment) => segment.midiNote !== null)
    .map((segment) => ({
      id: segment.id,
      frequencyHz: midiToFrequency(segment.midiNote),
      startAt: startAt + segment.startMs / 1000,
      stopAt: startAt + segment.endMs / 1000,
    }));
}

export class DemoPlayer {
  #AudioContext;

  #context = null;

  #oscillators = [];

  constructor({
    AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext,
  } = {}) {
    this.#AudioContext = AudioContextCtor;
  }

  async play(practice) {
    await this.stop();
    if (!this.#AudioContext) {
      throw new Error("Web Audio is unavailable in this browser");
    }
    this.#context = new this.#AudioContext();
    await this.#context.resume();
    const schedule = buildDemoSchedule(practice, this.#context.currentTime + 0.05);
    for (const item of schedule) {
      const oscillator = this.#context.createOscillator();
      const gain = this.#context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(item.frequencyHz, item.startAt);
      gain.gain.setValueAtTime(0.0001, item.startAt);
      gain.gain.exponentialRampToValueAtTime(0.18, item.startAt + 0.02);
      gain.gain.setValueAtTime(0.18, Math.max(item.startAt + 0.02, item.stopAt - 0.04));
      gain.gain.exponentialRampToValueAtTime(0.0001, item.stopAt);
      oscillator.connect(gain);
      gain.connect(this.#context.destination);
      oscillator.start(item.startAt);
      oscillator.stop(item.stopAt);
      this.#oscillators.push(oscillator);
    }
    const durationMs = Math.max(0, (schedule.at(-1)?.stopAt - this.#context.currentTime) * 1000);
    await new Promise((resolve) => setTimeout(resolve, durationMs));
    await this.stop();
  }

  async stop() {
    for (const oscillator of this.#oscillators) {
      try {
        oscillator.stop();
      } catch {
        // Already stopped by its scheduled end.
      }
      oscillator.disconnect();
    }
    this.#oscillators = [];
    if (this.#context && this.#context.state !== "closed") {
      await this.#context.close();
    }
    this.#context = null;
  }
}
