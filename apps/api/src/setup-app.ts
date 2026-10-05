import {
  StandardSchemaValidationPipe,
  type INestApplication,
  type NestApplicationOptions,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

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
  // Validates (and transforms) parameters declared with `{ schema }` against zod schemas.
  app.useGlobalPipes(new StandardSchemaValidationPipe({ transform: true }));

  const openApi = new DocumentBuilder()
    .setTitle('Fandex API')
    .setDescription('Accounts, catalog and collection for the Fandex apps.')
    .setVersion('0.2.0')
    .build();
  // Interactive docs at /docs, raw OpenAPI JSON at /docs-json.
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, openApi));

  return app;
}
