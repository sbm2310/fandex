import type { CatalogBook } from './catalog-book';
import { isBookEntry, type CatalogEntry } from './catalog-entry';
import { isBookItem, type CollectionItem } from './collection-item';

/**
 * True if two catalog entries describe the same edition: same ISBN when both have one,
 * otherwise the same source record. Different sources can describe one book, which the
 * ISBN catches; books without ISBNs (old or rare editions) fall back to the source id.
 */
export function isSameBook(a: CatalogBook, b: CatalogBook): boolean {
  if (a.isbn13 && b.isbn13) return a.isbn13 === b.isbn13;
  return a.source === b.source && a.externalId === b.externalId;
}

/** Same edition (books), same set (LEGO: set number incl. version) or the same figure. */
export function isSameEntry(a: CatalogEntry, b: CatalogEntry): boolean {
  if (isBookEntry(a) && isBookEntry(b)) return isSameBook(a, b);
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
  if (!isBookEntry(entry) || !entry.workKey) return [];
  return items.filter(
    (item) =>
      isBookItem(item) &&
      item.catalog.workKey === entry.workKey &&
      !isSameBook(item.catalog, entry),
  );
}
