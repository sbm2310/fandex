import {
  addToCollectionRequestSchema,
  updateCollectionItemRequestSchema,
  type UpdateCollectionItemRequest,
  type AddToCollectionRequest,
  type CollectionItemResponse,
  type CollectionResponse,
  type CollectionUniversesResponse,
} from '@fandex/core';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import { z } from 'zod';

import { CollectionService } from './collection.service.js';

const itemIdSchema = z.uuid();

/** The signed-in user's collection (the global auth guard requires a session). */
@ApiTags('collection')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Not signed in.' })
@Controller('collection')
export class CollectionController {
  constructor(private readonly collection: CollectionService) {}

  @Get()
  @ApiOkResponse({ description: 'Your items, newest first.' })
  async list(@Session() session: UserSession): Promise<CollectionResponse> {
    return { items: await this.collection.list(session.user.id) };
  }

  @Get('universes')
  @ApiOkResponse({
    description:
      'The universes you own items from, with counts per category, covers and characters.',
  })
  async universes(@Session() session: UserSession): Promise<CollectionUniversesResponse> {
    return { universes: await this.collection.universes(session.user.id) };
  }

  @Post()
  @ApiCreatedResponse({ description: 'Added.' })
  @ApiOkResponse({ description: 'Already in your collection; the existing item is returned.' })
  @ApiNotFoundResponse({ description: 'No such catalog item.' })
  async add(
    @Session() session: UserSession,
    @Body({ schema: addToCollectionRequestSchema }) body: AddToCollectionRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CollectionItemResponse> {
    const { item, created } = await this.collection.add(session.user.id, body.catalogItemId);
    response.status(created ? 201 : 200);
    return item;
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Updated; the item as you now see it.' })
  @ApiBadRequestResponse({
    description: 'Nothing to change, an unknown universe or character, or a LEGO category change.',
  })
  @ApiNotFoundResponse({ description: 'Not in your collection.' })
  async update(
    @Session() session: UserSession,
    @Param('id', { schema: itemIdSchema }) id: string,
    @Body({ schema: updateCollectionItemRequestSchema }) body: UpdateCollectionItemRequest,
  ): Promise<CollectionItemResponse> {
    return this.collection.update(session.user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Removed.' })
  @ApiNotFoundResponse({ description: 'Not in your collection.' })
  async remove(
    @Session() session: UserSession,
    @Param('id', { schema: itemIdSchema }) id: string,
  ): Promise<void> {
    await this.collection.remove(session.user.id, id);
  }
}
