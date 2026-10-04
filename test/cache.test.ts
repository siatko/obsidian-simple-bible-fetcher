import { describe, expect, it, vi } from "vitest";
import { CacheStorage, JsonCache } from "../src/cache";

interface MemoryStorage extends CacheStorage {
  writes: string[];
  failNextWrite: boolean;
  readError: boolean;
}

function createStorage(initial: string | null = null): MemoryStorage {
  let value = initial;
  return {
    writes: [],
    failNextWrite: false,
    readError: false,
    async read() {
      if (this.readError) throw new Error("read failed");
      return value;
    },
    async write(data: string) {
      if (this.failNextWrite) {
        this.failNextWrite = false;
        throw new Error("write failed");
      }
      value = data;
      this.writes.push(data);
    },
  };
}

describe("JsonCache", () => {
  it("stores and returns values by key", () => {
    const cache = new JsonCache(createStorage());
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
    cache.set("a", { value: 1 });
    expect(cache.get("a")).toEqual({ value: 1 });
    expect(cache.size).toBe(1);
  });

  it("persists entries with a schema version on flush", async () => {
    const storage = createStorage();
    const cache = new JsonCache(storage);
    cache.set("url", [1, 2, 3]);
    await cache.flush();

    expect(storage.writes).toHaveLength(1);
    expect(JSON.parse(storage.writes[0])).toEqual({
      schemaVersion: 1,
      entries: { url: [1, 2, 3] },
    });
  });

  it("loads previously persisted entries", async () => {
    const storage = createStorage(
      JSON.stringify({ schemaVersion: 1, entries: { url: ["a"] } })
    );
    const cache = new JsonCache(storage);
    await cache.load();
    expect(cache.get("url")).toEqual(["a"]);
  });

  it("ignores a cache written with a different schema version", async () => {
    const storage = createStorage(
      JSON.stringify({ schemaVersion: 999, entries: { url: ["a"] } })
    );
    const cache = new JsonCache(storage);
    await cache.load();
    expect(cache.size).toBe(0);
  });

  it("ignores corrupt cache content", async () => {
    const storage = createStorage("{not json");
    const cache = new JsonCache(storage);
    await cache.load();
    expect(cache.size).toBe(0);
  });

  it("ignores read errors", async () => {
    const storage = createStorage();
    storage.readError = true;
    const cache = new JsonCache(storage);
    await expect(cache.load()).resolves.toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("does not write when nothing changed", async () => {
    const storage = createStorage();
    const cache = new JsonCache(storage);
    await cache.flush();
    expect(storage.writes).toHaveLength(0);
  });

  it("saves automatically after a delay", async () => {
    vi.useFakeTimers();
    try {
      const storage = createStorage();
      const cache = new JsonCache(storage);
      cache.set("url", "x");
      expect(storage.writes).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1500);
      expect(storage.writes).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps data dirty when a write fails so it can retry", async () => {
    const storage = createStorage();
    const cache = new JsonCache(storage);
    cache.set("url", "x");
    storage.failNextWrite = true;
    await cache.flush();
    expect(storage.writes).toHaveLength(0);

    await cache.flush();
    expect(storage.writes).toHaveLength(1);
    expect(JSON.parse(storage.writes[0]).entries).toEqual({ url: "x" });
  });
});
