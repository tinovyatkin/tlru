[![codecov](https://codecov.io/gh/tinovyatkin/tlru/branch/master/graph/badge.svg)](https://codecov.io/gh/tinovyatkin/tlru)

# tlru

Time aware least recently used [TLRU](<https://en.wikipedia.org/wiki/Cache_replacement_policies#Time_aware_least_recently_used_(TLRU)>) cache for Node.JS

Small (~ 70 lines of TypeScript), fast (_extends_ native `Map` class, maintaining the same speed for `set`, `get` and `has` operations), memory efficient (don't uses an internal linked-list for LRU, but instead uses just one timer per class instance via [fun-dispatcher](https://github.com/tinovyatkin/fun-dispatcher) and proactively performs cache eviction - so great for caching large objects)

## Usage as LRU cache

TLRU may be seen as regular LRU cache where all cached items have the same `maxAge` as whole cache, and, effectively, this library can be used as efficient LRU cache:

```js
const { TLRU } = require("tlru");

const lru = new TLRU({ defaultLRU: true, maxStoreSize: 2 });

lru.set("a", 1);
lru.set("b", 2);
expect(lru.get("a")).toBe(1);
lru.delete("a");
lru.set("c", 1);
lru.set("d", 1);

// TLRU prunes cache lazily, so, need to give some time
setImmediate(() => {
  expect([...lru.keys()]).toEqual(["c", "d"]);
});

// Peek item without affecting it's LRU rating
lru.get("a", false /* this is the flag */);

// all native `Map` methods are here
lru.delete("a");
console.log([...lru.entries()]); // [[key, value], ...]

// Serializes to JSON, sorted by LRU rating
console.log(JSON.stringify(lru)); // [[key1, value1], [key2, value2], ...]
```

See more examples at `__tests__/lru.test.ts`

## Usage as TLRU

Each item in cache can have its own TTU (time to usage or time to live).

```js
const { TLRU } = require("tlru");

const lru = new TLRU({ maxStoreSize: 4, maxAgeMs: 1000 });

lru.set("a", 1, 500);
lru.set("b", 2, 700);
lru.set("c", 3); // default TTU = maxAgeMs

setTimeout(() => {
  expect(lru.has("a")).toBeFalsy();
  expect(lru.get("b")).toBe(2);
  expect(lru.has("c")).toBeTruthy();
  expect(lru.size).toBe(2);
}, 600);

setTimeout(() => {
  expect(lru.has("b")).toBeFalsy();
  expect(lru.has("c")).toBeTruthy();
  expect(lru.size).toBe(1);
}, 800);
```

Items can be revived to original TTU on getting, so, you will have LRU/TRLU hybrid:

```js
const { TLRU } = require("tlru");

const lru = new TLRU({ maxStoreSize: 4, maxAgeMs: 1000 });
lru.set("a", 1, 500);
lru.set("b", 2, 700);
lru.set("c", 3); // default TTU = maxAgeMs

setTimeout(() => {
  expect(lru.has("a")).toBeFalsy();
  expect(lru.get("b", true /* revive flag - reset TTU */)).toBe(2); // 'b' got new 700 ms of life
  expect(lru.size).toBe(2);
}, 600);

setTimeout(() => {
  expect(lru.has("b")).toBeTruthy();
  expect(lru.has("c")).toBeFalsy(); // should be evicted by cache maxAgeMs default
  expect(lru.size).toBe(1);
}, 1200);

setTimeout(() => {
  expect(lru.size).toBe(0);
}, 1500);
```
