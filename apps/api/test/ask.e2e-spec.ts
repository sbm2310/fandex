import {
  aiQuotaResponseSchema,
  askResponseSchema,
  type BookCatalog,
  type CatalogBook,
} from '@fandex/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { usageDay } from '../src/ai/ai-quota.service.js';
import { AiRateLimitError, type ChatModel } from '../src/ai/chat-client.js';
import { ASK_MODEL } from '../src/ai/question-answerer.service.js';
import { BOOK_CATALOG } from '../src/catalog/catalog.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

const book = (externalId: string, title: string, authors: string[] = []) =>
  ({
    source: 'openlibrary',
    externalId,
    category: 'book',
    title,
    authors,
    matchSignals: { title },
  }) as CatalogBook;

// Universe links come from the real matcher: "Batman" in a title links DC and Batman.
const yearOne = book('OL1M', 'Batman: Year One', ['Frank Miller']);
const killingJoke = book('OL2M', 'Batman: The Killing Joke', ['Alan Moore']);
const wayOfKings = book('OL3M', 'The Way of Kings', ['Brandon Sanderson']);

/** What the model replies for "What Batman stuff do I own?" (as Groq did, recorded in core). */
const batmanReply = JSON.stringify({
  scope: 'collection',
  universes: ['dc'],
  characters: ['Batman'],
  categories: [],
  titleWords: [],
  creator: null,
  addedAfter: null,
  addedBefore: null,
  arrivingAfter: null,
  arrivingBefore: null,
  balanceDue: false,
  delayed: false,
  sort: 'recent',
  answer: 'list',
  unsupported: null,
});

/** What the model replies for "What's arriving this month?" in October 2026 (recorded in core). */
const arrivingReply = JSON.stringify({
  ...JSON.parse(batmanReply),
  scope: 'preorders',
  universes: [],
  characters: [],
  arrivingAfter: '2026-10-01',
  arrivingBefore: '2026-11-01',
});

const fakeBooks = {
  search: vi.fn<BookCatalog['search']>(),
  lookupIsbn: vi.fn<BookCatalog['lookupIsbn']>(),
};
const fakeModel = { chat: vi.fn<ChatModel['chat']>() };

