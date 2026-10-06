import {
  CollectionStorageError,
  collectionItemSchema,
  collectionResponseSchema,
  isBookCategory,
  type CatalogEntry,
  type CollectionItem,
  type CollectionItemChanges,
  type CollectionItemResponse,
  type CollectionRepository,
  type Isbn13,
} from '@fandex/core';

import type { ApiFetch } from './api-fetch';
import { toCatalogEntry } from './catalog-mapping';

/** The signed-in user's collection, stored by the Fandex API (synced across devices). */
export class ApiCollectionRepository implements CollectionRepository {
  constructor(private readonly apiFetch: ApiFetch) {}

  async list(): Promise<CollectionItem[]> {
    const response = await this.request('/collection');
    const { items } = collectionResponseSchema.parse(await response.json());
    return items.flatMap((item) => {
      const collectionItem = toCollectionItem(item);
      return collectionItem ? [collectionItem] : [];
    });
  }

  async add(entry: CatalogEntry): Promise<CollectionItem> {
    if (!entry.catalogId) {
      throw new CollectionStorageError(`"${entry.title}" has no catalog id, so it can't be synced`);
    }
    const response = await this.request('/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catalogItemId: entry.catalogId }),
    });
    const item = toCollectionItem(collectionItemSchema.parse(await response.json()));
    if (!item) throw new CollectionStorageError('The server returned an item the app cannot show');
    return item;
  }

  /** Removes an item; one that's already gone (404) counts as removed. */
  async remove(id: string): Promise<void> {
    await this.request(`/collection/${encodeURIComponent(id)}`, { method: 'DELETE' }, [404]);
  }

  async update(id: string, changes: CollectionItemChanges): Promise<CollectionItem> {
    const response = await this.request(`/collection/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
    const item = toCollectionItem(collectionItemSchema.parse(await response.json()));
    if (!item) throw new CollectionStorageError('The server returned an item the app cannot show');
    return item;
  }

  async findByIsbn(isbn: Isbn13): Promise<CollectionItem | undefined> {
    return (await this.list()).find(
      (item) => item.category !== 'lego' && item.catalog.isbn13 === isbn,
    );
  }

  private async request(path: string, init: RequestInit = {}, acceptable: number[] = []) {
    let response: Response;
    try {
      response = await this.apiFetch(path, init);
    } catch (error) {
      throw new CollectionStorageError("Can't reach the Fandex server", { cause: error });
    }
    if (!response.ok && !acceptable.includes(response.status)) {
      throw new CollectionStorageError(`Collection request failed (${response.status})`);
    }
    return response;
  }
}

function toCollectionItem(item: CollectionItemResponse): CollectionItem | null {
  const catalog = toCatalogEntry(item.catalog);
  if (!catalog) return null;
  const base = {
    id: item.id,
    addedAt: item.addedAt,
    ...(item.notes && { notes: item.notes }),
    ...(item.linkEdits && { linkEdits: item.linkEdits }),
  };
  if (catalog.category === 'lego') return { ...base, category: 'lego', catalog };
  // The user's corrected category, if any (older servers don't send one).
  const category =
    item.category && isBookCategory(item.category) ? item.category : catalog.category;
  return { ...base, category, catalog };
}
