import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { appOptions, setupApp } from '../src/setup-app.js';

/**
 * The real app (same options and setup as main.ts) against the test database. `configure`
 * can replace providers, e.g. the external catalog with a fake.
 */
export async function createTestApp(
  configure: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await configure(Test.createTestingModule({ imports: [AppModule] })).compile();
  const app = setupApp(moduleRef.createNestApplication(appOptions));
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}
