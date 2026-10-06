import { OpenLibraryCatalog, RebrickableCatalog } from '@fandex/core';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';

import { CatalogSignalsService } from './catalog-signals.service.js';
import { CatalogController } from './catalog.controller.js';
import { BOOK_CATALOG, CatalogService, LEGO_CATALOG } from './catalog.service.js';
import { RateLimitedCatalog } from './rate-limited-catalog.js';
import { RequestSpacer } from './request-spacer.js';

/** Identifying ourselves raises Open Library's limit from 1 to 3 requests per second. */
const OPEN_LIBRARY_USER_AGENT = 'Fandex/0.2 (https://github.com/sbm2310/fandex)';

@Module({
  controllers: [CatalogController],
  providers: [
    CatalogService,
    CatalogSignalsService,
    {
      provide: BOOK_CATALOG,
      // ~2.9 requests/second, just under the limit.
      useFactory: () =>
        new RateLimitedCatalog(
          new OpenLibraryCatalog({ headers: { 'User-Agent': OPEN_LIBRARY_USER_AGENT } }),
          350,
        ),
    },
    {
      provide: LEGO_CATALOG,
      inject: [ConfigService],
      // Rebrickable throttles to about 1 request/second, so every HTTP request (a set lookup
      // makes two) waits for its slot. Without a key, LEGO is simply off.
      useFactory: (config: ConfigService<Env, true>) => {
        const apiKey = config.get('REBRICKABLE_API_KEY', { infer: true });
        if (!apiKey) return null;
        const spacer = new RequestSpacer(1000);
        return new RebrickableCatalog({ apiKey, beforeRequest: () => spacer.run(async () => {}) });
      },
    },
  ],
  exports: [CatalogSignalsService],
})
export class CatalogModule {}
