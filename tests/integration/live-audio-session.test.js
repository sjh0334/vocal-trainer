import { describe, expect, it, vi } from "vitest";

import { LiveAudioSession } from "../../src/audio/live-audio-session.js";

function message(data) {
  const event = new Event("message");
  Object.defineProperty(event, "data", { value: data });
  return event;
}

class FakePort extends EventTarget {
  start = vi.fn();
}

class FakeNode {
  constructor() {
    this.port = new FakePort();
    this.connect = vi.fn();
    this.disconnect = vi.fn();
  }
}

class FakeWorker extends EventTarget {
  postMessage = vi.fn();

  terminate = vi.fn();
}

function setup() {
  const track = new EventTarget();
  track.stop = vi.fn();
  const stream = { getTracks: () => [track] };
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const silentOutput = { gain: { value: 1 }, connect: vi.fn() };
  const context = {
    currentTime: 1.05,
    state: "running",
    destination: {},
    audioWorklet: { addModule: vi.fn(async () => {}) },
    createMediaStreamSource: vi.fn(() => source),
    createGain: vi.fn(() => silentOutput),
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {
      context.state = "closed";
    }),
  };
  const worker = new FakeWorker();
  const node = new FakeNode();
  const received = [];
  const times = [5_000, 5_070];
  const session = new LiveAudioSession({
    mediaDevices: { getUserMedia: vi.fn(async () => stream) },
    AudioContextCtor: vi.fn(() => context),
    workerFactory: () => worker,
    workletNodeFactory: () => node,
    performanceNow: () => times.shift(),
  });
  return { context, node, received, session, source, stream, track, worker };
}

describe("LiveAudioSession", () => {
  it("adds end-to-end processing latency and releases every owned resource", async () => {
    const { context, node, received, session, source, track, worker } = setup();
    await session.start({ sessionId: "session-a", onFrame: (frame) => received.push(frame) });
    const samples = Float32Array.from([0, 0.1, -0.1]);
    node.port.dispatchEvent(
      message({ sequence: 4, timestampMs: 1_000, sampleRate: 48_000, samples }),
    );
    const posted = worker.postMessage.mock.calls[0][0];
    expect(posted).toMatchObject({ sessionId: "session-a", capturedAtMs: 4_950 });
    worker.dispatchEvent(
      message({
        sessionId: "session-a",
        sequence: 4,
        timestampMs: 1_000,
        capturedAtMs: posted.capturedAtMs,
        frequencyHz: 220,
        midi: 57,
        confidence: 0.98,
        rms: 0.2,
        voiced: true,
      }),
    );
    expect(received[0]).toMatchObject({ latencyMs: 120 });

    await session.stop();

    expect(source.disconnect).toHaveBeenCalledOnce();
    expect(node.disconnect).toHaveBeenCalledOnce();
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it("forwards device loss but detaches the listener before an intentional stop", async () => {
    const { session, track } = setup();
    const onError = vi.fn();
    await session.start({ sessionId: "session-a", onFrame: vi.fn(), onError });

    track.dispatchEvent(new Event("ended"));
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0].message).toMatch(/microphone/i);

    await session.stop();
    track.dispatchEvent(new Event("ended"));
    expect(onError).toHaveBeenCalledOnce();
  });
});
