/**
 * A small in-memory cache with a time-to-live and a size cap (oldest entries evicted first).
 * Per process: fine for a single API instance; a shared cache (e.g. Redis) would replace it
 * if we ever run several.
 */
export class TtlCache<V> {
  private readonly entries = new Map<string, { value: V; expiresAt: number }>();

  constructor(
    private readonly options: { ttlMs: number; maxEntries: number; now?: () => number },
  ) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.options.ttlMs });
    while (this.entries.size > this.options.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }
}
