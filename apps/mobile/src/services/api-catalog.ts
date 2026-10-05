import {
  CatalogError,
  catalogItemSchema,
  catalogSearchResponseSchema,
  type BookCatalog,
  type CatalogBook,
  type CatalogRequestOptions,
  type Isbn13,
} from '@fandex/core';

import type { ApiFetch } from './api-fetch';
import { toCatalogBook } from './catalog-mapping';

/**
 * The book catalog via the Fandex API, which queries Open Library, caches results in its
 * database and assigns our own ids. Implements the same interface the screens already use.
 */
export class ApiCatalog implements BookCatalog {
  constructor(private readonly apiFetch: ApiFetch) {}

  async search(query: string, options: CatalogRequestOptions = {}): Promise<CatalogBook[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const response = await this.request(`/catalog/search?q=${encodeURIComponent(q)}`, options);
    const { items } = catalogSearchResponseSchema.parse(await response.json());
    return items.flatMap((item) => {
      const book = toCatalogBook(item);
      return book ? [book] : [];
    });
  }

  async lookupIsbn(isbn: Isbn13, options: CatalogRequestOptions = {}): Promise<CatalogBook | null> {
    const response = await this.request(`/catalog/isbn/${isbn}`, options, { allowNotFound: true });
    if (response.status === 404) return null;
    return toCatalogBook(catalogItemSchema.parse(await response.json()));
  }

  private async request(
    path: string,
    { signal }: CatalogRequestOptions,
    { allowNotFound = false } = {},
  ): Promise<Response> {
    let response: Response;
    try {
      response = await this.apiFetch(path, signal ? { signal } : {});
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new CatalogError('fandex-api', 'network', 'Could not reach the Fandex API', undefined, {
        cause: error,
      });
    }
    if (response.ok || (allowNotFound && response.status === 404)) return response;
    if (response.status === 503 || response.status === 429) {
      throw new CatalogError('fandex-api', 'rate-limited', 'The catalog is busy', response.status);
    }
    throw new CatalogError(
      'fandex-api',
      'http',
      `Catalog request failed (${response.status})`,
      response.status,
    );
  }
}
