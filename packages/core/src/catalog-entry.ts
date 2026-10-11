import type { CatalogBook } from './catalog-book';
import type { CatalogFigure } from './catalog-figure';
import type { CatalogSet } from './catalog-set';

/** Anything Fandex can hold: a book (incl. manga and comics), a LEGO set, or a figure. */
export type CatalogEntry = CatalogBook | CatalogSet | CatalogFigure;

/** Books, manga and comics: the entries with authors, ISBNs and editions. */
export function isBookEntry(entry: CatalogEntry): entry is CatalogBook {
  return entry.category !== 'lego' && entry.category !== 'figure';
}
