import { catalogItemSchema } from '@fandex/core';

import { toCatalogBook, toCatalogSet } from '@/services/catalog-mapping';

const book = catalogItemSchema.parse({
  id: '0199b5a0-0000-7000-8000-000000000001',
  category: 'book',
  source: 'openlibrary',
  externalId: 'OL1M',
  title: 'The Hobbit',
  creators: ['J.R.R. Tolkien'],
  universes: ['middle-earth'],
  characters: [{ universe: 'middle-earth', character: 'gandalf' }],
});

describe('catalog mapping', () => {
  it('keeps the universe links, so a guest collection knows its universes', () => {
    expect(toCatalogBook(book)).toMatchObject({
      universes: ['middle-earth'],
      characters: [{ universe: 'middle-earth', character: 'gandalf' }],
    });
  });

  it('leaves out empty links (and parses payloads from servers without them)', () => {
    const { universes: _u, characters: _c, ...old } = book;
    const parsed = catalogItemSchema.parse({
      ...old,
      category: 'lego',
      source: 'rebrickable',
      setNumber: '1',
    });

    const set = toCatalogSet(parsed);

    expect(set).not.toHaveProperty('universes');
    expect(set).not.toHaveProperty('characters');
  });
});
