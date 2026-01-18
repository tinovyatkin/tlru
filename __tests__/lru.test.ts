import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import { TLRU } from "../src/index.ts";

describe("Use TLRU as LRU", () => {
  afterEach(() => new Promise((resolve) => setImmediate(resolve)));

  it("clear() sets the cache to its initial state", () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 2, maxAgeMs: 1000 });

    const json1 = JSON.stringify(lru);

    lru.set("foo", "bar");
    lru.clear();
    const json2 = JSON.stringify(lru);

    assert.strictEqual(json2, json1);
  });

  it("setting keys doesn't grow past max size", async () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 3, maxAgeMs: 1000 });
    assert.strictEqual(lru.size, 0);
    lru.set("foo1", "bar1");
    assert.strictEqual(lru.size, 1);
    lru.set("foo2", "bar2");
    assert.strictEqual(lru.size, 2);
    lru.set("foo3", "bar3");
    assert.strictEqual(lru.size, 3);

    lru.set("foo4", "bar4");
    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(lru.size, 3);
  });

  it("setting keys returns `this`", () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 2, maxAgeMs: 1000 });
    assert.ok(lru.set("foo", "bar") instanceof TLRU);
    assert.strictEqual(lru.set("foo1", "bar1").size, 2);
  });

  it("lru invariant is maintained for set()", async () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 2, maxAgeMs: 1000 });

    lru.set("foo1", "bar1");
    lru.set("foo2", "bar2");
    lru.set("foo3", "bar3");
    lru.set("foo4", "bar4");

    await new Promise((resolve) => setImmediate(resolve));
    assert.deepStrictEqual([...lru.keys()], ["foo3", "foo4"]);
  });

  it("overwriting a key updates the value", () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 2, maxAgeMs: 1000 });
    lru.set("foo1", "bar1");
    assert.strictEqual(lru.get("foo1"), "bar1");
    lru.set("foo1", "bar2");
    assert.strictEqual(lru.get("foo1"), "bar2");
  });

  it("lru invariant is maintained for get()", async () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 2, maxAgeMs: 1000 });

    lru.set("foo1", "bar1");
    lru.set("foo2", "bar2");
    assert.strictEqual(lru.size, 2);

    lru.get("foo1"); // now foo2 should be deleted instead of foo1

    lru.set("foo3", "bar3");

    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(lru.size, 2);
    assert.deepStrictEqual([...lru.keys()], ["foo1", "foo3"]);
  });

  it("lru invariant is maintained after set(), get() and delete()", async () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 2, maxAgeMs: 1000 });

    lru.set("a", 1);
    lru.set("b", 2);
    assert.strictEqual(lru.get("a"), 1);
    lru.delete("a");
    assert.strictEqual(lru.size, 1);
    lru.set("c", 1);
    lru.set("d", 1);

    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.deepStrictEqual([...lru.keys()], ["c", "d"]);
  });

  it("lru invariant is maintained in the corner case size == 1", async () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 1, maxAgeMs: 1000 });

    lru.set("foo1", "bar1");
    lru.set("foo2", "bar2");

    lru.get("foo2"); // now foo2 should be deleted instead of foo1

    lru.set("foo3", "bar3");

    await new Promise((resolve) => setImmediate(resolve));
    assert.deepStrictEqual([...lru.keys()], ["foo3"]);
  });

  it("get() returns item value", () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 2, maxAgeMs: 1000 });
    lru.set("foo", "bar");
    assert.strictEqual(lru.get("foo"), "bar");
  });

  it("get() with revive=false returns item value without changing the order", async () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 2, maxAgeMs: 1000 });
    lru.set("foo", "bar");
    lru.set("bar", "baz");
    assert.strictEqual(lru.get("foo", false), "bar");
    lru.set("baz", "foo");

    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(lru.get("foo"), undefined);
  });

  it("get respects max age", { timeout: 300 }, async () => {
    const lru = new TLRU({ defaultLRU: true, maxAgeMs: 5 });
    lru.set("foo", "bar");
    assert.strictEqual(lru.get("foo"), "bar");
    await new Promise((resolve) => setTimeout(resolve, 100));
    //   'the entry is removed if age > max_age'
    assert.strictEqual(lru.has("foo"), false);
  });

  it("evicting items by age", async () => {
    const lru = new TLRU({ defaultLRU: true, maxAgeMs: 5 });
    lru.set("foo", "bar");
    assert.strictEqual(lru.get("foo"), "bar");
    await new Promise((resolve) => setTimeout(resolve, 100));
    // 'the entry is removed if age > max_age': function(lru) {
    assert.strictEqual(lru.get("foo"), undefined);
  });

  it("evicting items by age (2)", async () => {
    const lru = new TLRU({ defaultLRU: true, maxAgeMs: 100000 });
    lru.set("foo", "bar");
    assert.strictEqual(lru.get("foo"), "bar");
    await new Promise((resolve) => setTimeout(resolve, 100));
    // the entry is not removed if age < max_age': function(lru) {
    assert.strictEqual(lru.get("foo"), "bar");
    lru.clear();
  });
});

describe("idempotent changes", () => {
  afterEach(() => new Promise((resolve) => setImmediate(resolve)));

  it("set() and remove() on empty LRU is idempotent", () => {
    const lru = new TLRU({ defaultLRU: true, maxAgeMs: 500 });
    const json1 = JSON.stringify(lru);

    lru.set("foo1", "bar1");
    lru.delete("foo1");
    const json2 = JSON.stringify(lru);

    assert.strictEqual(json2, json1);
  });

  it("2 set()s and 2 remove()s on empty LRU is idempotent", () => {
    const lru = new TLRU({ defaultLRU: true, maxAgeMs: 500 });
    const json1 = JSON.stringify(lru);

    lru.set("foo1", "bar1");
    lru.set("foo2", "bar2");
    lru.delete("foo1");
    lru.delete("foo2");
    const json2 = JSON.stringify(lru);

    assert.strictEqual(json2, json1);
  });

  it("2 set()s and 2 remove()s (in opposite order) on empty LRU is idempotent", () => {
    const lru = new TLRU({ defaultLRU: true, maxAgeMs: 500 });
    const json1 = JSON.stringify(lru);

    lru.set("foo1", "bar1");
    lru.set("foo2", "bar2");
    lru.delete("foo2");
    lru.delete("foo1");
    const json2 = JSON.stringify(lru);

    assert.strictEqual(json2, json1);
  });

  it("after setting one key, get() is idempotent", () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 2, maxAgeMs: 500 });
    lru.set("a", "a");
    const json1 = JSON.stringify(lru);

    lru.get("a");
    const json2 = JSON.stringify(lru);

    assert.strictEqual(json2, json1);
  });

  it("after setting two keys, get() on last-set key is idempotent", () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 2, maxAgeMs: 500 });
    lru.set("a", "a");
    lru.set("b", "b");
    const json1 = JSON.stringify(lru);

    lru.get("b");
    const json2 = JSON.stringify(lru);

    assert.strictEqual(json2, json1);
  });
});
