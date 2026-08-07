import { indexedDB } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";

import { SessionRepository } from "../../src/storage/session-repository.js";

const repositories = [];

function makeRepository(name = `vocal-trainer-test-${crypto.randomUUID()}`) {
  const repository = new SessionRepository({ indexedDB, dbName: name });
  repositories.push(repository);
  return repository;
}

function record(id = "session-1", createdAt = "2026-08-08T00:00:00.000Z") {
  return {
    id,
    schemaVersion: 1,
    practiceId: "stepwise-warmup",
    practiceVersion: 1,
    createdAt,
    durationMs: 2400,
    mimeType: "audio/webm;codecs=opus",
    audioBlob: new Blob(["audio"], { type: "audio/webm;codecs=opus" }),
    trajectory: [{ timestampMs: 100, frequencyHz: 220, voiced: true }],
    report: { scorerVersion: 1, status: "scored", totalScore: 88 },
  };
}

afterEach(async () => {
  await Promise.all(repositories.splice(0).map((repository) => repository.destroyForTests()));
});

describe("SessionRepository", () => {
  it("round-trips one complete record and retains it across reopen", async () => {
    const dbName = `vocal-trainer-test-${crypto.randomUUID()}`;
    const first = makeRepository(dbName);
    await first.save(record());
    first.close();

    const reopened = makeRepository(dbName);
    const stored = await reopened.get("session-1");

    expect(stored).toMatchObject({
      id: "session-1",
      practiceVersion: 1,
      report: { totalScore: 88 },
    });
    expect(stored.audioBlob).toBeInstanceOf(Blob);
    expect(stored).not.toHaveProperty("expiresAt");
  });

  it("sorts the complete history newest first", async () => {
    const repository = makeRepository();
    await repository.save(record("older", "2026-08-07T00:00:00.000Z"));
    await repository.save(record("newer", "2026-08-08T00:00:00.000Z"));

    expect((await repository.list()).map((item) => item.id)).toEqual(["newer", "older"]);
  });

  it("rejects an incomplete record without leaving partial data", async () => {
    const repository = makeRepository();
    const incomplete = record();
    delete incomplete.audioBlob;

    await expect(repository.save(incomplete)).rejects.toThrow(/audioBlob/);
    await expect(repository.get("session-1")).resolves.toBeNull();
  });

  it("does not persist a save cancelled before its transaction starts", async () => {
    const repository = makeRepository();
    const cancellation = new AbortController();

    const saving = repository.save(record(), { signal: cancellation.signal });
    const rejected = expect(saving).rejects.toMatchObject({ name: "AbortError" });
    cancellation.abort();

    await rejected;
    await expect(repository.get("session-1")).resolves.toBeNull();
  });

  it("deletes one record or clears all records", async () => {
    const repository = makeRepository();
    await repository.save(record("one"));
    await repository.save(record("two"));

    await repository.delete("one");
    expect(await repository.get("one")).toBeNull();
    expect(await repository.get("two")).not.toBeNull();

    await repository.clear();
    expect(await repository.list()).toEqual([]);
  });
});
