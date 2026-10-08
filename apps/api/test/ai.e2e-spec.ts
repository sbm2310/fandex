import {
  aiQuotaResponseSchema,
  shelfScanResponseSchema,
  type BookCatalog,
  type CatalogBook,
  type CatalogSet,
  type LegoCatalog,
} from '@fandex/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { usageDay } from '../src/ai/ai-quota.service.js';
import { AiProviderError, AiRateLimitError, type ChatModel } from '../src/ai/chat-client.js';
import { CHAT_MODEL } from '../src/ai/shelf-reader.service.js';
import { BOOK_CATALOG, LEGO_CATALOG } from '../src/catalog/catalog.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

/** The smallest thing that passes for a JPEG: its magic bytes and a little padding. */
const jpeg = (size = 64) =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size)]);

const reply = [
  'manga | Vagabond | - | Takehiko Inoue | 8 | -',
  'comic | MARVEL | - | - | 1 | -', // publisher-only: dropped by the parser
  'lego | Millennium Falcon | - | - | 1 | 75375',
].join('\n');

const fakeModel = { chat: vi.fn<ChatModel['chat']>() };

const vagabondNovel: CatalogBook = {
  source: 'openlibrary',
  externalId: 'OL1M',
  category: 'book',
  title: 'Vagabond',
  authors: ['Bernard Cornwell'],
};
const vagabondManga: CatalogBook = {
  source: 'openlibrary',
  externalId: 'OL2M',
  category: 'manga',
  title: 'Vagabond VIZBIG Edition, Vol. 1',
  authors: ['井上雄彦 (Takehiko Inoue)'],
};
const falcon: CatalogSet = {
  source: 'rebrickable',
  externalId: '75375-1',
  category: 'lego',
  title: 'Millennium Falcon',
  setNumber: '75375',
  year: 2024,
};
const oldFalcon: CatalogSet = { ...falcon, externalId: '10179-1', setNumber: '10179', year: 2007 };

const fakeBooks = {
  search: vi.fn<BookCatalog['search']>(),
  lookupIsbn: vi.fn<BookCatalog['lookupIsbn']>(),
};
const fakeLego = {
  searchSets: vi.fn<LegoCatalog['searchSets']>(),
  lookupSet: vi.fn<LegoCatalog['lookupSet']>(),
};

