import {
  catalogItemSchema,
  workSeriesResponseSchema,
  type BookSeries,
  type CatalogBook,
} from '@fandex/core';

import type { ApiFetch } from './api-fetch';
import { toCatalogBook } from './catalog-mapping';
import { requestCatalog } from './catalog-request';

/** The series of some works: a work missing from `series` has none, or isn't known yet. */
export type WorksSeries = {
  series: Map<string, BookSeries>;
  /** Works Wikidata couldn't be asked about yet (slow or busy): ask again shortly. */
  pending: Set<string>;
};

/** Book series (from Wikidata, cached by the Fandex API) and the books missing from them. */
export interface SeriesCatalog {
  seriesForWorks(workKeys: readonly string[]): Promise<WorksSeries>;
  /** An edition of a work, to add or pre-order; null if Open Library has none. */
  lookupWork(workKey: string): Promise<CatalogBook | null>;
}

export class ApiSeriesCatalog implements SeriesCatalog {
  constructor(private readonly apiFetch: ApiFetch) {}

  async seriesForWorks(workKeys: readonly string[]): Promise<WorksSeries> {
    const found = new Map<string, BookSeries>();
    const pending = new Set<string>();
    if (workKeys.length === 0) return { series: found, pending };
    const response = await requestCatalog(
      this.apiFetch,
      `/series/works?keys=${encodeURIComponent(workKeys.join(','))}`,
      {},
    );
    const { works, series } = workSeriesResponseSchema.parse(await response.json());
    const byId = new Map(series.map((s) => [s.wikidataId, s]));
    for (const work of works) {
      const match = work.seriesId ? byId.get(work.seriesId) : undefined;
      if (match) found.set(work.workKey, match);
      if (work.pending) pending.add(work.workKey);
    }
    return { series: found, pending };
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
