import {
  catalogItemSchema,
  catalogSearchResponseSchema,
  type CatalogRequestOptions,
  type CatalogSet,
  type LegoCatalog,
} from '@fandex/core';

import type { ApiFetch } from './api-fetch';
import { toCatalogSet } from './catalog-mapping';
import { requestCatalog } from './catalog-request';

/** LEGO sets via the Fandex API (Rebrickable behind it, cached and rate-limited). */
export class ApiLegoCatalog implements LegoCatalog {
  constructor(private readonly apiFetch: ApiFetch) {}

  async searchSets(query: string, options: CatalogRequestOptions = {}): Promise<CatalogSet[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const response = await requestCatalog(
      this.apiFetch,
      `/catalog/search?q=${encodeURIComponent(q)}&kind=lego`,
      options,
    );
    const { items } = catalogSearchResponseSchema.parse(await response.json());
    return items.flatMap((item) => {
      const set = toCatalogSet(item);
      return set ? [set] : [];
    });
  }

  async lookupSet(setNum: string, options: CatalogRequestOptions = {}): Promise<CatalogSet | null> {
    const response = await requestCatalog(
      this.apiFetch,
      `/catalog/lego/${encodeURIComponent(setNum)}`,
      options,
      { allowNotFound: true },
    );
    if (response.status === 404) return null;
    return toCatalogSet(catalogItemSchema.parse(await response.json()));
  }
}
