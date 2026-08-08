const FRAME_SIZE = 2048;
const HOP_SIZE = 512;

class PitchCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(FRAME_SIZE);
    this.filled = 0;
    this.sequence = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) {
      return true;
    }
    for (const sample of channel) {
      this.buffer[this.filled] = sample;
      this.filled += 1;
      if (this.filled === FRAME_SIZE) {
        const frame = this.buffer.slice();
        this.port.postMessage(
          {
            sequence: this.sequence,
            timestampMs: currentTime * 1000,
            sampleRate,
            samples: frame,
          },
          [frame.buffer],
        );
        this.sequence += 1;
        this.buffer.copyWithin(0, HOP_SIZE);
        this.filled = FRAME_SIZE - HOP_SIZE;
      }
    }
    return true;
  }
}

registerProcessor("pitch-capture-processor", PitchCaptureProcessor);
