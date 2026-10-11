/**
 * Collectible categories Fandex supports. Books, manga and comics come from Open Library,
 * LEGO from Rebrickable; figures are added by hand (no public catalog covers them).
 */
export const CATEGORIES = ['book', 'manga', 'comic', 'lego', 'figure'] as const;

export type Category = (typeof CATEGORIES)[number];

/** Categories that are printed books (identified by ISBN). */
export const BOOK_CATEGORIES = ['book', 'manga', 'comic'] as const satisfies readonly Category[];

export type BookCategory = (typeof BOOK_CATEGORIES)[number];

export function isBookCategory(value: string): value is BookCategory {
  return (BOOK_CATEGORIES as readonly string[]).includes(value);
}
