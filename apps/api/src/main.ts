import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';
import { appOptions, setupApp } from './setup-app.js';

const app = setupApp(await NestFactory.create(AppModule, appOptions));
const port = app.get(ConfigService<Env, true>).get('PORT', { infer: true });
await app.listen(port);
console.log(`Fandex API listening on http://localhost:${port} (docs at /docs)`);
