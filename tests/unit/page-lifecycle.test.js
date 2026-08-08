import { describe, expect, it, vi } from "vitest";

import { handlePageVisibility } from "../../src/session/page-lifecycle.js";

describe("handlePageVisibility", () => {
  it("finalizes a running practice when the page becomes hidden", async () => {
    const stop = vi.fn(async () => {});
    const abort = vi.fn(async () => {});

    await expect(
      handlePageVisibility({ hidden: true, sessionState: "running", stop, abort }),
    ).resolves.toBe("finalized");
    expect(stop).toHaveBeenCalledWith("pageHidden");
    expect(abort).not.toHaveBeenCalled();
  });

  it("aborts preparation but ignores inactive or visible pages", async () => {
    const stop = vi.fn(async () => {});
    const abort = vi.fn(async () => {});

    await expect(
      handlePageVisibility({ hidden: true, sessionState: "calibrating", stop, abort }),
    ).resolves.toBe("aborted");
    await expect(
      handlePageVisibility({ hidden: false, sessionState: "running", stop, abort }),
    ).resolves.toBe("ignored");
    expect(abort).toHaveBeenCalledOnce();
    expect(stop).not.toHaveBeenCalled();
  });
});
