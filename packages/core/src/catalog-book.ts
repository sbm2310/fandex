import type { Isbn13 } from './isbn';

/**
 * External catalogs Fandex reads book data from. Open Library only for now: Google Books was
 * considered and rejected (its terms forbid storing results and charging users).
 */
export type CatalogSource = 'openlibrary';

/**
 * A book as a catalog describes it: something that exists, whether or not the user owns it.
 * Adapters map each source's response into this shape.
 */
export type CatalogBook = {
  source: CatalogSource;
  /** The book's id in its source, e.g. an Open Library edition key (`OL22039557M`). */
  externalId: string;
  title: string;
  subtitle?: string;
  authors: string[];
  publishedYear?: number;
  publisher?: string;
  isbn13?: Isbn13;
  coverUrl?: string;
};

/** The display title including the subtitle, e.g. "Mistborn: The Final Empire". */
export function formatTitle(book: Pick<CatalogBook, 'title' | 'subtitle'>): string {
  return book.subtitle ? `${book.title}: ${book.subtitle}` : book.title;
}
