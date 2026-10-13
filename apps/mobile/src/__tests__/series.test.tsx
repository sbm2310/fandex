import type { BookSeries, CatalogBook } from '@fandex/core';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import AddScreen from '@/app/(tabs)/add';
import CollectionScreen from '@/app/(tabs)/index';
import BookDetailScreen from '@/app/book/[id]';
import SeriesScreen from '@/app/series';
import {
  createFakeCatalog,
  createFakeSeriesCatalog,
  createMemoryCollection,
  createWrapper,
  hobbit,
} from '@/test-utils/providers';

jest.mock('@/utils/today', () => ({ localToday: () => '2026-10-12' }));

const book = (title: string, workKey: string, extra: Partial<CatalogBook> = {}): CatalogBook => ({
  source: 'openlibrary',
  externalId: `${workKey}-edition`,
  category: 'book',
  title,
  authors: ['Brandon Sanderson'],
  workKey,
  ...extra,
});
const wayOfKings = book('The Way of Kings', 'OL15358691W');
const wordsOfRadiance = book('Words of Radiance', 'OL16813053W');
const oathbringer = book('Oathbringer', 'OL17834026W', { catalogId: 'cat-oathbringer' });
const bookSix = book('Book Six', 'OL99W', {
  catalogId: 'cat-six',
  publishDate: { date: '2031-03-01', precision: 'day' },
});

const stormlight: BookSeries = {
  wikidataId: 'Q7766706',
  name: 'The Stormlight Archive',
  entries: [
    { wikidataId: 'Q1', title: 'The Way of Kings', workKey: 'OL15358691W', ordinal: 1 },
    { wikidataId: 'Q2', title: 'Words of Radiance', workKey: 'OL16813053W', ordinal: 2 },
    { wikidataId: 'Q3', title: 'Oathbringer', workKey: 'OL17834026W', ordinal: 3 },
    { wikidataId: 'Q4', title: 'Rhythm of War', ordinal: 4, published: '2020-11-17' },
    { wikidataId: 'Q6', title: 'Book Six', workKey: 'OL99W', ordinal: 5, published: '2031-03-01' },
  ],
  extras: [{ wikidataId: 'Q9', title: 'Edgedancer', workKey: 'OL19631308W' }],
};

async function openItem(
  owned: CatalogBook[],
  services: Parameters<typeof createWrapper>[0] = {},
  id = 'item-1',
) {
  const deviceCollection = createMemoryCollection();
  for (const entry of owned) await deviceCollection.add(entry);
  const app = renderRouter(
    { 'book/[id]': BookDetailScreen, '(tabs)/add': AddScreen },
    { initialUrl: `/book/${id}`, wrapper: createWrapper({ deviceCollection, ...services }) },
  );
  await app;
  return { getPathname: () => app.getPathname() };
}

