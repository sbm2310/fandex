import type { CollectionItem } from './collection-item';
import { sortCollection } from './sort-collection';

function item(title: string, addedAt: string, subtitle?: string): CollectionItem {
  return {
    id: title,
    category: 'book',
    addedAt,
    catalog: {
      source: 'openlibrary',
      externalId: title,
      category: 'book',
      title,
      authors: [],
      ...(subtitle && { subtitle }),
    },
  };
}

const titles = (items: CollectionItem[]) => items.map((i) => i.catalog.title);

describe('sortCollection', () => {
  const items = [
    item('The Hobbit', '2026-10-01T00:00:00Z'),
    item('dune', '2026-10-03T00:00:00Z'),
    item('A Game of Thrones', '2026-10-02T00:00:00Z'),
    item('Mistborn', '2026-10-04T00:00:00Z'),
  ];

  it('sorts by most recently added', () => {
    expect(titles(sortCollection(items, 'recent'))).toEqual([
      'Mistborn',
      'dune',
      'A Game of Thrones',
      'The Hobbit',
    ]);
  });

  it('sorts by title, ignoring leading articles and case', () => {
    expect(titles(sortCollection(items, 'title'))).toEqual([
      'dune',
      'A Game of Thrones',
      'The Hobbit',
      'Mistborn',
    ]);
  });

  it('compares numbers in titles naturally and uses subtitles to break ties', () => {
    const series = [
      item('Saga', '2026-01-01T00:00:00Z', 'Volume 10'),
      item('Saga', '2026-01-02T00:00:00Z', 'Volume 2'),
      item('Saga', '2026-01-03T00:00:00Z', 'Volume 1'),
    ];

    expect(
      sortCollection(series, 'title').map((i) =>
        i.category === 'lego' ? undefined : i.catalog.subtitle,
      ),
    ).toEqual(['Volume 1', 'Volume 2', 'Volume 10']);
  });

  it('does not mutate the input', () => {
    const copy = [...items];
    sortCollection(items, 'title');
    expect(items).toEqual(copy);
  });
});
