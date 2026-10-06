import {
  CatalogError,
  parseIsbn,
  type BookCatalog,
  type CatalogBook,
  type CatalogSet,
  type LegoCatalog,
} from '@fandex/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { CatalogSignalsService } from '../src/catalog/catalog-signals.service.js';
import { BOOK_CATALOG, LEGO_CATALOG } from '../src/catalog/catalog.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

const hobbitIsbn = parseIsbn('9780547928227')!;

const hobbit: CatalogBook = {
  source: 'openlibrary',
  externalId: 'OL25391413M',
  category: 'book',
  title: 'The Hobbit',
  authors: ['J.R.R. Tolkien'],
  isbn13: hobbitIsbn,
  workKey: 'OL27482W',
  matchSignals: {
    title: 'The Hobbit',
    authors: ['J.R.R. Tolkien'],
    people: ['Bilbo Baggins', 'Gandalf'],
    places: ['Middle-earth'],
  },
};

const falconSignals = { title: 'Millennium Falcon', legoThemeIds: [171, 158] };
const falconMinifigs = ['Han Solo, Old, Angry', 'Chewbacca'];
const falcon = (minifigs?: string[]): CatalogSet => ({
  source: 'rebrickable',
  externalId: '75192-1',
  category: 'lego',
  title: 'Millennium Falcon',
  setNumber: '75192',
  matchSignals: { ...falconSignals, ...(minifigs && { minifigs }) },
});

const fakeBooks = {
  search: vi.fn<BookCatalog['search']>(),
  lookupIsbn: vi.fn<BookCatalog['lookupIsbn']>(),
};
const fakeLego = {
  searchSets: vi.fn<LegoCatalog['searchSets']>(),
  lookupSet: vi.fn<LegoCatalog['lookupSet']>(),
};

