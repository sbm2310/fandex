import { addToCollectionRequestSchema, collectionItemSchema } from './collection';

describe('collection contracts', () => {
  it('requires a UUID catalog item id to add', () => {
    expect(addToCollectionRequestSchema.safeParse({ catalogItemId: 'not-a-uuid' }).success).toBe(
      false,
    );
    expect(
      addToCollectionRequestSchema.safeParse({
        catalogItemId: '0199b5a0-7c1e-7a3b-9f00-1234567890ab',
      }).success,
    ).toBe(true);
  });

  it('embeds the catalog entry in an owned item', () => {
    const item = collectionItemSchema.parse({
      id: '0199b5a0-7c1e-7a3b-9f00-1234567890ab',
      addedAt: '2026-10-05T10:00:00.000Z',
      catalog: {
        id: '0199b5a0-7c1e-7a3b-9f00-1234567890ac',
        category: 'book',
        source: 'openlibrary',
        externalId: 'OL1M',
        title: 'Dune',
        creators: ['Frank Herbert'],
      },
    });

    expect(item.catalog.title).toBe('Dune');
  });
});
