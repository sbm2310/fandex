import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { appOptions, setupApp } from '../src/setup-app.js';

describe('API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = setupApp(moduleRef.createNestApplication(appOptions));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health reports the API and database as up', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok', database: 'up' });
  });

  it('serves the OpenAPI document', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);

    expect(response.body).toMatchObject({ info: { title: 'Fandex API' } });
    expect(Object.keys(response.body.paths as object)).toContain('/api/health');
  });

  it('returns 404 for unknown routes', async () => {
    await request(app.getHttpServer()).get('/api/nope').expect(404);
  });
});
