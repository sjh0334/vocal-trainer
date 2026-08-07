import { frequencyToMidi } from "./note.js";
import { detectPitch } from "./yin.js";

export function analyzePitchFrame({ sessionId, sequence, timestampMs, sampleRate, samples }) {
  const result = detectPitch(samples, sampleRate);
  return {
    sessionId,
    sequence,
    timestampMs,
    frequencyHz: result.frequencyHz,
    midi: result.frequencyHz === null ? null : frequencyToMidi(result.frequencyHz),
    confidence: result.confidence,
    rms: result.rms,
    voiced: result.voiced,
  };
}

if (typeof self !== "undefined" && typeof self.addEventListener === "function") {
  self.addEventListener("message", (event) => {
    self.postMessage(analyzePitchFrame(event.data));
  });
}
