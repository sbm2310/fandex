import {
  adminFigureSuggestionsResponseSchema,
  catalogItemSchema,
  catalogSearchResponseSchema,
  collectionResponseSchema,
  figureSeedEntrySchema,
  figureSuggestionSchema,
  figureSuggestionsResponseSchema,
  meResponseSchema,
  preordersResponseSchema,
} from '@fandex/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { z } from 'zod';

import { FIGURE_SEED_ENTRIES, FigureSeedService } from '../src/catalog/figure-seed.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

const WEB = 'http://localhost:8081';
const PASSWORD = 'correct horse battery';
const ADMIN = 'admin@example.com'; // ADMIN_EMAILS in vitest.config.e2e.ts

const LIST = z.array(figureSeedEntrySchema).parse([
  {
    id: 'hot-toys-mms-279',
    brand: 'hot-toys',
    line: 'mms',
    number: 'MMS 279',
    name: 'Darth Vader (A New Hope)',
    universe: 'star-wars',
    characters: ['darth-vader'],
    sources: ['https://example.com/vader'],
  },
]);

type Agent = ReturnType<typeof request.agent>;

describe('Figure suggestions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function start(entries = LIST) {
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

  async function signUp(email: string): Promise<Agent> {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/sign-up/email')
      .set('Origin', WEB)
      .send({ name: email.split('@')[0], email, password: PASSWORD })
      .expect(200);
    return agent;
  }

  /** A figure added by hand and put in the collection, as the app does. */
  async function ownFigure(agent: Agent, body: object = { title: 'Spartan Warrior' }) {
    const figure = catalogItemSchema.parse(
      (await agent.post('/api/catalog/custom').send(body).expect(201)).body,
    );
    const { body: item } = await agent
      .post('/api/collection')
      .send({ catalogItemId: figure.id })
      .expect(201);
    return { figure, itemId: item.id as string };
  }

  const suggest = async (agent: Agent, catalogItemId: string, status = 201) =>
    figureSuggestionSchema.parse(
      (
        await agent
          .post('/api/figure-suggestions')
          .send({ catalogItemId, note: 'Seen at SDCC' })
          .expect(status)
      ).body,
    );

  const pending = async (admin: Agent) =>
    adminFigureSuggestionsResponseSchema.parse(
      (await admin.get('/api/admin/figure-suggestions').expect(200)).body,
    ).suggestions;

  const searchFigures = async (q: string) =>
    catalogSearchResponseSchema.parse(
      (
        await request(app.getHttpServer())
          .get('/api/catalog/search')
          .query({ q, kind: 'figures' })
          .expect(200)
      ).body,
    ).items;

  it('lets you suggest only your own figures, once', async () => {
    const fan = await signUp('fan@example.com');
    const other = await signUp('other@example.com');
    const { figure } = await ownFigure(fan);
    const [vader] = await searchFigures('MMS 279');

    await request(app.getHttpServer())
      .post('/api/figure-suggestions')
      .send({ catalogItemId: figure.id })
      .expect(401);
    await other.post('/api/figure-suggestions').send({ catalogItemId: figure.id }).expect(404);
    await fan.post('/api/figure-suggestions').send({ catalogItemId: vader!.id }).expect(404);

    const first = await suggest(fan, figure.id);
    const again = await suggest(fan, figure.id, 200);

    expect(first).toMatchObject({
      status: 'pending',
      catalogItemId: figure.id,
      note: 'Seen at SDCC',
    });
    expect(again.id).toBe(first.id);
    const { suggestions } = figureSuggestionsResponseSchema.parse(
      (await fan.get('/api/figure-suggestions').expect(200)).body,
    );
    expect(suggestions.map((s) => s.id)).toEqual([first.id]);
    expect((await other.get('/api/figure-suggestions').expect(200)).body).toEqual({
      suggestions: [],
    });
  });

  it('is reviewed by admins only', async () => {
    const fan = await signUp('fan@example.com');
    const admin = await signUp(ADMIN);
    const { figure } = await ownFigure(fan);
    const { id } = await suggest(fan, figure.id);

    // Lazily: supertest starts each request's server when it's created.
    const calls = [
      () => fan.get('/api/admin/figure-suggestions'),
      () => fan.post(`/api/admin/figure-suggestions/${id}/approve`),
      () => fan.post(`/api/admin/figure-suggestions/${id}/reject`).send({ note: 'no' }),
      () => fan.post(`/api/admin/figure-suggestions/${id}/merge`).send({ targetId: figure.id }),
    ];
    for (const call of calls) await call().expect(403);
    expect(meResponseSchema.parse((await fan.get('/api/me')).body).isAdmin).toBe(false);
    expect(meResponseSchema.parse((await admin.get('/api/me')).body).isAdmin).toBe(true);
  });

  it('shows admins each pending suggestion with its figure, suggester and likely duplicates', async () => {
    const fan = await signUp('fan@example.com');
    const admin = await signUp(ADMIN);
    const { figure } = await ownFigure(fan, {
      title: 'Darth Vader',
      brand: 'Hot Toys',
      number: 'mms279',
    });
    await suggest(fan, figure.id);

    const [suggestion, ...rest] = await pending(admin);

    expect(rest).toEqual([]);
    expect(suggestion).toMatchObject({
      status: 'pending',
      note: 'Seen at SDCC',
      suggestedBy: { name: 'fan', email: 'fan@example.com' },
      figure: { id: figure.id, figureNumber: 'MMS 279' },
    });
    expect(suggestion!.candidates.map((c) => [c.item.externalId, c.sameFigure])).toEqual([
      ['hot-toys-mms-279', true],
    ]);
  });

  it('approving shares the figure with everyone, without its picture', async () => {
    const fan = await signUp('fan@example.com');
    const admin = await signUp(ADMIN);
    const { figure, itemId } = await ownFigure(fan, {
      title: 'Spartan Warrior',
      brand: 'Custom Studio',
      coverUrl: 'https://example.com/spartan.jpg',
    });
    expect(await searchFigures('spartan')).toEqual([]);
    const { id } = await suggest(fan, figure.id);

    const approved = figureSuggestionSchema.parse(
      (await admin.post(`/api/admin/figure-suggestions/${id}/approve`).expect(200)).body,
    );

    expect(approved).toMatchObject({ status: 'approved', catalogItemId: figure.id });
    expect(approved.reviewedAt).toBeDefined();
    const [shared] = await searchFigures('spartan');
    expect(shared).toMatchObject({ id: figure.id, source: 'fandex', title: 'Spartan Warrior' });
    expect(shared).not.toHaveProperty('coverUrl');
    await admin.post(`/api/admin/figure-suggestions/${id}/approve`).expect(409);
    // Anyone can add it now; the suggester removing theirs doesn't delete it.
    const other = await signUp('other@example.com');
    await other.post('/api/collection').send({ catalogItemId: figure.id }).expect(201);
    await fan.delete(`/api/collection/${itemId}`).expect(204);
    expect(await prisma.catalogItem.count({ where: { id: figure.id } })).toBe(1);
  });

  it('keeps approved figures when the curated list changes, even if nobody owns them', async () => {
    const fan = await signUp('fan@example.com');
    const admin = await signUp(ADMIN);
    const { figure, itemId } = await ownFigure(fan);
    const { id } = await suggest(fan, figure.id);
    await admin.post(`/api/admin/figure-suggestions/${id}/approve`).expect(200);
    await fan.delete(`/api/collection/${itemId}`).expect(204);
    await app.close();

    // The next deploy's list is different (Vader dropped); the approved figure isn't in it.
    expect(await (await start([])).sync()).toBe('synced');

    expect((await searchFigures('spartan')).map((item) => item.id)).toEqual([figure.id]);
    expect(await searchFigures('MMS 279')).toEqual([]);
  });

  it("merging moves the suggester's collection item and pre-orders onto the shared figure", async () => {
    const fan = await signUp('fan@example.com');
    const admin = await signUp(ADMIN);
    const { figure, itemId } = await ownFigure(fan, { title: 'Darth Vader', brand: 'Hot Toys' });
    const { body: preorder } = await fan
      .post('/api/preorders')
      .send({ catalogItemId: figure.id, price: 29999 })
      .expect(201);
    const [vader] = await searchFigures('MMS 279');
    const { id } = await suggest(fan, figure.id);

    const merged = figureSuggestionSchema.parse(
      (
        await admin
          .post(`/api/admin/figure-suggestions/${id}/merge`)
          .send({ targetId: vader!.id })
          .expect(200)
      ).body,
    );

    expect(merged).toMatchObject({ status: 'merged', mergedIntoId: vader!.id });
    expect(merged).not.toHaveProperty('catalogItemId');
    const { items } = collectionResponseSchema.parse((await fan.get('/api/collection')).body);
    expect(items.map((item) => [item.id, item.catalog.id])).toEqual([[itemId, vader!.id]]);
    const { preorders } = preordersResponseSchema.parse((await fan.get('/api/preorders')).body);
    expect(preorders.map((p) => [p.id, p.catalog.id])).toEqual([[preorder.id, vader!.id]]);
    expect(await prisma.catalogItem.count({ where: { id: figure.id } })).toBe(0);
    // The suggester still sees what became of it.
    const { suggestions } = figureSuggestionsResponseSchema.parse(
      (await fan.get('/api/figure-suggestions')).body,
    );
    expect(suggestions).toMatchObject([{ id, status: 'merged', mergedIntoId: vader!.id }]);
  });

  it('merging drops the duplicate when the suggester already owns the shared figure', async () => {
    const fan = await signUp('fan@example.com');
    const admin = await signUp(ADMIN);
    const [vader] = await searchFigures('MMS 279');
    const { body: owned } = await fan
      .post('/api/collection')
      .send({ catalogItemId: vader!.id })
      .expect(201);
    const { figure } = await ownFigure(fan, { title: 'Darth Vader' });
    const { id } = await suggest(fan, figure.id);

    await admin
      .post(`/api/admin/figure-suggestions/${id}/merge`)
      .send({ targetId: vader!.id })
      .expect(200);

    const { items } = collectionResponseSchema.parse((await fan.get('/api/collection')).body);
    expect(items.map((item) => item.id)).toEqual([owned.id]);
  });

  it("merges only into a shared figure, not someone's private one", async () => {
    const fan = await signUp('fan@example.com');
    const other = await signUp('other@example.com');
    const admin = await signUp(ADMIN);
    const { figure } = await ownFigure(fan);
    const { figure: theirs } = await ownFigure(other);
    const { id } = await suggest(fan, figure.id);

    for (const targetId of [theirs.id, figure.id]) {
      await admin.post(`/api/admin/figure-suggestions/${id}/merge`).send({ targetId }).expect(400);
    }
    expect((await pending(admin)).map((s) => s.id)).toEqual([id]);
  });

  it('rejecting needs a note, keeps the figure private, and can be suggested again', async () => {
    const fan = await signUp('fan@example.com');
    const admin = await signUp(ADMIN);
    const { figure } = await ownFigure(fan);
    const { id } = await suggest(fan, figure.id);

    await admin.post(`/api/admin/figure-suggestions/${id}/reject`).send({ note: ' ' }).expect(400);
    const rejected = figureSuggestionSchema.parse(
      (
        await admin
          .post(`/api/admin/figure-suggestions/${id}/reject`)
          .send({ note: 'Please add the maker and the number on the box.' })
          .expect(200)
      ).body,
    );

    expect(rejected).toMatchObject({
      status: 'rejected',
      reviewNote: 'Please add the maker and the number on the box.',
    });
    expect(await searchFigures('spartan')).toEqual([]);
    expect(await pending(admin)).toEqual([]);

    const reopened = await suggest(fan, figure.id, 200);
    expect(reopened).toMatchObject({ id, status: 'pending' });
    expect(reopened).not.toHaveProperty('reviewNote');
  });

  it('is withdrawn when its figure is removed', async () => {
    const fan = await signUp('fan@example.com');
    const { figure, itemId } = await ownFigure(fan);
    await suggest(fan, figure.id);

    await fan.delete(`/api/collection/${itemId}`).expect(204);

    expect(await prisma.figureSuggestion.count()).toBe(0);
  });
});
