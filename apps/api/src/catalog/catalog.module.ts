import { OpenLibraryCatalog } from '@fandex/core';
import { Module } from '@nestjs/common';

import { CatalogController } from './catalog.controller.js';
import { BOOK_CATALOG, CatalogService } from './catalog.service.js';
import { RateLimitedCatalog } from './rate-limited-catalog.js';

/** Identifying ourselves raises Open Library's limit from 1 to 3 requests per second. */
const OPEN_LIBRARY_USER_AGENT = 'Fandex/0.2 (https://github.com/sbm2310/fandex)';

@Module({
  controllers: [CatalogController],
  providers: [
    CatalogService,
    {
      provide: BOOK_CATALOG,
      // ~2.9 requests/second, just under the limit.
      useFactory: () =>
        new RateLimitedCatalog(
          new OpenLibraryCatalog({ headers: { 'User-Agent': OPEN_LIBRARY_USER_AGENT } }),
          350,
        ),
    },
  ],
})
export class CatalogModule {}
