import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

async function createController(databaseUp: boolean) {
  const module = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [{ provide: PrismaService, useValue: { isHealthy: async () => databaseUp } }],
  }).compile();
  return module.get(HealthController);
}

describe('HealthController', () => {
  it('reports ok when the database is up', async () => {
    const controller = await createController(true);

    await expect(controller.check()).resolves.toEqual({ status: 'ok', database: 'up' });
  });

  it('responds 503 when the database is down', async () => {
    const controller = await createController(false);

    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
