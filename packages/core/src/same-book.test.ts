import type { CatalogBook, CatalogSource } from './catalog-book';
import { parseIsbn, type Isbn13 } from './isbn';
import { isSameBook } from './same-book';

const isbn = (value: string) => parseIsbn(value) as Isbn13;
// Only Open Library exists today; matching must keep working once more sources are added.
const otherSource = 'another-catalog' as CatalogSource;
const book = (overrides: Partial<CatalogBook>): CatalogBook => ({
  source: 'openlibrary',
  externalId: 'OL1M',
  title: 'T',
  authors: [],
  ...overrides,
});

describe('isSameBook', () => {
  it('matches the same ISBN from different sources', () => {
    expect(
      isSameBook(
        book({ isbn13: isbn('9780306406157') }),
        book({ source: otherSource, externalId: 'abc', isbn13: isbn('9780306406157') }),
      ),
    ).toBe(true);
  });

  it('treats different ISBNs as different editions even with the same source id', () => {
    expect(
      isSameBook(book({ isbn13: isbn('9780306406157') }), book({ isbn13: isbn('9780804429573') })),
    ).toBe(false);
  });

  it('falls back to source and id when an ISBN is missing', () => {
    expect(isSameBook(book({}), book({ isbn13: isbn('9780306406157') }))).toBe(true);
    expect(isSameBook(book({}), book({ externalId: 'OL2M' }))).toBe(false);
    expect(isSameBook(book({}), book({ source: otherSource }))).toBe(false);
  });
});
