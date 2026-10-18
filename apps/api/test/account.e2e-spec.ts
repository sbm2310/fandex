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

    it('lets the web app edit with PATCH (items, pre-orders)', async () => {
      const response = await request(app.getHttpServer())
        .options('/api/preorders/x')
        .set('Origin', WEB)
        .set('Access-Control-Request-Method', 'PATCH');

      expect(response.headers['access-control-allow-methods']).toContain('PATCH');
      expect(response.headers['access-control-allow-origin']).toBe(WEB);
    });

    it('does not allow other sites', async () => {
      const response = await request(app.getHttpServer())
        .options('/api/me')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('display name', () => {
    it('renames the signed-in user, trimmed', async () => {
      const agent = await signedInBrowser();

      await agent
        .post('/api/auth/update-user')
        .set('Origin', WEB)
        .send({ name: '  Shalom  ' })
        .expect(200);

      const me = await agent.get('/api/me').expect(200);
      expect(me.body.name).toBe('Shalom');
    });

    it.each([
      ['an empty name', '   '],
      ['a name over 50 characters', 'a'.repeat(51)],
      ['a name that is not text', 42],
    ])('refuses %s', async (_, name) => {
      const agent = await signedInBrowser();

      const response = await agent.post('/api/auth/update-user').set('Origin', WEB).send({ name });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_NAME');
      expect((await agent.get('/api/me').expect(200)).body.name).toBe(reader.name);
    });

    it('checks names on sign-up too', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/sign-up/email')
        .set('Origin', WEB)
        .send({ ...reader, name: '' });

      expect(response.status).toBe(400);
      expect(await prisma.user.count()).toBe(0);
    });

    it("can't rename without a session", async () => {
      await request(app.getHttpServer())
        .post('/api/auth/update-user')
        .set('Origin', WEB)
        .send({ name: 'Intruder' })
        .expect(401);
    });
  });

  describe('preferred currency', () => {
    it('is USD until the user picks another', async () => {
      const agent = await signedInBrowser();
      expect((await agent.get('/api/me').expect(200)).body.preferredCurrency).toBe('USD');

      await agent
        .post('/api/auth/update-user')
        .set('Origin', WEB)
        .send({ preferredCurrency: 'ILS' })
        .expect(200);

      const me = await agent.get('/api/me').expect(200);
      expect(me.body.preferredCurrency).toBe('ILS');
      expect(me.body.name).toBe(reader.name);
    });

    it.each([
      ['an unknown currency', 'XYZ'],
      ['lower case', 'ils'],
      ['not text', 7],
    ])('refuses %s', async (_, preferredCurrency) => {
      const agent = await signedInBrowser();

      const response = await agent
        .post('/api/auth/update-user')
        .set('Origin', WEB)
        .send({ preferredCurrency });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_CURRENCY');
      expect((await agent.get('/api/me').expect(200)).body.preferredCurrency).toBe('USD');
    });
  });

  describe('change password', () => {
    const newPassword = 'a brand new passphrase';

    it('changes the password; the old one stops working', async () => {
      const agent = await signedInBrowser();

      await agent
        .post('/api/auth/change-password')
        .set('Origin', WEB)
        .send({ currentPassword: reader.password, newPassword })
        .expect(200);

      const server = app.getHttpServer();
      const signIn = (password: string) =>
        request(server)
          .post('/api/auth/sign-in/email')
          .set('Origin', WEB)
          .send({ email: reader.email, password });
      expect((await signIn(reader.password)).status).toBe(401);
      expect((await signIn(newPassword)).status).toBe(200);
    });

    it('refuses a wrong current password', async () => {
      const agent = await signedInBrowser();

      const response = await agent
        .post('/api/auth/change-password')
        .set('Origin', WEB)
        .send({ currentPassword: 'not my password', newPassword });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_PASSWORD');
    });

    it('signs out other devices when asked', async () => {
      const agent = await signedInBrowser();
      const other = request.agent(app.getHttpServer());
      await other
        .post('/api/auth/sign-in/email')
        .set('Origin', WEB)
        .send({ email: reader.email, password: reader.password })
        .expect(200);

      await agent
        .post('/api/auth/change-password')
        .set('Origin', WEB)
        .send({ currentPassword: reader.password, newPassword, revokeOtherSessions: true })
        .expect(200);

      await other.get('/api/me').expect(401);
      await agent.get('/api/me').expect(200);
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
