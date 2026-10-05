import { Test } from '@nestjs/testing';

import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('reports ok', async () => {
    const module = await Test.createTestingModule({ controllers: [HealthController] }).compile();

    expect(module.get(HealthController).check()).toEqual({ status: 'ok' });
  });
});
