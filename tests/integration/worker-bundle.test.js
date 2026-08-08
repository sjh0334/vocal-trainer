import { readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { afterEach, describe, expect, it } from "vitest";

const outDir = join(tmpdir(), `vocal-trainer-build-${crypto.randomUUID()}`);

afterEach(async () => {
  await rm(outDir, { recursive: true, force: true });
});

describe("production worker bundle", () => {
  it("emits the pitch worker with all of its imports resolved", async () => {
    await build({
      logLevel: "silent",
      build: { outDir, emptyOutDir: true },
    });

    const assets = await readdir(join(outDir, "assets"));
    expect(assets.some((name) => name.startsWith("pitch-worker-") && name.endsWith(".js"))).toBe(
      true,
    );
  });
});
