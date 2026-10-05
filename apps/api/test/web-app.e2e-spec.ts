import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { appOptions, setupApp } from '../src/setup-app.js';
import { serveWebApp } from '../src/web-app.js';

describe('Serving the web app (e2e)', () => {
  let app: NestExpressApplication;
  let directory: string;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'fandex-web-'));
    writeFileSync(join(directory, 'index.html'), '<!doctype html><title>Fandex</title>');
    mkdirSync(join(directory, '_expo', 'static', 'js'), { recursive: true });
    writeFileSync(join(directory, '_expo', 'static', 'js', 'entry-abc123.js'), 'console.log(1)');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>(appOptions);
    setupApp(app);
    // A relative path, as render.yaml passes it (sendFile needs it resolved).
    serveWebApp(app, relative(process.cwd(), directory));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it.each(['/', '/add', '/book/0199b5a0-7c1e-7a3b-9f00-1234567890ab'])(
    'serves the app shell for %s (client-side routing)',
    async (path) => {
      const response = await request(app.getHttpServer()).get(path).expect(200);

      expect(response.text).toContain('<title>Fandex</title>');
      expect(response.headers['cache-control']).toBe('no-cache');
    },
  );

  it('serves content-hashed bundles with a long cache', async () => {
    const response = await request(app.getHttpServer())
      .get('/_expo/static/js/entry-abc123.js')
      .expect(200);

    expect(response.headers['cache-control']).toContain('immutable');
  });

  it('keeps API routes and API 404s as JSON', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect('Content-Type', /json/);
    const missing = await request(app.getHttpServer()).get('/api/nope').expect(404);

    expect(missing.headers['content-type']).toMatch(/json/);
  });

  it('refuses to start without an index.html', () => {
    expect(() => serveWebApp(app, join(directory, 'missing'))).toThrow(/index\.html/);
  });
});
