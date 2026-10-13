import {
  catalogSearchResponseSchema,
  figureSeedEntrySchema,
  preorderSchema,
  type FigureSeedEntry,
} from '@fandex/core';
import { FIGURE_SEED } from '@fandex/core/figure-seed';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { z } from 'zod';

import { FIGURE_SEED_ENTRIES, FigureSeedService } from '../src/catalog/figure-seed.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { UniverseLinker } from '../src/universes/universe-linker.service.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

const WEB = 'http://localhost:8081';
const PASSWORD = 'correct horse battery';

const SOURCE = 'https://example.com/source';
const fixture = (entries: object[]): FigureSeedEntry[] =>
  z.array(figureSeedEntrySchema).parse(entries);

const LIST = fixture([
  {
    id: 'inart-gandalf-the-grey',
    brand: 'inart',
    line: 'sixth-scale',
    name: 'Gandalf the Grey',
    universe: 'middle-earth',
    characters: ['gandalf'],
    release: '2023-Q2',
    price: 'USD 445.00',
    sources: [SOURCE],
  },
  {
    id: 'hot-toys-mms-279',
    brand: 'hot-toys',
    line: 'mms',
    number: 'MMS 279',
    name: 'Darth Vader (A New Hope)',
    universe: 'star-wars',
    characters: ['darth-vader'],
    edition: 'Standard',
    sources: [SOURCE, 'https://example.com/second'],
  },
  {
    // Nothing in this name tells a matcher it's DC: the curated link does.
    id: 'inart-supergirl-2026',
    brand: 'inart',
    line: 'sixth-scale',
    name: 'Supergirl (Supergirl, 2026)',
    universe: 'dc',
    sources: [SOURCE],
  },
]);

describe('Shared figure catalog (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function start(entries: readonly FigureSeedEntry[] = LIST) {
    ({ app, prisma } = await createTestApp((builder) =>
      builder.overrideProvider(FIGURE_SEED_ENTRIES).useValue(entries),
    ));
    return app.get(FigureSeedService);
  }

  beforeEach(async () => {
    const seed = await start();
    await resetDatabase(prisma);
    await seed.sync();
  });
  afterEach(() => app.close());

  const search = async (q: string) =>
    catalogSearchResponseSchema.parse(
      (
        await request(app.getHttpServer())
          .get('/api/catalog/search')
          .query({ q, kind: 'figures' })
          .expect(200)
      ).body,
    ).items;

  async function signUp(email = 'fan@example.com') {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/sign-up/email')
      .set('Origin', WEB)
      .send({ name: 'Fan', email, password: PASSWORD })
      .expect(200);
    return agent;
  }

  it('serves curated figures to anyone, with their facts, sources and curated links', async () => {
    const [gandalf, ...rest] = await search('gandalf');

    expect(rest).toEqual([]);
    expect(gandalf).toMatchObject({
      category: 'figure',
      source: 'fandex',
      externalId: 'inart-gandalf-the-grey',
      title: 'Gandalf the Grey',
      creators: ['InArt'],
      subtitle: 'Sixth Scale Collectible Figure',
      scale: '1/6',
      releaseDate: { date: '2023-04-01', precision: 'quarter' },
      price: { amount: 44500, currency: 'USD' },
      sources: [SOURCE],
      universes: ['middle-earth'],
      characters: [{ universe: 'middle-earth', character: 'gandalf' }],
    });
    const [supergirl] = await search('supergirl');
    expect(supergirl).toMatchObject({ universes: ['dc'], characters: [] });
  });

  it('finds a figure by its box number, written any common way', async () => {
    for (const q of ['MMS 279', 'mms279', 'hot toys MMS-279']) {
      const items = await search(q);
      expect(items.map((item) => item.externalId)).toEqual(['hot-toys-mms-279']);
      expect(items[0]).toMatchObject({ figureNumber: 'MMS 279', edition: 'Standard' });
    }
    expect((await search('vader')).map((item) => item.externalId)).toEqual(['hot-toys-mms-279']);
  });

  it("never shows someone's private figures", async () => {
    const agent = await signUp();
    await agent
      .post('/api/catalog/custom')
      .send({ title: 'Gandalf the Grey', brand: 'Custom Studio' })
      .expect(201);

    const items = await search('gandalf');

    expect(items.map((item) => item.source)).toEqual(['fandex']);
  });

  it('can be added and pre-ordered by any user, and stays when removed from a collection', async () => {
    const [vader] = await search('MMS 279');
    const first = await signUp('first@example.com');
    const second = await signUp('second@example.com');

    const { body: owned } = await first
      .post('/api/collection')
      .send({ catalogItemId: vader!.id })
      .expect(201);
    await second.post('/api/collection').send({ catalogItemId: vader!.id }).expect(201);
    const preorder = preorderSchema.parse(
      (
        await second
          .post('/api/preorders')
          .send({ catalogItemId: vader!.id, price: 29999 })
          .expect(201)
      ).body,
    );
    expect(preorder.catalog.externalId).toBe('hot-toys-mms-279');

    await first.delete(`/api/collection/${owned.id}`).expect(204);
    expect(await prisma.catalogItem.count({ where: { id: vader!.id } })).toBe(1);
  });

  it('syncs once per list, and keeps ids and owned figures when the list changes', async () => {
    const [gandalf] = await search('gandalf');
    const [vader] = await search('MMS 279');
    const agent = await signUp();
    await agent.post('/api/collection').send({ catalogItemId: vader!.id }).expect(201);
    expect(await app.get(FigureSeedService).sync()).toBe('unchanged');
    await app.close();

    // Next deploy: Gandalf's price corrected, Vader and Supergirl dropped from the list.
    const changed = LIST.filter((entry) => entry.id === 'inart-gandalf-the-grey').map((entry) => ({
      ...entry,
      price: { amount: 46000, currency: 'USD' as const },
    }));
    expect(await (await start(changed)).sync()).toBe('synced');

    const [updated] = await search('gandalf');
    expect(updated).toMatchObject({ id: gandalf!.id, price: { amount: 46000, currency: 'USD' } });
    // Someone owns Vader, so he stays (still shared); nobody had Supergirl, so she's gone.
    expect(await prisma.catalogItem.count({ where: { id: vader!.id } })).toBe(1);
    expect(await prisma.catalogItem.count({ where: { externalId: 'inart-supergirl-2026' } })).toBe(
      0,
    );
  });

  it('keeps curated links when every item is re-matched (a universe seed change)', async () => {
    await app.get(UniverseLinker).relinkAll();

    const [supergirl] = await search('supergirl');
    expect(supergirl).toMatchObject({ universes: ['dc'] });
  });

  it('syncs the real curated list', async () => {
    await app.close();
    const seed = await start(FIGURE_SEED);
    await resetDatabase(prisma);

    expect(await seed.sync()).toBe('synced');

    expect(await prisma.catalogItem.count({ where: { source: 'fandex' } })).toBe(
      FIGURE_SEED.length,
    );
    expect((await search('MMS 279')).map((item) => item.title)).toEqual([
      'Darth Vader (A New Hope)',
    ]);
    const [gandalf] = await search('gandalf');
    expect(gandalf).toMatchObject({ creators: ['InArt'], universes: ['middle-earth'] });
  });
});
