import { targetAtTime } from "../domain/practice-definition.js";
import { centsBetween, midiToFrequency } from "../pitch/note.js";

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

export function assessPitchFrame({ frame, quality, practice, timestampMs }) {
  const target = targetAtTime(practice, timestampMs);
  const hasPitchedTarget = Boolean(target && target.midiNote !== null);
  const accepted = quality === "accepted";
  const signedCents =
    accepted && hasPitchedTarget
      ? centsBetween(frame.frequencyHz, midiToFrequency(target.midiNote))
      : null;
  const trajectoryPoint = {
    timestampMs,
    frequencyHz: accepted ? frame.frequencyHz : null,
    midi: accepted ? frame.midi : null,
    confidence: frame.confidence,
    rms: frame.rms,
    latencyMs: Number.isFinite(frame.latencyMs) ? frame.latencyMs : null,
    voiced: accepted,
    targetSegmentId: target?.id ?? null,
    signedCents,
    classification: classifyCents(signedCents),
  };
  const assessment = hasPitchedTarget
    ? {
        targetSegmentId: target.id,
        timestampMs,
        signedCents,
        rms: frame.rms,
        voiced: accepted,
      }
    : null;
  return { assessment, trajectoryPoint };
}