describe('a book series on the item page', () => {
  const services = () => ({
    seriesCatalog: createFakeSeriesCatalog({
      series: [stormlight],
      works: { OL17834026W: oathbringer, OL99W: bookSix },
    }),
  });

  it("shows the book's place and what's missing, to add or pre-order", async () => {
    await openItem([wayOfKings, wordsOfRadiance], services());

    expect(
      await screen.findByRole('header', { name: 'Book 1 of 5 in The Stormlight Archive' }),
    ).toBeOnTheScreen();
    expect(screen.getByText("You have 2 of 5. You're missing:")).toBeOnTheScreen();
    // A missing book with an edition: Add, and its place.
    expect(await screen.findByRole('button', { name: 'Add Oathbringer' })).toBeOnTheScreen();
    expect(screen.getByText('Book 3')).toBeOnTheScreen();
    // An upcoming one: when it's out, and Pre-order.
    expect(await screen.findByText('Book 5 · Out March 1, 2031')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Pre-order Book Six' })).toBeOnTheScreen();
    // Out already: add it, nothing to pre-order.
    expect(screen.queryByRole('link', { name: 'Pre-order Oathbringer' })).not.toBeOnTheScreen();
    // No Open Library work: its title, and a search instead.
    expect(screen.getByText('Rhythm of War')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Search for Rhythm of War' })).toBeOnTheScreen();
    // Novellas aren't missing books.
    expect(screen.queryByText('Edgedancer')).not.toBeOnTheScreen();
  });

  it('adds a missing book to the collection, which then counts as owned', async () => {
    await openItem([wayOfKings], services());
    expect(await screen.findByText("You have 1 of 5. You're missing:")).toBeOnTheScreen();

    await fireEvent.press(await screen.findByRole('button', { name: 'Add Oathbringer' }));

    expect(await screen.findByText("You have 2 of 5. You're missing:")).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add Oathbringer' })).not.toBeOnTheScreen();
  });

  it('says so when the whole series is there', async () => {
    const complete = { ...stormlight, entries: stormlight.entries.slice(0, 2) };
    await openItem([wayOfKings, wordsOfRadiance], {
      seriesCatalog: createFakeSeriesCatalog({ series: [complete] }),
    });

    expect(
      await screen.findByRole('header', { name: 'Book 1 of 2 in The Stormlight Archive' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('You have all 2 books.')).toBeOnTheScreen();
  });

  it('asks again shortly when Wikidata was too slow to answer', async () => {
    jest.useFakeTimers();
    try {
      const seriesCatalog = createFakeSeriesCatalog({ series: [stormlight] });
      seriesCatalog.seriesForWorks.mockResolvedValueOnce({
        series: new Map(),
        pending: new Set(['OL15358691W']),
      });
      await openItem([wayOfKings], { seriesCatalog });
      expect(await screen.findByRole('header', { name: 'The Way of Kings' })).toBeOnTheScreen();
      expect(screen.queryByText(/ in The Stormlight Archive/)).not.toBeOnTheScreen();

      await act(() => jest.advanceTimersByTimeAsync(20_000));

      expect(
        await screen.findByRole('header', { name: 'Book 1 of 5 in The Stormlight Archive' }),
      ).toBeOnTheScreen();
      expect(seriesCatalog.seriesForWorks).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows nothing for a book in no series', async () => {
    const seriesCatalog = createFakeSeriesCatalog();
    await openItem([{ ...hobbit, workKey: 'OL27482W' }], { seriesCatalog });

    expect(await screen.findByRole('header', { name: 'The Hobbit' })).toBeOnTheScreen();
    expect(seriesCatalog.seriesForWorks).toHaveBeenCalledWith(['OL27482W']);
    expect(screen.queryByText(/ of .* in /)).not.toBeOnTheScreen();
  });
});

describe('manga volumes on the item page', () => {
  const volume = (title: string, extra: Partial<CatalogBook> = {}): CatalogBook => ({
    source: 'openlibrary',
    externalId: title,
    category: 'manga',
    title,
    authors: ['Eiichiro Oda'],
    ...extra,
  });

  it("shows the volume, what's missing up to the highest owned, and the next one", async () => {
    const vol4 = volume('One Piece, Vol. 4', {
      catalogId: 'cat-op-4',
      publishDate: { date: '2027-02-02', precision: 'day' },
    });
    const catalog = createFakeCatalog({ search: jest.fn(async () => [vol4]) });

    await openItem([volume('One Piece, Vol. 1'), volume('ONE PIECE 3')], { catalog }, 'item-2');

    expect(await screen.findByRole('header', { name: 'Volume 3 of One Piece' })).toBeOnTheScreen();
    expect(screen.getByText("You have 2 of 3. You're missing volume 2.")).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Search for One Piece' })).toBeOnTheScreen();
    expect(catalog.search).toHaveBeenCalledWith('one piece 4');
    expect(await screen.findByText('Next: volume 4, out February 2, 2027')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Pre-order One Piece, Vol. 4' })).toBeOnTheScreen();
  });

  it('opens a search for the missing volumes', async () => {
    const app = await openItem([volume('One Piece, Vol. 1'), volume('One Piece, Vol. 3')]);

    await fireEvent.press(await screen.findByRole('link', { name: 'Search for One Piece' }));

    expect(app.getPathname()).toBe('/add');
  });
});

describe('the Series view', () => {
  const manga = (title: string, extra: Partial<CatalogBook> = {}): CatalogBook => ({
    source: 'openlibrary',
    externalId: title,
    category: 'manga',
    title,
    authors: [],
    ...extra,
  });

  async function openSeries(
    owned: CatalogBook[],
    services: Parameters<typeof createWrapper>[0] = {},
  ) {
    const deviceCollection = createMemoryCollection();
    for (const entry of owned) await deviceCollection.add(entry);
    const app = renderRouter(
      { '(tabs)/index': CollectionScreen, series: SeriesScreen, 'book/[id]': BookDetailScreen },
      { initialUrl: '/series', wrapper: createWrapper({ deviceCollection, ...services }) },
    );
    await app;
    return { getPathname: () => app.getPathname() };
  }

  const owned = [
    wayOfKings,
    wordsOfRadiance,
    manga('One Piece, Vol. 1'),
    manga('One Piece, Vol. 3'),
    manga('Naruto, Vol. 1'),
    manga('Naruto, Vol. 2'),
    manga('Akira'),
  ];
  const vol4 = manga('One Piece, Vol. 4', {
    catalogId: 'cat-op-4',
    publishDate: { date: '2027-02-02', precision: 'day' },
  });
  const services = () => ({
    seriesCatalog: createFakeSeriesCatalog({ series: [stormlight] }),
    catalog: createFakeCatalog({
      search: jest.fn(async (query: string) => (query === 'one piece 4' ? [vol4] : [])),
    }),
  });

  it("lists each series with what's missing and what's next, incomplete first", async () => {
    await openSeries(owned, services());

    // The next volume is there once the search answers.
    expect(
      await screen.findByLabelText(
        'One Piece, Manga. You have 2 of 3 volumes. Missing volume 2. Next: volume 4, out February 2, 2027',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('2 of 3 have something missing.')).toBeOnTheScreen();
    const rows = screen.getAllByRole('link').map((row) => row.props.accessibilityLabel as string);
    expect(rows).toEqual([
      'One Piece, Manga. You have 2 of 3 volumes. Missing volume 2. Next: volume 4, out February 2, 2027',
      'The Stormlight Archive, Books. You have 2 of 5 books. Missing books 3–5',
      'Naruto, Manga. You have 2 of 2 volumes. Complete',
    ]);
  });

  it("opens an owned item of the series, whose page has what's missing", async () => {
    const app = await openSeries(owned, services());

    await fireEvent.press(await screen.findByLabelText(/^The Stormlight Archive, Books/));

    // The most recently added book of the series.
    expect(app.getPathname()).toBe('/book/item-2');
    expect(
      await screen.findByRole('header', { name: 'Book 2 of 5 in The Stormlight Archive' }),
    ).toBeOnTheScreen();
  });

  it('still lists manga when book series fail to load, and tries again', async () => {
    const seriesCatalog = createFakeSeriesCatalog({ series: [stormlight] });
    seriesCatalog.seriesForWorks.mockRejectedValueOnce(new Error("Can't reach Fandex"));
    await openSeries(owned, { ...services(), seriesCatalog });

    expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn.t load your book series/);
    expect(screen.getByLabelText(/^One Piece, Manga/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByLabelText(/^The Stormlight Archive, Books/)).toBeOnTheScreen();
  });

  it('explains itself when there are no series', async () => {
    await openSeries([manga('Akira')], services());

    expect(await screen.findByText('No series yet')).toBeOnTheScreen();
  });

  it('is opened from the Collection tab', async () => {
    const deviceCollection = createMemoryCollection();
    await deviceCollection.add(wayOfKings);
    const app = renderRouter(
      { '(tabs)/index': CollectionScreen, series: SeriesScreen },
      { initialUrl: '/', wrapper: createWrapper({ deviceCollection, ...services() }) },
    );
    await app;

    await fireEvent.press(await screen.findByLabelText(/^Your series/));

    expect(app.getPathname()).toBe('/series');
  });
});
