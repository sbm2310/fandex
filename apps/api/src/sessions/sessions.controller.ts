import type { DeviceSession } from '@fandex/core';
import { Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { z } from 'zod';

import { SessionsService } from './sessions.service.js';

const idSchema = z.uuid();

/** Signed-in devices. Protected by the global auth guard; scoped to the signed-in user. */
@ApiTags('account')
@ApiCookieAuth()
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  @ApiOkResponse({ description: 'Devices you are signed in on, most recently active first.' })
  list(@Session() session: UserSession): Promise<DeviceSession[]> {
    return this.sessions.list(session.user.id, session.session.id);
  }

  @Post('sign-out-others')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Every other device is signed out.' })
  async signOutOthers(@Session() session: UserSession): Promise<{ signedOut: number }> {
    return { signedOut: await this.sessions.signOutOthers(session.user.id, session.session.id) };
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'That device is signed out.' })
  @ApiBadRequestResponse({ description: 'This device: use sign-out instead.' })
  @ApiNotFoundResponse({ description: 'Not one of your devices.' })
  async signOut(
    @Session() session: UserSession,
    @Param('id', { schema: idSchema }) id: string,
  ): Promise<void> {
    await this.sessions.signOut(session.user.id, session.session.id, id);
  }
}
