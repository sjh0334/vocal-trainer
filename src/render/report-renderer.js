function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function rounded(value) {
  return Number.isFinite(value) ? Math.round(value) : "—";
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1024) {
    return `${Math.max(0, bytes ?? 0)} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const COMPONENT_LABELS = {
  stability: "稳定度",
  accuracy: "音准",
  breathContinuity: "气息连续性",
  volumeDecay: "音量衰减",
};

function scoreCards(report) {
  return Object.entries(COMPONENT_LABELS)
    .map(([key, label]) => {
      const component = report.components[key];
      return `
        <article class="score-card">
          <span>${label}</span>
          <strong>${rounded(component.score)}</strong>
          <div class="score-meter" aria-hidden="true">
            <i style="--score:${Math.max(0, Math.min(100, component.score))}%"></i>
          </div>
        </article>
      `;
    })
    .join("");
}

function diagnostics(report) {
  return report.diagnostics
    .map(
      (item) => `
        <article class="diagnostic-card">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.evidence)}</p>
          <p class="diagnostic-action">下一步：${escapeHtml(item.action)}</p>
        </article>
      `,
    )
    .join("");
}

function rawMetrics(report) {
  return `
    <dl class="raw-metrics">
      <div><dt>平均落点</dt><dd>${rounded(report.components.accuracy.raw.signedBiasCents)}¢</dd></div>
      <div><dt>典型波动</dt><dd>${rounded(report.components.stability.raw.deviationCents)}¢</dd></div>
      <div><dt>有效发声</dt><dd>${rounded(report.dataQuality.voicedCoverage * 100)}%</dd></div>
      <div><dt>最长中断</dt><dd>${rounded(report.components.breathContinuity.raw.longestGapMs)}ms</dd></div>
    </dl>
  `;
}

export function renderReport({ practice, session, playback = { state: "idle", cursorMs: 0 } }) {
  const report = session.report;
  const insufficient = report.status === "insufficient";
  const total = insufficient ? "数据不足" : rounded(report.totalScore);
  const playLabel = playback.state === "playing" ? "暂停录音" : "播放录音";
  const recordingSize = formatBytes(session.record?.audioBlob?.size);
  return `
    <section class="report-page page-grid">
      <header class="page-header">
        <div>
          <p class="eyebrow">PRACTICE REPORT</p>
          <h1>${escapeHtml(practice.title)}</h1>
        </div>
        <button class="ghost-button" data-action="home">返回练习</button>
      </header>
      <section class="report-hero ${insufficient ? "is-insufficient" : ""}">
        <div>
          <span>本次总分</span>
          <strong>${total}</strong>
        </div>
        <p>${insufficient ? "有效发声不足，这次不强行打分。" : "分数之外，更重要的是下面的证据和下一步。"}</p>
      </section>
      ${insufficient ? "" : `<section class="score-grid">${scoreCards(report)}</section>`}
      <section class="runway-panel report-track">
        <div class="panel-heading"><div><span class="panel-kicker">REPLAY</span><h2>录音与音高轨迹</h2></div></div>
        <canvas id="report-track" aria-label="录音音高轨迹"></canvas>
        <div class="playback-row">
          <button id="playback-button" class="primary-button" data-action="play">${playLabel}</button>
          <span id="playback-time">${(playback.cursorMs / 1000).toFixed(1)}s</span>
        </div>
        <p class="privacy-note">本地录音 ${recordingSize}。录音只保存在这台设备，不会上传；你可以随时删除。</p>
      </section>
      <section class="report-columns">
        <div><div class="panel-heading"><div><span class="panel-kicker">COACHING</span><h2>诊断与练法</h2></div></div>${diagnostics(report)}</div>
        <div><div class="panel-heading"><div><span class="panel-kicker">EVIDENCE</span><h2>原始指标</h2></div></div>${rawMetrics(report)}</div>
      </section>
      ${session.persistence === "failed" ? `<p class="error-banner">报告未能写入本地存储：${escapeHtml(session.error)}</p>` : ""}
      <footer class="report-actions">
        <button class="primary-button" data-action="retry">再练一次</button>
        <button class="danger-button" data-action="delete-current">删除这条记录</button>
      </footer>
    </section>
  `;
}

export function renderHistory(history) {
  if (history.length === 0) {
    return `<div class="empty-state"><strong>还没有练习记录</strong><p>完成一次练习后，录音与报告会保存在这里。</p></div>`;
  }
  return history
    .map(
      (record) => `
        <article class="history-row">
          <button data-action="open-history" data-record-id="${escapeHtml(record.id)}">
            <span>${escapeHtml(record.practiceTitle ?? record.practiceId)}</span>
            <small>${new Date(record.createdAt).toLocaleString("zh-CN")}</small>
            <strong>${record.report.totalScore === null ? "数据不足" : rounded(record.report.totalScore)}</strong>
          </button>
          <button class="icon-button" aria-label="删除记录" data-action="delete-history" data-record-id="${escapeHtml(record.id)}">×</button>
        </article>
      `,
    )
    .join("");
}
