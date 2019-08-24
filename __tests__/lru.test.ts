import { TLRU } from '../src/index';

describe('Use TLRU as LRU', () => {
  afterEach(setImmediate);

  it('clear() sets the cache to its initial state', () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 2 });

    const json1 = JSON.stringify(lru);

    lru.set('foo', 'bar');
    lru.clear();
    const json2 = JSON.stringify(lru);

    expect(json2).toBe(json1);
  });

  it("setting keys doesn't grow past max size", async () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 3 });
    expect(lru.size).toBe(0);
    lru.set('foo1', 'bar1');
    expect(lru.size).toBe(1);
    lru.set('foo2', 'bar2');
    expect(lru.size).toBe(2);
    lru.set('foo3', 'bar3');
    expect(lru.size).toBe(3);

    lru.set('foo4', 'bar4');
    await new Promise(resolve => setImmediate(resolve));
    expect(lru.size).toBe(3);
  });

  it('setting keys returns `this`', () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 2 });
    expect(lru.set('foo', 'bar')).toBeInstanceOf(TLRU);
    expect(lru.set('foo1', 'bar1').size).toBe(2);
  });

  it('lru invariant is maintained for set()', async () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 2 });

    lru.set('foo1', 'bar1');
    lru.set('foo2', 'bar2');
    lru.set('foo3', 'bar3');
    lru.set('foo4', 'bar4');

    await new Promise(resolve => setImmediate(resolve));

    expect([...lru.keys()]).toEqual(['foo3', 'foo4']);
  });

  it('overwriting a key updates the value', () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 2 });
    lru.set('foo1', 'bar1');
    expect(lru.get('foo1')).toBe('bar1');
    lru.set('foo1', 'bar2');
    expect(lru.get('foo1')).toBe('bar2');
  });

  it('lru invariant is maintained for get()', async () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 2 });

    lru.set('foo1', 'bar1');
    lru.set('foo2', 'bar2');
    expect(lru.size).toBe(2);

    lru.get('foo1'); // now foo2 should be deleted instead of foo1

    lru.set('foo3', 'bar3');

    await new Promise(resolve => setImmediate(resolve));

    expect(lru.size).toBe(2);
    expect([...lru.keys()]).toEqual(['foo1', 'foo3']);
  });

  it('lru invariant is maintained after set(), get() and remove()', async () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 2 });
    lru.set('a', 1);
    lru.set('b', 2);
    expect(lru.get('a')).toBe(1);
    lru.delete('a');
    lru.set('c', 1);
    lru.set('d', 1);

    await new Promise(resolve => setImmediate(resolve));
    expect([...lru.keys()]).toEqual(['c', 'd']);
  });

  it('lru invariant is maintained in the corner case size == 1', async () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 1 });

    lru.set('foo1', 'bar1');
    lru.set('foo2', 'bar2');

    lru.get('foo2'); // now foo2 should be deleted instead of foo1

    lru.set('foo3', 'bar3');

    await new Promise(resolve => setImmediate(resolve));
    expect([...lru.keys()]).toEqual(['foo3']);
  });

  it('get() returns item value', () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 2 });
    lru.set('foo', 'bar');
    expect(lru.get('foo')).toBe('bar');
  });

  it('get() with revieve=false returns item value without changing the order', async () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 2 });
    lru.set('foo', 'bar');
    lru.set('bar', 'baz');
    expect(lru.get('foo', false)).toEqual('bar');
    lru.set('baz', 'foo');

    await new Promise(resolve => setImmediate(resolve));
    expect(lru.get('foo')).toBeUndefined();
  });

  it('get respects max age', async () => {
    const lru = new TLRU({ defaultLRU: true, maxAgeMs: 5 });
    lru.set('foo', 'bar');
    expect(lru.get('foo')).toBe('bar');
    await new Promise(resolve => setTimeout(resolve, 100));
    //   'the entry is removed if age > max_age'
    expect(lru.has('foo')).toBeFalsy();
  }, 300);

  it('evicting items by age', async () => {
    const lru = new TLRU({ defaultLRU: true, maxAgeMs: 5 });
    lru.set('foo', 'bar');
    expect(lru.get('foo')).toBe('bar');
    await new Promise(resolve => setTimeout(resolve, 100));
    // 'the entry is removed if age > max_age': function(lru) {
    expect(lru.get('foo')).toBeUndefined();
  });

  it('evicting items by age (2)', async () => {
    const lru = new TLRU({ defaultLRU: true, maxAgeMs: 100000 });
    lru.set('foo', 'bar');
    expect(lru.get('foo')).toBe('bar');
    await new Promise(resolve => setTimeout(resolve, 100));
    // the entry is not removed if age < max_age': function(lru) {
    expect(lru.get('foo')).toBe('bar');
  });
});

describe('idempotent changes', () => {
  afterEach(setImmediate);

  it('set() and remove() on empty LRU is idempotent', () => {
    const lru = new TLRU({ defaultLRU: true });
    const json1 = JSON.stringify(lru);

    lru.set('foo1', 'bar1');
    lru.delete('foo1');
    const json2 = JSON.stringify(lru);

    expect(json2).toBe(json1);
  });

  it('2 set()s and 2 remove()s on empty LRU is idempotent', () => {
    const lru = new TLRU({ defaultLRU: true });
    const json1 = JSON.stringify(lru);

    lru.set('foo1', 'bar1');
    lru.set('foo2', 'bar2');
    lru.delete('foo1');
    lru.delete('foo2');
    const json2 = JSON.stringify(lru);

    expect(json2).toBe(json1);
  });

  it('2 set()s and 2 remove()s (in opposite order) on empty LRU is idempotent', () => {
    const lru = new TLRU({ defaultLRU: true });
    const json1 = JSON.stringify(lru);

    lru.set('foo1', 'bar1');
    lru.set('foo2', 'bar2');
    lru.delete('foo2');
    lru.delete('foo1');
    const json2 = JSON.stringify(lru);

    expect(json2).toBe(json1);
  });

  it('after setting one key, get() is idempotent', () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 2 });
    lru.set('a', 'a');
    const json1 = JSON.stringify(lru);

    lru.get('a');
    const json2 = JSON.stringify(lru);

    expect(json2).toBe(json1);
  });

  it('after setting two keys, get() on last-set key is idempotent', () => {
    const lru = new TLRU({ defaultLRU: true, maxStoreSize: 2 });
    lru.set('a', 'a');
    lru.set('b', 'b');
    const json1 = JSON.stringify(lru);

    lru.get('b');
    const json2 = JSON.stringify(lru);

    expect(json2).toBe(json1);
  });
});
