export class FrameAccumulator {
  #buffer = [];

  #frameSize;

  #hopSize;

  #onFrame;

  constructor({ frameSize = 2048, hopSize = 512, onFrame }) {
    if (hopSize > frameSize || hopSize < 1) {
      throw new RangeError("hopSize must be between 1 and frameSize");
    }
    this.#frameSize = frameSize;
    this.#hopSize = hopSize;
    this.#onFrame = onFrame;
  }

  push(samples) {
    this.#buffer.push(...samples);
    while (this.#buffer.length >= this.#frameSize) {
      this.#onFrame(Float32Array.from(this.#buffer.slice(0, this.#frameSize)));
      this.#buffer.splice(0, this.#hopSize);
    }
  }

  reset() {
    this.#buffer = [];
  }
}

function defaultWorkerFactory(url) {
  return new Worker(url, { type: "module" });
}

function defaultWorkletNodeFactory(context) {
  return new AudioWorkletNode(context, "pitch-capture-processor");
}

export class LiveAudioSession {
  #AudioContext;

  #context = null;

  #mediaDevices;

  #node = null;

  #source = null;

  #stream = null;

  #worker = null;

  #workerFactory;

  #workletNodeFactory;

  constructor({
    mediaDevices = globalThis.navigator?.mediaDevices,
    AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext,
    workerFactory = defaultWorkerFactory,
    workletNodeFactory = defaultWorkletNodeFactory,
  } = {}) {
    this.#mediaDevices = mediaDevices;
    this.#AudioContext = AudioContextCtor;
    this.#workerFactory = workerFactory;
    this.#workletNodeFactory = workletNodeFactory;
  }

  get stream() {
    return this.#stream;
  }

  get currentTimeMs() {
    return (this.#context?.currentTime ?? 0) * 1000;
  }

  async start({ sessionId, onFrame }) {
    if (this.#stream) {
      throw new Error("live audio session already active");
    }
    if (!this.#mediaDevices?.getUserMedia || !this.#AudioContext) {
      throw new Error("microphone audio APIs are unavailable in this browser");
    }

    try {
      this.#stream = await this.#mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      this.#context = new this.#AudioContext();
      await this.#context.audioWorklet.addModule(new URL("./audio-worklet.js", import.meta.url));
      this.#worker = this.#workerFactory(new URL("../pitch/pitch-worker.js", import.meta.url));
      this.#node = this.#workletNodeFactory(this.#context);
      this.#source = this.#context.createMediaStreamSource(this.#stream);
      const silentOutput = this.#context.createGain();
      silentOutput.gain.value = 0;
      this.#source.connect(this.#node);
      this.#node.connect(silentOutput);
      silentOutput.connect(this.#context.destination);

      this.#node.port.addEventListener("message", (event) => {
        const payload = { ...event.data, sessionId };
        this.#worker.postMessage(payload, [payload.samples.buffer]);
      });
      this.#node.port.start?.();
      this.#worker.addEventListener("message", (event) => onFrame(event.data));
      await this.#context.resume();
      return this.#stream;
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop() {
    this.#source?.disconnect();
    this.#node?.disconnect();
    this.#worker?.terminate();
    for (const track of this.#stream?.getTracks?.() ?? []) {
      track.stop();
    }
    if (this.#context && this.#context.state !== "closed") {
      await this.#context.close();
    }
    this.#context = null;
    this.#node = null;
    this.#source = null;
    this.#stream = null;
    this.#worker = null;
  }
}
