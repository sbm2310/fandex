import type { CatalogBook } from './catalog-book';
import type { CatalogEntry } from './catalog-entry';
import type { CollectionItem } from './collection-item';

/**
 * True if two catalog entries describe the same edition: same ISBN when both have one,
 * otherwise the same source record. Different sources can describe one book, which the
 * ISBN catches; books without ISBNs (old or rare editions) fall back to the source id.
 */
export function isSameBook(a: CatalogBook, b: CatalogBook): boolean {
  if (a.isbn13 && b.isbn13) return a.isbn13 === b.isbn13;
  return a.source === b.source && a.externalId === b.externalId;
}

/** Same edition (books) or same set (LEGO: same Rebrickable set number, incl. version). */
export function isSameEntry(a: CatalogEntry, b: CatalogEntry): boolean {
  if (a.category !== 'lego' && b.category !== 'lego') return isSameBook(a, b);
  return a.source === b.source && a.externalId === b.externalId;
}

/**
 * Owned copies of the same book in other editions (another printing, translation or format
 * of the same Open Library work). Ownership stays per edition, so these aren't "owned" for
 * the entry itself; they're worth a hint ("You own another edition").
 */
export function findOtherEditions(
  entry: CatalogEntry,
  items: readonly CollectionItem[],
): CollectionItem[] {
  if (entry.category === 'lego' || !entry.workKey) return [];
  return items.filter(
    (item) =>
      item.category !== 'lego' &&
      item.catalog.workKey === entry.workKey &&
      !isSameBook(item.catalog, entry),
  );
}
