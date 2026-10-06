import type { BookCatalog, CatalogBook, CatalogRequestOptions, Isbn13 } from '@fandex/core';

import { RequestSpacer } from './request-spacer.js';

/** A BookCatalog whose calls start at least `minIntervalMs` apart (Open Library: 3/s). */
export class RateLimitedCatalog implements BookCatalog {
  private readonly spacer: RequestSpacer;

  constructor(
    private readonly inner: BookCatalog,
    minIntervalMs: number,
    now?: () => number,
  ) {
    this.spacer = new RequestSpacer(minIntervalMs, now);
  }

  search(query: string, options?: CatalogRequestOptions): Promise<CatalogBook[]> {
    return this.spacer.run(() => this.inner.search(query, options));
  }

  lookupIsbn(isbn: Isbn13, options?: CatalogRequestOptions): Promise<CatalogBook | null> {
    return this.spacer.run(() => this.inner.lookupIsbn(isbn, options));
  }
}
