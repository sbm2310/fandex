import type { CatalogBook } from './catalog-book';
import type { CatalogSet } from './catalog-set';

/** Anything the catalogs describe: a book (incl. manga and comics) or a LEGO set. */
export type CatalogEntry = CatalogBook | CatalogSet;

export function isCatalogSet(entry: CatalogEntry): entry is CatalogSet {
  return entry.category === 'lego';
}
