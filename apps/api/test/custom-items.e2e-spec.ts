import { catalogItemSchema, collectionResponseSchema } from '@fandex/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

const WEB = 'http://localhost:8081';
const PASSWORD = 'correct horse battery';

const gandalf = {
  title: 'Gandalf the Grey',
  brand: 'Hot Toys',
  line: 'The Lord of the Rings — Movie Masterpiece',
  scale: '1/6',
  coverUrl: 'https://example.com/gandalf.jpg',
};

describe('Custom items (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeEach(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
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

  const create = async (agent: ReturnType<typeof request.agent>, body: object = gandalf) =>
    catalogItemSchema.parse((await agent.post('/api/catalog/custom').send(body).expect(201)).body);

  it('requires signing in', async () => {
    await request(app.getHttpServer()).post('/api/catalog/custom').send(gandalf).expect(401);
  });

  it('saves a figure, linked to the universes and characters its name and line mention', async () => {
    const agent = await signUp();

    const figure = await create(agent);

    expect(figure).toMatchObject({
      category: 'figure',
      source: 'custom',
      title: 'Gandalf the Grey',
      creators: ['Hot Toys'],
      subtitle: 'The Lord of the Rings — Movie Masterpiece',
      scale: '1/6',
      coverUrl: 'https://example.com/gandalf.jpg',
      universes: ['middle-earth'],
      characters: [{ universe: 'middle-earth', character: 'gandalf' }],
    });
    // Blank optional fields are dropped, not stored as "".
    const plain = await create(agent, { title: '  Darth Vader  ', brand: ' ', scale: '' });
    expect(plain).toMatchObject({ title: 'Darth Vader', creators: [], universes: ['star-wars'] });
    expect(plain).not.toHaveProperty('scale');
  });

  it('keeps its box number (written our way), edition, release and price', async () => {
    const agent = await signUp();

    const figure = await create(agent, {
      title: 'Iron Man Mark LXXXV',
      brand: 'Hot Toys',
      number: 'mms528d30',
      edition: 'Deluxe',
      release: { date: '2019-11-20', precision: 'month' },
      price: { amount: 42800, currency: 'USD' },
    });

    expect(figure).toMatchObject({
      source: 'custom',
      figureNumber: 'MMS 528 D30',
      edition: 'Deluxe',
      releaseDate: { date: '2019-11-01', precision: 'month' },
      price: { amount: 42800, currency: 'USD' },
    });
    expect(figure).not.toHaveProperty('sources');
  });

  it.each([
    ['no name', { title: '   ' }],
    ['a price in an unknown currency', { title: 'x', price: { amount: 100, currency: 'XYZ' } }],
    ['an image that is not https', { ...gandalf, coverUrl: 'http://example.com/a.jpg' }],
    ['a name that is too long', { title: 'x'.repeat(201) }],
  ])('rejects %s', async (_case, body) => {
    const agent = await signUp();
    await agent.post('/api/catalog/custom').send(body).expect(400);
  });

  it('can be added to its owner’s collection, and only theirs', async () => {
    const owner = await signUp('owner@example.com');
    const other = await signUp('other@example.com');
    const figure = await create(owner);

    await owner.post('/api/collection').send({ catalogItemId: figure.id }).expect(201);
    const { items } = collectionResponseSchema.parse(
      (await owner.get('/api/collection').expect(200)).body,
    );
    expect(items.map((item) => [item.category, item.catalog.title])).toEqual([
      ['figure', 'Gandalf the Grey'],
    ]);

    // Another user can't add (or learn about) someone's figure.
    await other.post('/api/collection').send({ catalogItemId: figure.id }).expect(404);
  });

  it("keeps its category: a figure can't be refiled as a book", async () => {
    const agent = await signUp();
    const figure = await create(agent);
    const { body: item } = await agent
      .post('/api/collection')
      .send({ catalogItemId: figure.id })
      .expect(201);

    const { body } = await agent
      .patch(`/api/collection/${item.id}`)
      .send({ category: 'comic' })
      .expect(400);

    expect(body.message).toBe("A figure's category can't be changed");
  });

  it('is deleted when its owner removes it from the collection', async () => {
    const agent = await signUp();
    const figure = await create(agent);
    const { body: item } = await agent
      .post('/api/collection')
      .send({ catalogItemId: figure.id })
      .expect(201);

    await agent.delete(`/api/collection/${item.id}`).expect(204);

    expect(await prisma.catalogItem.count({ where: { id: figure.id } })).toBe(0);
  });

  it('goes with its owner when they delete their account', async () => {
    const agent = await signUp();
    const figure = await create(agent);
    await agent.post('/api/collection').send({ catalogItemId: figure.id }).expect(201);

    await agent
      .post('/api/auth/delete-user')
      .set('Origin', WEB)
      .send({ password: PASSWORD })
      .expect(200);

    expect(await prisma.catalogItem.count({ where: { source: 'custom' } })).toBe(0);
    expect(await prisma.collectionItem.count()).toBe(0);
  });
});
