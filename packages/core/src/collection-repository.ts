import type { CatalogEntry } from './catalog-entry';
import type { CollectionItem, CollectionItemChanges } from './collection-item';
import type { Isbn13 } from './isbn';

/**
 * Persistence for the user's collection. Stage 1 implements it on-device (AsyncStorage);
 * Stage 2 swaps in an API-backed implementation without touching the screens.
 */
export interface CollectionRepository {
  /** All items, most recently added first. */
  list(): Promise<CollectionItem[]>;
  add(entry: CatalogEntry): Promise<CollectionItem>;
  /** Removes an item; does nothing if the id doesn't exist. */
  remove(id: string): Promise<void>;
  /** Fixes an item's category or universe links; rejects if the item doesn't exist. */
  update(id: string, changes: CollectionItemChanges): Promise<CollectionItem>;
  findByIsbn(isbn: Isbn13): Promise<CollectionItem | undefined>;
}
