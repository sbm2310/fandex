import {
  suggestFigureRequestSchema,
  type FigureSuggestionResponse,
  type FigureSuggestionsResponse,
  type SuggestFigureRequest,
} from '@fandex/core';
import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';

import { FigureSuggestionsService } from './figure-suggestions.service.js';

/** Suggesting your own figures for Fandex's shared catalog (signed in). */
@ApiTags('figure suggestions')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Not signed in.' })
@Controller('figure-suggestions')
export class FigureSuggestionsController {
  constructor(private readonly suggestions: FigureSuggestionsService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Suggested; an admin will review it.' })
  @ApiOkResponse({
    description: 'Already suggested (returned as is), or rejected before and now reopened.',
  })
  @ApiNotFoundResponse({ description: 'Not a figure you added by hand.' })
  async suggest(
    @Session() session: UserSession,
    @Body({ schema: suggestFigureRequestSchema }) body: SuggestFigureRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<FigureSuggestionResponse> {
    const { suggestion, created } = await this.suggestions.suggest(session.user.id, body);
    response.status(created ? 201 : 200);
    return suggestion;
  }

  @Get()
  @ApiOkResponse({ description: 'Your suggestions and what became of them, newest first.' })
  async mine(@Session() session: UserSession): Promise<FigureSuggestionsResponse> {
    return { suggestions: await this.suggestions.mine(session.user.id) };
  }
}
