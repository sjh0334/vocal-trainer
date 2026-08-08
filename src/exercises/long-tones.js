import { validatePracticeDefinition } from "../domain/practice-definition.js";
import { midiToFrequency, midiToNoteName } from "../pitch/note.js";

const LONG_TONE_DURATION_MS = 8000;

function longTone(midiNote) {
  const noteName = midiToNoteName(midiNote);
  return validatePracticeDefinition({
    id: `long-tone-${noteName.toLowerCase()}`,
    version: 1,
    title: `长音 ${noteName}`,
    leadInMs: 0,
    segments: [
      {
        id: `long-tone-${noteName.toLowerCase()}-target`,
        startMs: 0,
        endMs: LONG_TONE_DURATION_MS,
        midiNote,
        label: noteName,
      },
    ],
  });
}

export function longToneTarget(practice) {
  const segment = practice.segments.find((candidate) => candidate.midiNote !== null);
  if (!segment) {
    throw new Error("long-tone practice must contain a pitched target");
  }
  return {
    noteName: midiToNoteName(segment.midiNote),
    frequencyHz: Number(midiToFrequency(segment.midiNote).toFixed(2)),
  };
}

export const LONG_TONE_PRACTICES = Object.freeze([longTone(57), longTone(60), longTone(64)]);
