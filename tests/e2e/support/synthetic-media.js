export function installSyntheticMedia() {
  const sampleRate = 48_000;

  function sineFrame(sequence) {
    const samples = new Float32Array(2048);
    for (let index = 0; index < samples.length; index += 1) {
      const absoluteIndex = sequence * 512 + index;
      samples[index] = Math.sin((2 * Math.PI * 261.63 * absoluteIndex) / sampleRate) * 0.3;
    }
    return samples;
  }

  function wavBlob(seconds, mimeType) {
    const wavSampleRate = 8_000;
    const sampleCount = wavSampleRate * seconds;
    const buffer = new ArrayBuffer(44 + sampleCount * 2);
    const view = new DataView(buffer);
    const writeText = (offset, value) => {
      for (const [index, character] of [...value].entries()) {
        view.setUint8(offset + index, character.charCodeAt(0));
      }
    };
    writeText(0, "RIFF");
    view.setUint32(4, 36 + sampleCount * 2, true);
    writeText(8, "WAVE");
    writeText(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, wavSampleRate, true);
    view.setUint32(28, wavSampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeText(36, "data");
    view.setUint32(40, sampleCount * 2, true);
    for (let index = 0; index < sampleCount; index += 1) {
      const sample = Math.sin((2 * Math.PI * 261.63 * index) / wavSampleRate) * 0.25;
      view.setInt16(44 + index * 2, Math.round(sample * 32767), true);
    }
    return new Blob([buffer], { type: mimeType });
  }

  class SyntheticPort extends EventTarget {
    postMessage() {}

    start() {}
  }

  class SyntheticAudioWorkletNode {
    constructor(context) {
      this.context = context;
      this.port = new SyntheticPort();
      this.sequence = 0;
      this.timer = setInterval(() => {
        const samples = sineFrame(this.sequence);
        this.port.dispatchEvent(
          new MessageEvent("message", {
            data: {
              sequence: this.sequence,
              timestampMs: this.context.currentTime * 1000,
              sampleRate,
              samples,
            },
          }),
        );
        this.sequence += 1;
      }, 32);
    }

    connect() {}

    disconnect() {
      clearInterval(this.timer);
    }
  }

  class SyntheticAudioContext {
    constructor() {
      this.startedAt = performance.now();
      this.state = "running";
      this.destination = {};
      this.audioWorklet = { addModule: async () => {} };
    }

    get currentTime() {
      return (performance.now() - this.startedAt) / 1000;
    }

    createGain() {
      return { gain: { value: 1 }, connect() {}, disconnect() {} };
    }

    createMediaStreamSource() {
      return { connect() {}, disconnect() {} };
    }

    async resume() {}

    async close() {
      this.state = "closed";
    }
  }

  class SyntheticMediaRecorder extends EventTarget {
    static isTypeSupported(type) {
      return type === "audio/webm;codecs=opus";
    }

    constructor(_stream, { mimeType }) {
      super();
      this.mimeType = mimeType;
      this.state = "inactive";
    }

    start() {
      this.state = "recording";
    }

    stop() {
      this.state = "inactive";
      queueMicrotask(() => {
        const dataEvent = new Event("dataavailable");
        Object.defineProperty(dataEvent, "data", { value: wavBlob(5, this.mimeType) });
        this.dispatchEvent(dataEvent);
        this.dispatchEvent(new Event("stop"));
      });
    }
  }

  const fakeStream = {
    getTracks: () => [{ stop() {} }],
  };
  globalThis.__syntheticGetUserMediaCalls = 0;
  navigator.mediaDevices.getUserMedia = async () => {
    globalThis.__syntheticGetUserMediaCalls += 1;
    return fakeStream;
  };
  globalThis.AudioContext = SyntheticAudioContext;
  globalThis.webkitAudioContext = SyntheticAudioContext;
  globalThis.AudioWorkletNode = SyntheticAudioWorkletNode;
  globalThis.MediaRecorder = SyntheticMediaRecorder;
}
