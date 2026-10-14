import {
  catalogSearchResponseSchema,
  type CatalogFigure,
  type CatalogRequestOptions,
} from '@fandex/core';

import type { ApiFetch } from './api-fetch';
import { toCatalogFigure } from './catalog-mapping';
import { requestCatalog } from './catalog-request';

/** Fandex's shared figure catalog (curated Hot Toys and InArt figures). Public: guests too. */
export type FigureCatalog = {
  /** By name, character or box number ("MMS 279"); best matches first. */
  searchFigures(query: string, options?: CatalogRequestOptions): Promise<CatalogFigure[]>;
};

export class ApiFigureCatalog implements FigureCatalog {
  constructor(private readonly apiFetch: ApiFetch) {}

  async searchFigures(
    query: string,
    options: CatalogRequestOptions = {},
  ): Promise<CatalogFigure[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const response = await requestCatalog(
      this.apiFetch,
      `/catalog/search?q=${encodeURIComponent(q)}&kind=figures`,
      options,
    );
    const { items } = catalogSearchResponseSchema.parse(await response.json());
    return items.flatMap((item) => {
      const figure = toCatalogFigure(item);
      return figure ? [figure] : [];
    });
  }
}
