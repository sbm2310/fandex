import {
  CatalogError,
  catalogItemSchema,
  workSeriesResponseSchema,
  type BookCatalog,
  type BookSeries,
  type CatalogBook,
} from '@fandex/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { BOOK_CATALOG } from '../src/catalog/catalog.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { SERIES_SOURCE, type SeriesSource } from '../src/series/series.service.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

// Shaped like Wikidata's real answer (core's recorded fixtures), shortened.
const stormlight: BookSeries = {
  wikidataId: 'Q7616797',
  name: 'The Stormlight Archive',
  entries: [
    { wikidataId: 'Q1', title: 'The Way of Kings', workKey: 'OL15358691W', ordinal: 1 },
    { wikidataId: 'Q2', title: 'Words of Radiance', workKey: 'OL16813053W', ordinal: 2 },
    { wikidataId: 'Q3', title: 'Oathbringer', workKey: 'OL17834026W', ordinal: 3 },
  ],
  extras: [{ wikidataId: 'Q9', title: 'Edgedancer', workKey: 'OL19631308W' }],
};
const WAY_OF_KINGS = 'OL15358691W';
const WORDS_OF_RADIANCE = 'OL16813053W';
const HOBBIT = 'OL27482W';

const fakeWikidata = { seriesForWork: vi.fn<SeriesSource['seriesForWork']>() };
const fakeBooks = {
  search: vi.fn<BookCatalog['search']>(),
  lookupIsbn: vi.fn<BookCatalog['lookupIsbn']>(),
};

describe('Series (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeEach(async () => {
    fakeWikidata.seriesForWork
      .mockReset()
      .mockImplementation(async (key) =>
        [...stormlight.entries, ...stormlight.extras].some((entry) => entry.workKey === key)
          ? stormlight
          : null,
      );
    fakeBooks.search.mockReset().mockResolvedValue([]);
    ({ app, prisma } = await createTestApp((builder) =>
      builder
        .overrideProvider(SERIES_SOURCE)
        .useValue(fakeWikidata)
        .overrideProvider(BOOK_CATALOG)
        .useValue(fakeBooks),
    ));
    await resetDatabase(prisma);
  });
  afterEach(() => app.close());

  const forWorks = async (...keys: string[]) =>
    workSeriesResponseSchema.parse(
      (
        await request(app.getHttpServer())
          .get('/api/series/works')
          .query({ keys: keys.join(',') })
          .expect(200)
      ).body,
    );

  it("answers each work's series, publicly, and remembers it for the whole series", async () => {
    const first = await forWorks(WAY_OF_KINGS, HOBBIT);

    expect(first.works).toEqual([
      { workKey: WAY_OF_KINGS, seriesId: 'Q7616797', pending: false },
      { workKey: HOBBIT, seriesId: null, pending: false },
    ]);
    expect(first.series).toEqual([stormlight]);
    expect(fakeWikidata.seriesForWork).toHaveBeenCalledTimes(2);

    // Another book of the series, and The Hobbit again: answered from the database.
    const second = await forWorks(WORDS_OF_RADIANCE, HOBBIT);
    expect(second.works.map((work) => work.seriesId)).toEqual(['Q7616797', null]);
    expect(fakeWikidata.seriesForWork).toHaveBeenCalledTimes(2);
  });

  it('asks once for several books of one series in a request', async () => {
    await forWorks(WAY_OF_KINGS, WORDS_OF_RADIANCE, 'OL17834026W');

    expect(fakeWikidata.seriesForWork).toHaveBeenCalledOnce();
  });

  it('asks again after a month, and keeps the cached series when Wikidata fails', async () => {
    await forWorks(WAY_OF_KINGS);
    await prisma.workSeries.updateMany({
      data: { checkedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
    });
    fakeWikidata.seriesForWork.mockRejectedValueOnce(
      new CatalogError('wikidata', 'network', 'Could not reach Wikidata'),
    );

    const response = await forWorks(WAY_OF_KINGS);

    expect(fakeWikidata.seriesForWork).toHaveBeenCalledTimes(2);
    expect(response.works).toEqual([
      { workKey: WAY_OF_KINGS, seriesId: 'Q7616797', pending: false },
    ]);
    expect(response.series).toEqual([stormlight]);
  });

  it("answers null for a work it couldn't ask about, and asks next time", async () => {
    fakeWikidata.seriesForWork.mockRejectedValueOnce(
      new CatalogError('wikidata', 'network', 'Could not reach Wikidata'),
    );

    // Not "no series": not known yet, so the app asks again shortly.
    expect((await forWorks(WAY_OF_KINGS)).works[0]).toMatchObject({
      seriesId: null,
      pending: true,
    });
    expect((await forWorks(WAY_OF_KINGS)).works[0]).toMatchObject({
      seriesId: 'Q7616797',
      pending: false,
    });
  });

  it('stops asking in a request once Wikidata says to slow down', async () => {
    fakeWikidata.seriesForWork.mockRejectedValueOnce(
      new CatalogError('wikidata', 'rate-limited', 'Wikidata rate limit hit', 429),
    );

    const response = await forWorks(HOBBIT, WAY_OF_KINGS);

    expect(fakeWikidata.seriesForWork).toHaveBeenCalledOnce();
    expect(response.works.map((work) => [work.seriesId, work.pending])).toEqual([
      [null, true],
      [null, true],
    ]);
  });

  it('rejects anything but up to 50 Open Library work ids', async () => {
    const server = app.getHttpServer();
    await request(server).get('/api/series/works').expect(400);
    await request(server).get('/api/series/works').query({ keys: 'OL1M' }).expect(400);
    await request(server).get('/api/series/works').query({ keys: 'OL1W" }' }).expect(400);
    const many = Array.from({ length: 51 }, (_, i) => `OL${i + 1}W`).join(',');
    await request(server).get('/api/series/works').query({ keys: many }).expect(400);
    expect(fakeWikidata.seriesForWork).not.toHaveBeenCalled();
  });

  describe('a book missing from a series', () => {
    const wordsOfRadiance = {
      source: 'openlibrary',
      externalId: 'OL27948034M',
      category: 'book',
      title: 'Words of Radiance',
      authors: ['Brandon Sanderson'],
      isbn13: '9781473208995',
      workKey: WORDS_OF_RADIANCE,
      matchSignals: { title: 'Words of Radiance' },
    } as CatalogBook;

    it('is found by its work, as a catalog item to add or pre-order', async () => {
      fakeBooks.search.mockResolvedValue([wordsOfRadiance]);

      const { body } = await request(app.getHttpServer())
        .get(`/api/catalog/work/${WORDS_OF_RADIANCE}`)
        .expect(200);

      expect(fakeBooks.search).toHaveBeenCalledWith(`key:/works/${WORDS_OF_RADIANCE}`);
      expect(catalogItemSchema.parse(body)).toMatchObject({
        title: 'Words of Radiance',
        workKey: WORDS_OF_RADIANCE,
        isbn13: '9781473208995',
      });
      expect(await prisma.catalogItem.count({ where: { workKey: WORDS_OF_RADIANCE } })).toBe(1);
    });

    it('is not found when Open Library has no edition of it, and must be a work id', async () => {
      await request(app.getHttpServer()).get(`/api/catalog/work/${HOBBIT}`).expect(404);
      await request(app.getHttpServer()).get('/api/catalog/work/OL22039557M').expect(400);
    });
  });
});
