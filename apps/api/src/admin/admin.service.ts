import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UserSession } from '@thallesp/nestjs-better-auth';

import type { Env } from '../config/env.js';

/**
 * Who may review figure suggestions: the accounts whose emails are in ADMIN_EMAILS. Enough for
 * one approver; there's no roles system.
 */
@Injectable()
export class AdminService {
  private readonly emails: ReadonlySet<string>;

  constructor(config: ConfigService<Env, true>) {
    this.emails = new Set(config.get('ADMIN_EMAILS', { infer: true }));
  }

  isAdmin(email: string): boolean {
    return this.emails.has(email.toLowerCase());
  }

  /** Throws 403 unless the signed-in user is an admin. */
  require(session: UserSession): void {
    if (!this.isAdmin(session.user.email)) throw new ForbiddenException('Admins only');
  }
}
