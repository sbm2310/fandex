import type { AiQuota } from '@fandex/core';
import { HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';
import type { AiUsageKind } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** The day a request counts towards: midnight UTC (stored as a DATE). */
export function usageDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Daily AI allowances. The free AI plan is shared by every user, so each user gets a few
 * requests a day, and all users together stay under the plan's daily limit.
 *
 * A request is checked before it's sent and counted only after it succeeds, so a failure
 * at the provider costs the user nothing. Two requests checked at the same moment can both
 * pass (at most one over the limit); that's acceptable for a free allowance.
 */
@Injectable()
export class AiQuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private limits(kind: AiUsageKind) {
    switch (kind) {
      case 'shelf_scan':
        return {
          perUser: this.config.get('AI_SHELF_SCANS_PER_USER', { infer: true }),
          perDay: this.config.get('AI_SHELF_SCANS_PER_DAY', { infer: true }),
        };
    }
  }

  /** Today's use for one user. */
  async status(userId: string, kind: AiUsageKind, now = new Date()): Promise<AiQuota> {
    const row = await this.prisma.aiUsage.findUnique({
      where: { userId_day_kind: { userId, day: usageDay(now), kind } },
    });
    return { used: row?.count ?? 0, limit: this.limits(kind).perUser };
  }

  /**
   * Throws 429 when the user has used today's allowance, or 503 when everyone together has
   * (that's the server's capacity, not the user's doing).
   */
  async assertAvailable(userId: string, kind: AiUsageKind, now = new Date()): Promise<void> {
    const { used, limit } = await this.status(userId, kind, now);
    if (used >= limit) {
      throw new HttpException(
        `You've used today's ${limit} shelf scans. They reset at midnight UTC.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const everyone = await this.prisma.aiUsage.aggregate({
      where: { day: usageDay(now), kind },
      _sum: { count: true },
    });
    if ((everyone._sum.count ?? 0) >= this.limits(kind).perDay) {
      throw new ServiceUnavailableException(
        'Shelf scanning has reached its daily limit for everyone. Try again tomorrow.',
      );
    }
  }

  /** Counts one successful request; returns the user's use after it. */
  async record(userId: string, kind: AiUsageKind, now = new Date()): Promise<AiQuota> {
    const row = await this.prisma.aiUsage.upsert({
      where: { userId_day_kind: { userId, day: usageDay(now), kind } },
      create: { userId, day: usageDay(now), kind, count: 1 },
      update: { count: { increment: 1 } },
    });
    return { used: row.count, limit: this.limits(kind).perUser };
  }
}
