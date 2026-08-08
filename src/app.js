import "./styles.css";
import "./styles/responsive.css";

import { DemoPlayer } from "./audio/demo-player.js";
import { LiveAudioSession } from "./audio/live-audio-session.js";
import { Recorder } from "./audio/recorder.js";
import {
  ACTIVE_PRACTICES,
  isActivePractice,
  resolvePractice,
} from "./exercises/practice-catalog.js";
import { PlaybackController } from "./playback/playback-controller.js";
import { TrackRenderer } from "./render/track-renderer.js";
import { handlePageVisibility } from "./session/page-lifecycle.js";
import { PracticeSessionController } from "./session/practice-session-controller.js";
import { SessionRepository } from "./storage/session-repository.js";
import { renderScreen } from "./ui/app-view.js";
import { formatLiveFeedback } from "./ui/live-feedback.js";

const app = document.querySelector("#app");
const runtimeConfig = globalThis.__VOCAL_TRAINER_CONFIG__ ?? {};
const repository = new SessionRepository();
const playback = new PlaybackController();
const demoPlayer = new DemoPlayer();
const audioSession = new LiveAudioSession();
const recorder = new Recorder();
const sessionController = new PracticeSessionController({
  audioSession,
  recorder,
  repository,
  calibrationMs: runtimeConfig.calibrationMs ?? 800,
  countdownMs: runtimeConfig.countdownMs ?? 3000,
});

const state = {
  route: "home",
  practices: ACTIVE_PRACTICES,
  practice: ACTIVE_PRACTICES[0],
  history: [],
  session: sessionController.snapshot(),
  playback: playback.snapshot(),
};

let playbackAnimation = null;

function findPractice(id) {
  return resolvePractice(id) ?? ACTIVE_PRACTICES[0];
}

async function refreshHistory() {
  state.history = (await repository.list()).map((record) => ({
    ...record,
    practiceTitle: findPractice(record.practiceId).title,
  }));
}

function drawLiveTrack() {
  const canvas = document.querySelector("#live-track");
  if (!canvas || !state.practice || state.session.state !== "running") {
    return;
  }
  const elapsedMs = state.session.trajectory.at(-1)?.timestampMs ?? 0;
  new TrackRenderer(canvas).render({
    practice: state.practice,
    trajectory: state.session.trajectory,
    elapsedMs,
  });
}

function drawReportTrack() {
  const canvas = document.querySelector("#report-track");
  const record = state.session.record;
  if (!canvas || !record) {
    return;
  }
  const elapsedMs =
    state.playback.cursorMs ||
    Math.min(record.durationMs, record.trajectory.at(-1)?.timestampMs ?? 0);
  new TrackRenderer(canvas).render({
    practice: state.practice,
    trajectory: record.trajectory,
    elapsedMs,
  });
}

function render() {
  app.innerHTML = renderScreen(state);
  if (state.route === "session") {
    drawLiveTrack();
  } else if (state.route === "report") {
    drawReportTrack();
  }
}

function updateRunningSurface() {
  const latest = state.session.trajectory.at(-1);
  const feedback = formatLiveFeedback(latest);
  const readout = document.querySelector(".live-readout");
  if (!readout) {
    render();
    return;
  }
  readout.className = `live-readout ${feedback.className}`;
  document.querySelector("#live-note").textContent = feedback.note;
  document.querySelector("#live-feedback").textContent = feedback.label;
  drawLiveTrack();
}

function stopPlaybackAnimation() {
  if (playbackAnimation !== null) {
    cancelAnimationFrame(playbackAnimation);
    playbackAnimation = null;
  }
}

function updatePlaybackSurface() {
  state.playback = playback.snapshot();
  const button = document.querySelector("#playback-button");
  const time = document.querySelector("#playback-time");
  if (button) {
    button.textContent = state.playback.state === "playing" ? "暂停录音" : "播放录音";
  }
  if (time) {
    time.textContent = `${(state.playback.cursorMs / 1000).toFixed(1)}s`;
  }
  drawReportTrack();
  if (state.playback.state === "playing") {
    playbackAnimation = requestAnimationFrame(updatePlaybackSurface);
  } else {
    playbackAnimation = null;
  }
}

