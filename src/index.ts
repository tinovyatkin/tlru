import { Scheduler } from 'fun-dispatcher';

export class TLRU extends Map<string, unknown> {
  private maxStoreSize = 1000;
  private maxAgeMs = 12 * 60 * 60 * 1000; // 12 hours;
  private scheduler = new Scheduler();

  private defaultLRU = false;

  constructor(
    options: {
      maxStoreSize?: number;
      maxAgeMs?: number;
      defaultLRU?: boolean;
    } = {}
  ) {
    super();
    if (options.maxAgeMs) this.maxAgeMs = options.maxAgeMs;
    if (options.maxStoreSize) this.maxStoreSize = options.maxStoreSize;
    if (options.defaultLRU) this.defaultLRU = true;
  }

  set(key: string, value: unknown, ttuMs = this.maxAgeMs) {
    if (this.size >= this.maxStoreSize) {
      // cleaning up old entries - this first all to be cleaned actually
      this.scheduler.runNext();
      // find a key with smallest expiry
      // const soonest = [...this.scheduler.entries()].reduce((prev, v) =>
      //   prev[1].expiry < v[1].expiry ? prev : v
      // );
      // super.delete(soonest[0]);
    }
    this.scheduler.schedule(
      key,
      () => super.delete(key),
      ttuMs + super.size /* to separate fast entries */
    );
    return super.set(key, value);
  }

  get(key: string, revive = this.defaultLRU): unknown | undefined {
    if (this.has(key)) {
      // reset use time
      if (revive) {
        const original = this.scheduler.get(key);
        if (original)
          this.scheduler.schedule(
            key,
            () => this.delete(key),
            original.delay + super.size
          );
      }
      return super.get(key);
    }
    return undefined;
  }

  clear() {
    this.scheduler.flush();
    super.clear();
  }

  toJSON() {
    return [...this].sort(([v], [v1]) => {
      const t1 = this.scheduler.get(v);
      const t2 = this.scheduler.get(v1);
      if (!t1) return -1;
      if (!t2) return 1;
      return t1.expiry - t2.expiry;
    });
  }
}