describe('Ask (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let catalogIds: Record<string, string>;

  async function start(model: ChatModel | null = fakeModel) {
    ({ app, prisma } = await createTestApp((builder) =>
      builder
        .overrideProvider(BOOK_CATALOG)
        .useValue(fakeBooks)
        .overrideProvider(ASK_MODEL)
        .useValue(model),
    ));
    await resetDatabase(prisma);
    const { body } = await request(app.getHttpServer())
      .get('/api/catalog/search')
      .query({ q: 'anything' })
      .expect(200);
    catalogIds = Object.fromEntries(
      body.items.map((item: { id: string; title: string }) => [item.title, item.id]),
    );
  }

  async function signUp(email = 'fan@example.com') {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:8081')
      .send({ name: 'Fan', email, password: 'correct horse battery' })
      .expect(200);
    return agent;
  }

  async function own(agent: ReturnType<typeof request.agent>, ...titles: string[]) {
    const ids: string[] = [];
    for (const title of titles) {
      const { body } = await agent
        .post('/api/collection')
        .send({ catalogItemId: catalogIds[title] })
        .expect(201);
      ids.push(body.id);
    }
    return ids;
  }

  const ask = async (agent: ReturnType<typeof request.agent>, question: string) =>
    askResponseSchema.parse((await agent.post('/api/ai/ask').send({ question }).expect(200)).body);

  beforeEach(() => {
    fakeBooks.search.mockReset().mockResolvedValue([yearOne, killingJoke, wayOfKings]);
    fakeModel.chat.mockReset().mockResolvedValue({
      text: batmanReply,
      finishReason: 'stop',
      usage: { promptTokens: 580, completionTokens: 60 },
    });
  });

  afterEach(() => app.close());

  it('requires a signed-in user and a question', async () => {
    await start();
    await request(app.getHttpServer()).post('/api/ai/ask').send({ question: 'Hi' }).expect(401);
    const agent = await signUp();

    await agent.post('/api/ai/ask').send({ question: '  ' }).expect(400);
    await agent
      .post('/api/ai/ask')
      .send({ question: 'x'.repeat(301) })
      .expect(400);
    expect(fakeModel.chat).not.toHaveBeenCalled();
  });

  it('answers from the collection with the query the AI made, without sending the collection', async () => {
    await start();
    const agent = await signUp();
    const [yearOneId, killingJokeId] = await own(
      agent,
      'Batman: Year One',
      'Batman: The Killing Joke',
      'The Way of Kings',
    );

    const response = await ask(agent, 'What Batman stuff do I own?');

    expect(response).toMatchObject({
      answer: 'You own 2 Batman items.',
      method: 'ai',
      unknown: [],
      quota: { used: 1, limit: 30 },
    });
    expect(response.query.characters).toEqual([{ universe: 'dc', character: 'batman' }]);
    expect(response.itemIds.sort()).toEqual([yearOneId, killingJokeId].sort());
    // The model gets the question and Fandex's universe names, never the collection.
    expect(fakeModel.chat).toHaveBeenCalledTimes(1);
    const sent = fakeModel.chat.mock.calls[0]![0];
    expect(sent.prompt).toContain('What Batman stuff do I own?');
    expect(sent.prompt).not.toContain('Year One');
    expect(sent.prompt).not.toContain('Killing Joke');
    expect(sent).toMatchObject({
      model: 'qwen/qwen3.8-27b',
      temperature: 0,
      jsonSchema: { name: 'collection_query' },
    });

    const status = aiQuotaResponseSchema.parse((await agent.get('/api/ai/quota').expect(200)).body);
    expect(status.questions).toEqual({ used: 1, limit: 30 });
  });

  it("answers only from the user's own items", async () => {
    await start();
    const fan = await signUp('fan@example.com');
    const friend = await signUp('friend@example.com');
    await own(fan, 'Batman: Year One');
    const [theirs] = await own(friend, 'Batman: The Killing Joke');

    const response = await ask(friend, 'What Batman stuff do I own?');

    expect(response.itemIds).toEqual([theirs]);
    expect(response.answer).toBe('You own 1 Batman item.');
  });

  it('falls back to keywords without the AI, and does not count it', async () => {
    await start(null);
    const agent = await signUp();
    await own(agent, 'Batman: Year One', 'The Way of Kings');

    const response = await ask(agent, 'What Batman stuff do I own?');

    expect(response).toMatchObject({
      answer: 'You own 1 Batman item.',
      method: 'keywords',
      notice: "AI isn't set up on this server, so keywords answered.",
      quota: { used: 0 },
    });
  });

  it.each([
    ['is busy', new AiRateLimitError('Rate limit reached', 5_000), 'The AI is busy right now'],
    ['replies with something unusable', null, "The AI couldn't answer right now"],
  ])(
    'falls back to keywords when the AI %s, and does not count it',
    async (_case, error, notice) => {
      await start();
      const agent = await signUp();
      await own(agent, 'Batman: Year One');
      if (error) fakeModel.chat.mockRejectedValue(error);
      else {
        fakeModel.chat.mockResolvedValue({
          text: '{"universes": "dc"}',
          finishReason: 'stop',
          usage: { promptTokens: 580, completionTokens: 10 },
        });
      }

      const response = await ask(agent, 'What Batman stuff do I own?');

      expect(response.method).toBe('keywords');
      expect(response.notice).toContain(notice);
      expect(response.answer).toBe('You own 1 Batman item.');
      expect(await prisma.aiUsage.count()).toBe(0);
    },
  );

  it('uses keywords once the daily AI questions are used up', async () => {
    await start();
    const agent = await signUp();
    const user = await prisma.user.findFirstOrThrow();
    await prisma.aiUsage.create({
      data: { userId: user.id, day: usageDay(new Date()), kind: 'question', count: 30 },
    });

    const response = await ask(agent, 'How many books do I have?');

    expect(response).toMatchObject({ method: 'keywords', answer: "You don't own any books yet." });
    expect(response.notice).toContain("You've used today's 30 AI questions");
    expect(fakeModel.chat).not.toHaveBeenCalled();
  });

  it("explains a question it can't answer, with no items", async () => {
    await start();
    const agent = await signUp();
    await own(agent, 'Batman: Year One');
    fakeModel.chat.mockResolvedValue({
      text: JSON.stringify({
        ...JSON.parse(batmanReply),
        universes: [],
        characters: [],
        unsupported: 'Item value is not tracked.',
      }),
      finishReason: 'stop',
      usage: { promptTokens: 580, completionTokens: 60 },
    });

    const response = await ask(agent, "What's my most valuable item?");

    expect(response.answer).toBe("I can't answer that yet: Item value is not tracked.");
    expect(response.itemIds).toEqual([]);
  });

  describe('about pre-orders', () => {
    const preorder = (agent: ReturnType<typeof request.agent>, body: object) =>
      agent
        .post('/api/preorders')
        .send(body)
        .expect(201)
        .then((response) => response.body.id as string);

    it("answers from the user's open pre-orders, without sending them", async () => {
      await start();
      fakeModel.chat.mockResolvedValue({
        text: arrivingReply,
        finishReason: 'stop',
        usage: { promptTokens: 700, completionTokens: 80 },
      });
      const fan = await signUp('fan@example.com');
      const friend = await signUp('friend@example.com');
      const october = { date: '2026-10-01', precision: 'month' };
      const arriving = await preorder(fan, {
        catalogItemId: catalogIds['Batman: Year One'],
        price: 2500,
        paid: 500,
        expectedRelease: october,
      });
      await preorder(fan, {
        catalogItemId: catalogIds['The Way of Kings'],
        expectedRelease: { date: '2027-03-01', precision: 'month' },
      });
      const cancelled = await preorder(fan, {
        catalogItemId: catalogIds['Batman: The Killing Joke'],
        expectedRelease: october,
      });
      await fan.patch(`/api/preorders/${cancelled}`).send({ status: 'cancelled' }).expect(200);
      await preorder(friend, {
        catalogItemId: catalogIds['Batman: The Killing Joke'],
        expectedRelease: october,
      });

      const response = await ask(fan, "What's arriving this month?");

      expect(response).toMatchObject({
        query: { scope: 'preorders', arrivingAfter: '2026-10-01', arrivingBefore: '2026-11-01' },
        answer: 'You have 1 pre-order arriving in October 2026. Still owed: $20.00.',
        itemIds: [arriving],
        method: 'ai',
      });
      const sent = fakeModel.chat.mock.calls[0]![0].prompt;
      expect(sent).not.toContain('Year One');
      expect(sent).not.toContain('Killing Joke');
    });

    it('answers what is owed with keywords too', async () => {
      await start(null);
      const agent = await signUp();
      await preorder(agent, {
        catalogItemId: catalogIds['Batman: Year One'],
        price: 35000,
        paid: 7000,
      });
      await preorder(agent, {
        catalogItemId: catalogIds['The Way of Kings'],
        price: 2999,
        paid: 2999,
      });

      const response = await ask(agent, 'How much do I still owe?');

      expect(response).toMatchObject({
        method: 'keywords',
        query: { scope: 'preorders', balanceDue: true },
        answer: 'You still owe $280.00 on 1 pre-order.',
      });
    });
  });
});
