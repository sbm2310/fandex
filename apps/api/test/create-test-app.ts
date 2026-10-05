import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { appOptions, setupApp } from '../src/setup-app.js';

/** The real app (same options and setup as main.ts) against the test database. */
export async function createTestApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = setupApp(moduleRef.createNestApplication(appOptions));
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}
