import {
  aiQuotaResponseSchema,
  figureScanResponseSchema,
  figureSeedEntrySchema,
} from '@fandex/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { z } from 'zod';

import { usageDay } from '../src/ai/ai-quota.service.js';
import { AiProviderError, type ChatModel } from '../src/ai/chat-client.js';
import { CHAT_MODEL } from '../src/ai/shelf-reader.service.js';
import { FIGURE_SEED_ENTRIES, FigureSeedService } from '../src/catalog/figure-seed.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

/** The smallest thing that passes for a JPEG: its magic bytes and a little padding. */
const jpeg = (size = 64) =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size)]);

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
  {
    id: 'inart-gandalf-the-grey',
    brand: 'inart',
    line: 'sixth-scale',
    name: 'Gandalf the Grey',
    universe: 'middle-earth',
    characters: ['gandalf'],
    sources: ['https://example.com/gandalf'],
  },
]);

const fakeModel = { chat: vi.fn<ChatModel['chat']>() };
const answer = (text: string) => ({
  text,
  finishReason: 'stop',
  usage: { promptTokens: 1500, completionTokens: 40 },
});

type Agent = ReturnType<typeof request.agent>;

describe('Figure box scans (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function start(model: ChatModel | null = fakeModel) {
    ({ app, prisma } = await createTestApp((builder) =>
      builder
        .overrideProvider(CHAT_MODEL)
        .useValue(model)
        .overrideProvider(FIGURE_SEED_ENTRIES)
        .useValue(LIST),
    ));
    await resetDatabase(prisma);
    await app.get(FigureSeedService).sync();
  }

  beforeEach(() => {
    fakeModel.chat
      .mockReset()
      .mockResolvedValue(answer('brand: HOT TOYS\nnumber: MMS279\nname: Darth Vader\nscale: 1/6'));
  });
  afterEach(() => app.close());

  async function signUp(email = 'fan@example.com'): Promise<Agent> {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:8081')
      .send({ name: 'Fan', email, password: 'correct horse battery' })
      .expect(200);
    return agent;
  }

  const scan = (agent: Agent, images = [jpeg()]) =>
    images.reduce(
      (req, image, index) =>
        req.attach('images', image, { filename: `box-${index}.jpg`, contentType: 'image/jpeg' }),
      agent.post('/api/ai/figure-scans'),
    );

  it('needs an account and JPEG photos', async () => {
    await start();
    await scan(request.agent(app.getHttpServer())).expect(401);
    const fan = await signUp();
    await fan.post('/api/ai/figure-scans').expect(400);
    await fan
      .post('/api/ai/figure-scans')
      .attach('images', Buffer.from('GIF89a'), { filename: 'x.gif', contentType: 'image/gif' })
      .expect(400);
    expect(fakeModel.chat).not.toHaveBeenCalled();
  });

  it("finds the figure a box's number names, marks it owned, and counts the scan", async () => {
    await start();
    const fan = await signUp();

    const first = figureScanResponseSchema.parse(
      (await scan(fan, [jpeg(), jpeg()]).expect(200)).body,
    );

    expect(first.reading).toEqual({
      brand: 'Hot Toys',
      number: 'MMS 279',
      name: 'Darth Vader',
      scale: '1/6',
    });
    expect(first.candidates.map((c) => [c.item.externalId, c.by, c.owned])).toEqual([
      ['hot-toys-mms-279', 'number', false],
    ]);
    expect(first.quota).toEqual({ used: 1, limit: 5 });
    expect(fakeModel.chat.mock.calls[0]![0]).toMatchObject({
      images: [expect.anything(), expect.anything()],
    });
    expect(fakeModel.chat.mock.calls[0]![0].prompt).toContain('box of a collectible figure');

    await fan
      .post('/api/collection')
      .send({ catalogItemId: first.candidates[0]!.item.id })
      .expect(201);
    const second = figureScanResponseSchema.parse((await scan(fan).expect(200)).body);
    expect(second.candidates[0]?.owned).toBe(true);
    const quota = aiQuotaResponseSchema.parse((await fan.get('/api/ai/quota')).body);
    expect(quota.figureScans).toEqual({ used: 2, limit: 5 });
    expect(quota.shelfScans).toEqual({ used: 0, limit: 5 });
  });

  it('finds a figure by its name when the box shows no number', async () => {
    await start();
    fakeModel.chat.mockResolvedValue(answer('brand: InArt\nnumber: -\nname: Gandalf the Grey'));
    const fan = await signUp();

    const { candidates } = figureScanResponseSchema.parse((await scan(fan).expect(200)).body);

    expect(candidates.map((c) => [c.item.externalId, c.by])).toEqual([
      ['inart-gandalf-the-grey', 'name'],
    ]);
  });

  it('answers with no reading when nothing on the box identifies a figure (still counted)', async () => {
    await start();
    fakeModel.chat.mockResolvedValue(answer("I can't make out this box."));
    const fan = await signUp();

    const body = figureScanResponseSchema.parse((await scan(fan).expect(200)).body);

    expect(body).toMatchObject({ reading: null, candidates: [], quota: { used: 1 } });
  });

  it("has its own daily allowance, and doesn't charge for a provider failure", async () => {
    await start();
    const fan = await signUp();
    const { id: userId } = await prisma.user.findUniqueOrThrow({
      where: { email: 'fan@example.com' },
    });

    fakeModel.chat.mockRejectedValueOnce(new AiProviderError('overloaded', 503));
    const busy = await scan(fan).expect(503);
    expect(busy.headers['retry-after']).toBe('30');
    expect(busy.body.message).toBe('Box scanning is unavailable right now. Try again shortly.');

    // Shelf scans used up don't stop box scans, and box scans have their own limit.
    await prisma.aiUsage.create({
      data: { userId, day: usageDay(new Date()), kind: 'shelf_scan', count: 5 },
    });
    await scan(fan).expect(200);
    await prisma.aiUsage.update({
      where: { userId_day_kind: { userId, day: usageDay(new Date()), kind: 'figure_scan' } },
      data: { count: 5 },
    });
    await scan(fan).expect(429);
    expect(fakeModel.chat).toHaveBeenCalledTimes(2);
  });

  it('is off without an AI provider', async () => {
    await start(null);
    const fan = await signUp();
    await scan(fan).expect(503);
  });
});
