import { WikidataSeriesCatalog } from '@fandex/core';
import { Module } from '@nestjs/common';

import { RequestSpacer } from '../catalog/request-spacer.js';

import { SeriesController } from './series.controller.js';
import { SERIES_SOURCE, SeriesService, type SeriesSource } from './series.service.js';

/** Wikimedia asks clients to say who they are; the repository link is how to reach us. */
const WIKIDATA_USER_AGENT = 'Fandex/0.2 (https://github.com/sbm2310/fandex)';

@Module({
  controllers: [SeriesController],
  providers: [
    SeriesService,
    {
      provide: SERIES_SOURCE,
      // One query a second at most: well within 60 s of query time a minute (each takes 2–4 s).
      useFactory: (): SeriesSource => {
        const wikidata = new WikidataSeriesCatalog({ userAgent: WIKIDATA_USER_AGENT });
        const spacer = new RequestSpacer(1000);
        return {
          seriesForWork: (key, options) => spacer.run(() => wikidata.seriesForWork(key, options)),
        };
      },
    },
  ],
  exports: [SeriesService],
})
export class SeriesModule {}
