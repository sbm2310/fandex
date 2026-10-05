import type { CatalogBook } from './catalog-book';
import type { BookCategory } from './category';

/**
 * A copy the user owns. It keeps a snapshot of the catalog data so the collection renders
 * even if the source changes or is unreachable.
 *
 * Books, manga and comics for now (copied from the catalog entry); LEGO will join as a
 * discriminated union on `category`.
 */
export type CollectionItem = {
  id: string;
  category: BookCategory;
  catalog: CatalogBook;
  /** ISO 8601 timestamp; a string so items round-trip through JSON storage unchanged. */
  addedAt: string;
  notes?: string;
};

/** Builds a new collection item. The id and clock are passed in so callers (and tests) control them. */
export function createCollectionItem(
  catalog: CatalogBook,
  { id, now }: { id: string; now: Date },
): CollectionItem {
  return { id, category: catalog.category, catalog, addedAt: now.toISOString() };
}
