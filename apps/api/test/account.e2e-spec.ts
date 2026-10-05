import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

const WEB = 'http://localhost:8081';
const reader = { name: 'Reader', email: 'reader@example.com', password: 'correct horse battery' };

describe('Account (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  beforeEach(() => resetDatabase(prisma));
  afterAll(() => app.close());

  async function signedInBrowser() {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/sign-up/email').set('Origin', WEB).send(reader).expect(200);
    return agent;
  }

  describe('native app (Expo)', () => {
    // React Native sends no Origin header; the Expo client sends `expo-origin` instead and
    // passes the session cookie explicitly (it keeps it in the Keychain, not a cookie jar).
    it('signs in and uses the session without an Origin header', async () => {
      await signedInBrowser();
      const server = app.getHttpServer();

      const signIn = await request(server)
        .post('/api/auth/sign-in/email')
        .set('expo-origin', 'fandex://')
        .send({ email: reader.email, password: reader.password })
        .expect(200);
      const cookie = String(signIn.headers['set-cookie']).split(';')[0] ?? '';

      await request(server).get('/api/me').set('Cookie', cookie).expect(200);
      await request(server)
        .post('/api/auth/sign-out')
        .set('Cookie', cookie)
        .set('expo-origin', 'fandex://')
        .send({})
        .expect(200);
      await request(server).get('/api/me').set('Cookie', cookie).expect(401);
    });
  });

  describe('CORS', () => {
    it('allows the web app to call the API with credentials', async () => {
      const response = await request(app.getHttpServer())
        .options('/api/me')
        .set('Origin', WEB)
        .set('Access-Control-Request-Method', 'GET');

      expect(response.headers['access-control-allow-origin']).toBe(WEB);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('does not allow other sites', async () => {
      const response = await request(app.getHttpServer())
        .options('/api/me')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('delete account', () => {
    it('deletes the user, their sessions and sign-in methods', async () => {
      const agent = await signedInBrowser();

      await agent
        .post('/api/auth/delete-user')
        .set('Origin', WEB)
        .send({ password: reader.password })
        .expect(200);

      await agent.get('/api/me').expect(401);
      expect(await prisma.user.count()).toBe(0);
      expect(await prisma.session.count()).toBe(0);
      expect(await prisma.account.count()).toBe(0);
    });

    it('refuses with a wrong password', async () => {
      const agent = await signedInBrowser();

      const response = await agent
        .post('/api/auth/delete-user')
        .set('Origin', WEB)
        .send({ password: 'not my password' });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(await prisma.user.count()).toBe(1);
      await agent.get('/api/me').expect(200);
    });
  });
});
