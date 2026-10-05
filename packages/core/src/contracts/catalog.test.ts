import {
  catalogItemSchema,
  catalogSearchKindSchema,
  catalogSearchQuerySchema,
  isbnParamSchema,
  setNumberParamSchema,
} from './catalog';

describe('catalog contracts', () => {
  it('normalizes ISBN path parameters to ISBN-13', () => {
    expect(isbnParamSchema.parse('0-345-44560-0')).toBe('9780345445605');
    expect(isbnParamSchema.safeParse('9780345445606').success).toBe(false);
  });

  it('trims search queries and enforces 2–200 characters', () => {
    expect(catalogSearchQuerySchema.parse('  hobbit ')).toBe('hobbit');
    expect(catalogSearchQuerySchema.safeParse(' h ').success).toBe(false);
    expect(catalogSearchQuerySchema.safeParse('x'.repeat(201)).success).toBe(false);
  });

  it('describes a catalog item with optional fields left out', () => {
    expect(
      catalogItemSchema.parse({
        id: '0199b5a0-7c1e-7a3b-9f00-1234567890ab',
        category: 'manga',
        source: 'openlibrary',
        externalId: 'OL1M',
        title: 'One Piece',
        creators: ['Eiichiro Oda'],
      }),
    ).toMatchObject({ category: 'manga' });
  });

  it('defaults the search kind to books and accepts lego', () => {
    expect(catalogSearchKindSchema.parse(undefined)).toBe('books');
    expect(catalogSearchKindSchema.parse('lego')).toBe('lego');
    expect(catalogSearchKindSchema.safeParse('vinyl').success).toBe(false);
  });

  it('normalizes set numbers', () => {
    expect(setNumberParamSchema.parse('75192')).toBe('75192-1');
    expect(setNumberParamSchema.safeParse('millennium falcon').success).toBe(false);
  });
});
