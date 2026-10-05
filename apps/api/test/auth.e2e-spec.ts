import { meResponseSchema } from '@fandex/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

// A trusted web origin (TRUSTED_ORIGINS in the e2e env). Better Auth rejects cookie-based
// requests from other origins (CSRF protection).
const ORIGIN = 'http://localhost:8081';
const reader = { name: 'Reader', email: 'reader@example.com', password: 'correct horse battery' };

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  beforeEach(() => resetDatabase(prisma));
  afterAll(() => app.close());

  /** A cookie-keeping client, like a browser. */
  const browser = () => request.agent(app.getHttpServer());

  async function signUp(agent = browser(), body: object = reader) {
    const response = await agent.post('/api/auth/sign-up/email').set('Origin', ORIGIN).send(body);
    return { agent, response };
  }

  it('signs up and is signed in straight away', async () => {
    const { agent, response } = await signUp();

    expect(response.status).toBe(200);
    expect(String(response.headers['set-cookie'])).toMatch(/session_token=/);

    const me = await agent.get('/me').expect(200);
    expect(meResponseSchema.parse(me.body)).toMatchObject({
      email: reader.email,
      name: reader.name,
      emailVerified: false,
    });
  });

  it('rejects /me without a session', async () => {
    await request(app.getHttpServer()).get('/me').expect(401);
  });

  it('signs in with the right password', async () => {
    await signUp();
    const agent = browser();

    await agent
      .post('/api/auth/sign-in/email')
      .set('Origin', ORIGIN)
      .send({ email: reader.email, password: reader.password })
      .expect(200);

    await agent.get('/me').expect(200);
  });

  it('rejects a wrong password', async () => {
    await signUp();

    await browser()
      .post('/api/auth/sign-in/email')
      .set('Origin', ORIGIN)
      .send({ email: reader.email, password: 'wrong password!' })
      .expect(401);
  });

  it('rejects a second account with the same email', async () => {
    await signUp();

    const { response } = await signUp(browser(), { ...reader, name: 'Copycat' });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await prisma.user.count()).toBe(1);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const { response } = await signUp(browser(), { ...reader, password: 'short' });

    expect(response.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it('signs out', async () => {
    const { agent } = await signUp();

    await agent.post('/api/auth/sign-out').set('Origin', ORIGIN).send({}).expect(200);

    await agent.get('/me').expect(401);
  });

  it('stores a password hash, never the password', async () => {
    await signUp();

    const account = await prisma.account.findFirstOrThrow({ where: { providerId: 'credential' } });
    expect(account.password).toBeTruthy();
    expect(account.password).not.toContain(reader.password);
  });

  it('rejects sign-in attempts from an untrusted origin', async () => {
    await signUp();

    const response = await browser()
      .post('/api/auth/sign-in/email')
      .set('Origin', 'https://evil.example')
      .send({ email: reader.email, password: reader.password });

    expect(response.status).toBe(403);
  });

  it('rejects cookie-authenticated requests from another site (CSRF)', async () => {
    const { agent } = await signUp();

    // A malicious page making the signed-in browser sign out: the cookie is sent, but the
    // Origin isn't trusted.
    await agent
      .post('/api/auth/sign-out')
      .set('Origin', 'https://evil.example')
      .send({})
      .expect(403);

    await agent.get('/me').expect(200);
  });

  it('keeps /health public', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });
});
