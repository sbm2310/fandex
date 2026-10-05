import type { BookCatalog, CatalogBook, CatalogRequestOptions, Isbn13 } from '@fandex/core';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wraps a BookCatalog so calls start at least `minIntervalMs` apart. All users' searches now
 * come from this server, so this keeps us within Open Library's limit (3 requests/second for
 * identified apps).
 */
export class RateLimitedCatalog implements BookCatalog {
  private nextSlot = 0;

  constructor(
    private readonly inner: BookCatalog,
    private readonly minIntervalMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  async search(query: string, options?: CatalogRequestOptions): Promise<CatalogBook[]> {
    await this.waitForSlot();
    return this.inner.search(query, options);
  }

  async lookupIsbn(isbn: Isbn13, options?: CatalogRequestOptions): Promise<CatalogBook | null> {
    await this.waitForSlot();
    return this.inner.lookupIsbn(isbn, options);
  }

  /** Reserves the next start time synchronously, so concurrent callers queue up in order. */
  private async waitForSlot(): Promise<void> {
    const now = this.now();
    const slot = Math.max(now, this.nextSlot);
    this.nextSlot = slot + this.minIntervalMs;
    if (slot > now) await sleep(slot - now);
  }
}
