import type { CatalogBook } from './catalog-book';

/**
 * True if two catalog entries describe the same edition: same ISBN when both have one,
 * otherwise the same source record. Different sources can describe one book, which the
 * ISBN catches; books without ISBNs (old or rare editions) fall back to the source id.
 */
export function isSameBook(a: CatalogBook, b: CatalogBook): boolean {
  if (a.isbn13 && b.isbn13) return a.isbn13 === b.isbn13;
  return a.source === b.source && a.externalId === b.externalId;
}
