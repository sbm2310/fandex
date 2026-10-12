import type { BookSeries } from '../catalogs/wikidata-series';
import { bookSeriesSchema } from '../contracts/series';
import { isUpcoming, seriesProgress } from './book-series';

const stormlight: BookSeries = {
  wikidataId: 'Q7616797',
  name: 'The Stormlight Archive',
  entries: [
    { wikidataId: 'Q1', title: 'The Way of Kings', workKey: 'OL15358691W', ordinal: 1 },
    { wikidataId: 'Q2', title: 'Words of Radiance', workKey: 'OL16813053W', ordinal: 2 },
    { wikidataId: 'Q3', title: 'Oathbringer', workKey: 'OL17834026W', ordinal: 3 },
    { wikidataId: 'Q6', title: 'Book Six', ordinal: 6, published: '2031-01-01' },
  ],
  extras: [{ wikidataId: 'Q9', title: 'Edgedancer', workKey: 'OL19631308W' }],
};

describe('seriesProgress', () => {
  it('splits the main line into owned and missing books, by work', () => {
    const progress = seriesProgress(stormlight, new Set(['OL15358691W', 'OL19631308W']));

    expect(progress.owned.map((entry) => entry.ordinal)).toEqual([1]);
    expect(progress.missing.map((entry) => entry.ordinal)).toEqual([2, 3, 6]);
  });

  it('counts a book without an Open Library id as missing', () => {
    const all = new Set(stormlight.entries.flatMap((entry) => entry.workKey ?? []));
    expect(seriesProgress(stormlight, all).missing.map((entry) => entry.title)).toEqual([
      'Book Six',
    ]);
  });
});

describe('isUpcoming', () => {
  it('is true only for a publication date after today', () => {
    expect(isUpcoming(stormlight.entries[3]!, '2026-10-12')).toBe(true);
    expect(isUpcoming({ ...stormlight.entries[3]!, published: '2026-10-12' }, '2026-10-12')).toBe(
      false,
    );
    expect(isUpcoming(stormlight.entries[0]!, '2026-10-12')).toBe(false);
  });
});

describe('bookSeriesSchema', () => {
  it('round-trips a series', () => {
    expect(bookSeriesSchema.parse(stormlight)).toEqual(stormlight);
  });
});
