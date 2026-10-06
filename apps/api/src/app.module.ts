import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '@thallesp/nestjs-better-auth';

import { createAuth } from './auth/auth.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { CollectionModule } from './collection/collection.module.js';
import { envSchema, type Env } from './config/env.js';
import { HealthModule } from './health/health.module.js';
import { MeModule } from './me/me.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { UniversesModule } from './universes/universes.module.js';

@Module({
  imports: [
    // Validates process.env (and .env in development) against the zod schema at startup.
    // Tests ignore .env, so a developer's local settings (e.g. real API keys) can't leak in.
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envSchema,
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    PrismaModule,
    // Mounts Better Auth at /api/auth and registers a global guard: every route requires a
    // signed-in user unless marked @AllowAnonymous() (secure by default).
    AuthModule.forRootAsync({
      inject: [PrismaService, ConfigService],
      useFactory: (prisma: PrismaService, config: ConfigService<Env, true>) => ({
        auth: createAuth(prisma, {
          NODE_ENV: config.get('NODE_ENV', { infer: true }),
          BETTER_AUTH_SECRET: config.get('BETTER_AUTH_SECRET', { infer: true }),
          BETTER_AUTH_URL: config.get('BETTER_AUTH_URL', { infer: true }),
          TRUSTED_ORIGINS: config.get('TRUSTED_ORIGINS', { infer: true }),
        }),
      }),
    }),
    HealthModule,
    MeModule,
    UniversesModule,
    CatalogModule,
    CollectionModule,
  ],
})
export class AppModule {}
