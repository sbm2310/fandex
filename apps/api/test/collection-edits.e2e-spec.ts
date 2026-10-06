import {
  collectionItemSchema,
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
import { UniverseSeedService } from '../src/universes/universe-seed.service.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

const hobbit: CatalogBook = {
  source: 'openlibrary',
  externalId: 'OL1M',
  category: 'book',
  title: 'The Hobbit',
  authors: ['J.R.R. Tolkien'],
  matchSignals: { title: 'The Hobbit', people: ['Gandalf', 'Bilbo Baggins'] },
};
const falcon: CatalogSet = {
  source: 'rebrickable',
  externalId: '75192-1',
  category: 'lego',
  title: 'Millennium Falcon',
  setNumber: '75192',
  matchSignals: { title: 'Millennium Falcon', legoThemeIds: [158], minifigs: [] },
};

const gandalf = { universe: 'middle-earth', character: 'gandalf' };
const bilbo = { universe: 'middle-earth', character: 'bilbo-baggins' };
const yoda = { universe: 'star-wars', character: 'yoda' };

const fakeBooks = {
  search: vi.fn<BookCatalog['search']>(),
  lookupIsbn: vi.fn<BookCatalog['lookupIsbn']>(),
};
const fakeLego = {
  searchSets: vi.fn<LegoCatalog['searchSets']>(),
  lookupSet: vi.fn<LegoCatalog['lookupSet']>(),
};

describe('Fixing collection items (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let agent: ReturnType<typeof request.agent>;
  let hobbitItem: string;
  let falconItem: string;

  beforeEach(async () => {
    fakeBooks.search.mockReset().mockResolvedValue([hobbit]);
    fakeLego.lookupSet.mockReset().mockResolvedValue(falcon);
    ({ app, prisma } = await createTestApp((builder) =>
      builder
        .overrideProvider(BOOK_CATALOG)
        .useValue(fakeBooks)
        .overrideProvider(LEGO_CATALOG)
        .useValue(fakeLego),
    ));
    await resetDatabase(prisma);
    agent = await signUp('fan@example.com');
    const { body: books } = await agent.get('/api/catalog/search').query({ q: 'hobbit' });
    const { body: set } = await agent.get('/api/catalog/lego/75192');
    hobbitItem = (await agent.post('/api/collection').send({ catalogItemId: books.items[0].id }))
      .body.id;
    falconItem = (await agent.post('/api/collection').send({ catalogItemId: set.id })).body.id;
  });
  afterEach(() => app.close());

  async function signUp(email: string) {
    const user = request.agent(app.getHttpServer());
    await user
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:8081')
      .send({ name: 'Fan', email, password: 'correct horse battery' })
      .expect(200);
    return user;
  }

  const patch = (id: string, body: object, as = agent) =>
    as.patch(`/api/collection/${id}`).send(body);

  async function listed(id: string) {
    const { body } = await agent.get('/api/collection').expect(200);
    return collectionItemSchema.parse(body.items.find((item: { id: string }) => item.id === id));
  }

  describe('category', () => {
    it('corrects a book’s category, keeping the catalog’s, and resets it', async () => {
      const response = await patch(hobbitItem, { category: 'comic' }).expect(200);

      expect(response.body).toMatchObject({ category: 'comic', catalog: { category: 'book' } });
      expect((await listed(hobbitItem)).category).toBe('comic');

      await patch(hobbitItem, { category: null }).expect(200);
      expect((await listed(hobbitItem)).category).toBe('book');
    });

    it("stores nothing when the 'correction' matches the catalog", async () => {
      await patch(hobbitItem, { category: 'book' }).expect(200);

      const row = await prisma.collectionItem.findUniqueOrThrow({ where: { id: hobbitItem } });
      expect(row.categoryOverride).toBeNull();
    });

    it("rejects a category change for a LEGO set, or a category that isn't a book's", async () => {
      await patch(falconItem, { category: 'book' }).expect(400);
      await patch(hobbitItem, { category: 'lego' }).expect(400);
    });
  });

  describe('links', () => {
    it('stores only the differences and applies them everywhere', async () => {
      const response = await patch(hobbitItem, {
        links: { universes: ['middle-earth', 'star-wars'], characters: [gandalf, yoda] },
      }).expect(200);

      const item = collectionItemSchema.parse(response.body);
      expect(item.linkEdits).toEqual({
        addedUniverses: ['star-wars'],
        addedCharacters: [yoda],
        removedCharacters: [bilbo],
      });
      // The catalog entry keeps the automatic links (shared by everyone who owns it).
      expect(item.catalog.characters).toEqual([gandalf, bilbo]);

      const { body } = await agent.get('/api/collection/universes').expect(200);
      const universes = collectionUniversesResponseSchema.parse(body).universes;
      expect(universes.map((u) => u.slug)).toEqual(['middle-earth', 'star-wars']);
      expect(universes[0]?.characters.map((c) => c.slug)).toEqual(['gandalf']);
    });

    it('can take an item out of every universe, and reset to the automatic links', async () => {
      await patch(hobbitItem, { links: { universes: [], characters: [] } }).expect(200);
      const { body: emptied } = await agent.get('/api/collection/universes').expect(200);
      expect(emptied.universes.map((u: { slug: string }) => u.slug)).toEqual(['star-wars']);

      const reset = await patch(hobbitItem, { links: null }).expect(200);

      expect(reset.body).not.toHaveProperty('linkEdits');
      const { body } = await agent.get('/api/collection/universes').expect(200);
      expect(body.universes.map((u: { slug: string }) => u.slug)).toEqual([
        'middle-earth',
        'star-wars',
      ]);
    });

    it('keeps the fixes when the automatic links are recomputed', async () => {
      await patch(hobbitItem, { links: { universes: ['middle-earth'], characters: [bilbo] } });
      await prisma.syncState.update({ where: { name: 'universe-seed' }, data: { hash: 'old' } });

      await app.get(UniverseSeedService).sync();

      const item = await listed(hobbitItem);
      expect(item.linkEdits).toEqual({ removedCharacters: [gandalf] });
      expect(item.catalog.characters).toEqual([gandalf, bilbo]);
    });

    it.each([
      ['an unknown universe', { universes: ['narnia'], characters: [] }],
      [
        'an unknown character',
        {
          universes: ['middle-earth'],
          characters: [{ universe: 'middle-earth', character: 'aslan' }],
        },
      ],
      [
        'a character in the wrong universe',
        { universes: ['star-wars'], characters: [{ universe: 'star-wars', character: 'gandalf' }] },
      ],
      ['an invalid slug', { universes: ['Middle Earth'], characters: [] }],
    ])('rejects %s', async (_, links) => {
      await patch(hobbitItem, { links }).expect(400);
      expect((await listed(hobbitItem)).linkEdits).toBeUndefined();
    });
  });

  it('rejects an empty change', async () => {
    await patch(hobbitItem, {}).expect(400);
  });

  it('requires signing in, and never touches another user’s item', async () => {
    await request(app.getHttpServer())
      .patch(`/api/collection/${hobbitItem}`)
      .send({ category: 'comic' })
      .expect(401);
    const other = await signUp('other@example.com');

    await patch(hobbitItem, { category: 'comic' }, other).expect(404);

    expect((await listed(hobbitItem)).category).toBe('book');
  });
});
