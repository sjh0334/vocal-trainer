import { describe, expect, it, vi } from "vitest";

import { PlaybackController } from "../../src/playback/playback-controller.js";

class FakeAudio extends EventTarget {
  constructor(url) {
    super();
    this.src = url;
    this.currentTime = 0;
    this.duration = 2;
    this.paused = true;
  }

  async play() {
    this.paused = false;
    this.dispatchEvent(new Event("play"));
  }

  pause() {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
}

function record(id = "session-1") {
  return {
    id,
    audioBlob: new Blob(["audio"], { type: "audio/webm" }),
    trajectory: [
      { timestampMs: 0, frequencyHz: 220 },
      { timestampMs: 500, frequencyHz: 221 },
      { timestampMs: 1000, frequencyHz: 222 },
    ],
  };
}

function setup() {
  const audios = [];
  const urlApi = {
    createObjectURL: vi.fn((blob) => `blob:${blob.size}:${audios.length}`),
    revokeObjectURL: vi.fn(),
  };
  const controller = new PlaybackController({
    urlApi,
    audioFactory: (url) => {
      const audio = new FakeAudio(url);
      audios.push(audio);
      return audio;
    },
  });
  return { audios, controller, urlApi };
}

describe("PlaybackController", () => {
  it("owns the object URL and projects playback time onto the trajectory", async () => {
    const { audios, controller, urlApi } = setup();
    controller.load(record());
    await controller.play();
    audios[0].currentTime = 0.62;

    expect(controller.snapshot()).toMatchObject({
      state: "playing",
      cursorMs: 620,
      trajectoryPoint: { timestampMs: 500, frequencyHz: 221 },
    });

    controller.unload();
    expect(controller.snapshot()).toEqual({ state: "idle", cursorMs: 0, trajectoryPoint: null });
    expect(urlApi.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("revokes the previous URL before loading another record", () => {
    const { controller, urlApi } = setup();
    controller.load(record("one"));
    controller.load(record("two"));

    expect(urlApi.createObjectURL).toHaveBeenCalledTimes(2);
    expect(urlApi.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(controller.currentRecordId).toBe("two");
  });

  it("stops and revokes playback before deletion", async () => {
    const { audios, controller, urlApi } = setup();
    controller.load(record());
    await controller.play();

    expect(controller.prepareForDelete("session-1")).toBe(true);
    expect(audios[0].paused).toBe(true);
    expect(urlApi.revokeObjectURL).toHaveBeenCalledOnce();
    expect(controller.currentRecordId).toBeNull();
  });
});
