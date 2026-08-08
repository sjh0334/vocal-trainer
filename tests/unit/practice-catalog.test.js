import { describe, expect, it } from "vitest";

import { ACTIVE_PRACTICES, resolvePractice } from "../../src/exercises/practice-catalog.js";

describe("practice catalog", () => {
  it("offers only long tones while preserving legacy records for readback", () => {
    expect(ACTIVE_PRACTICES.map((practice) => practice.id)).toEqual([
      "long-tone-a3",
      "long-tone-c4",
      "long-tone-e4",
    ]);
    expect(resolvePractice("stepwise-warmup")).toMatchObject({ title: "五声音阶往返" });
    expect(resolvePractice("thirds-warmup")).toMatchObject({ title: "三度跳进短句" });
    expect(resolvePractice("missing")).toBeNull();
  });
});
