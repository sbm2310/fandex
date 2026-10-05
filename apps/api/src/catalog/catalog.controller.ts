import {
  catalogSearchQuerySchema,
  isbnParamSchema,
  type CatalogItemResponse,
  type CatalogSearchResponse,
  type Isbn13,
} from '@fandex/core';
import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
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
  @ApiOkResponse({ description: 'Matching books, manga and comics.' })
  @ApiBadRequestResponse({ description: 'q is missing, or shorter than 2 / longer than 200.' })
  @ApiBadGatewayResponse({ description: 'The external catalog failed.' })
  async search(
    @Query('q', { schema: catalogSearchQuerySchema }) query: string,
  ): Promise<CatalogSearchResponse> {
    return { items: await this.catalog.search(query) };
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
