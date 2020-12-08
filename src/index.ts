import { Scheduler } from "fun-dispatcher";

export class TLRU<T> extends Map<string, T> {
  private maxStoreSize = 1000;
  private maxAgeMs = 12 * 60 * 60 * 1000; // 12 hours;
  private readonly scheduler = new Scheduler();
  private readonly disposer?: (obj: T) => void;

  private defaultLRU = false;

  constructor(
    options: {
      maxStoreSize?: number;
      maxAgeMs?: number;
      defaultLRU?: boolean;
      disposer?: (obj: T) => void;
    } = {}
  ) {
    super();
    if (options.maxAgeMs) this.maxAgeMs = options.maxAgeMs;
    if (options.maxStoreSize) this.maxStoreSize = options.maxStoreSize;
    if (options.defaultLRU) this.defaultLRU = true;
    if (options.disposer) this.disposer = options.disposer;
  }

  set(
    key: string,
    value: T,
    ttuMs = this.maxAgeMs + this.size /* to separate fast entries */
  ): this {
    if (this.size >= this.maxStoreSize) {
      // cleaning up old entries - this first all to be cleaned actually
      this.scheduler.runNext();
    }
    this.scheduler.schedule(
      key,
      () => {
        if (typeof this.disposer === "function" && super.has(key))
          this.disposer(super.get(key)!);
        super.delete(key);
      },
      ttuMs
    );
    return super.set(key, value);
  }

  get(key: string, revive = this.defaultLRU): T | undefined {
    if (this.has(key)) {
      // reset use time
      if (revive) {
        const original = this.scheduler.get(key);
        if (original)
          this.scheduler.schedule(
            key,
            () => super.delete(key),
            original.delay + super.size
          );
      }
      return super.get(key);
    }
    return undefined;
  }

  delete(key: string): boolean {
    this.scheduler.delete(key);
    return super.delete(key);
  }

  clear(): void {
    this.scheduler.flush();
    super.clear();
  }

  toJSON(): [string, T][] {
    return [...this].sort(([v], [v1]) => {
      const t1 = this.scheduler.get(v);
      const t2 = this.scheduler.get(v1);
      if (!t1) return -1;
      if (!t2) return 1;
      return t1.expiry - t2.expiry;
    });
  }
}
