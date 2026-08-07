import { targetAtTime } from "../domain/practice-definition.js";

export function timeToX(timestampMs, { elapsedMs, playheadX, pixelsPerMs }) {
  return playheadX + (timestampMs - elapsedMs) * pixelsPerMs;
}

export function midiToY(midi, { centerMidi, centerY, pixelsPerSemitone }) {
  return centerY - (midi - centerMidi) * pixelsPerSemitone;
}

function noteRange(practice, currentTarget) {
  const notes = practice.segments
    .map((segment) => segment.midiNote)
    .filter((note) => note !== null);
  const centerMidi = currentTarget?.midiNote ?? (Math.min(...notes) + Math.max(...notes)) / 2;
  return { centerMidi, notes };
}

export function createTrackViewModel({
  practice,
  trajectory,
  elapsedMs,
  width,
  height,
  windowMs = 5200,
}) {
  const playheadX = Math.round(width * 0.34);
  const pixelsPerMs = width / windowMs;
  const currentTarget = targetAtTime(practice, elapsedMs);
  const { centerMidi } = noteRange(practice, currentTarget);
  const centerY = height / 2;
  const pixelsPerSemitone = Math.min(30, height / 12);
  const geometry = { centerMidi, centerY, pixelsPerSemitone };
  const timeline = { elapsedMs, playheadX, pixelsPerMs };

  return {
    playheadX,
    currentTarget,
    centerMidi,
    pixelsPerSemitone,
    segments: practice.segments
      .filter((segment) => segment.midiNote !== null)
      .map((segment) => ({
        ...segment,
        x1: timeToX(segment.startMs, timeline),
        x2: timeToX(segment.endMs, timeline),
        y: midiToY(segment.midiNote, geometry),
      })),
    points: trajectory
      .filter((point) => Number.isFinite(point.midi))
      .map((point) => ({
        ...point,
        x: timeToX(point.timestampMs, timeline),
        y: midiToY(point.midi, geometry),
      })),
  };
}

const FALLBACK_THEME = {
  background: "#11131b",
  grid: "rgba(255,255,255,0.08)",
  target: "#8573ff",
  targetText: "#f7f4ff",
  accurate: "#55d6a6",
  sharp: "#ffb454",
  flat: "#69b7ff",
  playhead: "rgba(255,255,255,0.72)",
};

function canvasTheme(canvas) {
  if (typeof getComputedStyle !== "function") {
    return FALLBACK_THEME;
  }
  const styles = getComputedStyle(canvas);
  return {
    background: styles.getPropertyValue("--track-background").trim() || FALLBACK_THEME.background,
    grid: styles.getPropertyValue("--track-grid").trim() || FALLBACK_THEME.grid,
    target: styles.getPropertyValue("--track-target").trim() || FALLBACK_THEME.target,
    targetText: styles.getPropertyValue("--track-text").trim() || FALLBACK_THEME.targetText,
    accurate: styles.getPropertyValue("--status-accurate").trim() || FALLBACK_THEME.accurate,
    sharp: styles.getPropertyValue("--status-sharp").trim() || FALLBACK_THEME.sharp,
    flat: styles.getPropertyValue("--status-flat").trim() || FALLBACK_THEME.flat,
    playhead: styles.getPropertyValue("--track-playhead").trim() || FALLBACK_THEME.playhead,
  };
}

export class TrackRenderer {
  #canvas;

  constructor(canvas) {
    this.#canvas = canvas;
  }

  render({ practice, trajectory, elapsedMs }) {
    const width = this.#canvas.clientWidth || 800;
    const height = this.#canvas.clientHeight || 320;
    const ratio = globalThis.devicePixelRatio || 1;
    this.#canvas.width = Math.round(width * ratio);
    this.#canvas.height = Math.round(height * ratio);
    const context = this.#canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const theme = canvasTheme(this.#canvas);
    const model = createTrackViewModel({ practice, trajectory, elapsedMs, width, height });

    context.fillStyle = theme.background;
    context.fillRect(0, 0, width, height);
    context.strokeStyle = theme.grid;
    context.lineWidth = 1;
    for (let y = 24; y < height; y += 32) {
      context.beginPath();
      context.moveTo(0, y + 0.5);
      context.lineTo(width, y + 0.5);
      context.stroke();
    }

    context.font = "700 12px system-ui";
    context.textAlign = "center";
    context.textBaseline = "middle";
    for (const segment of model.segments) {
      const blockHeight = Math.max(14, model.pixelsPerSemitone * 0.72);
      context.fillStyle = theme.target;
      context.beginPath();
      context.roundRect(
        segment.x1,
        segment.y - blockHeight / 2,
        segment.x2 - segment.x1,
        blockHeight,
        7,
      );
      context.fill();
      context.fillStyle = theme.targetText;
      context.fillText(segment.label, (segment.x1 + segment.x2) / 2, segment.y);
    }

    if (model.points.length > 1) {
      context.lineWidth = 4;
      context.lineCap = "round";
      context.lineJoin = "round";
      for (let index = 1; index < model.points.length; index += 1) {
        const previous = model.points[index - 1];
        const point = model.points[index];
        context.strokeStyle = theme[point.classification] ?? theme.accurate;
        context.beginPath();
        context.moveTo(previous.x, previous.y);
        context.lineTo(point.x, point.y);
        context.stroke();
      }
    }

    context.strokeStyle = theme.playhead;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(model.playheadX, 0);
    context.lineTo(model.playheadX, height);
    context.stroke();
    return model;
  }
}
