import type { BookCategory } from './category';
import type { Isbn13 } from './isbn';

/**
 * Where book data comes from: Open Library. Google Books was considered and rejected (its
 * terms forbid storing results and charging users).
 */
export type BookSource = 'openlibrary';

/** Every external catalog Fandex reads from: books and LEGO sets. */
export type CatalogSource = BookSource | 'rebrickable';

/**
 * A book as a catalog describes it: something that exists, whether or not the user owns it.
 * Adapters map each source's response into this shape.
 */
export type CatalogBook = {
  source: BookSource;
  /** The book's id in its source, e.g. an Open Library edition key (`OL22039557M`). */
  externalId: string;
  /** Book, manga or comic; derived from the catalog's subjects. */
  category: BookCategory;
  /** Our own catalog id, when the entry came through the Fandex API (cached in its database). */
  catalogId?: string;
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
