const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Makes calls start at least `minIntervalMs` apart, queueing concurrent callers in order.
 * All users' searches come from this server, so this keeps us within each source's rate limit.
 */
export class RequestSpacer {
  private nextSlot = 0;

  constructor(
    private readonly minIntervalMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Runs `call` in the next free slot. */
  async run<T>(call: () => Promise<T>): Promise<T> {
    // Reserve the slot synchronously so concurrent callers get distinct, ordered slots.
    const now = this.now();
    const slot = Math.max(now, this.nextSlot);
    this.nextSlot = slot + this.minIntervalMs;
    if (slot > now) await sleep(slot - now);
    return call();
  }
}
