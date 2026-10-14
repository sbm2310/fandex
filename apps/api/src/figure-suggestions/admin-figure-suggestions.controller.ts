import {
  mergeSuggestionRequestSchema,
  rejectSuggestionRequestSchema,
  suggestionStatusQuerySchema,
  type AdminFigureSuggestionsResponse,
  type FigureSuggestionResponse,
  type FigureSuggestionStatus,
  type MergeSuggestionRequest,
  type RejectSuggestionRequest,
} from '@fandex/core';
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { z } from 'zod';

import { AdminService } from '../admin/admin.service.js';
import { FigureSuggestionsService } from './figure-suggestions.service.js';

const idSchema = z.uuid();

/** Reviewing figure suggestions: admins only (ADMIN_EMAILS). */
@ApiTags('admin')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Not signed in.' })
@ApiForbiddenResponse({ description: 'Not an admin.' })
@Controller('admin/figure-suggestions')
export class AdminFigureSuggestionsController {
  constructor(
    private readonly suggestions: FigureSuggestionsService,
    private readonly admin: AdminService,
  ) {}

  @Get()
  @ApiOkResponse({
    description:
      'Suggestions with this status (default pending), oldest first, with possible duplicates.',
  })
  async list(
    @Session() session: UserSession,
    @Query('status', { schema: suggestionStatusQuerySchema }) status: FigureSuggestionStatus,
  ): Promise<AdminFigureSuggestionsResponse> {
    this.admin.require(session);
    return { suggestions: await this.suggestions.list(status) };
  }

  @Post(':id/approve')
  @HttpCode(200)
  @ApiOkResponse({ description: 'The figure is now in the shared catalog.' })
  @ApiNotFoundResponse({ description: 'No such suggestion.' })
  @ApiConflictResponse({ description: 'Already reviewed.' })
  approve(
    @Session() session: UserSession,
    @Param('id', { schema: idSchema }) id: string,
  ): Promise<FigureSuggestionResponse> {
    this.admin.require(session);
    return this.suggestions.approve(id);
  }

  @Post(':id/merge')
  @HttpCode(200)
  @ApiOkResponse({ description: "Merged: the suggester's items now point to the shared figure." })
  @ApiBadRequestResponse({ description: 'The target is not a shared figure.' })
  @ApiNotFoundResponse({ description: 'No such suggestion.' })
  @ApiConflictResponse({ description: 'Already reviewed.' })
  merge(
    @Session() session: UserSession,
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: mergeSuggestionRequestSchema }) body: MergeSuggestionRequest,
  ): Promise<FigureSuggestionResponse> {
    this.admin.require(session);
    return this.suggestions.merge(id, body.targetId);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Rejected; the figure stays private and the suggester sees the note.',
  })
  @ApiBadRequestResponse({ description: 'No note.' })
  @ApiNotFoundResponse({ description: 'No such suggestion.' })
  @ApiConflictResponse({ description: 'Already reviewed.' })
  reject(
    @Session() session: UserSession,
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: rejectSuggestionRequestSchema }) body: RejectSuggestionRequest,
  ): Promise<FigureSuggestionResponse> {
    this.admin.require(session);
    return this.suggestions.reject(id, body.note);
  }
}
