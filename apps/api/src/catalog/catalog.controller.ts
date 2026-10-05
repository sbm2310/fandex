import {
  catalogSearchKindSchema,
  catalogSearchQuerySchema,
  isbnParamSchema,
  setNumberParamSchema,
  type CatalogItemResponse,
  type CatalogSearchKind,
  type CatalogSearchResponse,
  type Isbn13,
} from '@fandex/core';
import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

import { CatalogService } from './catalog.service.js';

/** Public: searching the catalog doesn't need an account. */
@ApiTags('catalog')
@AllowAnonymous()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('search')
  @ApiOkResponse({
    description: 'Matching books/manga/comics (kind=books) or LEGO sets (kind=lego).',
  })
  @ApiBadRequestResponse({ description: 'q is missing or the wrong length, or kind is unknown.' })
  @ApiBadGatewayResponse({ description: 'The external catalog failed.' })
  @ApiServiceUnavailableResponse({
    description: 'LEGO search is not set up, or the source is busy.',
  })
  async search(
    @Query('q', { schema: catalogSearchQuerySchema }) query: string,
    @Query('kind', { schema: catalogSearchKindSchema }) kind: CatalogSearchKind,
  ): Promise<CatalogSearchResponse> {
    return { items: await this.catalog.search(query, kind) };
  }

  @Get('lego/:setNumber')
  @ApiOkResponse({ description: 'The LEGO set with this number ("75192" or "75192-1").' })
  @ApiBadRequestResponse({ description: 'Not a valid set number.' })
  @ApiNotFoundResponse({ description: 'No such set.' })
  lookupSet(
    @Param('setNumber', { schema: setNumberParamSchema }) setNum: string,
  ): Promise<CatalogItemResponse> {
    return this.catalog.lookupSet(setNum);
  }

  @Get('isbn/:isbn')
  @ApiOkResponse({ description: 'The edition with this ISBN (ISBN-10 or ISBN-13).' })
  @ApiBadRequestResponse({ description: 'Not a valid ISBN.' })
  @ApiNotFoundResponse({ description: 'No catalog knows this ISBN.' })
  lookupIsbn(
    @Param('isbn', { schema: isbnParamSchema }) isbn: Isbn13,
  ): Promise<CatalogItemResponse> {
    return this.catalog.lookupIsbn(isbn);
  }
}