sessionController.subscribe((snapshot) => {
  const previousState = state.session.state;
  state.session = snapshot;
  if (snapshot.state === "report") {
    state.route = "report";
    state.practice = snapshot.practice;
    refreshHistory().finally(render);
    return;
  }
  if (snapshot.state === "running" && previousState === "running" && state.route === "session") {
    updateRunningSurface();
    return;
  }
  if (state.route === "session") {
    render();
  }
});

async function startPractice(practice) {
  stopPlaybackAnimation();
  playback.unload();
  await demoPlayer.stop();
  if (sessionController.snapshot().state !== "idle") {
    sessionController.reset();
  }
  state.practice = practice;
  state.route = "session";
  render();
  try {
    await sessionController.start(practice);
  } catch {
    render();
  }
}

async function openRecord(recordId) {
  const record = await repository.get(recordId);
  if (!record) {
    await refreshHistory();
    render();
    return;
  }
  playback.unload();
  state.practice = findPractice(record.practiceId);
  state.session = {
    state: "report",
    persistence: "saved",
    error: null,
    report: record.report,
    record,
    trajectory: record.trajectory,
  };
  state.playback = playback.snapshot();
  state.route = "report";
  render();
}

app.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }
  const { action, practiceId, recordId } = button.dataset;
  button.disabled = true;
  try {
    if (action === "prepare") {
      await demoPlayer.stop();
      state.practice = findPractice(practiceId);
      state.route = "prepare";
      render();
    } else if (action === "preview") {
      const practice = findPractice(practiceId);
      button.textContent = "试听中…";
      await demoPlayer.play(practice);
      render();
    } else if (action === "begin-practice") {
      await startPractice(state.practice);
    } else if (action === "cancel") {
      await sessionController.abort();
      state.route = "prepare";
      render();
    } else if (action === "stop") {
      await sessionController.stop("user");
    } else if (action === "retry") {
      if (isActivePractice(state.practice)) {
        await startPractice(state.practice);
      } else {
        state.practice = ACTIVE_PRACTICES[0];
        state.route = "prepare";
        render();
      }
    } else if (action === "home") {
      stopPlaybackAnimation();
      playback.unload();
      await demoPlayer.stop();
      if (
        ["requesting_permission", "calibrating", "countdown", "running"].includes(
          sessionController.snapshot().state,
        )
      ) {
        await sessionController.abort();
      }
      state.route = "home";
      await refreshHistory();
      render();
    } else if (action === "history") {
      await refreshHistory();
      state.route = "history";
      render();
    } else if (action === "play") {
      if (playback.currentRecordId !== state.session.record.id) {
        playback.load(state.session.record);
      }
      if (playback.snapshot().state === "playing") {
        playback.pause();
        updatePlaybackSurface();
      } else {
        await playback.play();
        updatePlaybackSurface();
      }
    } else if (action === "open-history") {
      await openRecord(recordId);
    } else if (action === "delete-current") {
      playback.prepareForDelete(state.session.record.id);
      await repository.delete(state.session.record.id);
      await refreshHistory();
      state.route = "home";
      render();
    } else if (action === "delete-history") {
      playback.prepareForDelete(recordId);
      await repository.delete(recordId);
      await refreshHistory();
      render();
    } else if (action === "clear-history") {
      playback.unload();
      await repository.clear();
      await refreshHistory();
      render();
    }
  } finally {
    if (button.isConnected) {
      button.disabled = false;
    }
  }
});

document.addEventListener("visibilitychange", () => {
  handlePageVisibility({
    hidden: document.hidden,
    sessionState: sessionController.snapshot().state,
    stop: (reason) => sessionController.stop(reason),
    abort: () => sessionController.abort(),
  })
    .then((outcome) => {
      if (outcome === "aborted") {
        state.route = "home";
        render();
      }
    })
    .catch(render);
});

window.addEventListener("beforeunload", () => {
  playback.unload();
  demoPlayer.stop();
  if (
    ["requesting_permission", "calibrating", "countdown", "running"].includes(
      sessionController.snapshot().state,
    )
  ) {
    sessionController.abort();
  }
});

refreshHistory().finally(render);