describe('AI (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function start(model: ChatModel | null = fakeModel, { lego = true } = {}) {
    ({ app, prisma } = await createTestApp((builder) =>
      builder
        .overrideProvider(CHAT_MODEL)
        .useValue(model)
        .overrideProvider(BOOK_CATALOG)
        .useValue(fakeBooks)
        .overrideProvider(LEGO_CATALOG)
        .useValue(lego ? fakeLego : null),
    ));
    await resetDatabase(prisma);
  }

  async function signUp(email = 'fan@example.com') {
    const user = request.agent(app.getHttpServer());
    await user
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:8081')
      .send({ name: 'Fan', email, password: 'correct horse battery' })
      .expect(200);
    return user;
  }

  const scan = (agent: ReturnType<typeof request.agent>, images = [jpeg(), jpeg()]) =>
    images.reduce(
      (req, image, index) =>
        req.attach('images', image, { filename: `part-${index}.jpg`, contentType: 'image/jpeg' }),
      agent.post('/api/ai/shelf-scans'),
    );

  beforeEach(() => {
    fakeModel.chat.mockReset().mockResolvedValue({
      text: reply,
      finishReason: 'stop',
      usage: { promptTokens: 2000, completionTokens: 40 },
    });
    fakeBooks.search
      .mockReset()
      .mockImplementation(async (query) =>
        query === 'Vagabond Takehiko Inoue' ? [vagabondNovel, vagabondManga] : [],
      );
    fakeLego.searchSets.mockReset().mockResolvedValue([oldFalcon, falcon]);
    fakeLego.lookupSet
      .mockReset()
      .mockImplementation(async (setNumber) => (setNumber === '75375-1' ? falcon : null));
  });

  afterEach(() => app.close());

  it('requires a signed-in user', async () => {
    await start();
    const server = app.getHttpServer();

    await request(server).get('/api/ai/quota').expect(401);
    await request(server)
      .post('/api/ai/shelf-scans')
      .attach('images', jpeg(), 'shelf.jpg')
      .expect(401);
    expect(fakeModel.chat).not.toHaveBeenCalled();
  });

  it('reads a shelf photo sent in parts, finds each reading in the catalog, and counts it', async () => {
    await start();
    const agent = await signUp();
    const left = jpeg(10);
    const right = jpeg(20);

    const { body } = await scan(agent, [left, right]).expect(200);

    const { items, quota } = shelfScanResponseSchema.parse(body);
    expect(quota).toEqual({ used: 1, limit: 5 });
    expect(items.map((item) => item.reading)).toEqual([
      { kind: 'manga', title: 'Vagabond', author: 'Takehiko Inoue', count: 8 },
      { kind: 'lego', title: 'Millennium Falcon', count: 1, setNumber: '75375' },
    ]);
    // Best first: the manga over the novel of the same name; the set whose number was read.
    const [vagabond, millenniumFalcon] = items;
    expect(vagabond!.candidates.map(({ item }) => [item.title, item.category])).toEqual([
      ['Vagabond VIZBIG Edition, Vol. 1', 'manga'],
      ['Vagabond', 'book'],
    ]);
    expect(millenniumFalcon!.candidates.map(({ item }) => item.setNumber)).toEqual([
      '75375',
      '10179',
    ]);
    expect(fakeBooks.search).toHaveBeenCalledWith('Vagabond Takehiko Inoue');
    expect(fakeLego.lookupSet).toHaveBeenCalledWith('75375-1');
    // Candidates are real catalog items, with our ids: addable as they are.
    const added = await agent
      .post('/api/collection')
      .send({ catalogItemId: vagabond!.candidates[0]!.item.id })
      .expect(201);
    expect(added.body.catalog.title).toBe('Vagabond VIZBIG Edition, Vol. 1');
    // Both readings agreed (the fake answers the same twice).
    expect(items.map((item) => item.sure)).toEqual([true, true]);
    // Read twice, each a request with both parts, core's prompt and the measured settings.
    expect(fakeModel.chat).toHaveBeenCalledTimes(2);
    expect(fakeModel.chat.mock.calls[1]![0]).toEqual(fakeModel.chat.mock.calls[0]![0]);
    const sent = fakeModel.chat.mock.calls[0]![0];
    expect(sent).toMatchObject({ model: 'qwen/qwen3.8-27b', maxTokens: 800, temperature: 0.6 });
    expect(sent.prompt).toContain('The 2 images are parts of one photo');
    expect(sent.images?.map((image) => Buffer.from(image))).toEqual([left, right]);

    const status = aiQuotaResponseSchema.parse((await agent.get('/api/ai/quota').expect(200)).body);
    expect(status).toEqual({ available: true, shelfScans: { used: 1, limit: 5 } });
  });

  it('puts what both readings found first, and marks what only one found as less sure', async () => {
    await start();
    const agent = await signUp();
    const answer = (text: string) => ({
      text,
      finishReason: 'stop' as const,
      usage: { promptTokens: 2000, completionTokens: 40 },
    });
    fakeModel.chat
      .mockResolvedValueOnce(answer('manga | Black Clover | - | - | 1 | -\n' + reply))
      .mockResolvedValueOnce(answer('manga | VAGABOND | - | - | 8 | -'));

    const { items } = shelfScanResponseSchema.parse((await scan(agent).expect(200)).body);

    expect(items.map((item) => [item.reading.title, item.sure])).toEqual([
      ['Vagabond', true],
      ['Black Clover', false],
      ['Millennium Falcon', false],
    ]);
  });

  it('uses the other reading when one of the two fails', async () => {
    await start();
    const agent = await signUp();
    fakeModel.chat.mockRejectedValueOnce(new AiRateLimitError('Rate limit reached', 5_000));

    const { items, quota } = shelfScanResponseSchema.parse((await scan(agent).expect(200)).body);

    expect(items.map((item) => [item.reading.title, item.sure])).toEqual([
      ['Vagabond', true],
      ['Millennium Falcon', true],
    ]);
    expect(quota.used).toBe(1);
  });

  it('marks candidates the user already owns', async () => {
    await start();
    const agent = await signUp();
    const first = shelfScanResponseSchema.parse((await scan(agent).expect(200)).body);
    const manga = first.items[0]!.candidates[0]!.item;
    await agent.post('/api/collection').send({ catalogItemId: manga.id }).expect(201);

    const again = shelfScanResponseSchema.parse((await scan(agent).expect(200)).body);

    expect(again.items[0]!.candidates.map((candidate) => candidate.owned)).toEqual([true, false]);
    expect(again.items[1]!.candidates.every((candidate) => !candidate.owned)).toBe(true);
    // Ownership is per user.
    const friend = await signUp('friend@example.com');
    const theirs = shelfScanResponseSchema.parse((await scan(friend).expect(200)).body);
    expect(theirs.items[0]!.candidates[0]!.owned).toBe(false);
  });

  it('still answers when a catalog search fails, or without LEGO on the server', async () => {
    await start(fakeModel, { lego: false });
    const agent = await signUp();
    fakeBooks.search.mockRejectedValue(new Error('Open Library is down'));

    const { items, quota } = shelfScanResponseSchema.parse((await scan(agent).expect(200)).body);

    expect(items.map((item) => item.candidates)).toEqual([[], []]);
    expect(quota.used).toBe(1);
  });

  it.each([
    ['no images', [], 400],
    ['a file that is not a JPEG', [Buffer.from('GIF89a')], 400],
    ['more than 3 parts', [jpeg(), jpeg(), jpeg(), jpeg()], 400],
    ['a part over 2 MB', [jpeg(2 * 1024 * 1024)], 413],
  ])('rejects %s without calling the model or counting it', async (_case, images, status) => {
    await start();
    const agent = await signUp();

    await scan(agent, images).expect(status);

    expect(fakeModel.chat).not.toHaveBeenCalled();
    expect(await prisma.aiUsage.count()).toBe(0);
  });

  it("stops a user at their daily allowance, without affecting anyone else's", async () => {
    await start();
    const fan = await signUp('fan@example.com');
    const friend = await signUp('friend@example.com');
    for (let i = 0; i < 5; i++) await scan(fan).expect(200);

    const { body } = await scan(fan).expect(429);

    expect(body.message).toBe("You've used today's 5 shelf scans. They reset at midnight UTC.");
    expect(fakeModel.chat).toHaveBeenCalledTimes(10); // two readings a scan
    await scan(friend).expect(200);
  });

  it("counts only today's scans", async () => {
    await start();
    const agent = await signUp();
    const user = await prisma.user.findFirstOrThrow();
    const yesterday = usageDay(new Date(Date.now() - 24 * 60 * 60 * 1000));
    await prisma.aiUsage.create({
      data: { userId: user.id, day: yesterday, kind: 'shelf_scan', count: 5 },
    });

    await scan(agent).expect(200);
  });

  it('stops everyone at the daily limit for all users together', async () => {
    await start();
    const agent = await signUp();
    const others = await prisma.user.create({
      data: { name: 'Others', email: 'others@example.com' },
    });
    await prisma.aiUsage.create({
      data: { userId: others.id, day: usageDay(new Date()), kind: 'shelf_scan', count: 30 },
    });

    const { body } = await scan(agent).expect(503);

    expect(body.message).toContain('daily limit for everyone');
    expect(fakeModel.chat).not.toHaveBeenCalled();
  });

  it("answers busy with the provider's Retry-After when it's rate limited, and doesn't count it", async () => {
    await start();
    const agent = await signUp();
    fakeModel.chat.mockRejectedValue(new AiRateLimitError('Rate limit reached', 11_200));

    const response = await scan(agent).expect(503);

    expect(response.headers['retry-after']).toBe('12');
    expect(response.body.message).toBe('Shelf scanning is busy. Try again in a minute.');
    expect(await prisma.aiUsage.count()).toBe(0);
  });

  it('answers unavailable when the provider fails or times out', async () => {
    await start();
    const agent = await signUp();
    fakeModel.chat.mockRejectedValue(new AiProviderError('did not answer in time', 504));

    const response = await scan(agent).expect(503);

    expect(response.headers['retry-after']).toBe('30');
    expect(response.body.message).toBe(
      'Shelf scanning is unavailable right now. Try again shortly.',
    );
    expect(await prisma.aiUsage.count()).toBe(0);
  });

  it('is off without an AI key', async () => {
    await start(null);
    const agent = await signUp();

    const { body } = await agent.get('/api/ai/quota').expect(200);
    expect(body).toEqual({ available: false, shelfScans: { used: 0, limit: 5 } });
    expect((await scan(agent).expect(503)).body.message).toBe(
      'Shelf scanning is not set up on this server.',
    );
  });

  it("deletes a user's usage with their account", async () => {
    await start();
    const agent = await signUp();
    await scan(agent).expect(200);

    await prisma.user.deleteMany();

    expect(await prisma.aiUsage.count()).toBe(0);
  });
});
