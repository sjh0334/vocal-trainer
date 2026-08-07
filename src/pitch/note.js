const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

function assertPositiveFrequency(frequency) {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    throw new RangeError("frequency must be a positive finite number");
  }
}

export function frequencyToMidi(frequency) {
  assertPositiveFrequency(frequency);
  return 69 + 12 * Math.log2(frequency / 440);
}

export function midiToFrequency(midi) {
  if (!Number.isFinite(midi)) {
    throw new RangeError("midi must be finite");
  }
  return 440 * 2 ** ((midi - 69) / 12);
}

export function centsBetween(frequency, referenceFrequency) {
  assertPositiveFrequency(frequency);
  assertPositiveFrequency(referenceFrequency);
  return 1200 * Math.log2(frequency / referenceFrequency);
}

export function midiToNoteName(midi) {
  if (!Number.isFinite(midi)) {
    throw new RangeError("midi must be finite");
  }
  const rounded = Math.round(midi);
  const noteIndex = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}