describe('Catalog signals (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let signals: CatalogSignalsService;
  const api = () => request(app.getHttpServer());

  beforeEach(async () => {
    fakeBooks.search.mockReset().mockResolvedValue([hobbit]);
    fakeBooks.lookupIsbn.mockReset().mockResolvedValue(hobbit);
    fakeLego.searchSets.mockReset().mockResolvedValue([falcon()]);
    fakeLego.lookupSet.mockReset().mockResolvedValue(falcon(falconMinifigs));
    ({ app, prisma } = await createTestApp((builder) =>
      builder
        .overrideProvider(BOOK_CATALOG)
        .useValue(fakeBooks)
        .overrideProvider(LEGO_CATALOG)
        .useValue(fakeLego),
    ));
    signals = app.get(CatalogSignalsService);
    await resetDatabase(prisma);
  });
  afterEach(() => app.close());

  /** A user who owns catalog items created directly in the database (as before Stage 3). */
  async function owned(...items: Parameters<PrismaService['catalogItem']['create']>[0]['data'][]) {
    const user = await prisma.user.create({ data: { name: 'Owner', email: 'owner@example.com' } });
    const rows = [];
    for (const data of items) {
      const row = await prisma.catalogItem.create({ data });
      await prisma.collectionItem.create({ data: { userId: user.id, catalogItemId: row.id } });
      rows.push(row);
    }
    return rows;
  }
  const oldBook = {
    category: 'book' as const,
    source: 'openlibrary' as const,
    creators: ['J.R.R. Tolkien'],
  };
  const oldSet = { category: 'lego' as const, source: 'rebrickable' as const, creators: [] };

  describe('when catalog results are stored', () => {
    it('keeps the signals and work key, without sending signals to the app', async () => {
      const response = await api().get('/api/catalog/search').query({ q: 'hobbit' }).expect(200);

      expect(response.body.items[0]).not.toHaveProperty('matchSignals');
      expect(response.body.items[0].workKey).toBe('OL27482W');
      const row = await prisma.catalogItem.findFirstOrThrow({
        where: { externalId: hobbit.externalId },
      });
      expect(row.workKey).toBe('OL27482W');
      expect(row.matchSignals).toEqual(hobbit.matchSignals);
    });

    it("doesn't erase minifigs from a set lookup when the set shows up in a search", async () => {
      await api().get('/api/catalog/lego/75192').expect(200);
      await api().get('/api/catalog/search').query({ q: 'falcon', kind: 'lego' }).expect(200);

      const row = await prisma.catalogItem.findFirstOrThrow({ where: { externalId: '75192-1' } });
      expect(row.matchSignals).toEqual({ ...falconSignals, minifigs: falconMinifigs });
    });
  });

  describe('backfillOwned', () => {
    it('refetches owned items that need signals, and only those', async () => {
      const [byIsbn, byEditionKey, set] = await owned(
        { ...oldBook, externalId: 'OL1M', title: 'The Hobbit', isbn13: hobbitIsbn },
        { ...oldBook, externalId: 'OL2M', title: 'No ISBN' },
        {
          ...oldSet,
          externalId: '75192-1',
          title: 'Millennium Falcon',
          matchSignals: falconSignals,
        },
        { ...oldBook, externalId: 'OL3M', title: 'Done', matchSignals: { title: 'Done' } },
      );
      await prisma.catalogItem.create({
        data: { ...oldBook, externalId: 'OL4M', title: 'Unowned' },
      });
      const noIsbn: CatalogBook = {
        ...hobbit,
        externalId: 'OL2M',
        matchSignals: { title: 'No ISBN' },
      };
      fakeBooks.search.mockResolvedValue([hobbit, noIsbn]);

      await expect(signals.backfillOwned()).resolves.toEqual({ refreshed: 3, failed: 0 });

      // The source returned a different edition for the ISBN; the owned row keeps its identity.
      const refreshed = await prisma.catalogItem.findUniqueOrThrow({ where: { id: byIsbn!.id } });
      expect(refreshed).toMatchObject({ externalId: 'OL1M', workKey: 'OL27482W' });
      expect(refreshed.matchSignals).toEqual(hobbit.matchSignals);
      expect(fakeBooks.lookupIsbn).toHaveBeenCalledTimes(1);
      expect(fakeBooks.search).toHaveBeenCalledExactlyOnceWith('edition_key:OL2M');
      expect(
        (await prisma.catalogItem.findUniqueOrThrow({ where: { id: byEditionKey!.id } }))
          .matchSignals,
      ).toEqual({ title: 'No ISBN' });
      expect(fakeLego.lookupSet).toHaveBeenCalledExactlyOnceWith('75192-1');
      expect(
        (await prisma.catalogItem.findUniqueOrThrow({ where: { id: set!.id } })).matchSignals,
      ).toEqual({
        ...falconSignals,
        minifigs: falconMinifigs,
      });
      const unowned = await prisma.catalogItem.findFirstOrThrow({ where: { externalId: 'OL4M' } });
      expect(unowned.matchSignals).toBeNull();
    });

    it('leaves an item for the next run when the source fails (resumable)', async () => {
      const [book] = await owned({
        ...oldBook,
        externalId: 'OL1M',
        title: 'The Hobbit',
        isbn13: hobbitIsbn,
      });
      fakeBooks.lookupIsbn.mockRejectedValueOnce(
        new CatalogError('openlibrary', 'network', 'down'),
      );

      await expect(signals.backfillOwned()).resolves.toEqual({ refreshed: 0, failed: 1 });
      expect(
        (await prisma.catalogItem.findUniqueOrThrow({ where: { id: book!.id } })).matchSignals,
      ).toBeNull();

      await expect(signals.backfillOwned()).resolves.toEqual({ refreshed: 1, failed: 0 });
    });

    it('records what it knows about an item the source no longer has, so it is not retried', async () => {
      const [book] = await owned({
        ...oldBook,
        externalId: 'OL1M',
        title: 'Gone',
        isbn13: hobbitIsbn,
      });
      fakeBooks.lookupIsbn.mockResolvedValue(null);

      await signals.backfillOwned();
      await signals.backfillOwned();

      expect(fakeBooks.lookupIsbn).toHaveBeenCalledTimes(1);
      expect(
        (await prisma.catalogItem.findUniqueOrThrow({ where: { id: book!.id } })).matchSignals,
      ).toEqual({
        title: 'Gone',
        authors: ['J.R.R. Tolkien'],
      });
    });

    it('keeps retrying a set whose minifigs could not be loaded', async () => {
      await owned({ ...oldSet, externalId: '75192-1', title: 'Millennium Falcon' });
      fakeLego.lookupSet
        .mockResolvedValueOnce(falcon())
        .mockResolvedValueOnce(falcon(falconMinifigs));

      await signals.backfillOwned();
      await signals.backfillOwned();

      expect(fakeLego.lookupSet).toHaveBeenCalledTimes(2);
      const row = await prisma.catalogItem.findFirstOrThrow({ where: { externalId: '75192-1' } });
      expect(row.matchSignals).toEqual({ ...falconSignals, minifigs: falconMinifigs });
    });
  });

  it('fetches minifigs right after a LEGO set found by search is added', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:8081')
      .send({ name: 'Builder', email: 'builder@example.com', password: 'correct horse battery' })
      .expect(200);
    const { body } = await api()
      .get('/api/catalog/search')
      .query({ q: 'falcon', kind: 'lego' })
      .expect(200);
    expect(fakeLego.lookupSet).not.toHaveBeenCalled();

    await agent.post('/api/collection').send({ catalogItemId: body.items[0].id }).expect(201);
    await signals.idle();

    const row = await prisma.catalogItem.findFirstOrThrow({ where: { externalId: '75192-1' } });
    expect(row.matchSignals).toEqual({ ...falconSignals, minifigs: falconMinifigs });
  });
});
