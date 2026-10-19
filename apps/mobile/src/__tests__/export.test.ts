import {
  createCollectionItem,
  type CatalogFigure,
  type CollectionItem,
  type PreorderResponse,
} from '@fandex/core';

import { linkedFalcon, linkedHobbit } from '@/test-utils/providers';
import {
  collectionCsv,
  collectionJson,
  csvLine,
  EXPORT_FORMAT_VERSION,
  exportFileName,
} from '@/utils/export';

const now = new Date('2026-10-19T08:00:00Z');

const vader: CatalogFigure = {
  source: 'fandex',
  externalId: 'hot-toys-mms-279',
  category: 'figure',
  title: 'Darth Vader',
  brand: 'Hot Toys',
  number: 'MMS 279',
  universes: ['star-wars'],
  characters: [{ universe: 'star-wars', character: 'darth-vader' }],
};

function items(): CollectionItem[] {
  const hobbit = createCollectionItem(
    { ...linkedHobbit, isbn13: '9780345339683' as never, matchSignals: { titles: ['x'] } as never },
    { id: 'a', now: new Date('2026-10-01T10:00:00Z') },
  );
  // The user removed Bilbo from this book's characters.
  hobbit.linkEdits = {
    removedCharacters: [{ universe: 'middle-earth', character: 'bilbo-baggins' }],
  };
  return [
    hobbit,
    createCollectionItem(linkedFalcon, { id: 'b', now: new Date('2026-10-02T10:00:00Z') }),
    createCollectionItem(vader, { id: 'c', now: new Date('2026-10-03T10:00:00Z') }),
  ];
}

describe('exportFileName', () => {
  it('names the file by format and day', () => {
    expect(exportFileName('csv', '2026-10-19')).toBe('fandex-collection-2026-10-19.csv');
  });
});

describe('collectionJson', () => {
  const preorder = { id: 'p1', price: 45000, currency: 'USD' } as unknown as PreorderResponse;

  it('keeps every item, the links as shown, and the pre-orders, without match signals', () => {
    const parsed = JSON.parse(collectionJson(items(), [preorder], now));

    expect(parsed.fandexExport).toBe(EXPORT_FORMAT_VERSION);
    expect(parsed.exportedAt).toBe('2026-10-19T08:00:00.000Z');
    expect(parsed.collection).toHaveLength(3);
    expect(parsed.collection[0].catalog.title).toBe('The Hobbit');
    expect(parsed.collection[0].catalog).not.toHaveProperty('matchSignals');
    expect(parsed.collection[0].linkEdits).toBeDefined();
    expect(parsed.collection[0].links.characters).toEqual([
      { universe: 'middle-earth', character: 'gandalf' },
    ]);
    expect(parsed.preorders).toEqual([preorder]);
  });
});

describe('collectionCsv', () => {
  it('writes a header and one row per item, with names from the universe seed', () => {
    const csv = collectionCsv(items());

    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines[0]).toBe(
      'Title,Subtitle,Category,By,ISBN,Set number,Figure number,Universes,Characters,Added',
    );
    expect(lines[1]).toBe(
      'The Hobbit,,Book,J.R.R. Tolkien,9780345339683,,,Middle-earth,Gandalf,2026-10-01',
    );
    expect(lines[2]).toBe('Millennium Falcon,,LEGO,LEGO,,75192,,Star Wars,Han Solo,2026-10-02');
    expect(lines[3]).toBe(
      'Darth Vader,,Figure,Hot Toys,,,MMS 279,Star Wars,Darth Vader,2026-10-03',
    );
  });

  it('has only the header for an empty collection', () => {
    expect(collectionCsv([]).slice(1).trimEnd().split('\r\n')).toHaveLength(1);
  });
});

describe('csvLine', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(csvLine(['Batman: Year One', 'Hello, world', 'Say "hi"', 'two\nlines'])).toBe(
      'Batman: Year One,"Hello, world","Say ""hi""","two\nlines"',
    );
  });

  it('keeps spreadsheets from running a cell as a formula', () => {
    expect(csvLine(['=HYPERLINK("x")', '+1', '-Man', '@me'])).toBe(
      `"'=HYPERLINK(""x"")",'+1,'-Man,'@me`,
    );
  });
});
