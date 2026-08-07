const MIME_TYPES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"];

export class Recorder {
  #MediaRecorder;

  #chunks = [];

  #completion = null;

  #mediaRecorder = null;

  #mimeTypes;

  #rejectCompletion = null;

  #state = "idle";

  constructor({ MediaRecorderCtor = globalThis.MediaRecorder, mimeTypes = MIME_TYPES } = {}) {
    this.#MediaRecorder = MediaRecorderCtor;
    this.#mimeTypes = mimeTypes;
  }

  get state() {
    return this.#state;
  }

  get mediaRecorderForTests() {
    return this.#mediaRecorder;
  }

  start(stream) {
    if (this.#state === "recording" || this.#state === "stopping") {
      throw new Error("recording already active");
    }
    if (!this.#MediaRecorder) {
      throw new Error("MediaRecorder is unavailable in this browser");
    }
    const mimeType = this.#mimeTypes.find((type) => this.#MediaRecorder.isTypeSupported(type));
    if (!mimeType) {
      throw new Error("this browser has no supported recording format");
    }

    this.#chunks = [];
    this.#completion = null;
    this.#rejectCompletion = null;
    this.#mediaRecorder = new this.#MediaRecorder(stream, { mimeType });
    this.#mediaRecorder.addEventListener("dataavailable", (event) => {
      if ((this.#state === "recording" || this.#state === "stopping") && event.data?.size > 0) {
        this.#chunks.push(event.data);
      }
    });
    this.#mediaRecorder.start();
    this.#state = "recording";
  }

  stop() {
    if (this.#completion) {
      return this.#completion;
    }
    if (this.#state !== "recording" || !this.#mediaRecorder) {
      return Promise.reject(new Error("no active recording"));
    }

    const mediaRecorder = this.#mediaRecorder;
    this.#state = "stopping";
    this.#completion = new Promise((resolve, reject) => {
      this.#rejectCompletion = reject;
      mediaRecorder.addEventListener(
        "stop",
        () => {
          if (this.#state !== "stopping") {
            return;
          }
          const mimeType = mediaRecorder.mimeType;
          const audioBlob = new Blob(this.#chunks, { type: mimeType });
          this.#rejectCompletion = null;
          this.#state = "complete";
          resolve({ audioBlob, mimeType });
        },
        { once: true },
      );
      mediaRecorder.addEventListener(
        "error",
        (event) => {
          if (this.#state !== "stopping") {
            return;
          }
          this.#rejectCompletion = null;
          this.#state = "error";
          reject(event.error ?? new Error("recording failed"));
        },
        { once: true },
      );
    });
    mediaRecorder.stop();
    return this.#completion;
  }

  abort() {
    const rejectCompletion = this.#rejectCompletion;
    this.#rejectCompletion = null;
    this.#chunks = [];
    this.#state = "idle";
    rejectCompletion?.(new DOMException("recording aborted", "AbortError"));
    if (this.#mediaRecorder?.state === "recording") {
      this.#mediaRecorder.stop();
    }
  }
}
