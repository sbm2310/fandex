import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';
import { appOptions, setupApp } from './setup-app.js';
import { serveWebApp } from './web-app.js';

const app = await NestFactory.create<NestExpressApplication>(AppModule, appOptions);
setupApp(app);
const config = app.get(ConfigService<Env, true>);
const webAppDir = config.get('WEB_APP_DIR', { infer: true });
if (webAppDir) serveWebApp(app, webAppDir);
const port = config.get('PORT', { infer: true });
await app.listen(port);
console.log(`Fandex API listening on http://localhost:${port} (docs at /api/docs)`);
