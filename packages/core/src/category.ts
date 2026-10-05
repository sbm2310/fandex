/**
 * Collectible categories Fandex supports. Books, manga and comics come from Open Library;
 * LEGO arrives with its own catalog. Figures will follow.
 */
export const CATEGORIES = ['book', 'manga', 'comic', 'lego'] as const;

export type Category = (typeof CATEGORIES)[number];

/** Categories that are printed books (identified by ISBN). */
export const BOOK_CATEGORIES = ['book', 'manga', 'comic'] as const satisfies readonly Category[];

export type BookCategory = (typeof BOOK_CATEGORIES)[number];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
