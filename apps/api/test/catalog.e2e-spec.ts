import {
  CatalogError,
  catalogItemSchema,
  catalogSearchResponseSchema,
  type BookCatalog,
  type CatalogBook,
} from '@fandex/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { BOOK_CATALOG } from '../src/catalog/catalog.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

const onePiece: CatalogBook = {
  source: 'openlibrary',
  externalId: 'OL9218212M',
  category: 'manga',
  title: 'One Piece, Vol. 1',
  subtitle: 'Romance Dawn',
  authors: ['Eiichiro Oda'],
  publishedYear: 2003,
  publisher: 'SHONEN JUMP',
  isbn13: '9781569319017' as CatalogBook['isbn13'] & string,
  coverUrl: 'https://covers.openlibrary.org/b/id/1-M.jpg',
};
const hobbit: CatalogBook = {
  source: 'openlibrary',
  externalId: 'OL51709286M',
  category: 'book',
  title: 'The Hobbit',
  authors: ['J.R.R. Tolkien'],
};

/** A controllable stand-in for Open Library. */
const fakeCatalog = {
  search: vi.fn<BookCatalog['search']>(),
  lookupIsbn: vi.fn<BookCatalog['lookupIsbn']>(),
};

describe('Catalog (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());

  // A fresh app per test: the in-memory search cache must not leak between tests.
  beforeEach(async () => {
    fakeCatalog.search.mockReset().mockResolvedValue([onePiece, hobbit]);
    fakeCatalog.lookupIsbn.mockReset().mockResolvedValue(onePiece);
    ({ app, prisma } = await createTestApp((builder) =>
      builder.overrideProvider(BOOK_CATALOG).useValue(fakeCatalog),
    ));
    await resetDatabase(prisma);
  });
  afterEach(() => app.close());

  describe('GET /catalog/search', () => {
    it('returns results with categories and our own ids, without signing in', async () => {
      const response = await api().get('/catalog/search').query({ q: ' one piece ' }).expect(200);

      const { items } = catalogSearchResponseSchema.parse(response.body);
      expect(items.map((item) => [item.title, item.category])).toEqual([
        ['One Piece, Vol. 1', 'manga'],
        ['The Hobbit', 'book'],
      ]);
      expect(items[0]).toMatchObject({
        creators: ['Eiichiro Oda'],
        year: 2003,
        isbn13: '9781569319017',
      });
      expect(items[1]).not.toHaveProperty('isbn13');
      expect(fakeCatalog.search).toHaveBeenCalledWith('one piece');
    });

    it('caches results in the database without duplicating them', async () => {
      const first = await api().get('/catalog/search').query({ q: 'one piece' });
      const second = await api().get('/catalog/search').query({ q: 'piece one' });

      expect(second.body.items[0].id).toBe(first.body.items[0].id);
      expect(await prisma.catalogItem.count()).toBe(2);
    });

    it('answers repeated searches from memory', async () => {
      await api().get('/catalog/search').query({ q: 'One Piece' }).expect(200);
      await api().get('/catalog/search').query({ q: 'one piece' }).expect(200);

      expect(fakeCatalog.search).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['missing', {}],
      ['too short', { q: ' a ' }],
      ['too long', { q: 'x'.repeat(201) }],
    ])('rejects a %s query', async (_, query) => {
      await api().get('/catalog/search').query(query).expect(400);
      expect(fakeCatalog.search).not.toHaveBeenCalled();
    });

    it('reports a failing source as 502', async () => {
      fakeCatalog.search.mockRejectedValue(new CatalogError('openlibrary', 'network', 'down'));

      await api().get('/catalog/search').query({ q: 'one piece' }).expect(502);
    });

    it('reports a rate-limited source as 503', async () => {
      fakeCatalog.search.mockRejectedValue(
        new CatalogError('openlibrary', 'rate-limited', 'slow down', 429),
      );

      await api().get('/catalog/search').query({ q: 'one piece' }).expect(503);
    });
  });

  describe('GET /catalog/isbn/:isbn', () => {
    it('looks up an ISBN (any format) and stores it', async () => {
      const response = await api().get('/catalog/isbn/1-56931-901-4').expect(200);

      expect(catalogItemSchema.parse(response.body)).toMatchObject({
        title: 'One Piece, Vol. 1',
        category: 'manga',
      });
      expect(fakeCatalog.lookupIsbn).toHaveBeenCalledWith('9781569319017');
      expect(await prisma.catalogItem.count()).toBe(1);
    });

    it('serves a known ISBN from the database', async () => {
      const first = await api().get('/catalog/isbn/9781569319017').expect(200);
      const second = await api().get('/catalog/isbn/9781569319017').expect(200);

      expect(second.body.id).toBe(first.body.id);
      expect(fakeCatalog.lookupIsbn).toHaveBeenCalledTimes(1);
    });

    it('falls back to a stale copy when the source is down', async () => {
      await api().get('/catalog/isbn/9781569319017').expect(200);
      await prisma.catalogItem.updateMany({ data: { fetchedAt: new Date('2020-01-01') } });
      fakeCatalog.lookupIsbn.mockRejectedValue(new CatalogError('openlibrary', 'network', 'down'));

      await api().get('/catalog/isbn/9781569319017').expect(200);
    });

    it('returns 404 for an unknown ISBN', async () => {
      fakeCatalog.lookupIsbn.mockResolvedValue(null);

      await api().get('/catalog/isbn/9791999999994').expect(404);
    });

    it('rejects an invalid ISBN without asking the source', async () => {
      await api().get('/catalog/isbn/9781569319018').expect(400);
      expect(fakeCatalog.lookupIsbn).not.toHaveBeenCalled();
    });
  });
});
