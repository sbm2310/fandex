/**
 * ISBN parsing and validation.
 *
 * Fandex stores every ISBN as a normalized ISBN-13 (13 digits, no separators). `Isbn13` is a
 * branded string: the only way to get one is through `parseIsbn` (or `isValidIsbn13` as a type
 * guard), so an unvalidated string can't be passed where an ISBN is expected.
 */

declare const isbn13Brand: unique symbol;

/** A validated, normalized ISBN-13, e.g. `9780306406157`. */
export type Isbn13 = string & { readonly [isbn13Brand]: true };

/** Removes spaces and hyphens and upper-cases a trailing `x`. Does not validate. */
export function normalizeIsbn(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

/** True for a valid ISBN-10 (9 digits + check digit 0-9 or X). Accepts separators. */
export function isValidIsbn10(input: string): boolean {
  const isbn = normalizeIsbn(input);
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;

  // Weights 10..1; X stands for 10. A valid ISBN-10 sums to a multiple of 11.
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const char = isbn.charAt(i);
    const value = char === 'X' ? 10 : Number(char);
    sum += value * (10 - i);
  }
  return sum % 11 === 0;
}

/**
 * True for a valid book ISBN-13: 13 digits, a 978 or 979 prefix and a correct check digit.
 * 979-0 is excluded: that range is ISMN (printed music), not books. Accepts separators.
 */
export function isValidIsbn13(input: string): input is Isbn13 {
  const isbn = normalizeIsbn(input);
  if (!/^97[89]\d{10}$/.test(isbn) || isbn.startsWith('9790')) return false;
  return ean13CheckDigit(isbn.slice(0, 12)) === Number(isbn.charAt(12));
}

/** Converts a valid ISBN-10 to its ISBN-13 (978 prefix, recomputed check digit). */
export function isbn10To13(input: string): Isbn13 {
  if (!isValidIsbn10(input)) {
    throw new Error(`Not a valid ISBN-10: "${input}"`);
  }
  const first12 = `978${normalizeIsbn(input).slice(0, 9)}`;
  return `${first12}${ean13CheckDigit(first12)}` as Isbn13;
}

/**
 * True if the input has the shape of an ISBN (10 or 13 characters once separators are removed),
 * whether or not its check digit is right. Lets the UI tell "typo in an ISBN" from "a title".
 */
export function looksLikeIsbn(input: string): boolean {
  return /^(\d{9}[\dX]|\d{13})$/.test(normalizeIsbn(input));
}

/**
 * Parses user input or scanned barcode data into a normalized ISBN-13.
 * Accepts ISBN-10 or ISBN-13, with or without hyphens/spaces. Returns `null` if invalid.
 */
export function parseIsbn(input: string): Isbn13 | null {
  const isbn = normalizeIsbn(input);
  if (isValidIsbn13(isbn)) return isbn;
  if (isValidIsbn10(isbn)) return isbn10To13(isbn);
  return null;
}

/**
 * True if raw barcode data is a book ISBN. Book barcodes are EAN-13 codes in the 978/979
 * ("Bookland") range; other EAN-13 codes on the same shelf (DVDs, toys, music) are rejected.
 */
export function isBookBarcode(data: string): boolean {
  return /^\d{13}$/.test(data) && isValidIsbn13(data);
}

/** EAN-13 check digit for the first 12 digits: weights alternate 1, 3. */
function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(first12.charAt(i)) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}
