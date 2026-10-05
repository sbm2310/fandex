import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Configuration shared by main.ts and the e2e tests, so tests exercise the same app setup
 * as production.
 */
export function setupApp(app: INestApplication): INestApplication {
  app.enableShutdownHooks();

  const openApi = new DocumentBuilder()
    .setTitle('Fandex API')
    .setDescription('Accounts, catalog and collection for the Fandex apps.')
    .setVersion('0.2.0')
    .build();
  // Interactive docs at /docs, raw OpenAPI JSON at /docs-json.
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, openApi));

  return app;
}
