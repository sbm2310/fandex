import {
  createFigureRequestSchema,
  type CatalogItemResponse,
  type CreateFigureRequest,
} from '@fandex/core';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';

import { CatalogService } from './catalog.service.js';

/**
 * Items added by hand (figures: no public catalog covers them). Signed in; each one is
 * private to the user who added it.
 */
@ApiTags('catalog')
@Controller('catalog/custom')
export class CustomItemsController {
  constructor(private readonly catalog: CatalogService) {}

  @Post()
  @ApiCreatedResponse({
    description:
      'The figure as a catalog item, with the universes and characters its name mentions. Add it to the collection with POST /collection.',
  })
  @ApiBadRequestResponse({
    description: 'No name, a field too long, or an image that is not an https:// link.',
  })
  create(
    @Session() session: UserSession,
    @Body({ schema: createFigureRequestSchema }) body: CreateFigureRequest,
  ): Promise<CatalogItemResponse> {
    return this.catalog.createFigure(session.user.id, body);
  }
}
