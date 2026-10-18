import { meResponseSchema, type MeResponse } from '@fandex/core';
import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';

import { AdminService } from '../admin/admin.service.js';

/** The signed-in user's account. Protected by the global auth guard (no @AllowAnonymous). */
@ApiTags('account')
@ApiCookieAuth()
@Controller('me')
export class MeController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  @ApiOkResponse({ description: 'The signed-in user.' })
  @ApiUnauthorizedResponse({ description: 'Not signed in.' })
  me(@Session() session: UserSession): MeResponse {
    const { id, email, name, emailVerified, createdAt } = session.user;
    return meResponseSchema.parse({
      id,
      email,
      name,
      emailVerified,
      createdAt: new Date(createdAt).toISOString(),
      // An additional field (auth.ts); the session type doesn't know it.
      preferredCurrency: (session.user as { preferredCurrency?: string }).preferredCurrency,
      isAdmin: this.admin.isAdmin(email),
    });
  }
}
