import {
  StandardSchemaValidationPipe,
  type INestApplication,
  type NestApplicationOptions,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { trustedOrigins } from './auth/auth.js';
import type { Env } from './config/env.js';

/**
 * Options for creating the app. Better Auth reads raw request bodies on its routes, so Nest's
 * body parser is off; the auth module re-adds JSON parsing for all other routes.
 */
export const appOptions: NestApplicationOptions = { bodyParser: false };

/**
 * Configuration shared by main.ts and the e2e tests, so tests exercise the same app setup
 * as production.
 */
export function setupApp(app: INestApplication): INestApplication {
  app.enableShutdownHooks();
  // Every API route lives under /api (Better Auth is mounted at /api/auth), so the web app can
  // be served from the same origin and own every other path.
  app.setGlobalPrefix('api');
  // Validates (and transforms) parameters declared with `{ schema }` against zod schemas.
  app.useGlobalPipes(new StandardSchemaValidationPipe({ transform: true }));
  // Browsers on another origin (the web app in development) may send cookies with these
  // methods. The auth module's built-in CORS left out PATCH (editing items and pre-orders).
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  app.enableCors({
    origin: trustedOrigins({
      NODE_ENV: config.get('NODE_ENV', { infer: true }),
      BETTER_AUTH_URL: config.get('BETTER_AUTH_URL', { infer: true }),
      TRUSTED_ORIGINS: config.get('TRUSTED_ORIGINS', { infer: true }),
    }),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  const openApi = new DocumentBuilder()
    .setTitle('Fandex API')
    .setDescription('Accounts, catalog and collection for the Fandex apps.')
    .setVersion('0.2.0')
    .build();
  // Interactive docs at /api/docs, raw OpenAPI JSON at /api/docs-json.
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, openApi));

  return app;
}
