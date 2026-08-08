import { validatePracticeDefinition } from "../domain/practice-definition.js";
import { midiToNoteName } from "../pitch/note.js";
import { LONG_TONE_PRACTICES } from "./long-tones.js";

function legacyMelody(id, title, notes) {
  const segments = [];
  let cursor = 0;
  for (const [index, midiNote] of notes.entries()) {
    segments.push({
      id: `${id}-note-${index + 1}`,
      startMs: cursor,
      endMs: cursor + 520,
      midiNote,
      label: midiToNoteName(midiNote),
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

const LEGACY_PRACTICES = Object.freeze([
  legacyMelody("stepwise-warmup", "五声音阶往返", [60, 62, 64, 67, 64, 62, 60]),
  legacyMelody("thirds-warmup", "三度跳进短句", [60, 64, 62, 65, 64, 67, 64]),
]);

const PRACTICE_CATALOG = Object.freeze([...LONG_TONE_PRACTICES, ...LEGACY_PRACTICES]);

export const ACTIVE_PRACTICES = LONG_TONE_PRACTICES;

export function isActivePractice(practice) {
  return Boolean(practice && ACTIVE_PRACTICES.some((candidate) => candidate.id === practice.id));
}

export function resolvePractice(id) {
  return PRACTICE_CATALOG.find((practice) => practice.id === id) ?? null;
}
