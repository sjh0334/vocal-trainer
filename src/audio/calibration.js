const BASE_GATE_RMS = 0.01;
const MAX_GATE_RMS = 0.08;
const NOISY_RMS = 0.025;

function rounded(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function median(sorted) {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function pendingCalibration() {
  return {
    status: "pending",
    sampleCount: 0,
    noiseFloorRms: null,
    peakRms: null,
    gateRms: BASE_GATE_RMS,
  };
}

export function summarizeCalibration(samples) {
  const valid = samples
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);
  if (valid.length === 0) {
    return { ...pendingCalibration(), status: "no-signal" };
  }
  const noiseFloorRms = rounded(median(valid));
  const peakRms = rounded(valid.at(-1));
  const gateRms = rounded(Math.min(MAX_GATE_RMS, Math.max(BASE_GATE_RMS, noiseFloorRms * 2)));
  return {
    status: noiseFloorRms >= NOISY_RMS ? "noisy" : "ready",
    sampleCount: valid.length,
    noiseFloorRms,
    peakRms,
    gateRms,
  };
}
