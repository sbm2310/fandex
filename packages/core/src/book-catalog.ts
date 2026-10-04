import type { CatalogBook } from './catalog-book';
import type { Isbn13 } from './isbn';

/** A searchable source of book data (Open Library, Google Books, ...). */
export interface BookCatalog {
  /** Free-text search by title, author, etc. */
  search(query: string): Promise<CatalogBook[]>;
  /** Exact lookup; resolves to `null` if the catalog doesn't know the ISBN. */
  lookupIsbn(isbn: Isbn13): Promise<CatalogBook | null>;
}
