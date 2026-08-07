function diagnostic(metric, tone, title, evidence, action) {
  return { metric, tone, title, evidence, action };
}

export function buildDiagnostics(report) {
  if (report.status === "insufficient") {
    const percent = Math.round(report.dataQuality.voicedCoverage * 100);
    return [
      diagnostic(
        "dataQuality.voicedCoverage",
        "info",
        "这次有效发声数据不足",
        `只识别到 ${percent}% 的有效发声。`,
        "先检查麦克风输入和环境噪声，再完整唱一遍。",
      ),
    ];
  }

  const results = [];
  const signedBias = report.components.accuracy.raw.signedBiasCents;
  if (signedBias > 15) {
    results.push(
      diagnostic(
        "accuracy.signedBiasCents",
        "warning",
        "整体落点偏高",
        `平均落点偏高 ${Math.round(signedBias)} cents。`,
        "起音后放松喉部，用更小的力度贴近目标音。",
      ),
    );
  } else if (signedBias < -15) {
    results.push(
      diagnostic(
        "accuracy.signedBiasCents",
        "warning",
        "整体落点偏低",
        `平均落点偏低 ${Math.round(Math.abs(signedBias))} cents。`,
        "先听清目标音，再用短音确认落点后延长。",
      ),
    );
  }

  const deviation = report.components.stability.raw.deviationCents;
  if (deviation > 20) {
    results.push(
      diagnostic(
        "stability.deviationCents",
        "warning",
        "落点附近波动较大",
        `典型波动约 ${Math.round(deviation)} cents。`,
        "先用较短的长音维持均匀气流，再逐步延长。",
      ),
    );
  }

  const longestGap = report.components.breathContinuity.raw.longestGapMs;
  if (longestGap >= 250) {
    results.push(
      diagnostic(
        "breathContinuity.longestGapMs",
        "warning",
        "持续音中有明显中断",
        `最长中断约 ${Math.round(longestGap)} ms。`,
        "缩短单次练习长度，先把气流连起来。",
      ),
    );
  }

  const slope = report.components.volumeDecay.raw.slopeDbPerSecond;
  if (slope < -3) {
    results.push(
      diagnostic(
        "volumeDecay.slopeDbPerSecond",
        "warning",
        "后半段音量下降较快",
        `音量趋势约 ${slope.toFixed(1)} dB/s。`,
        "保持麦克风距离不变，用均匀气流托住音尾。",
      ),
    );
  }

  return results.length > 0
    ? results
    : [
        diagnostic(
          "summary",
          "positive",
          "这次落点和持续性都不错",
          "主要指标都在当前练习的稳定区间。",
          "保持当前力度，再尝试下一条旋律。",
        ),
      ];
}
