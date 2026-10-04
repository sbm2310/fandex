import type { CatalogBook } from './catalog-book';
import { createCollectionItem } from './collection-item';
import { parseIsbn, type Isbn13 } from './isbn';

function isbn(value: string): Isbn13 {
  const parsed = parseIsbn(value);
  if (!parsed) throw new Error(`Invalid test ISBN: ${value}`);
  return parsed;
}

const hobbit: CatalogBook = {
  source: 'openlibrary',
  externalId: 'OL26331930M',
  title: 'The Hobbit',
  authors: ['J.R.R. Tolkien'],
  isbn13: isbn('9780547928227'),
};

describe('createCollectionItem', () => {
  it('wraps the catalog book with the given id and an ISO timestamp', () => {
    const item = createCollectionItem(hobbit, {
      id: 'item-1',
      now: new Date('2026-10-04T12:00:00Z'),
    });

    expect(item).toEqual({
      id: 'item-1',
      category: 'book',
      catalog: hobbit,
      addedAt: '2026-10-04T12:00:00.000Z',
    });
  });

  it('survives a JSON round trip unchanged', () => {
    const item = createCollectionItem(hobbit, { id: 'item-1', now: new Date() });

    expect(JSON.parse(JSON.stringify(item))).toEqual(item);
  });
});
