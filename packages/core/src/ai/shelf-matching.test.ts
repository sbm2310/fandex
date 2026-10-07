import searches from './__fixtures__/shelf-searches.json';
import {
  matchShelfReadings,
  rankEntries,
  scoreEntry,
  shelfSearchQuery,
  titleSimilarity,
  volumeNumber,
  type MatchableEntry,
  type ShelfCatalog,
} from './shelf-matching';
import type { ShelfReading } from './shelf-reading';

// shelf-searches.json: real Open Library and Rebrickable results for queries built from real
// readings of the owner's shelf (see docs/eval/shelf-recognition.md).
type Entry = MatchableEntry & { year?: number };
const books = searches.books as Record<string, Entry[]>;
const lego = searches.lego as Record<string, Entry[]>;
const lookups = searches.lookups as Record<string, Entry | null>;

const reading = (title: string, extra: Partial<ShelfReading> = {}): ShelfReading => ({
  kind: 'book',
  title,
  count: 1,
  ...extra,
});
const best = (read: ShelfReading, entries: Entry[]) => rankEntries(read, entries)[0];

describe('shelfSearchQuery', () => {
  it('adds the author, or the kind when there is none', () => {
    expect(shelfSearchQuery(reading('Civil War', { kind: 'comic', author: 'Millar' }))).toBe(
      'Civil War Millar',
    );
    expect(shelfSearchQuery(reading('CIVIL WAR', { kind: 'comic' }))).toBe('CIVIL WAR comics');
    expect(shelfSearchQuery(reading('Vagabond', { kind: 'manga' }))).toBe('Vagabond manga');
    expect(shelfSearchQuery(reading('Dune'))).toBe('Dune');
    expect(shelfSearchQuery(reading('X-Wing', { kind: 'lego' }))).toBe('X-Wing');
  });

  it('searches a non-English reading by its English title', () => {
    expect(shelfSearchQuery(reading('משחקי הכס', { englishTitle: 'A Game of Thrones' }))).toBe(
      'A Game of Thrones',
    );
  });
});

describe('titleSimilarity', () => {
  it('rewards a title that contains everything read, and prefers the shorter one', () => {
    const exact = titleSimilarity('CIVIL WAR', { title: 'Civil War' });
    const longer = titleSimilarity('CIVIL WAR', { title: 'Civil War Companion' });

    expect(exact).toBe(1);
    expect(longer).toBeLessThan(exact);
    expect(longer).toBeGreaterThanOrEqual(0.6);
  });

  it('looks in the subtitle too, and ignores filler words', () => {
    expect(
      titleSimilarity('Kimetsu no Yaiba', { title: 'Demon slayer', subtitle: 'Kimetsu no yaiba' }),
    ).toBeGreaterThanOrEqual(0.7);
    expect(titleSimilarity('The Hobbit', { title: 'Hobbit' })).toBe(1);
  });

  it('gives misreadings and unrelated titles a low score', () => {
    // Under the 0.6 a candidate needs.
    expect(titleSimilarity('UNLAND SAGA', { title: 'Vinland Saga' })).toBeLessThan(0.6);
    expect(titleSimilarity('Civil War', { title: 'The Art of War' })).toBeLessThan(0.6);
    expect(titleSimilarity('', { title: 'Anything' })).toBe(0);
  });
});

describe('volumeNumber', () => {
  it.each([
    ['Vagabond, Vol. 6', 6],
    ['Vagabond Volume 1', 1],
    ['Demon slayer: Kimetsu no yaiba. Volume 1', 1],
    ['Stormlight Archive Book 3', 3],
    ['バガボンド(5)', 5],
    ['Vagabond', undefined],
    ['Catch-22', undefined],
  ])('%s → %s', (title, expected) => {
    expect(volumeNumber({ title })).toBe(expected);
  });
});

