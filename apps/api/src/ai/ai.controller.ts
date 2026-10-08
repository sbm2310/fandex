import {
  askRequestSchema,
  type AiQuotaResponse,
  type AskRequest,
  type AskResponse,
  type ShelfScanResponse,
} from '@fandex/core';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Res,
  ServiceUnavailableException,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOkResponse,
  ApiPayloadTooLargeResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';

import { AiQuotaService } from './ai-quota.service.js';
import { QuestionAnswerer } from './question-answerer.service.js';
import { AiProviderError, AiRateLimitError } from './chat-client.js';
import { ShelfScanService } from './shelf-scan.service.js';

/** The parts of one shelf photo (the app sends two halves; the provider accepts up to 3). */
export const MAX_SHELF_IMAGES = 3;
/** Per part. A half of a phone photo, resized for the model, is a few hundred KB. */
export const MAX_SHELF_IMAGE_BYTES = 2 * 1024 * 1024;

const isJpeg = (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

/** AI features for signed-in users (the global auth guard requires a session). */
@ApiTags('ai')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Not signed in.' })
@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly shelfScans: ShelfScanService,
    private readonly quota: AiQuotaService,
    private readonly questions: QuestionAnswerer,
  ) {}

  @Get('quota')
  @ApiOkResponse({ description: "Whether AI is available here, and today's allowance." })
  async getQuota(@Session() session: UserSession): Promise<AiQuotaResponse> {
    return {
      available: this.shelfScans.available,
      shelfScans: await this.quota.status(session.user.id, 'shelf_scan'),
      provider: this.shelfScans.provider,
      questions: await this.quota.status(session.user.id, 'question'),
    };
  }

  /**
   * Answers a question about the signed-in user's collection. The AI turns it into a query
   * (the collection is never sent to it); without the AI, keyword matching answers, so there's
   * always an answer. Only questions the AI answered count towards the allowance.
   */
  @Post('ask')
  @HttpCode(200)
  @ApiOkResponse({
    description:
      'The query the question became, the answer, the matching item ids, and your allowance.',
  })
  @ApiBadRequestResponse({ description: 'No question, or one over 300 characters.' })
  async ask(
    @Session() session: UserSession,
    @Body({ schema: askRequestSchema }) body: AskRequest,
  ): Promise<AskResponse> {
    return this.questions.ask(session.user.id, body.question);
  }

  /**
   * Reads one shelf photo, sent as JPEG parts (multipart field `images`). The photo is used
   * for this request only and never stored.
   */
  @Post('shelf-scans')
  @HttpCode(200)
  @UseInterceptors(
    // Parsed in memory, limited before reading the whole upload.
    FilesInterceptor('images', MAX_SHELF_IMAGES, {
      limits: { files: MAX_SHELF_IMAGES, fileSize: MAX_SHELF_IMAGE_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { images: { type: 'array', items: { type: 'string', format: 'binary' } } },
    },
  })
  @ApiOkResponse({
    description:
      'What the model read, each with the catalog entries it could be (best first, marked when you own them), and your allowance.',
  })
  @ApiBadRequestResponse({ description: 'No images, more than 3, or not JPEG.' })
  @ApiPayloadTooLargeResponse({ description: 'An image is larger than 2 MB.' })
  @ApiTooManyRequestsResponse({ description: "You've used today's shelf scans." })
  @ApiServiceUnavailableResponse({
    description:
      'AI is not set up here, it is busy (see Retry-After), or the daily limit for everyone is reached.',
  })
  async scanShelf(
    @Session() session: UserSession,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ShelfScanResponse> {
    const images = (files ?? []).map((file) => new Uint8Array(file.buffer));
    if (images.length === 0) throw new BadRequestException('Send the photo as JPEG `images`.');
    if (!images.every(isJpeg)) throw new BadRequestException('Images must be JPEG.');
    if (!this.shelfScans.available) {
      throw new ServiceUnavailableException('Shelf scanning is not set up on this server.');
    }
    try {
      return await this.shelfScans.scan(session.user.id, images);
    } catch (error) {
      if (!(error instanceof AiProviderError) && !(error instanceof TypeError)) throw error;
      // The user isn't charged for a failure at the provider; "busy" with a time to retry.
      const retryAfterSeconds =
        error instanceof AiRateLimitError ? Math.ceil(error.retryAfterMs / 1000) : 30;
      this.logger.warn(
        `Shelf scan failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      response.setHeader('Retry-After', String(retryAfterSeconds));
      throw new ServiceUnavailableException(
        error instanceof AiRateLimitError
          ? 'Shelf scanning is busy. Try again in a minute.'
          : 'Shelf scanning is unavailable right now. Try again shortly.',
      );
    }
  }
}
