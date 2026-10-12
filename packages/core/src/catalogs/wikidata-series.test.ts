import courtOfMistAndFury from './__fixtures__/wikidata-series-a-court-of-mist-and-fury.json';
import hobbit from './__fixtures__/wikidata-series-hobbit.json';
import mistborn from './__fixtures__/wikidata-series-mistborn.json';
import philosophersStone from './__fixtures__/wikidata-series-philosophers-stone.json';
import wayOfKings from './__fixtures__/wikidata-series-way-of-kings.json';
import { CatalogError } from './catalog-error';
import { parseSeriesResponse, seriesQuery, WikidataSeriesCatalog } from './wikidata-series';

// Real Wikidata Query Service responses to seriesQuery, recorded October 12, 2026.

const series = (fixture: { results: { bindings: unknown[] } }) =>
  parseSeriesResponse(fixture.results.bindings as Parameters<typeof parseSeriesResponse>[0]);
const places = (fixture: Parameters<typeof series>[0]) =>
  series(fixture)?.entries.map((entry) => [entry.ordinal, entry.title, entry.workKey]);

describe('parseSeriesResponse', () => {
  it("finds a book's series and its main line in order, with Open Library work ids", () => {
    expect(series(wayOfKings)).toMatchObject({ name: 'The Stormlight Archive' });
    expect(places(wayOfKings)).toEqual([
      [1, 'The Way of Kings', 'OL15358691W'],
      [2, 'Words of Radiance', 'OL16813053W'],
      [3, 'Oathbringer', 'OL17834026W'],
      [4, 'Rhythm of War', 'OL24154052W'],
      [5, 'Wind and Truth', 'OL37577930W'],
    ]);
    expect(series(wayOfKings)!.entries[0]).toMatchObject({ published: '2010-08-31' });
  });

  it('keeps novellas and unnumbered books as extras, not as missing books', () => {
    expect(
      series(wayOfKings)!
        .extras.map((entry) => entry.title)
        .sort(),
    ).toEqual(['Dawnshard', 'Edgedancer', 'The Stormlight Archive (Part One)']);
    // 3.1 is A Court of Frost and Starlight, a novella between books 3 and 4.
    expect(places(courtOfMistAndFury)?.map(([ordinal]) => ordinal)).toEqual([1, 2, 3, 4]);
    expect(series(courtOfMistAndFury)!.extras).toMatchObject([
      { ordinal: 3.1, title: 'A Court of Frost and Starlight' },
    ]);
  });

  it('names a series that has only a multilingual label (Harry Potter)', () => {
    expect(series(philosophersStone)).toMatchObject({ name: 'Harry Potter' });
    expect(places(philosophersStone)?.map(([ordinal]) => ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    // The "0.5" prequel and Cursed Child (in two items) are extras.
    expect(series(philosophersStone)!.extras.map((entry) => entry.ordinal ?? null)).toContain(0.5);
  });

  it('chooses the series the book is numbered in (Mistborn, not the Cosmere)', () => {
    expect(series(mistborn)).toMatchObject({ name: 'Mistborn' });
    expect(places(mistborn)).toHaveLength(7);
  });

  it('prefers the series the book is numbered in over a bigger one it merely belongs to', () => {
    const row = (series: string, bookOrdinal: string | null, member: string, ordinal: string) => ({
      series: { value: `http://www.wikidata.org/entity/${series}` },
      seriesLabel: { value: series },
      ...(bookOrdinal && { bookOrdinal: { value: bookOrdinal } }),
      member: { value: `http://www.wikidata.org/entity/${member}` },
      memberLabel: { value: member },
      ordinal: { value: ordinal },
    });
    const rows = [
      // The book is number 1 of a trilogy…
      ...['Q1', 'Q2', 'Q3'].map((member, i) => row('Trilogy', '1', member, String(i + 1))),
      // …and, without a number, in a bigger numbered universe of books.
      ...['Q1', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'].map((member, i) =>
        row('Universe', null, member, String(i + 1)),
      ),
    ];

    expect(parseSeriesResponse(rows)).toMatchObject({ name: 'Trilogy' });
  });

  it('knows no series for a standalone book', () => {
    expect(series(hobbit)).toBeNull();
  });
});

describe('WikidataSeriesCatalog', () => {
  function catalogReturning(response: Response) {
    const fetch = jest.fn<Promise<Response>, Parameters<typeof globalThis.fetch>>(() =>
      Promise.resolve(response),
    );
    return { fetch, catalog: new WikidataSeriesCatalog({ fetch, userAgent: 'Fandex/test' }) };
  }

  it('asks Wikidata about the work, identifying itself', async () => {
    const { fetch, catalog } = catalogReturning(Response.json(wayOfKings));

    const result = await catalog.seriesForWork('OL15358691W');

    expect(result?.entries).toHaveLength(5);
    const [url, init] = fetch.mock.calls[0]!;
    expect(new URL(String(url)).searchParams.get('query')).toContain('wdt:P648 "OL15358691W"');
    expect(init?.headers).toMatchObject({ 'User-Agent': 'Fandex/test' });
  });

  it('only accepts Open Library work ids (the id goes into the query)', () => {
    expect(() => seriesQuery('OL1W" } UNION { ?x ?y ?z')).toThrow();
    expect(() => seriesQuery('OL22039557M')).toThrow();
  });

  it('reports a rate limit and other failures as catalog errors', async () => {
    await expect(
      catalogReturning(new Response('', { status: 429 })).catalog.seriesForWork('OL1W'),
    ).rejects.toMatchObject({ source: 'wikidata', kind: 'rate-limited' });
    await expect(
      catalogReturning(new Response('', { status: 503 })).catalog.seriesForWork('OL1W'),
    ).rejects.toBeInstanceOf(CatalogError);
  });
});
