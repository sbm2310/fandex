import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CatalogModule } from '../catalog/catalog.module.js';
import type { Env } from '../config/env.js';

import { AiQuotaService } from './ai-quota.service.js';
import { AiController } from './ai.controller.js';
import { ChatClient } from './chat-client.js';
import { CHAT_MODEL, ShelfReader } from './shelf-reader.service.js';
import { ShelfScanService } from './shelf-scan.service.js';

@Module({
  imports: [CatalogModule],
  controllers: [AiController],
  providers: [
    AiQuotaService,
    ShelfReader,
    ShelfScanService,
    {
      provide: CHAT_MODEL,
      inject: [ConfigService],
      // Without a key the AI features are simply off (they answer 503), like LEGO without one.
      useFactory: (config: ConfigService<Env, true>) => {
        const apiKey = config.get('GROQ_API_KEY', { infer: true });
        return apiKey
          ? new ChatClient({ apiKey, baseUrl: config.get('AI_BASE_URL', { infer: true }) })
          : null;
      },
    },
  ],
})
export class AiModule {}
