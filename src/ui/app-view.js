import { renderHistory, renderReport } from "../render/report-renderer.js";

function duration(practice) {
  return ((practice.segments.at(-1)?.endMs ?? 0) / 1000).toFixed(1);
}

function melodyCard(practice) {
  const notes = practice.segments.filter((segment) => segment.midiNote !== null);
  const min = Math.min(...notes.map((segment) => segment.midiNote));
  const max = Math.max(...notes.map((segment) => segment.midiNote));
  return `
    <article class="melody-card">
      <button class="melody-select" data-action="prepare" data-practice-id="${practice.id}">
        <span class="melody-icon" aria-hidden="true">♪</span>
        <span><strong>${practice.title}</strong><small>${notes.length} 个音 · ${duration(practice)} 秒 · MIDI ${min}–${max}</small></span>
        <span class="melody-enter">进入练习 →</span>
      </button>
    </article>
  `;
}

function renderHome({ practices, history }) {
  return `
    <section class="home-page page-grid">
      <header class="hero">
        <div>
          <p class="eyebrow">REAL-TIME PITCH PRACTICE</p>
          <h1 aria-label="听见你的声音">听见你的<br /><em>声音</em></h1>
          <p class="hero-copy">跟着简单旋律唱，实时看准、偏高还是偏低。练完不只给分，还告诉你下一步怎么练。</p>
        </div>
        <div class="hero-orbit" aria-hidden="true"><span>A4</span><i></i><b>440<small>Hz</small></b></div>
      </header>
      <section class="practice-picker">
        <div class="panel-heading"><div><span class="panel-kicker">01 · CHOOSE</span><h2>选择练习旋律</h2></div><button class="ghost-button" data-action="history">历史 ${history.length}</button></div>
        <div class="melody-list">${practices.map((practice) => melodyCard(practice)).join("")}</div>
        <p class="privacy-note">麦克风、录音和报告均在本地处理。本地保存，不上传。</p>
      </section>
      <section class="promise-grid">
        <article><span>01</span><strong>YIN 音高检测</strong><p>不用简单 FFT 猜峰值，专注单声道基频。</p></article>
        <article><span>02</span><strong>一眼看懂偏差</strong><p>位置、文字和颜色共同表达准、高、低。</p></article>
        <article><span>03</span><strong>评分给出方向</strong><p>音准与稳定度解耦，颤音不会被误算成跑调。</p></article>
      </section>
    </section>
  `;
}

function renderPreparation(practice) {
  const notes = practice.segments.filter((segment) => segment.midiNote !== null);
  const min = Math.min(...notes.map((segment) => segment.midiNote));
  const max = Math.max(...notes.map((segment) => segment.midiNote));
  return `
    <section class="prepare-page page-grid">
      <header class="page-header prepare-header">
        <div><p class="eyebrow">PRACTICE READY</p><h1>${practice.title}</h1></div>
        <button class="ghost-button" data-action="home">← 重新选择</button>
      </header>
      <section class="practice-picker prepare-panel">
        <div><span class="panel-kicker">01 · LISTEN</span><h2>先听一遍旋律</h2><p class="prepare-copy">熟悉旋律后，再明确点击开始练习。进入这个页面不会申请麦克风，也不会自动开练。</p></div>
        <div class="prepare-summary">
          <div><span>音符</span><strong>${notes.length}</strong></div>
          <div><span>时长</span><strong>${duration(practice)}s</strong></div>
          <div><span>音域</span><strong>MIDI ${min}–${max}</strong></div>
        </div>
        <div class="prepare-actions">
          <button class="ghost-button" data-action="preview" data-practice-id="${practice.id}">试听旋律</button>
          <button class="primary-button" data-action="begin-practice">开始练习 <span>→</span></button>
        </div>
        <p class="privacy-note">只有点击“开始练习”后，浏览器才会申请麦克风权限。</p>
      </section>
    </section>
  `;
}

