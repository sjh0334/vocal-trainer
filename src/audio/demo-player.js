import { midiToFrequency } from "../pitch/note.js";

const DEMO_TONE = Object.freeze({
  waveform: "triangle",
  peakGain: 0.06,
  lowpassHz: 2400,
  filterQ: 0.55,
  attackSeconds: 0.055,
  releaseSeconds: 0.14,
});

export function buildDemoSchedule(practice, startAt) {
  return practice.segments
    .filter((segment) => segment.midiNote !== null)
    .map((segment) => {
      const noteStartAt = startAt + segment.startMs / 1000;
      const noteStopAt = startAt + segment.endMs / 1000;
      return {
        id: segment.id,
        frequencyHz: midiToFrequency(segment.midiNote),
        startAt: noteStartAt,
        stopAt: noteStopAt,
        attackEndAt: Math.min(noteStartAt + DEMO_TONE.attackSeconds, noteStopAt),
        releaseStartAt: Math.max(
          noteStartAt + DEMO_TONE.attackSeconds,
          noteStopAt - DEMO_TONE.releaseSeconds,
        ),
        waveform: DEMO_TONE.waveform,
        peakGain: DEMO_TONE.peakGain,
        lowpassHz: DEMO_TONE.lowpassHz,
        filterQ: DEMO_TONE.filterQ,
      };
    });
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
      const filter = this.#context.createBiquadFilter();
      const gain = this.#context.createGain();
      oscillator.type = item.waveform;
      oscillator.frequency.setValueAtTime(item.frequencyHz, item.startAt);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(item.lowpassHz, item.startAt);
      filter.Q.setValueAtTime(item.filterQ, item.startAt);
      gain.gain.setValueAtTime(0.0001, item.startAt);
      gain.gain.exponentialRampToValueAtTime(item.peakGain, item.attackEndAt);
      gain.gain.setValueAtTime(item.peakGain, item.releaseStartAt);
      gain.gain.exponentialRampToValueAtTime(0.0001, item.stopAt);
      oscillator.connect(filter);
      filter.connect(gain);
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
