import { aiQuotaResponseSchema, shelfScanResponseSchema } from '@fandex/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { usageDay } from '../src/ai/ai-quota.service.js';
import { AiProviderError, AiRateLimitError, type ChatModel } from '../src/ai/chat-client.js';
import { CHAT_MODEL } from '../src/ai/shelf-reader.service.js';
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

describe('AI (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function start(model: ChatModel | null = fakeModel) {
    ({ app, prisma } = await createTestApp((builder) =>
      builder.overrideProvider(CHAT_MODEL).useValue(model),
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

  it('reads a shelf photo sent in parts, and counts it', async () => {
    await start();
    const agent = await signUp();
    const left = jpeg(10);
    const right = jpeg(20);

    const { body } = await scan(agent, [left, right]).expect(200);

    expect(shelfScanResponseSchema.parse(body)).toEqual({
      readings: [
        { kind: 'manga', title: 'Vagabond', author: 'Takehiko Inoue', count: 8 },
        { kind: 'lego', title: 'Millennium Falcon', count: 1, setNumber: '75375' },
      ],
      quota: { used: 1, limit: 5 },
    });
    // One request with both parts, core's prompt and the measured settings.
    expect(fakeModel.chat).toHaveBeenCalledTimes(1);
    const sent = fakeModel.chat.mock.calls[0]![0];
    expect(sent).toMatchObject({ model: 'qwen/qwen3.8-27b', maxTokens: 800, temperature: 0.6 });
    expect(sent.prompt).toContain('The 2 images are parts of one photo');
    expect(sent.images?.map((image) => Buffer.from(image))).toEqual([left, right]);

    const quota = aiQuotaResponseSchema.parse((await agent.get('/api/ai/quota').expect(200)).body);
    expect(quota).toEqual({ available: true, shelfScans: { used: 1, limit: 5 } });
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
    expect(fakeModel.chat).toHaveBeenCalledTimes(5);
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
      data: { userId: others.id, day: usageDay(new Date()), kind: 'shelf_scan', count: 60 },
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
