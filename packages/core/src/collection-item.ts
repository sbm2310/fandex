import type { CatalogBook } from './catalog-book';
import type { CatalogEntry } from './catalog-entry';
import type { CatalogSet } from './catalog-set';
import type { BookCategory } from './category';

type CollectionItemBase = {
  id: string;
  /** ISO 8601 timestamp; a string so items round-trip through JSON storage unchanged. */
  addedAt: string;
  notes?: string;
};

/**
 * A copy the user owns. It keeps a snapshot of the catalog data so the collection renders
 * even if the source changes or is unreachable. A discriminated union on `category`: books
 * (incl. manga and comics) carry a CatalogBook, LEGO sets a CatalogSet.
 */
export type CollectionItem =
  | (CollectionItemBase & { category: BookCategory; catalog: CatalogBook })
  | (CollectionItemBase & { category: 'lego'; catalog: CatalogSet });

/** Builds a new collection item. The id and clock are passed in so callers (and tests) control them. */
export function createCollectionItem(
  catalog: CatalogEntry,
  { id, now }: { id: string; now: Date },
): CollectionItem {
  const addedAt = now.toISOString();
  return catalog.category === 'lego'
    ? { id, category: 'lego', catalog, addedAt }
    : { id, category: catalog.category, catalog, addedAt };
}
