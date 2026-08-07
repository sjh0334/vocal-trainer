import { validatePracticeDefinition } from "../domain/practice-definition.js";

function melody(id, title, notes) {
  const segments = [];
  let cursor = 0;
  for (const [index, midiNote] of notes.entries()) {
    segments.push({
      id: `${id}-note-${index + 1}`,
      startMs: cursor,
      endMs: cursor + 520,
      midiNote,
      label:
        midiNote === 60
          ? "C4"
          : midiNote === 62
            ? "D4"
            : midiNote === 64
              ? "E4"
              : midiNote === 65
                ? "F4"
                : "G4",
    });
    cursor += 520;
    if (index < notes.length - 1) {
      segments.push({
        id: `${id}-rest-${index + 1}`,
        startMs: cursor,
        endMs: cursor + 100,
        midiNote: null,
        label: "休止",
      });
      cursor += 100;
    }
  }
  return validatePracticeDefinition({ id, version: 1, title, leadInMs: 0, segments });
}

export const SIMPLE_MELODIES = Object.freeze([
  melody("stepwise-warmup", "五声音阶往返", [60, 62, 64, 67, 64, 62, 60]),
  melody("thirds-warmup", "三度跳进短句", [60, 64, 62, 65, 64, 67, 64]),
]);
