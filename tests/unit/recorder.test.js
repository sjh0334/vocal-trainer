import { describe, expect, it } from "vitest";

import { Recorder } from "../../src/audio/recorder.js";

class FakeMediaRecorder extends EventTarget {
  static supported = new Set(["audio/webm;codecs=opus"]);

  static isTypeSupported(type) {
    return FakeMediaRecorder.supported.has(type);
  }

  constructor(stream, options) {
    super();
    this.stream = stream;
    this.mimeType = options.mimeType;
    this.state = "inactive";
    this.stopCalls = 0;
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.stopCalls += 1;
    this.state = "inactive";
  }

  emitChunk(value = "audio") {
    const event = new Event("dataavailable");
    Object.defineProperty(event, "data", {
      value: new Blob([value], { type: this.mimeType }),
    });
    this.dispatchEvent(event);
  }

  finish() {
    this.dispatchEvent(new Event("stop"));
  }
}

describe("Recorder", () => {
  it("chooses a supported MIME type and produces one Blob", async () => {
    const recorder = new Recorder({ MediaRecorderCtor: FakeMediaRecorder });
    recorder.start({ id: "stream" });
    const mediaRecorder = recorder.mediaRecorderForTests;
    const resultPromise = recorder.stop();
    mediaRecorder.emitChunk();
    mediaRecorder.finish();

    await expect(resultPromise).resolves.toMatchObject({
      mimeType: "audio/webm;codecs=opus",
    });
    expect((await resultPromise).audioBlob).toBeInstanceOf(Blob);
  });

  it("makes concurrent stop calls share one completion", async () => {
    const recorder = new Recorder({ MediaRecorderCtor: FakeMediaRecorder });
    recorder.start({ id: "stream" });
    const mediaRecorder = recorder.mediaRecorderForTests;

    const first = recorder.stop();
    const second = recorder.stop();
    expect(first).toBe(second);
    expect(mediaRecorder.stopCalls).toBe(1);
    mediaRecorder.emitChunk();
    mediaRecorder.finish();
    await first;
  });

  it("rejects a second start and unsupported browsers", () => {
    const recorder = new Recorder({ MediaRecorderCtor: FakeMediaRecorder });
    recorder.start({ id: "stream" });
    expect(() => recorder.start({ id: "other" })).toThrow(/already/i);

    class Unsupported extends FakeMediaRecorder {
      static isTypeSupported() {
        return false;
      }
    }
    expect(() => new Recorder({ MediaRecorderCtor: Unsupported }).start({})).toThrow(/format/i);
  });

  it("defers a missing browser MediaRecorder error until the user starts", () => {
    const recorder = new Recorder({ MediaRecorderCtor: undefined });

    expect(() => recorder.start({})).toThrow(/MediaRecorder is unavailable/i);
  });
});
