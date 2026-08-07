export const SCORE_RULES = Object.freeze({
  scorerVersion: 1,
  minimumVoicedCoverage: 0.5,
  minimumVoicedFrames: 3,
  weights: Object.freeze({
    stability: 0.4,
    accuracy: 0.3,
    breathContinuity: 0.2,
    volumeDecay: 0.1,
  }),
});

export function clampScore(value) {
  return Math.max(0, Math.min(100, value));
}
