import { collectionItemSchema, collectionResponseSchema } from '@fandex/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

const ORIGIN = 'http://localhost:8081';

describe('Collection (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let dune: { id: string };
  let onePiece: { id: string };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  beforeEach(async () => {
    await resetDatabase(prisma);
    dune = await prisma.catalogItem.create({
      data: {
        category: 'book',
        source: 'openlibrary',
        externalId: 'OL1M',
        title: 'Dune',
        creators: ['Frank Herbert'],
      },
    });
    onePiece = await prisma.catalogItem.create({
      data: {
        category: 'manga',
        source: 'openlibrary',
        externalId: 'OL2M',
        title: 'One Piece, Vol. 1',
        creators: ['Eiichiro Oda'],
      },
    });
  });
  afterAll(() => app.close());

  /** A signed-in client (cookie jar), like a browser. */
  async function signedIn(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/sign-up/email')
      .set('Origin', ORIGIN)
      .send({ name: email, email, password: 'correct horse battery' })
      .expect(200);
    return agent;
  }

  it('requires signing in', async () => {
    const api = request(app.getHttpServer());

    await api.get('/api/collection').expect(401);
    await api.post('/api/collection').send({ catalogItemId: dune.id }).expect(401);
    await api.delete('/api/collection/0199b5a0-7c1e-7a3b-9f00-1234567890ab').expect(401);
  });

  it('starts empty', async () => {
    const reader = await signedIn('reader@example.com');

    const response = await reader.get('/api/collection').expect(200);

    expect(collectionResponseSchema.parse(response.body)).toEqual({ items: [] });
  });

  it('adds catalog items and lists them newest first, with catalog data', async () => {
    const reader = await signedIn('reader@example.com');

    const added = await reader.post('/api/collection').send({ catalogItemId: dune.id }).expect(201);
    await reader.post('/api/collection').send({ catalogItemId: onePiece.id }).expect(201);

    expect(collectionItemSchema.parse(added.body)).toMatchObject({ catalog: { title: 'Dune' } });
    const { items } = collectionResponseSchema.parse((await reader.get('/api/collection')).body);
    expect(items.map((item) => [item.catalog.title, item.catalog.category])).toEqual([
      ['One Piece, Vol. 1', 'manga'],
      ['Dune', 'book'],
    ]);
  });

  it('returns the existing item (200) when adding the same edition again', async () => {
    const reader = await signedIn('reader@example.com');
    const first = await reader.post('/api/collection').send({ catalogItemId: dune.id }).expect(201);

    const again = await reader.post('/api/collection').send({ catalogItemId: dune.id }).expect(200);

    expect(again.body.id).toBe(first.body.id);
    expect(await prisma.collectionItem.count()).toBe(1);
  });

  it('handles a burst of identical adds (double tap) without duplicates', async () => {
    const reader = await signedIn('reader@example.com');

    const responses = await Promise.all(
      [1, 2, 3].map(() => reader.post('/api/collection').send({ catalogItemId: dune.id })),
    );

    expect(responses.map((r) => r.status).sort()).toEqual([200, 200, 201]);
    expect(new Set(responses.map((r) => r.body.id)).size).toBe(1);
    expect(await prisma.collectionItem.count()).toBe(1);
  });

  it.each([
    ['a missing id', {}],
    ['a non-UUID id', { catalogItemId: 'dune' }],
  ])('rejects %s with 400', async (_, body) => {
    const reader = await signedIn('reader@example.com');

    await reader.post('/api/collection').send(body).expect(400);
  });

  it('returns 404 for an unknown catalog item', async () => {
    const reader = await signedIn('reader@example.com');

    await reader
      .post('/api/collection')
      .send({ catalogItemId: '0199b5a0-7c1e-7a3b-9f00-1234567890ab' })
      .expect(404);
  });

  it('removes an item (204), then reports it as gone (404)', async () => {
    const reader = await signedIn('reader@example.com');
    const { body } = await reader.post('/api/collection').send({ catalogItemId: dune.id });

    await reader.delete(`/api/collection/${body.id}`).expect(204);
    await reader.delete(`/api/collection/${body.id}`).expect(404);
    expect((await reader.get('/api/collection')).body.items).toEqual([]);
  });

  it('rejects a non-UUID item id', async () => {
    const reader = await signedIn('reader@example.com');

    await reader.delete('/api/collection/not-a-uuid').expect(400);
  });

  describe('isolation between users', () => {
    it("never shows one user's items to another", async () => {
      const alice = await signedIn('alice@example.com');
      const bob = await signedIn('bob@example.com');
      await alice.post('/api/collection').send({ catalogItemId: dune.id }).expect(201);

      const bobs = await bob.get('/api/collection').expect(200);

      expect(bobs.body.items).toEqual([]);
    });

    it("can't remove another user's item, and doesn't reveal that it exists", async () => {
      const alice = await signedIn('alice@example.com');
      const bob = await signedIn('bob@example.com');
      const { body: alicesItem } = await alice
        .post('/api/collection')
        .send({ catalogItemId: dune.id });

      await bob.delete(`/api/collection/${alicesItem.id}`).expect(404);

      expect((await alice.get('/api/collection')).body.items).toHaveLength(1);
    });

    it('lets two users own the same edition independently', async () => {
      const alice = await signedIn('alice@example.com');
      const bob = await signedIn('bob@example.com');

      const a = await alice.post('/api/collection').send({ catalogItemId: dune.id }).expect(201);
      const b = await bob.post('/api/collection').send({ catalogItemId: dune.id }).expect(201);

      expect(a.body.id).not.toBe(b.body.id);
    });
  });

  it('deletes the collection along with the account', async () => {
    const reader = await signedIn('reader@example.com');
    await reader.post('/api/collection').send({ catalogItemId: dune.id }).expect(201);

    await reader
      .post('/api/auth/delete-user')
      .set('Origin', ORIGIN)
      .send({ password: 'correct horse battery' })
      .expect(200);

    expect(await prisma.collectionItem.count()).toBe(0);
    expect(await prisma.catalogItem.count()).toBe(2);
  });
});
