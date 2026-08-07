function defaultAudioFactory(url) {
  return new Audio(url);
}

function nearestPriorPoint(trajectory, cursorMs) {
  let result = null;
  for (const point of trajectory) {
    if (point.timestampMs > cursorMs) {
      break;
    }
    result = point;
  }
  return result;
}

export class PlaybackController {
  #audio = null;

  #audioFactory;

  #listeners = [];

  #record = null;

  #state = "idle";

  #url = null;

  #urlApi;

  constructor({ audioFactory = defaultAudioFactory, urlApi = URL } = {}) {
    this.#audioFactory = audioFactory;
    this.#urlApi = urlApi;
  }

  get currentRecordId() {
    return this.#record?.id ?? null;
  }

  get audioElement() {
    return this.#audio;
  }

  load(record) {
    if (!record || !(record.audioBlob instanceof Blob) || !Array.isArray(record.trajectory)) {
      throw new TypeError("a complete recorded session is required");
    }
    this.unload();
    this.#record = record;
    this.#url = this.#urlApi.createObjectURL(record.audioBlob);
    this.#audio = this.#audioFactory(this.#url);
    this.#listen("play", () => {
      this.#state = "playing";
    });
    this.#listen("pause", () => {
      if (this.#state !== "ended") {
        this.#state = "paused";
      }
    });
    this.#listen("ended", () => {
      this.#state = "ended";
    });
    this.#listen("error", () => {
      this.#state = "error";
    });
    this.#state = "ready";
  }

  #listen(event, listener) {
    this.#audio.addEventListener(event, listener);
    this.#listeners.push([event, listener]);
  }

  async play() {
    if (!this.#audio) {
      throw new Error("load a recording before playback");
    }
    await this.#audio.play();
    this.#state = "playing";
  }

  pause() {
    this.#audio?.pause();
  }

  snapshot() {
    if (!this.#audio || !this.#record) {
      return { state: "idle", cursorMs: 0, trajectoryPoint: null };
    }
    const cursorMs = Math.round(this.#audio.currentTime * 1000);
    return {
      state: this.#state,
      cursorMs,
      trajectoryPoint: nearestPriorPoint(this.#record.trajectory, cursorMs),
    };
  }

  prepareForDelete(recordId) {
    if (this.currentRecordId !== recordId) {
      return false;
    }
    this.unload();
    return true;
  }

  unload() {
    if (this.#audio) {
      for (const [event, listener] of this.#listeners) {
        this.#audio.removeEventListener(event, listener);
      }
      this.#listeners = [];
      this.#audio.pause();
      this.#audio.removeAttribute?.("src");
      this.#audio.load?.();
    }
    if (this.#url) {
      this.#urlApi.revokeObjectURL(this.#url);
    }
    this.#audio = null;
    this.#record = null;
    this.#url = null;
    this.#state = "idle";
  }
}
