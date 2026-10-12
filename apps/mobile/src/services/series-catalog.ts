import {
  catalogItemSchema,
  workSeriesResponseSchema,
  type BookSeries,
  type CatalogBook,
} from '@fandex/core';

import type { ApiFetch } from './api-fetch';
import { toCatalogBook } from './catalog-mapping';
import { requestCatalog } from './catalog-request';

/** Book series (from Wikidata, cached by the Fandex API) and the books missing from them. */
export interface SeriesCatalog {
  /** Each work's series; a work missing from the map has none (or none known yet). */
  seriesForWorks(workKeys: readonly string[]): Promise<Map<string, BookSeries>>;
  /** An edition of a work, to add or pre-order; null if Open Library has none. */
  lookupWork(workKey: string): Promise<CatalogBook | null>;
}

export class ApiSeriesCatalog implements SeriesCatalog {
  constructor(private readonly apiFetch: ApiFetch) {}

  async seriesForWorks(workKeys: readonly string[]): Promise<Map<string, BookSeries>> {
    const found = new Map<string, BookSeries>();
    if (workKeys.length === 0) return found;
    const response = await requestCatalog(
      this.apiFetch,
      `/series/works?keys=${encodeURIComponent(workKeys.join(','))}`,
      {},
    );
    const { works, series } = workSeriesResponseSchema.parse(await response.json());
    const byId = new Map(series.map((s) => [s.wikidataId, s]));
    for (const { workKey, seriesId } of works) {
      const match = seriesId ? byId.get(seriesId) : undefined;
      if (match) found.set(workKey, match);
    }
    return found;
  }

  async lookupWork(workKey: string): Promise<CatalogBook | null> {
    const response = await requestCatalog(
      this.apiFetch,
      `/catalog/work/${workKey}`,
      {},
      {
        allowNotFound: true,
      },
    );
    if (response.status === 404) return null;
    return toCatalogBook(catalogItemSchema.parse(await response.json()));
  }
}
