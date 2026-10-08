import { isSameEntry, type CatalogBook, type CollectionItem, type Isbn13 } from '@fandex/core';

/**
 * Rapid scanning: book after book with the camera open, each ISBN looked up as it's read and
 * listed (newest first) until the user adds them all. Pure functions over the list, so the
 * screen only wires the camera and the lookups to them.
 */

export type ScannedBook =
  | { isbn: Isbn13; status: 'looking-up' }
  | { isbn: Isbn13; status: 'found'; book: CatalogBook }
  | { isbn: Isbn13; status: 'not-found' }
  | { isbn: Isbn13; status: 'failed' };

export type LookupResult = { book: CatalogBook | null } | { error: unknown };

/**
 * A newly read ISBN goes to the top of the list, waiting for its lookup. Null when it's
 * already listed: the camera reads a barcode many times a second while it's in view.
 */
export function addScan(list: readonly ScannedBook[], isbn: Isbn13): ScannedBook[] | null {
  if (list.some((scanned) => scanned.isbn === isbn)) return null;
  return [{ isbn, status: 'looking-up' }, ...list];
}

/** Records a lookup's answer (ignored if the book was removed from the list meanwhile). */
export function settleScan(
  list: readonly ScannedBook[],
  isbn: Isbn13,
  result: LookupResult,
): ScannedBook[] {
  const settled: ScannedBook =
    'error' in result
      ? { isbn, status: 'failed' }
      : result.book
        ? { isbn, status: 'found', book: result.book }
        : { isbn, status: 'not-found' };
  return list.map((scanned) => (scanned.isbn === isbn ? settled : scanned));
}

/** Back to looking up, for "Try again" after a failed lookup. */
export function retryScan(list: readonly ScannedBook[], isbn: Isbn13): ScannedBook[] {
  return list.map((scanned) =>
    scanned.isbn === isbn ? { isbn, status: 'looking-up' as const } : scanned,
  );
}

export function removeScan(list: readonly ScannedBook[], isbn: Isbn13): ScannedBook[] {
  return list.filter((scanned) => scanned.isbn !== isbn);
}

/** Whether this edition is already in the collection. */
export function isOwned(book: CatalogBook, owned: readonly CollectionItem[]): boolean {
  return owned.some((item) => isSameEntry(item.catalog, book));
}

/**
 * The books "Add" will save, oldest scan first: found, not owned, and each edition once (two
 * ISBNs can resolve to the same Open Library edition).
 */
export function booksToAdd(
  list: readonly ScannedBook[],
  owned: readonly CollectionItem[],
): CatalogBook[] {
  const books: CatalogBook[] = [];
  for (const scanned of [...list].reverse()) {
    if (scanned.status !== 'found' || isOwned(scanned.book, owned)) continue;
    if (books.some((book) => isSameEntry(book, scanned.book))) continue;
    books.push(scanned.book);
  }
  return books;
}
