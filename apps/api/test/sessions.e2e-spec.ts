import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

const WEB = 'http://localhost:8081';
const MAC_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36';
const IPHONE_APP = 'Expo/57.0.9 CFNetwork/3860.400.51 Darwin/24.6.0';
const reader = { name: 'Reader', email: 'reader@example.com', password: 'correct horse battery' };
const other = { name: 'Other', email: 'other@example.com', password: 'another good password' };

describe('Signed-in devices (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  beforeEach(() => resetDatabase(prisma));
  afterAll(() => app.close());

  /** A browser-like client with its own cookie jar and User-Agent. */
  async function device(
    userAgent: string,
    who = reader,
    { signUp = false }: { signUp?: boolean } = {},
  ) {
    const agent = request.agent(app.getHttpServer());
    const path = signUp ? '/api/auth/sign-up/email' : '/api/auth/sign-in/email';
    const body = signUp ? who : { email: who.email, password: who.password };
    await agent.post(path).set('Origin', WEB).set('User-Agent', userAgent).send(body).expect(200);
    return agent;
  }

  async function twoDevices() {
    const mac = await device(MAC_CHROME, reader, { signUp: true });
    const phone = await device(IPHONE_APP);
    return { mac, phone };
  }

  it("lists the user's devices by name, marking this one, without tokens or addresses", async () => {
    const { mac } = await twoDevices();

    const { body } = await mac.get('/api/sessions').expect(200);

    expect(body).toHaveLength(2);
    expect(body.map((s: { device: string }) => s.device).sort()).toEqual([
      'Chrome on Mac',
      'Fandex on iPhone',
    ]);
    expect(body[0]).toMatchObject({ current: true, device: 'Chrome on Mac' });
    expect(Object.keys(body[0]).sort()).toEqual([
      'current',
      'device',
      'id',
      'lastActiveAt',
      'signedInAt',
    ]);
  });

  it('signs out another device, which then has to sign in again', async () => {
    const { mac, phone } = await twoDevices();
    const sessions = (await mac.get('/api/sessions').expect(200)).body;
    const phoneSession = sessions.find((s: { current: boolean }) => !s.current);

    await mac.delete(`/api/sessions/${phoneSession.id}`).set('Origin', WEB).expect(204);

    await phone.get('/api/me').expect(401);
    await mac.get('/api/me').expect(200);
    expect((await mac.get('/api/sessions').expect(200)).body).toHaveLength(1);
  });

  it('refuses to sign out this device here (that is "Sign out")', async () => {
    const { mac } = await twoDevices();
    const current = (await mac.get('/api/sessions').expect(200)).body.find(
      (s: { current: boolean }) => s.current,
    );

    await mac.delete(`/api/sessions/${current.id}`).set('Origin', WEB).expect(400);
    await mac.get('/api/me').expect(200);
  });

  it("can't see or sign out someone else's devices", async () => {
    const { mac } = await twoDevices();
    const stranger = await device(MAC_CHROME, other, { signUp: true });
    const strangerSession = (await stranger.get('/api/sessions').expect(200)).body[0];

    expect((await mac.get('/api/sessions').expect(200)).body).toHaveLength(2);
    await mac.delete(`/api/sessions/${strangerSession.id}`).set('Origin', WEB).expect(404);
    await mac.post('/api/sessions/sign-out-others').set('Origin', WEB).expect(200);

    await stranger.get('/api/me').expect(200);
  });

  it('signs out every other device and keeps this one', async () => {
    const { mac, phone } = await twoDevices();
    const tablet = await device(MAC_CHROME);

    const { body } = await mac.post('/api/sessions/sign-out-others').set('Origin', WEB).expect(200);

    expect(body).toEqual({ signedOut: 2 });
    await phone.get('/api/me').expect(401);
    await tablet.get('/api/me').expect(401);
    await mac.get('/api/me').expect(200);
  });

  it('needs a session', async () => {
    await request(app.getHttpServer()).get('/api/sessions').expect(401);
  });
});
