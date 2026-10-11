import {
  collectionResponseSchema,
  describeSlips,
  preorderSchema,
  preordersResponseSchema,
  type BookCatalog,
  type CatalogBook,
} from '@fandex/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { BOOK_CATALOG } from '../src/catalog/catalog.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

const WEB = 'http://localhost:8081';
const PASSWORD = 'correct horse battery';

const windAndTruth = {
  source: 'openlibrary',
  externalId: 'OL1M',
  category: 'book',
  title: 'Wind and Truth',
  authors: ['Brandon Sanderson'],
  matchSignals: { title: 'Wind and Truth' },
} as CatalogBook;

const fakeBooks = {
  search: vi.fn<BookCatalog['search']>(),
  lookupIsbn: vi.fn<BookCatalog['lookupIsbn']>(),
};

type Agent = ReturnType<typeof request.agent>;

describe('Pre-orders (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bookId: string;

  beforeEach(async () => {
    fakeBooks.search.mockReset().mockResolvedValue([windAndTruth]);
    ({ app, prisma } = await createTestApp((builder) =>
      builder.overrideProvider(BOOK_CATALOG).useValue(fakeBooks),
    ));
    await resetDatabase(prisma);
    const { body } = await request(app.getHttpServer())
      .get('/api/catalog/search')
      .query({ q: 'wind and truth' })
      .expect(200);
    bookId = body.items[0].id;
  });
  afterEach(() => app.close());

  async function signUp(email = 'fan@example.com') {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/sign-up/email')
      .set('Origin', WEB)
      .send({ name: 'Fan', email, password: PASSWORD })
      .expect(200);
    return agent;
  }

  const create = async (agent: Agent, body: object) =>
    preorderSchema.parse((await agent.post('/api/preorders').send(body).expect(201)).body);
  const patch = async (agent: Agent, id: string, body: object) =>
    preorderSchema.parse((await agent.patch(`/api/preorders/${id}`).send(body).expect(200)).body);
  const figure = async (agent: Agent, title = 'Gandalf the Grey') =>
    (await agent.post('/api/catalog/custom').send({ title, brand: 'Hot Toys' }).expect(201)).body
      .id as string;

  it('requires signing in', async () => {
    const server = app.getHttpServer();
    await request(server).get('/api/preorders').expect(401);
    await request(server).post('/api/preorders').send({ catalogItemId: bookId }).expect(401);
  });

  it('records a pre-order with its prices, dates and store, and lists it', async () => {
    const agent = await signUp();

    const preorder = await create(agent, {
      catalogItemId: bookId,
      price: 3599,
      paid: 0,
      balanceDueDate: '2026-11-01',
      expectedRelease: { date: '2027-03-17', precision: 'month' },
      store: '  Barnes & Noble ',
      orderNumber: 'BN-123',
      orderUrl: 'https://example.com/orders/123',
    });

    expect(preorder).toMatchObject({
      status: 'ordered',
      catalog: { id: bookId, title: 'Wind and Truth' },
      currency: 'USD',
      price: 3599,
      paid: 0,
      balanceDueDate: '2026-11-01',
      expectedRelease: { date: '2027-03-01', precision: 'month' },
      store: 'Barnes & Noble',
      orderNumber: 'BN-123',
      orderUrl: 'https://example.com/orders/123',
    });
    // The first expected date is history too: it's what "originally" refers to.
    expect(preorder.history).toMatchObject([
      { from: null, to: { date: '2027-03-01', precision: 'month' }, source: 'user' },
    ]);
    const { preorders } = preordersResponseSchema.parse(
      (await agent.get('/api/preorders').expect(200)).body,
    );
    expect(preorders.map((p) => p.id)).toEqual([preorder.id]);
  });

  it('keeps every change of the expected date, so delays show', async () => {
    const agent = await signUp();
    const { id } = await create(agent, {
      catalogItemId: bookId,
      expectedRelease: { date: '2027-03-01', precision: 'month' },
    });

    await patch(agent, id, { expectedRelease: { date: '2027-06-10', precision: 'month' } });
    await patch(agent, id, { expectedRelease: { date: '2027-06-01', precision: 'month' } }); // same
    const updated = await patch(agent, id, { notes: 'Delayed again by the publisher' });

    expect(updated.expectedRelease).toEqual({ date: '2027-06-01', precision: 'month' });
    expect(updated.history.map((change) => [change.from?.date ?? null, change.to?.date])).toEqual([
      [null, '2027-03-01'],
      ['2027-03-01', '2027-06-01'],
    ]);
    expect(describeSlips(updated.history)).toBe('Delayed once, originally March 2027');
  });

  it('refuses paying more than the price, also when the price comes down', async () => {
    const agent = await signUp();
    await agent
      .post('/api/preorders')
      .send({ catalogItemId: bookId, price: 100, paid: 200 })
      .expect(400);
    const { id } = await create(agent, { catalogItemId: bookId, price: 35000, paid: 7000 });

    const { body } = await agent.patch(`/api/preorders/${id}`).send({ price: 5000 }).expect(400);

    expect(body.message).toBe("What's paid can't be more than the price");
    expect((await patch(agent, id, { price: null })).price).toBeUndefined(); // unknown is fine
  });

  it('moves into the collection when it arrives, once, however often it is asked', async () => {
    const agent = await signUp();
    const { id } = await create(agent, { catalogItemId: bookId, price: 3599, paid: 3599 });

    const first = await agent.post(`/api/preorders/${id}/arrive`).expect(200);
    const again = await agent.post(`/api/preorders/${id}/arrive`).expect(200);

    expect(first.body.preorder).toMatchObject({ status: 'arrived', arrivedAt: expect.any(String) });
    expect(again.body.item.id).toBe(first.body.item.id);
    const { items } = collectionResponseSchema.parse(
      (await agent.get('/api/collection').expect(200)).body,
    );
    expect(items.map((item) => item.catalog.title)).toEqual(['Wind and Truth']);
    // Arrived is final for its status.
    await agent.patch(`/api/preorders/${id}`).send({ status: 'cancelled' }).expect(409);
  });

  it('can be cancelled and reopened; a cancelled one does not arrive', async () => {
    const agent = await signUp();
    const { id } = await create(agent, { catalogItemId: bookId });

    expect((await patch(agent, id, { status: 'cancelled' })).status).toBe('cancelled');
    await agent.post(`/api/preorders/${id}/arrive`).expect(409);
    expect((await patch(agent, id, { status: 'ordered' })).status).toBe('ordered');
  });

  it("keeps each user's pre-orders to themselves", async () => {
    const owner = await signUp('owner@example.com');
    const other = await signUp('other@example.com');
    const mine = await create(owner, { catalogItemId: bookId, price: 3599 });
    const ownersFigure = await figure(owner);

    await other.get(`/api/preorders/${mine.id}`).expect(404);
    await other.patch(`/api/preorders/${mine.id}`).send({ notes: 'mine now' }).expect(404);
    await other.post(`/api/preorders/${mine.id}/arrive`).expect(404);
    await other.delete(`/api/preorders/${mine.id}`).expect(404);
    expect((await other.get('/api/preorders').expect(200)).body.preorders).toEqual([]);
    // Nor can anyone pre-order someone else's figure.
    await other.post('/api/preorders').send({ catalogItemId: ownersFigure }).expect(404);
    expect((await owner.get(`/api/preorders/${mine.id}`).expect(200)).body.notes).toBeUndefined();
  });

  it('cleans up a figure added only for a pre-order, but keeps one that arrived', async () => {
    const agent = await signUp();
    const onlyForThis = await figure(agent, 'Darth Vader');
    const kept = await figure(agent, 'Gandalf the Grey');
    const dropped = await create(agent, { catalogItemId: onlyForThis });
    const arrived = await create(agent, { catalogItemId: kept });
    const { body } = await agent.post(`/api/preorders/${arrived.id}/arrive`).expect(200);

    await agent.delete(`/api/preorders/${dropped.id}`).expect(204);
    // Removing the arrived figure from the collection keeps it: its pre-order still refers to it.
    await agent.delete(`/api/collection/${body.item.id}`).expect(204);

    expect(await prisma.catalogItem.count({ where: { id: onlyForThis } })).toBe(0);
    expect(await prisma.catalogItem.count({ where: { id: kept } })).toBe(1);
  });

  it('goes with the account, figures and all', async () => {
    const agent = await signUp();
    const gandalf = await figure(agent);
    await create(agent, { catalogItemId: gandalf, price: 35000 });
    await create(agent, { catalogItemId: bookId });

    await agent
      .post('/api/auth/delete-user')
      .set('Origin', WEB)
      .send({ password: PASSWORD })
      .expect(200);

    expect(await prisma.preorder.count()).toBe(0);
    expect(await prisma.preorderDateChange.count()).toBe(0);
    expect(await prisma.catalogItem.count({ where: { source: 'custom' } })).toBe(0);
  });
});
