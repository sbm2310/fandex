import {
  collectionUniversesResponseSchema,
  type BookCatalog,
  type CatalogBook,
  type CatalogSet,
  type LegoCatalog,
} from '@fandex/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { BOOK_CATALOG, LEGO_CATALOG } from '../src/catalog/catalog.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

const book = (externalId: string, title: string, signals: Partial<CatalogBook['matchSignals']>) =>
  ({
    source: 'openlibrary',
    externalId,
    category: 'book',
    title,
    authors: [],
    coverUrl: `https://covers.openlibrary.org/b/id/${externalId}-M.jpg`,
    matchSignals: { title, ...signals },
  }) as CatalogBook;

const hobbit = book('OL1M', 'The Hobbit', { people: ['Bilbo Baggins', 'Gandalf'] });
const heir = book('OL2M', 'Star Wars: Heir to the Empire', { people: ['Admiral Thrawn'] });
const wayOfKings = book('OL3M', 'The Way of Kings', {});
const yearOne = book('OL4M', 'Batman: Year One', {});
const rivendell: CatalogSet = {
  source: 'rebrickable',
  externalId: '10316-1',
  category: 'lego',
  title: 'Lord of the Rings: Rivendell',
  setNumber: '10316',
  coverUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/1.jpg',
  matchSignals: {
    title: 'Lord of the Rings: Rivendell',
    legoThemeIds: [721],
    minifigs: ['Gandalf The Grey - Cape, Hat', 'Frodo  - Dark Green Cape'],
  },
};

const fakeBooks = {
  search: vi.fn<BookCatalog['search']>(),
  lookupIsbn: vi.fn<BookCatalog['lookupIsbn']>(),
};
const fakeLego = {
  searchSets: vi.fn<LegoCatalog['searchSets']>(),
  lookupSet: vi.fn<LegoCatalog['lookupSet']>(),
};

describe('Collection by universe (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let catalogIds: Record<string, string>;
  const api = () => request(app.getHttpServer());

  beforeEach(async () => {
    fakeBooks.search.mockReset().mockResolvedValue([hobbit, heir, wayOfKings, yearOne]);
    fakeLego.lookupSet.mockReset().mockResolvedValue(rivendell);
    ({ app, prisma } = await createTestApp((builder) =>
      builder
        .overrideProvider(BOOK_CATALOG)
        .useValue(fakeBooks)
        .overrideProvider(LEGO_CATALOG)
        .useValue(fakeLego),
    ));
    await resetDatabase(prisma);
    const { body } = await api().get('/api/catalog/search').query({ q: 'anything' }).expect(200);
    const { body: set } = await api().get('/api/catalog/lego/10316').expect(200);
    catalogIds = Object.fromEntries(
      [...body.items, set].map((item: { id: string; title: string }) => [item.title, item.id]),
    );
  });
  afterEach(() => app.close());

  async function signUp(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:8081')
      .send({ name: 'Fan', email, password: 'correct horse battery' })
      .expect(200);
    return agent;
  }

  async function own(agent: ReturnType<typeof request.agent>, ...titles: string[]) {
    const ids: string[] = [];
    for (const title of titles) {
      const { body } = await agent
        .post('/api/collection')
        .send({ catalogItemId: catalogIds[title] })
        .expect(201);
      ids.push(body.id);
    }
    return ids;
  }

  async function universesOf(agent: ReturnType<typeof request.agent>) {
    const { body } = await agent.get('/api/collection/universes').expect(200);
    return collectionUniversesResponseSchema.parse(body).universes;
  }

  it('requires signing in', async () => {
    await api().get('/api/collection/universes').expect(401);
  });

  it('is empty for an empty collection', async () => {
    const agent = await signUp('new@example.com');

    expect(await universesOf(agent)).toEqual([]);
  });

  it('summarizes the universes you own items from', async () => {
    const agent = await signUp('fan@example.com');
    await own(agent, 'The Hobbit', 'Star Wars: Heir to the Empire', 'The Way of Kings');
    await own(agent, 'Lord of the Rings: Rivendell');

    const universes = await universesOf(agent);

    expect(universes.map((universe) => universe.slug)).toEqual(['middle-earth', 'star-wars']);
    expect(universes[0]).toEqual({
      slug: 'middle-earth',
      name: 'Middle-earth',
      itemCount: 2,
      categoryCounts: { book: 1, lego: 1 },
      coverUrls: [rivendell.coverUrl, hobbit.coverUrl],
      characters: [
        { slug: 'gandalf', name: 'Gandalf', itemCount: 2 },
        { slug: 'bilbo-baggins', name: 'Bilbo Baggins', itemCount: 1 },
        { slug: 'frodo-baggins', name: 'Frodo Baggins', itemCount: 1 },
      ],
    });
    expect(universes[1]).toMatchObject({
      itemCount: 1,
      characters: [{ slug: 'thrawn', name: 'Thrawn', itemCount: 1 }],
    });
  });

  it('drops a universe once its last item is removed', async () => {
    const agent = await signUp('fan@example.com');
    const [hobbitItem] = await own(agent, 'The Hobbit', 'Star Wars: Heir to the Empire');

    await agent.delete(`/api/collection/${hobbitItem}`).expect(204);

    expect((await universesOf(agent)).map((universe) => universe.slug)).toEqual(['star-wars']);
  });

  it("only counts the signed-in user's items", async () => {
    const alice = await signUp('alice@example.com');
    const bob = await signUp('bob@example.com');
    await own(alice, 'The Hobbit');
    await own(bob, 'Batman: Year One', 'The Hobbit');

    expect(await universesOf(alice)).toEqual([
      expect.objectContaining({ slug: 'middle-earth', itemCount: 1 }),
    ]);
    expect((await universesOf(bob)).map((universe) => universe.slug)).toEqual([
      'middle-earth',
      'dc',
    ]);
  });
});
