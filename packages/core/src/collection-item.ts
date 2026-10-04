import type { CatalogBook } from './catalog-book';
import type { Category } from './category';

/**
 * A copy the user owns. It keeps a snapshot of the catalog data so the collection renders
 * even if the source changes or is unreachable.
 *
 * Only books exist in Stage 1; other categories will join as a discriminated union on `category`.
 */
export type CollectionItem = {
  id: string;
  category: Extract<Category, 'book'>;
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
  return { id, category: 'book', catalog, addedAt: now.toISOString() };
}
