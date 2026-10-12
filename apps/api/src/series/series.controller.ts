import { workKeysQuerySchema, type WorkSeriesResponse } from '@fandex/core';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

import { SeriesService } from './series.service.js';

/** Public: series are reference data (guests see what they're missing too). */
@ApiTags('series')
@AllowAnonymous()
@Controller('series')
export class SeriesController {
  constructor(private readonly series: SeriesService) {}

  @Get('works')
  @ApiOkResponse({
    description:
      "Each work's series (null: none known, or Wikidata couldn't be asked just now), each series once.",
  })
  @ApiBadRequestResponse({ description: 'keys missing, not Open Library work ids, or over 50.' })
  forWorks(
    @Query('keys', { schema: workKeysQuerySchema }) keys: string[],
  ): Promise<WorkSeriesResponse> {
    return this.series.forWorks(keys);
  }
}
