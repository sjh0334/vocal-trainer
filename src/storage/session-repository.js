const DATABASE_VERSION = 1;
const STORE_NAME = "sessions";

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error), { once: true });
    transaction.addEventListener("error", () => reject(transaction.error), { once: true });
  });
}

function abortReason(signal) {
  return signal?.reason instanceof Error
    ? signal.reason
    : new DOMException("operation aborted", "AbortError");
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw abortReason(signal);
  }
}

function validateRecord(record) {
  if (!record || typeof record.id !== "string" || record.id === "") {
    throw new TypeError("record.id must be a non-empty string");
  }
  if (record.schemaVersion !== 1) {
    throw new TypeError("record.schemaVersion must be 1");
  }
  if (!(record.audioBlob instanceof Blob)) {
    throw new TypeError("record.audioBlob must be a Blob");
  }
  if (!Array.isArray(record.trajectory)) {
    throw new TypeError("record.trajectory must be an array");
  }
  if (!record.report || typeof record.report !== "object") {
    throw new TypeError("record.report is required");
  }
  if (!Number.isInteger(record.practiceVersion) || record.practiceVersion < 1) {
    throw new TypeError("record.practiceVersion must be a positive integer");
  }
}

export class SessionRepository {
  #databasePromise = null;

  #dbName;

  #indexedDB;

  constructor({ indexedDB = globalThis.indexedDB, dbName = "vocal-trainer" } = {}) {
    if (!indexedDB) {
      throw new Error("IndexedDB is unavailable in this browser");
    }
    this.#indexedDB = indexedDB;
    this.#dbName = dbName;
  }

  async #database() {
    if (!this.#databasePromise) {
      this.#databasePromise = new Promise((resolve, reject) => {
        const request = this.#indexedDB.open(this.#dbName, DATABASE_VERSION);
        request.addEventListener("upgradeneeded", () => {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
          }
        });
        request.addEventListener(
          "success",
          () => {
            request.result.addEventListener("versionchange", () => request.result.close());
            resolve(request.result);
          },
          { once: true },
        );
        request.addEventListener("error", () => reject(request.error), { once: true });
      });
    }
    return this.#databasePromise;
  }

  async save(record, { signal } = {}) {
    validateRecord(record);
    throwIfAborted(signal);
    const database = await this.#database();
    throwIfAborted(signal);
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const abortTransaction = () => {
      try {
        transaction.abort();
      } catch {
        // The transaction completed between the signal and this event handler.
      }
    };
    signal?.addEventListener("abort", abortTransaction, { once: true });
    try {
      transaction.objectStore(STORE_NAME).put(record);
      await transactionComplete(transaction);
    } catch (error) {
      if (signal?.aborted) {
        throw abortReason(signal);
      }
      throw error;
    } finally {
      signal?.removeEventListener("abort", abortTransaction);
    }
    return record.id;
  }

  async get(id) {
    const database = await this.#database();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const result = await requestResult(transaction.objectStore(STORE_NAME).get(id));
    return result ?? null;
  }

  async list() {
    const database = await this.#database();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const records = await requestResult(transaction.objectStore(STORE_NAME).getAll());
    return records.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async delete(id) {
    const database = await this.#database();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    await transactionComplete(transaction);
  }

  async clear() {
    const database = await this.#database();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).clear();
    await transactionComplete(transaction);
  }

  close() {
    if (this.#databasePromise) {
      this.#databasePromise.then((database) => database.close()).catch(() => {});
      this.#databasePromise = null;
    }
  }

  async destroyForTests() {
    this.close();
    await new Promise((resolve, reject) => {
      const request = this.#indexedDB.deleteDatabase(this.#dbName);
      request.addEventListener("success", () => resolve(), { once: true });
      request.addEventListener("error", () => reject(request.error), { once: true });
      request.addEventListener("blocked", () => reject(new Error("database deletion blocked")), {
        once: true,
      });
    });
  }
}
