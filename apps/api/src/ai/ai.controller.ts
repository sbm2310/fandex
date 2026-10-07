import type { AiQuotaResponse, ShelfScanResponse } from '@fandex/core';
import {
  BadRequestException,
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
import { AiRateLimitError } from './chat-client.js';
import { ShelfReader } from './shelf-reader.service.js';

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
    private readonly reader: ShelfReader,
    private readonly quota: AiQuotaService,
  ) {}

  @Get('quota')
  @ApiOkResponse({ description: "Whether AI is available here, and today's allowance." })
  async getQuota(@Session() session: UserSession): Promise<AiQuotaResponse> {
    return {
      available: this.reader.available,
      shelfScans: await this.quota.status(session.user.id, 'shelf_scan'),
    };
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
  @ApiOkResponse({ description: 'What the model read (unverified guesses), and your allowance.' })
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
    if (!this.reader.available) {
      throw new ServiceUnavailableException('Shelf scanning is not set up on this server.');
    }
    const userId = session.user.id;
    await this.quota.assertAvailable(userId, 'shelf_scan');

    let readings;
    try {
      ({ readings } = await this.reader.read(images));
    } catch (error) {
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
    return { readings, quota: await this.quota.record(userId, 'shelf_scan') };
  }
}
