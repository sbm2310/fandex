import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module.js';
import type { Prisma } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { appOptions } from '../src/setup-app.js';
import { resetDatabase } from './reset-database.js';

describe('Database (e2e)', () => {
  let prisma: PrismaService;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = await moduleRef.createNestApplication(appOptions).init();
    prisma = app.get(PrismaService);
    close = () => app.close();
  });

  beforeEach(() => resetDatabase(prisma));
  afterAll(() => close());

  const hobbit: Prisma.CatalogItemCreateInput = {
    category: 'book',
    source: 'openlibrary',
    externalId: 'OL22039557M',
    title: 'The Hobbit',
    creators: ['J.R.R. Tolkien'],
    year: 2001,
    isbn13: '9780345445605',
  };

  it('stores and reads a catalog item', async () => {
    const created = await prisma.catalogItem.create({ data: hobbit });

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    await expect(
      prisma.catalogItem.findUnique({ where: { id: created.id } }),
    ).resolves.toMatchObject({
      title: 'The Hobbit',
      creators: ['J.R.R. Tolkien'],
      isbn13: '9780345445605',
    });
  });

  it('rejects the same source record twice', async () => {
    await prisma.catalogItem.create({ data: hobbit });

    await expect(prisma.catalogItem.create({ data: { ...hobbit, title: 'Copy' } })).rejects.toThrow(
      /Unique constraint/,
    );
  });

  it('finds items by ISBN', async () => {
    await prisma.catalogItem.create({ data: hobbit });

    await expect(
      prisma.catalogItem.findMany({ where: { isbn13: '9780345445605' } }),
    ).resolves.toHaveLength(1);
  });
});
