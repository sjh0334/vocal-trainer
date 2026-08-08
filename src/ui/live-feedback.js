import { midiToNoteName } from "../pitch/note.js";

export function formatLiveFeedback(point) {
  if (!point || point.classification === "unvoiced") {
    return { className: "unvoiced", label: "等待发声", cents: "—", note: "—" };
  }
  const cents = Math.round(point.signedCents);
  const label =
    point.classification === "sharp"
      ? `偏高 +${cents}¢`
      : point.classification === "flat"
        ? `偏低 ${cents}¢`
        : `准确 ${cents >= 0 ? "+" : ""}${cents}¢`;
  return {
    className: point.classification,
    label,
    cents,
    note: Number.isFinite(point.midi) ? midiToNoteName(point.midi) : "—",
  };
}