describe('rankEntries on real search results', () => {
  it('finds the Marvel event among Civil War history books', () => {
    const comic = best(
      reading('CIVIL WAR', { kind: 'comic', count: 2 }),
      books['Civil War comics']!,
    );

    expect(comic).toMatchObject({
      title: 'Civil War',
      creators: ['Mark Millar'],
      category: 'comic',
    });
  });

  it('offers a run of volumes from volume 1', () => {
    const vagabond = best(
      reading('Vagabond', { kind: 'manga', count: 8 }),
      books['Vagabond manga']!,
    );
    const demonSlayer = best(
      reading('Demon Slayer', { kind: 'manga', count: 23 }),
      books['Demon Slayer manga']!,
    );

    expect(volumeNumber(vagabond!)).toBe(1);
    expect(vagabond!.category).toBe('manga');
    expect(demonSlayer).toMatchObject({ title: 'Demon slayer', category: 'manga' });
    expect(volumeNumber(demonSlayer!)).toBe(1);
  });

  it('uses the author it read', () => {
    const oathbringer = best(
      reading('OATHBRINGER', { author: 'Brandon Sanderson' }),
      books['Oathbringer Brandon Sanderson']!,
    );

    expect(oathbringer).toMatchObject({ title: 'Oathbringer', creators: ['Brandon Sanderson'] });
  });

  it('matches what a spine shortens', () => {
    const bigTime = best(
      reading('SPIDER-MAN: BIG TIME', { kind: 'comic', count: 6 }),
      books['SPIDER-MAN: BIG TIME comics']!,
    );

    expect(bigTime).toMatchObject({
      title: 'The amazing Spider-Man',
      subtitle: 'Big time, the complete collection',
    });
  });

  it('prefers the category it read over an exact title in another one', () => {
    const shelf: Entry[] = [
      { title: 'Vagabond', creators: ['Bernard Cornwell'], category: 'book' },
      { title: 'Vagabond, Vol. 6', creators: ['Takehiko Inoue'], category: 'manga' },
    ];

    expect(best(reading('Vagabond', { kind: 'manga' }), shelf)?.category).toBe('manga');
    expect(best(reading('Vagabond'), shelf)?.creators).toEqual(['Bernard Cornwell']);
  });

  it('rejects titles that only share a word', () => {
    const unrelated: Entry[] = [
      { title: 'The Art of War', creators: ['Sun Tzu'], category: 'book' },
    ];

    expect(rankEntries(reading('Civil War', { kind: 'comic' }), unrelated)).toEqual([]);
  });

  it('offers nothing for a misreading', () => {
    expect(books['UNLAND SAGA manga']).toEqual([]);
    expect(
      rankEntries(reading('UNLAND SAGA', { kind: 'manga' }), books['Vagabond manga']!),
    ).toEqual([]);
  });

  it('keeps LEGO and books apart', () => {
    const falconBook = { title: 'Millennium Falcon', creators: [], category: 'book' as const };
    expect(scoreEntry(reading('Millennium Falcon', { kind: 'lego' }), falconBook)).toBe(0);
    expect(scoreEntry(reading('Millennium Falcon'), lego['Millennium Falcon']![0]!)).toBe(0);
  });

  it('ranks the set whose number was read first, then newer sets, promotional items last', () => {
    const falcon = rankEntries(
      reading('Millennium Falcon', { kind: 'lego', setNumber: '75375' }),
      lego['Millennium Falcon']!,
    );
    const tantive = rankEntries(reading('Tantive IV', { kind: 'lego' }), lego['Tantive IV']!);

    expect(falcon[0]).toMatchObject({ setNumber: '75375', year: 2024 });
    const numbers = tantive.map((set) => set.setNumber);
    expect(numbers[0]).toBe('75376'); // the 2024 model, as on the owner's shelf
    // A promotional item named exactly "Tantive IV" ranks below every real set of that name.
    expect(numbers.indexOf('6382975')).toBeGreaterThan(numbers.indexOf('10198'));
  });
});

