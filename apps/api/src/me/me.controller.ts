import type { MeResponse } from '@fandex/core';
import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';

/** The signed-in user's account. Protected by the global auth guard (no @AllowAnonymous). */
@ApiTags('account')
@ApiCookieAuth()
@Controller('me')
export class MeController {
  @Get()
  @ApiOkResponse({ description: 'The signed-in user.' })
  @ApiUnauthorizedResponse({ description: 'Not signed in.' })
  me(@Session() session: UserSession): MeResponse {
    const { id, email, name, emailVerified, createdAt } = session.user;
    return { id, email, name, emailVerified, createdAt: new Date(createdAt).toISOString() };
  }
}
