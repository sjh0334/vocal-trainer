import { longToneTarget } from "../exercises/long-tones.js";
import { renderHistory, renderReport } from "../render/report-renderer.js";
import { formatLiveFeedback } from "./live-feedback.js";

function duration(practice) {
  return ((practice.segments.at(-1)?.endMs ?? 0) / 1000).toFixed(1);
}

function melodyCard(practice) {
  const target = longToneTarget(practice);
  return `
    <article class="melody-card">
      <button class="melody-select" data-action="prepare" data-practice-id="${practice.id}">
        <span class="melody-icon" aria-hidden="true">♪</span>
        <span><strong>${practice.title}</strong><small>目标 ${target.noteName} · ${target.frequencyHz} Hz · ${duration(practice)} 秒</small></span>
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
          <p class="hero-copy">先把一个音唱稳、唱长。慢速跑道实时显示准、偏高还是偏低，结束后还能回听自己的录音。</p>
        </div>
        <div class="hero-orbit" aria-hidden="true"><span>A3</span><i></i><b>220<small>Hz</small></b></div>
      </header>
      <section class="practice-picker">
        <div class="panel-heading"><div><span class="panel-kicker">01 · CHOOSE</span><h2>选择舒服的目标音</h2></div><button class="ghost-button" data-action="history">历史 ${history.length}</button></div>
        <div class="melody-list">${practices.map((practice) => melodyCard(practice)).join("")}</div>
        <p class="privacy-note">麦克风、录音和报告均在本地处理。本地保存，不上传。</p>
      </section>
      <section class="promise-grid">
        <article><span>01</span><strong>一个目标音</strong><p>先不追旋律，只练习把一个长音唱稳。</p></article>
        <article><span>02</span><strong>慢速稳定跑道</strong><p>位置、文字和颜色共同表达准、高、低。</p></article>
        <article><span>03</span><strong>录完立即回听</strong><p>录音只留在本机，把看到的轨迹和听到的声音对上。</p></article>
      </section>
    </section>
  `;
}

function renderPreparation(practice) {
  const target = longToneTarget(practice);
  return `
    <section class="prepare-page page-grid">
      <header class="page-header prepare-header">
        <div><p class="eyebrow">PRACTICE READY</p><h1>${practice.title}</h1></div>
        <button class="ghost-button" data-action="home">← 重新选择</button>
      </header>
      <section class="practice-picker prepare-panel">
        <p class="target-badge">目标音 ${target.noteName} · ${target.frequencyHz} Hz</p>
        <div><span class="panel-kicker">01 · LISTEN</span><h2>先听一遍目标长音</h2><p class="prepare-copy">目标音是 <strong>${target.noteName}</strong>。熟悉后再开始录制；进入这个页面不会申请麦克风。</p></div>
        <div class="prepare-summary">
          <div><span>目标音</span><strong>${target.noteName}</strong></div>
          <div><span>频率</span><strong>${target.frequencyHz} Hz</strong></div>
          <div><span>时长</span><strong>${duration(practice)}s</strong></div>
        </div>
        <div class="prepare-actions">
          <button class="ghost-button" data-action="preview" data-practice-id="${practice.id}">试听目标音</button>
          <button class="primary-button" data-action="begin-practice">开始录制 <span>→</span></button>
        </div>
        <p class="privacy-note">只有点击“开始练习”后，浏览器才会申请麦克风权限。</p>
      </section>
    </section>
  `;
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
  const live = formatLiveFeedback(latest);
  const target = longToneTarget(practice);
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
      <header class="session-header"><div><p class="eyebrow">LIVE SESSION</p><h1>${practice.title}</h1><p class="target-badge">目标 ${target.noteName} · ${target.frequencyHz} Hz</p></div><button class="danger-button" data-action="stop">结束录制</button></header>
      <section class="live-readout ${live.className}">
        <div><span>当前音高</span><strong id="live-note">${live.note}</strong></div>
        <div><span>实时反馈</span><strong id="live-feedback">${live.label}</strong></div>
      </section>
      <section class="runway-panel">
        <div class="panel-heading"><div><span class="panel-kicker">PITCH RUNWAY</span><h2>实时音高跑道</h2></div><div class="legend"><span class="accurate">准</span><span class="sharp">高</span><span class="flat">低</span></div></div>
        <canvas id="live-track" aria-label="实时音高跑道"></canvas>
      </section>
      <p class="session-tip">保持一个舒服的音量，让平滑后的曲线贴近紫色 ${target.noteName} 目标带；竖线代表现在。</p>
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
