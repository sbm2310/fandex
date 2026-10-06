import type { CatalogBook, BookSource } from './catalog-book';
import { parseIsbn, type Isbn13 } from './isbn';
import type { CatalogSet } from './catalog-set';
import { createCollectionItem } from './collection-item';
import { findOtherEditions, isSameBook, isSameEntry } from './same-book';

const isbn = (value: string) => parseIsbn(value) as Isbn13;
// Only Open Library exists today; matching must keep working once more sources are added.
const otherSource = 'another-catalog' as BookSource;
const book = (overrides: Partial<CatalogBook>): CatalogBook => ({
  source: 'openlibrary',
  externalId: 'OL1M',
  category: 'book',
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

describe('isSameEntry', () => {
  const falcon: CatalogSet = {
    source: 'rebrickable',
    externalId: '75192-1',
    category: 'lego',
    title: 'Millennium Falcon',
    setNumber: '75192',
  };

  it('matches the same LEGO set number', () => {
    expect(isSameEntry(falcon, { ...falcon, title: 'renamed' })).toBe(true);
  });

  it('treats another version of a set as different', () => {
    expect(isSameEntry(falcon, { ...falcon, externalId: '75192-2' })).toBe(false);
  });

  it('never matches a set with a book', () => {
    expect(isSameEntry(falcon, book({ externalId: '75192-1' }))).toBe(false);
  });

  it('matches books like isSameBook', () => {
    expect(isSameEntry(book({}), book({}))).toBe(true);
  });
});

describe('findOtherEditions', () => {
  const hardcover = book({
    externalId: 'OL1M',
    isbn13: isbn('9780547928227'),
    workKey: 'OL27482W',
  });
  const paperback = book({
    externalId: 'OL2M',
    isbn13: isbn('9780345339683'),
    workKey: 'OL27482W',
  });
  const owned = (catalog: CatalogBook) =>
    createCollectionItem(catalog, { id: catalog.externalId, now: new Date('2026-10-06') });

  it('finds owned copies of the same work in other editions', () => {
    expect(findOtherEditions(paperback, [owned(hardcover)]).map((item) => item.id)).toEqual([
      'OL1M',
    ]);
  });

  it('ignores the same edition, other works, and entries without a work key', () => {
    const otherWork = book({ externalId: 'OL3M', isbn13: isbn('9780306406157'), workKey: 'OL1W' });
    const { workKey: _workKey, ...unknownWork } = paperback;

    expect(findOtherEditions(hardcover, [owned(hardcover)])).toEqual([]);
    expect(findOtherEditions(paperback, [owned(otherWork)])).toEqual([]);
    expect(findOtherEditions(unknownWork, [owned(hardcover)])).toEqual([]);
  });
});
