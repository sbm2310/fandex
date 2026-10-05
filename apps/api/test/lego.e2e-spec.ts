import {
  catalogItemSchema,
  catalogSearchResponseSchema,
  type CatalogSet,
  type LegoCatalog,
} from '@fandex/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { LEGO_CATALOG } from '../src/catalog/catalog.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

const falcon: CatalogSet = {
  source: 'rebrickable',
  externalId: '75192-1',
  category: 'lego',
  title: 'Millennium Falcon',
  setNumber: '75192',
  year: 2017,
  pieceCount: 7541,
  theme: 'Star Wars',
  subtheme: 'Ultimate Collector Series',
  coverUrl: 'https://cdn.rebrickable.com/media/sets/75192-1/30881.jpg',
};

const fakeLego = {
  searchSets: vi.fn<LegoCatalog['searchSets']>(),
  lookupSet: vi.fn<LegoCatalog['lookupSet']>(),
};

describe('LEGO catalog (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());

  beforeEach(async () => {
    fakeLego.searchSets.mockReset().mockResolvedValue([falcon]);
    fakeLego.lookupSet.mockReset().mockResolvedValue(falcon);
    ({ app, prisma } = await createTestApp((builder) =>
      builder.overrideProvider(LEGO_CATALOG).useValue(fakeLego),
    ));
    await resetDatabase(prisma);
  });
  afterEach(() => app.close());

  it('searches LEGO sets with kind=lego and stores them with theme and pieces', async () => {
    const response = await api()
      .get('/catalog/search')
      .query({ q: 'millennium falcon', kind: 'lego' })
      .expect(200);

    const { items } = catalogSearchResponseSchema.parse(response.body);
    expect(items).toMatchObject([
      {
        category: 'lego',
        source: 'rebrickable',
        setNumber: '75192',
        pieceCount: 7541,
        theme: 'Star Wars',
        subtheme: 'Ultimate Collector Series',
        creators: [],
      },
    ]);
    expect(fakeLego.searchSets).toHaveBeenCalledWith('millennium falcon');
    expect(await prisma.catalogItem.count({ where: { category: 'lego' } })).toBe(1);
  });

  it('keeps book and LEGO search caches apart', async () => {
    await api().get('/catalog/search').query({ q: 'falcon', kind: 'lego' }).expect(200);

    await api().get('/catalog/search').query({ q: 'falcon', kind: 'lego' }).expect(200);

    expect(fakeLego.searchSets).toHaveBeenCalledTimes(1);
  });

  it('rejects an unknown kind', async () => {
    await api().get('/catalog/search').query({ q: 'falcon', kind: 'vinyl' }).expect(400);
  });

  it('looks up a set by its printed number and caches it', async () => {
    const first = await api().get('/catalog/lego/75192').expect(200);
    const second = await api().get('/catalog/lego/75192-1').expect(200);

    expect(catalogItemSchema.parse(first.body)).toMatchObject({
      title: 'Millennium Falcon',
      setNumber: '75192',
    });
    expect(second.body.id).toBe(first.body.id);
    expect(fakeLego.lookupSet).toHaveBeenCalledTimes(1);
    expect(fakeLego.lookupSet).toHaveBeenCalledWith('75192-1');
  });

  it('returns 404 for an unknown set and 400 for an invalid number', async () => {
    fakeLego.lookupSet.mockResolvedValue(null);

    await api().get('/catalog/lego/99999999').expect(404);
    await api().get('/catalog/lego/not a set').expect(400);
  });

  it('lets a signed-in user add a LEGO set to their collection', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:8081')
      .send({ name: 'Builder', email: 'builder@example.com', password: 'correct horse battery' })
      .expect(200);
    const { body: set } = await api().get('/catalog/lego/75192').expect(200);

    await agent.post('/collection').send({ catalogItemId: set.id }).expect(201);

    const { body } = await agent.get('/collection').expect(200);
    expect(body.items).toMatchObject([
      { catalog: { category: 'lego', title: 'Millennium Falcon' } },
    ]);
  });
});

describe('LEGO catalog without an API key (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // The e2e environment has no REBRICKABLE_API_KEY (and .env is ignored in tests).
  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  beforeEach(() => resetDatabase(prisma));
  afterAll(() => app.close());

  it('answers 503 instead of failing', async () => {
    await request(app.getHttpServer())
      .get('/catalog/search')
      .query({ q: 'falcon', kind: 'lego' })
      .expect(503);
    await request(app.getHttpServer()).get('/catalog/lego/75192').expect(503);
  });

  it('still serves sets that are already cached', async () => {
    await prisma.catalogItem.create({
      data: {
        category: 'lego',
        source: 'rebrickable',
        externalId: '75192-1',
        title: 'Millennium Falcon',
        creators: [],
        setNumber: '75192',
      },
    });

    await request(app.getHttpServer()).get('/catalog/lego/75192').expect(200);
  });
});
