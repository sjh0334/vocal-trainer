import { clampScore, SCORE_RULES } from "./score-rules.js";

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function weightedMean(items, valueKey) {
  const totalWeight = items.reduce((total, item) => total + item.weight, 0);
  if (totalWeight === 0) {
    return 0;
  }
  return items.reduce((total, item) => total + item[valueKey] * item.weight, 0) / totalWeight;
}

function estimateFrameInterval(assessments) {
  const deltas = [];
  for (let index = 1; index < assessments.length; index += 1) {
    const delta = assessments[index].timestampMs - assessments[index - 1].timestampMs;
    if (delta > 0) {
      deltas.push(delta);
    }
  }
  return median(deltas) || 0;
}

function longestUnvoicedGap(assessments) {
  const interval = estimateFrameInterval(assessments);
  let currentFrames = 0;
  let longestFrames = 0;
  for (const assessment of assessments) {
    if (assessment.voiced && Number.isFinite(assessment.signedCents)) {
      currentFrames = 0;
    } else {
      currentFrames += 1;
      longestFrames = Math.max(longestFrames, currentFrames);
    }
  }
  return longestFrames * interval;
}

function linearSlope(points) {
  if (points.length < 3) {
    return 0;
  }
  const meanX = mean(points.map((point) => point.x));
  const meanY = mean(points.map((point) => point.y));
  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    numerator += (point.x - meanX) * (point.y - meanY);
    denominator += (point.x - meanX) ** 2;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

function volumeSlopeDbPerSecond(assessments) {
  const voiced = assessments.filter(
    (assessment) => assessment.voiced && Number.isFinite(assessment.rms) && assessment.rms > 0,
  );
  if (voiced.length < 3) {
    return 0;
  }
  const origin = voiced[0].timestampMs;
  return linearSlope(
    voiced.map((assessment) => ({
      x: (assessment.timestampMs - origin) / 1000,
      y: 20 * Math.log10(assessment.rms),
    })),
  );
}

function segmentPitchMetrics(segments, assessments) {
  return segments
    .filter((segment) => segment.midiNote !== null)
    .map((segment) => {
      const cents = assessments
        .filter(
          (assessment) =>
            assessment.targetSegmentId === segment.id &&
            assessment.voiced &&
            Number.isFinite(assessment.signedCents),
        )
        .map((assessment) => assessment.signedCents);
      if (cents.length === 0) {
        return null;
      }
      const signedBias = mean(cents);
      return {
        id: segment.id,
        weight: segment.endMs - segment.startMs,
        signedBias,
        absoluteBias: Math.abs(signedBias),
        deviation: median(cents.map((value) => Math.abs(value - signedBias))),
      };
    })
    .filter(Boolean);
}

export function scoreSession({ segments, assessments }) {
  if (!Array.isArray(segments) || !Array.isArray(assessments)) {
    throw new TypeError("segments and assessments must be arrays");
  }
  const ordered = [...assessments].sort((left, right) => left.timestampMs - right.timestampMs);
  const voiced = ordered.filter(
    (assessment) => assessment.voiced && Number.isFinite(assessment.signedCents),
  );
  const voicedCoverage = ordered.length === 0 ? 0 : voiced.length / ordered.length;
  const pitchMetrics = segmentPitchMetrics(segments, ordered);
  const signedBiasCents = weightedMean(pitchMetrics, "signedBias");
  const biasCents = weightedMean(pitchMetrics, "absoluteBias");
  const deviationCents = weightedMean(pitchMetrics, "deviation");
  const longestGapMs = longestUnvoicedGap(ordered);
  const slopeDbPerSecond = volumeSlopeDbPerSecond(ordered);

  const accuracyScore = clampScore(100 - Math.max(0, biasCents - 5) * 2);
  const stabilityScore = clampScore(100 - Math.max(0, deviationCents - 5) * 2.5);
  const breathScore = clampScore(voicedCoverage * 100 - (longestGapMs / 1000) * 20);
  const volumeScore = clampScore(100 - Math.max(0, -slopeDbPerSecond - 0.5) * 8);
  const enoughData =
    voicedCoverage >= SCORE_RULES.minimumVoicedCoverage &&
    voiced.length >= SCORE_RULES.minimumVoicedFrames &&
    pitchMetrics.length > 0;

  const components = {
    stability: {
      score: stabilityScore,
      raw: { deviationCents },
    },
    accuracy: {
      score: accuracyScore,
      raw: { signedBiasCents, biasCents },
    },
    breathContinuity: {
      score: breathScore,
      raw: { voicedCoverage, longestGapMs },
    },
    volumeDecay: {
      score: volumeScore,
      raw: { slopeDbPerSecond },
    },
  };
  const totalScore = enoughData
    ? Object.entries(SCORE_RULES.weights).reduce(
        (total, [key, weight]) => total + components[key].score * weight,
        0,
      )
    : null;

  return {
    scorerVersion: SCORE_RULES.scorerVersion,
    status: enoughData ? "scored" : "insufficient",
    totalScore,
    dataQuality: {
      totalFrames: ordered.length,
      voicedFrames: voiced.length,
      voicedCoverage,
    },
    components,
    segmentMetrics: pitchMetrics,
  };
}
