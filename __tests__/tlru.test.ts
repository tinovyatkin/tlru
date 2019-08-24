import { TLRU } from '../src/index';

describe('Use TLRU as time sensitive cache', () => {
  afterEach(setImmediate);

  it('tlru proactively removes expired items', done => {
    const lru = new TLRU({ maxStoreSize: 4, maxAgeMs: 1000 });
    lru.set('a', 1, 500);
    lru.set('b', 2, 700);
    lru.set('c', 3); // default TTU = maxAgeMs

    setTimeout(() => {
      expect(lru.has('a')).toBeFalsy();
      expect(lru.has('b')).toBeTruthy();
      expect(lru.has('c')).toBeTruthy();
      expect(lru.size).toBe(2);
    }, 600);

    setTimeout(() => {
      expect(lru.has('b')).toBeFalsy();
      expect(lru.has('c')).toBeTruthy();
      expect(lru.size).toBe(1);
    }, 800);

    setTimeout(() => {
      expect(lru.get('c')).toBeUndefined();
      expect(lru.size).toBe(0);
      done();
    }, 1100);
  }, 1500);

  it('get is not affecting item TTU', done => {
    const lru = new TLRU({ maxStoreSize: 4, maxAgeMs: 1000 });
    lru.set('a', 1, 500);
    lru.set('b', 2, 700);
    lru.set('c', 3); // default TTU = maxAgeMs

    setTimeout(() => {
      expect(lru.has('a')).toBeFalsy();
      expect(lru.get('b')).toBe(2);
      expect(lru.has('c')).toBeTruthy();
      expect(lru.size).toBe(2);
    }, 600);

    setTimeout(() => {
      expect(lru.has('b')).toBeFalsy();
      expect(lru.has('c')).toBeTruthy();
      expect(lru.size).toBe(1);
      done();
    }, 800);
  }, 1500);

  it('item can be revived to original TTU on get', done => {
    const lru = new TLRU({ maxStoreSize: 4, maxAgeMs: 1000 });
    lru.set('a', 1, 500);
    lru.set('b', 2, 700);
    lru.set('c', 3); // default TTU = maxAgeMs

    setTimeout(() => {
      expect(lru.has('a')).toBeFalsy();
      expect(lru.get('b', true)).toBe(2); // 'b' get new 700 ms of life
      expect(lru.size).toBe(2);
    }, 600);

    setTimeout(() => {
      expect(lru.has('b')).toBeTruthy();
      expect(lru.has('c')).toBeFalsy(); // should be evicted by cache maxAgeMs default
      expect(lru.size).toBe(1);
    }, 1200);

    setTimeout(() => {
      expect(lru.size).toBe(0);
      done();
    }, 1500);
  }, 1600);
});
