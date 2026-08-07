function assertNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string`);
  }
}

function normalizeSegment(segment, index) {
  assertNonEmptyString(segment?.id, `segments[${index}].id`);
  assertNonEmptyString(segment?.label, `segments[${index}].label`);

  if (!Number.isFinite(segment.startMs) || !Number.isFinite(segment.endMs)) {
    throw new TypeError(`segments[${index}] must have finite timestamps`);
  }
  if (segment.startMs < 0 || segment.endMs <= segment.startMs) {
    throw new RangeError(`segments[${index}] must have a positive duration`);
  }
  if (
    segment.midiNote !== null &&
    (!Number.isInteger(segment.midiNote) || segment.midiNote < 0 || segment.midiNote > 127)
  ) {
    throw new RangeError(`segments[${index}].midiNote must be null or an integer from 0 to 127`);
  }

  return Object.freeze({
    id: segment.id,
    startMs: segment.startMs,
    endMs: segment.endMs,
    midiNote: segment.midiNote,
    label: segment.label,
  });
}

export function validatePracticeDefinition(definition) {
  assertNonEmptyString(definition?.id, "id");
  assertNonEmptyString(definition?.title, "title");
  if (!Number.isInteger(definition.version) || definition.version < 1) {
    throw new RangeError("version must be a positive integer");
  }
  if (!Number.isFinite(definition.leadInMs) || definition.leadInMs < 0) {
    throw new RangeError("leadInMs must be a non-negative number");
  }
  if (!Array.isArray(definition.segments) || definition.segments.length === 0) {
    throw new TypeError("segments must be a non-empty array");
  }

  const segments = definition.segments.map(normalizeSegment);
  const ids = new Set();
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (ids.has(segment.id)) {
      throw new Error(`duplicate segment id: ${segment.id}`);
    }
    ids.add(segment.id);
    if (index > 0 && segment.startMs < segments[index - 1].endMs) {
      throw new Error(`segments overlap at ${segment.id}`);
    }
  }

  return Object.freeze({
    id: definition.id,
    version: definition.version,
    title: definition.title,
    leadInMs: definition.leadInMs,
    segments: Object.freeze(segments),
  });
}

export function targetAtTime(practice, timestampMs) {
  if (!Number.isFinite(timestampMs) || timestampMs < 0) {
    return null;
  }

  return (
    practice.segments.find(
      (segment) => timestampMs >= segment.startMs && timestampMs < segment.endMs,
    ) ?? null
  );
}
