import {
  createPreorderRequestSchema,
  updatePreorderRequestSchema,
  type CollectionItemResponse,
  type CreatePreorderInput,
  type PreorderResponse,
  type PreordersResponse,
  type UpdatePreorderInput,
} from '@fandex/core';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { z } from 'zod';

import { PreordersService } from './preorders.service.js';

const idSchema = z.uuid();

/** The signed-in user's pre-orders (account only: they hold payments you'd want everywhere). */
@ApiTags('preorders')
@Controller('preorders')
export class PreordersController {
  constructor(private readonly preorders: PreordersService) {}

  @Get()
  @ApiOkResponse({ description: 'Your pre-orders, newest first, each with its date history.' })
  async list(@Session() session: UserSession): Promise<PreordersResponse> {
    return { preorders: await this.preorders.list(session.user.id) };
  }

  @Get(':id')
  @ApiOkResponse({ description: 'One of your pre-orders.' })
  @ApiNotFoundResponse({ description: 'Not one of your pre-orders.' })
  get(
    @Session() session: UserSession,
    @Param('id', { schema: idSchema }) id: string,
  ): Promise<PreorderResponse> {
    return this.preorders.get(session.user.id, id);
  }

  @Post()
  @ApiCreatedResponse({ description: 'The new pre-order.' })
  @ApiBadRequestResponse({ description: 'Invalid fields, or paid more than the price.' })
  @ApiNotFoundResponse({ description: 'No such catalog item.' })
  create(
    @Session() session: UserSession,
    @Body({ schema: createPreorderRequestSchema }) body: CreatePreorderInput,
  ): Promise<PreorderResponse> {
    return this.preorders.create(session.user.id, body);
  }

  @Patch(':id')
  @ApiOkResponse({
    description: 'The pre-order as it is now; a new expected date is added to its history.',
  })
  @ApiBadRequestResponse({
    description: 'Nothing to change, invalid fields, or paid more than the price.',
  })
  @ApiNotFoundResponse({ description: 'Not one of your pre-orders.' })
  @ApiConflictResponse({ description: "It's arrived: its status can't change any more." })
  update(
    @Session() session: UserSession,
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: updatePreorderRequestSchema }) body: UpdatePreorderInput,
  ): Promise<PreorderResponse> {
    return this.preorders.update(session.user.id, id, body);
  }

  @Post(':id/arrive')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Closed, and the item is in your collection. Safe to repeat.' })
  @ApiNotFoundResponse({ description: 'Not one of your pre-orders.' })
  @ApiConflictResponse({ description: 'It was cancelled.' })
  arrive(
    @Session() session: UserSession,
    @Param('id', { schema: idSchema }) id: string,
  ): Promise<{ preorder: PreorderResponse; item: CollectionItemResponse }> {
    return this.preorders.arrive(session.user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Deleted.' })
  @ApiNotFoundResponse({ description: 'Not one of your pre-orders.' })
  async remove(
    @Session() session: UserSession,
    @Param('id', { schema: idSchema }) id: string,
  ): Promise<void> {
    await this.preorders.remove(session.user.id, id);
  }
}
