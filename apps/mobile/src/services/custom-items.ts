import { catalogItemSchema, trimmed, type CatalogFigure, type NewFigure } from '@fandex/core';

import type { ApiFetch } from './api-fetch';
import { toCatalogFigure } from './catalog-mapping';

/** Figures added by hand, saved on the Fandex API (signed in). Guests make them on the device. */
export type CustomItems = {
  createFigure(figure: NewFigure): Promise<CatalogFigure>;
};

export class CustomItemError extends Error {
  override readonly name = 'CustomItemError';
}

export class ApiCustomItems implements CustomItems {
  constructor(private readonly apiFetch: ApiFetch) {}

  async createFigure(figure: NewFigure): Promise<CatalogFigure> {
    const response = await this.apiFetch('/catalog/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Only the figure's own fields (a device entry also carries ids and links).
      body: JSON.stringify(trimmed(figure)),
    }).catch((error: unknown) => {
      throw new CustomItemError("Can't reach the Fandex server", { cause: error });
    });
    if (!response.ok) throw new CustomItemError(`Saving the figure failed (${response.status})`);
    const entry = toCatalogFigure(catalogItemSchema.parse(await response.json()));
    if (!entry) throw new CustomItemError('The server returned an item the app cannot show');
    return entry;
  }
}
