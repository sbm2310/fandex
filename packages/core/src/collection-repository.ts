import type { CatalogBook } from './catalog-book';
import type { CollectionItem } from './collection-item';
import type { Isbn13 } from './isbn';

/**
 * Persistence for the user's collection. Stage 1 implements it on-device (AsyncStorage);
 * Stage 2 swaps in an API-backed implementation without touching the screens.
 */
export interface CollectionRepository {
  /** All items, most recently added first. */
  list(): Promise<CollectionItem[]>;
  add(book: CatalogBook): Promise<CollectionItem>;
  /** Removes an item; does nothing if the id doesn't exist. */
  remove(id: string): Promise<void>;
  findByIsbn(isbn: Isbn13): Promise<CollectionItem | undefined>;
}