function feedback(latest) {
  if (!latest || latest.classification === "unvoiced") {
    return { className: "unvoiced", label: "等待发声", cents: "—", note: "—" };
  }
  const cents = Math.round(latest.signedCents);
  const label =
    latest.classification === "sharp"
      ? `偏高 +${cents}¢`
      : latest.classification === "flat"
        ? `偏低 ${cents}¢`
        : `准确 ${cents >= 0 ? "+" : ""}${cents}¢`;
  return {
    className: latest.classification,
    label,
    cents,
    note: Number.isFinite(latest.midi) ? Math.round(latest.midi) : "—",
  };
}

function calibrationCopy(calibration) {
  if (calibration?.status === "noisy") {
    const noise = Math.round(calibration.noiseFloorRms * 100);
    const peak = Math.round(calibration.peakRms * 100);
    return `环境音较高：噪声约 ${noise}%，输入峰值 ${peak}%。尽量靠近麦克风。`;
  }
  if (calibration?.status === "no-signal") {
    return "暂未检测到稳定输入，请检查麦克风；仍可继续本次练习。";
  }
  if (calibration?.status === "ready") {
    const noise = Math.round(calibration.noiseFloorRms * 100);
    return `环境检查完成：噪声约 ${noise}%。旋律即将进入跑道。`;
  }
  return "旋律即将从中央游标进入。";
}

function renderSession({ practice, session }) {
  const latest = session.trajectory?.at(-1);
  const live = feedback(latest);
  const stageCopy = {
    requesting_permission: ["允许麦克风", "浏览器会询问权限，音频不会上传。"],
    calibrating: ["正在检查环境", "保持安静片刻，我们在采样输入音量与环境噪声。"],
    countdown: ["准备开始", calibrationCopy(session.calibration)],
  };
  if (session.state !== "running") {
    const [title, copy] = stageCopy[session.state] ?? [
      "无法开始练习",
      session.error ?? "请返回重试。",
    ];
    return `<section class="stage-page"><button class="ghost-button stage-back" data-action="cancel">← 返回</button><div class="stage-status"><div class="pulse-ring"></div><p class="eyebrow">MICROPHONE CHECK</p><h1>${title}</h1><p>${copy}</p></div></section>`;
  }

  return `
    <section class="session-page page-grid">
      <header class="session-header"><div><p class="eyebrow">LIVE SESSION</p><h1>${practice.title}</h1></div><button class="danger-button" data-action="stop">结束练习</button></header>
      <section class="live-readout ${live.className}">
        <div><span>当前音高</span><strong id="live-note">${live.note}</strong></div>
        <div><span>实时反馈</span><strong id="live-feedback">${live.label}</strong></div>
      </section>
      <section class="runway-panel">
        <div class="panel-heading"><div><span class="panel-kicker">PITCH RUNWAY</span><h2>实时音高跑道</h2></div><div class="legend"><span class="accurate">准</span><span class="sharp">高</span><span class="flat">低</span></div></div>
        <canvas id="live-track" aria-label="实时音高跑道"></canvas>
      </section>
      <p class="session-tip">让你的曲线贴近紫色目标音符块；中央竖线代表现在。</p>
    </section>
  `;
}

function renderHistoryPage(history) {
  return `<section class="history-page page-grid"><header class="page-header"><div><p class="eyebrow">LOCAL HISTORY</p><h1>练习记录</h1></div><button class="ghost-button" data-action="home">返回练习</button></header><section class="history-list">${renderHistory(history)}</section>${history.length > 0 ? '<button class="danger-button" data-action="clear-history">清空全部记录</button>' : ""}</section>`;
}

export function renderScreen(state) {
  if (state.route === "prepare") {
    return renderPreparation(state.practice);
  }
  if (state.route === "session") {
    return renderSession(state);
  }
  if (state.route === "report") {
    return renderReport(state);
  }
  if (state.route === "history") {
    return renderHistoryPage(state.history);
  }
  return renderHome(state);
}
