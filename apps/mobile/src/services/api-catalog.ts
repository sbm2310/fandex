import {
  catalogItemSchema,
  catalogSearchResponseSchema,
  type BookCatalog,
  type CatalogBook,
  type CatalogRequestOptions,
  type Isbn13,
} from '@fandex/core';

import type { ApiFetch } from './api-fetch';
import { toCatalogBook } from './catalog-mapping';
import { requestCatalog } from './catalog-request';

/**
 * The book catalog via the Fandex API, which queries Open Library, caches results in its
 * database and assigns our own ids. Implements the same interface the screens already use.
 */
export class ApiCatalog implements BookCatalog {
  constructor(private readonly apiFetch: ApiFetch) {}

  async search(query: string, options: CatalogRequestOptions = {}): Promise<CatalogBook[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const response = await requestCatalog(
      this.apiFetch,
      `/catalog/search?q=${encodeURIComponent(q)}`,
      options,
    );
    const { items } = catalogSearchResponseSchema.parse(await response.json());
    return items.flatMap((item) => {
      const book = toCatalogBook(item);
      return book ? [book] : [];
    });
  }

  async lookupIsbn(isbn: Isbn13, options: CatalogRequestOptions = {}): Promise<CatalogBook | null> {
    const response = await requestCatalog(this.apiFetch, `/catalog/isbn/${isbn}`, options, {
      allowNotFound: true,
    });
    if (response.status === 404) return null;
    return toCatalogBook(catalogItemSchema.parse(await response.json()));
  }
}
