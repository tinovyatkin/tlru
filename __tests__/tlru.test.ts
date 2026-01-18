import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import { TLRU } from "../src/index.ts";

describe("Use TLRU as time sensitive cache", () => {
  afterEach(() => new Promise((resolve) => setImmediate(resolve)));

  it("tlru proactively removes expired items", { timeout: 1500 }, async () => {
    const lru = new TLRU({ maxStoreSize: 4, maxAgeMs: 1000 });
    lru.set("a", 1, 500);
    lru.set("b", 2, 700);
    lru.set("c", 3); // default TTU = maxAgeMs

    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.strictEqual(lru.has("a"), false);
    assert.strictEqual(lru.has("b"), true);
    assert.strictEqual(lru.has("c"), true);
    assert.strictEqual(lru.size, 2);

    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.strictEqual(lru.has("b"), false);
    assert.strictEqual(lru.has("c"), true);
    assert.strictEqual(lru.size, 1);

    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.strictEqual(lru.get("c"), undefined);
    assert.strictEqual(lru.size, 0);
  });

  it("get is not affecting item TTU", { timeout: 1500 }, async () => {
    const lru = new TLRU({ maxStoreSize: 4, maxAgeMs: 1000 });
    lru.set("a", 1, 500);
    lru.set("b", 2, 700);
    lru.set("c", 3); // default TTU = maxAgeMs

    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.strictEqual(lru.has("a"), false);
    assert.strictEqual(lru.get("b"), 2);
    assert.strictEqual(lru.has("c"), true);
    assert.strictEqual(lru.size, 2);

    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.strictEqual(lru.has("b"), false);
    assert.strictEqual(lru.has("c"), true);
    assert.strictEqual(lru.size, 1);
  });

  it("item can be revived to original TTU on get", { timeout: 1600 }, async () => {
    const lru = new TLRU({ maxStoreSize: 4, maxAgeMs: 1000 });
    lru.set("a", 1, 500);
    lru.set("b", 2, 700);
    lru.set("c", 3); // default TTU = maxAgeMs

    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.strictEqual(lru.has("a"), false);
    assert.strictEqual(lru.get("b", true), 2); // 'b' get new 700 ms of life
    assert.strictEqual(lru.size, 2);

    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.strictEqual(lru.has("b"), true);
    assert.strictEqual(lru.has("c"), false); // should be evicted by cache maxAgeMs default
    assert.strictEqual(lru.size, 1);

    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.strictEqual(lru.size, 0);
  });
});
