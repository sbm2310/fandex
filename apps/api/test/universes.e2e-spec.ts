import {
  UNIVERSE_SEED,
  catalogItemSchema,
  catalogSearchResponseSchema,
  parseIsbn,
  universeDetailSchema,
  universeListResponseSchema,
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
import { UniverseSeedService } from '../src/universes/universe-seed.service.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

const hobbit: CatalogBook = {
  source: 'openlibrary',
  externalId: 'OL25391413M',
  category: 'book',
  title: 'The Hobbit',
  authors: ['J.R.R. Tolkien'],
  isbn13: parseIsbn('9780547928227')!,
  matchSignals: {
    title: 'The Hobbit',
    authors: ['J.R.R. Tolkien'],
    people: ['Bilbo Baggins', 'Gandalf', 'J. R. R. Tolkien (1892-1973)'],
    places: ['Middle-earth', 'Rivendell'],
  },
};
const unrelated: CatalogBook = {
  source: 'openlibrary',
  externalId: 'OL1M',
  category: 'book',
  title: 'The Way of Kings',
  authors: ['Brandon Sanderson'],
  matchSignals: { title: 'The Way of Kings', authors: ['Brandon Sanderson'] },
};
const falcon = (minifigs?: string[]): CatalogSet => ({
  source: 'rebrickable',
  externalId: '75192-1',
  category: 'lego',
  title: 'Millennium Falcon',
  setNumber: '75192',
  matchSignals: {
    title: 'Millennium Falcon',
    legoThemeIds: [171, 158],
    ...(minifigs && { minifigs }),
  },
});

const fakeBooks = {
  search: vi.fn<BookCatalog['search']>(),
  lookupIsbn: vi.fn<BookCatalog['lookupIsbn']>(),
};
const fakeLego = {
  searchSets: vi.fn<LegoCatalog['searchSets']>(),
  lookupSet: vi.fn<LegoCatalog['lookupSet']>(),
};

describe('Universes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());

  beforeEach(async () => {
    fakeBooks.search.mockReset().mockResolvedValue([hobbit, unrelated]);
    fakeBooks.lookupIsbn.mockReset().mockResolvedValue(hobbit);
    fakeLego.searchSets.mockReset().mockResolvedValue([falcon()]);
    fakeLego.lookupSet.mockReset().mockResolvedValue(falcon(['Han Solo, Old, Angry', 'Chewbacca']));
    ({ app, prisma } = await createTestApp((builder) =>
      builder
        .overrideProvider(BOOK_CATALOG)
        .useValue(fakeBooks)
        .overrideProvider(LEGO_CATALOG)
        .useValue(fakeLego),
    ));
    await resetDatabase(prisma);
  });
  afterEach(() => app.close());

  async function signUp() {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:8081')
      .send({ name: 'Fan', email: 'fan@example.com', password: 'correct horse battery' })
      .expect(200);
    return agent;
  }

  describe('GET /universes', () => {
    it('lists the seed universes in order, without signing in', async () => {
      const response = await api().get('/api/universes').expect(200);

      const { universes } = universeListResponseSchema.parse(response.body);
      expect(universes.map((universe) => universe.slug)).toEqual(
        UNIVERSE_SEED.map((universe) => universe.slug),
      );
      expect(universes[0]).toEqual({
        slug: 'middle-earth',
        name: 'Middle-earth',
        description: expect.stringContaining('Tolkien'),
        wikidataId: 'Q81738',
      });
    });
  });

  describe('GET /universes/:slug', () => {
    it('returns the universe with its characters, without internal fields', async () => {
      const response = await api().get('/api/universes/middle-earth').expect(200);

      const universe = universeDetailSchema.parse(response.body);
      expect(universe.characters[0]).toEqual({
        slug: 'gandalf',
        name: 'Gandalf',
        wikidataId: 'Q177499',
      });
      expect(universe.characters).toHaveLength(UNIVERSE_SEED[0]!.characters.length);
      expect(response.body).not.toHaveProperty('id');
      expect(response.body.characters[0]).not.toHaveProperty('aliases');
    });

    it('answers 404 for an unknown universe and 400 for an invalid slug', async () => {
      await api().get('/api/universes/narnia').expect(404);
      await api().get('/api/universes/Middle%20Earth').expect(400);
    });
  });

  describe('catalog items', () => {
    it('come with their universes and characters', async () => {
      const response = await api().get('/api/catalog/search').query({ q: 'hobbit' }).expect(200);

      const [book, other] = catalogSearchResponseSchema.parse(response.body).items;
      expect(book).toMatchObject({
        universes: ['middle-earth'],
        characters: [
          { universe: 'middle-earth', character: 'gandalf' },
          { universe: 'middle-earth', character: 'bilbo-baggins' },
        ],
      });
      expect(other).toMatchObject({ universes: [], characters: [] });
    });

    it('keep their links when served from the database later', async () => {
      await api().get('/api/catalog/isbn/9780547928227').expect(200);
      const response = await api().get('/api/catalog/isbn/9780547928227').expect(200);

      expect(fakeBooks.lookupIsbn).toHaveBeenCalledTimes(1);
      expect(catalogItemSchema.parse(response.body).universes).toEqual(['middle-earth']);
    });

    it('come with their links in a collection', async () => {
      const agent = await signUp();
      const { body } = await api().get('/api/catalog/search').query({ q: 'hobbit' }).expect(200);
      await agent.post('/api/collection').send({ catalogItemId: body.items[0].id }).expect(201);

      const { body: collection } = await agent.get('/api/collection').expect(200);
      expect(collection.items[0].catalog.universes).toEqual(['middle-earth']);
    });

    it('gain characters once a LEGO set’s minifigs arrive', async () => {
      const agent = await signUp();
      const { body } = await api()
        .get('/api/catalog/search')
        .query({ q: 'falcon', kind: 'lego' })
        .expect(200);
      // The theme says Star Wars; who's in the set isn't known from search results.
      expect(body.items[0]).toMatchObject({ universes: ['star-wars'], characters: [] });

      await agent.post('/api/collection').send({ catalogItemId: body.items[0].id }).expect(201);
      await app.get(CatalogSignalsService).idle();

      const { body: collection } = await agent.get('/api/collection').expect(200);
      expect(collection.items[0].catalog.characters).toEqual([
        { universe: 'star-wars', character: 'han-solo' },
        { universe: 'star-wars', character: 'chewbacca' },
      ]);
    });
  });

  describe('seed sync', () => {
    const seedService = () => app.get(UniverseSeedService);

    // Shared reference data: put it back even if a test failed halfway.
    afterEach(async () => {
      await prisma.universe.deleteMany({ where: { slug: 'atlantis' } });
      await seedService().sync();
    });

    it('does nothing when the seed is unchanged', async () => {
      await expect(seedService().sync()).resolves.toBe('unchanged');
    });

    it('applies a changed seed: drops stale universes, keeps ids, and re-matches items', async () => {
      await api().get('/api/catalog/search').query({ q: 'hobbit' }).expect(200);
      const item = await prisma.catalogItem.findFirstOrThrow({ where: { title: 'The Hobbit' } });
      const before = await prisma.universe.findUniqueOrThrow({ where: { slug: 'middle-earth' } });
      // A universe the seed no longer has, linked to the item; and the item's real links gone.
      const stale = await prisma.universe.create({
        data: {
          slug: 'atlantis',
          name: 'Atlantis',
          description: '',
          wikidataId: 'Q1',
          position: 99,
        },
      });
      await prisma.catalogItemUniverse.deleteMany({ where: { catalogItemId: item.id } });
      await prisma.catalogItemUniverse.create({
        data: { catalogItemId: item.id, universeId: stale.id },
      });
      await prisma.syncState.update({ where: { name: 'universe-seed' }, data: { hash: 'old' } });

      await expect(seedService().sync()).resolves.toBe('synced');

      expect(await prisma.universe.findUnique({ where: { slug: 'atlantis' } })).toBeNull();
      const after = await prisma.universe.findUniqueOrThrow({ where: { slug: 'middle-earth' } });
      expect(after.id).toBe(before.id);
      const links = await prisma.catalogItemUniverse.findMany({
        where: { catalogItemId: item.id },
        include: { universe: true },
      });
      expect(links.map((link) => link.universe.slug)).toEqual(['middle-earth']);
      await expect(seedService().sync()).resolves.toBe('unchanged');
    });
  });
});
