function rootMeanSquare(samples) {
  let energy = 0;
  for (const sample of samples) {
    energy += sample * sample;
  }
  return Math.sqrt(energy / samples.length);
}

function parabolicMinimum(values, index) {
  if (index <= 0 || index >= values.length - 1) {
    return index;
  }
  const left = values[index - 1];
  const center = values[index];
  const right = values[index + 1];
  const denominator = 2 * (2 * center - right - left);
  if (denominator === 0) {
    return index;
  }
  return index + (right - left) / denominator;
}

export function detectPitch(samples, sampleRate, options = {}) {
  if (!(samples instanceof Float32Array) || samples.length < 32) {
    throw new TypeError("samples must be a Float32Array with at least 32 values");
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError("sampleRate must be positive");
  }

  const {
    minFrequency = 65,
    maxFrequency = 1000,
    threshold = 0.15,
    minConfidence = 0.7,
    minRms = 0.005,
  } = options;
  const rms = rootMeanSquare(samples);
  if (rms < minRms) {
    return { frequencyHz: null, confidence: 0, rms, voiced: false };
  }

  const minTau = Math.max(2, Math.floor(sampleRate / maxFrequency));
  const maxTau = Math.min(Math.floor(sampleRate / minFrequency), Math.floor(samples.length / 2));
  if (maxTau <= minTau) {
    throw new RangeError("sample window is too short for the configured frequency range");
  }

  const difference = new Float64Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau += 1) {
    let sum = 0;
    for (let index = 0; index < samples.length - tau; index += 1) {
      const delta = samples[index] - samples[index + tau];
      sum += delta * delta;
    }
    difference[tau] = sum;
  }

  const cmnd = new Float64Array(maxTau + 1);
  cmnd[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= maxTau; tau += 1) {
    runningSum += difference[tau];
    cmnd[tau] = runningSum === 0 ? 1 : (difference[tau] * tau) / runningSum;
  }

  let candidate = -1;
  for (let tau = minTau; tau <= maxTau; tau += 1) {
    if (cmnd[tau] >= threshold) {
      continue;
    }
    while (tau + 1 <= maxTau && cmnd[tau + 1] < cmnd[tau]) {
      tau += 1;
    }
    candidate = tau;
    break;
  }

  if (candidate === -1) {
    return { frequencyHz: null, confidence: 0, rms, voiced: false };
  }

  const refinedTau = parabolicMinimum(cmnd, candidate);
  const frequencyHz = sampleRate / refinedTau;
  const confidence = Math.max(0, Math.min(1, 1 - cmnd[candidate]));
  const voiced =
    confidence >= minConfidence && frequencyHz >= minFrequency && frequencyHz <= maxFrequency;

  return {
    frequencyHz: voiced ? frequencyHz : null,
    confidence,
    rms,
    voiced,
  };
}