describe('matchShelfReadings', () => {
  const key = (entry: Entry) => `${entry.category}:${entry.setNumber ?? entry.title}`;

  // Recorded results by query, ignoring case (the readings are often in capitals).
  const recorded = (results: Record<string, Entry[]>, query: string) =>
    Object.entries(results).find(([q]) => q.toLowerCase() === query.toLowerCase())?.[1] ?? [];

  function catalog(overrides: Partial<ShelfCatalog<Entry>> = {}) {
    return {
      searchBooks: jest.fn(async (query: string) => recorded(books, query)),
      searchSets: jest.fn(async (query: string) => recorded(lego, query)),
      lookupSet: jest.fn(async (setNumber: string) => lookups[setNumber] ?? null),
      ...overrides,
    };
  }

  it('looks up each reading and returns its candidates, best first', async () => {
    const shelf = catalog();
    const matches = await matchShelfReadings(
      [
        reading('CIVIL WAR', { kind: 'comic', count: 2 }),
        reading('UNLAND SAGA', { kind: 'manga', count: 11 }),
      ],
      shelf,
      key,
    );

    expect(shelf.searchBooks).toHaveBeenCalledWith('CIVIL WAR comics');
    expect(matches).toHaveLength(2);
    expect(matches[0]!.candidates[0]).toMatchObject({ title: 'Civil War', category: 'comic' });
    expect(matches[0]!.candidates.length).toBeLessThanOrEqual(4);
    // Kept, with no candidates: the app offers a search for it.
    expect(matches[1]).toEqual({ reading: matches[1]!.reading, candidates: [] });
  });

  it('retries with just the title when the narrower search finds nothing', async () => {
    const edge: Entry = {
      title: 'Amazing Spider-Man',
      subtitle: 'Edge of Spider-Verse',
      creators: ['Dan Slott'],
      category: 'comic',
    };
    const searchBooks = jest.fn(async (query: string) =>
      query === 'EDGE OF SPIDER-VERSE' ? [edge] : [],
    );

    const [match] = await matchShelfReadings(
      [reading('EDGE OF SPIDER-VERSE', { kind: 'comic' })],
      catalog({ searchBooks }),
      key,
    );

    expect(searchBooks.mock.calls).toEqual([
      ['EDGE OF SPIDER-VERSE comics'],
      ['EDGE OF SPIDER-VERSE'],
    ]);
    expect(match!.candidates).toEqual([edge]);
  });

  it('searches once when the plain title is the query, or the first search matched', async () => {
    const searchBooks = jest.fn(async (query: string) => recorded(books, query));

    await matchShelfReadings(
      [reading('Nothing Like It'), reading('CIVIL WAR', { kind: 'comic' })],
      catalog({ searchBooks }),
      key,
    );

    expect(searchBooks.mock.calls).toEqual([['Nothing Like It'], ['CIVIL WAR comics']]);
  });

  it('trusts a LEGO set number only when the set is named like the reading', async () => {
    const shelf = catalog();
    const [falcon, xWing] = await matchShelfReadings(
      [
        reading('Millennium Falcon', { kind: 'lego', setNumber: '75375' }),
        // Models invent numbers: 75020 is Jabba's Sail Barge.
        reading('X-Wing', { kind: 'lego', setNumber: '75020' }),
      ],
      shelf,
      key,
    );

    expect(shelf.lookupSet).toHaveBeenCalledWith('75375-1');
    expect(falcon!.candidates[0]).toMatchObject({ setNumber: '75375' });
    expect(xWing!.candidates.map((set) => set.title)).not.toContain("Jabba's Sail Barge");
    expect(xWing!.candidates[0]?.title).toMatch(/x-wing/i);
  });

  it('drops a reading whose best candidate an earlier one already claimed', async () => {
    const matches = await matchShelfReadings(
      [
        reading('Vagabond', { kind: 'manga', count: 8 }),
        reading('VAGABOND', { kind: 'manga', count: 3 }),
      ],
      catalog(),
      key,
    );

    expect(matches.map((match) => match.reading.title)).toEqual(['Vagabond']);
  });

  it('keeps going when one lookup fails, and without LEGO on the server', async () => {
    const matches = await matchShelfReadings(
      [
        reading('PLANET HULK', { kind: 'comic' }),
        reading('CIVIL WAR', { kind: 'comic' }),
        reading('Tantive IV', { kind: 'lego' }),
      ],
      catalog({
        searchBooks: jest.fn(async (query: string) => {
          if (query.startsWith('PLANET')) throw new Error('Open Library is down');
          return recorded(books, query);
        }),
        searchSets: null,
        lookupSet: null,
      }),
      key,
    );

    expect(matches.map((match) => match.candidates.length > 0)).toEqual([false, true, false]);
  });

  it('reports lookups that failed', async () => {
    const onError = jest.fn();
    const failure = new Error('Open Library is down');

    await matchShelfReadings(
      [reading('PLANET HULK', { kind: 'comic' })],
      catalog({ searchBooks: jest.fn(async () => Promise.reject(failure)) }),
      key,
      onError,
    );

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'PLANET HULK' }),
      failure,
    );
  });

  it('resolves at most 24 readings per photo', async () => {
    const shelf = catalog();
    const many = Array.from({ length: 30 }, (_, i) => reading(`Book ${i}`));

    expect(await matchShelfReadings(many, shelf, key)).toHaveLength(24);
    expect(shelf.searchBooks).toHaveBeenCalledTimes(24);
  });
});
