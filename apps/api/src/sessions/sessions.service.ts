import { deviceName, type DeviceSession } from '@fandex/core';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

/**
 * The devices a user is signed in on, for the Account tab. Better Auth's own list-sessions
 * returns each session's token to the client; this returns only what the page shows.
 * Better Auth reads sessions from the database on every request (no cookie cache), so a
 * deleted session is signed out on its next request.
 */
@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, currentId: string): Promise<DeviceSession[]> {
    const rows = await this.prisma.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { updatedAt: 'desc' },
    });
    const sessions = rows.map((row) => ({
      id: row.id,
      device: deviceName(row.userAgent),
      signedInAt: row.createdAt.toISOString(),
      lastActiveAt: row.updatedAt.toISOString(),
      current: row.id === currentId,
    }));
    // This device first, then the others as they were last active (the sort is stable).
    return sessions.sort((a, b) => Number(b.current) - Number(a.current));
  }

  /** Signs out one of the user's other devices; someone else's session is "not found". */
  async signOut(userId: string, currentId: string, id: string): Promise<void> {
    if (id === currentId) {
      throw new BadRequestException('Use "Sign out" to sign out of this device.');
    }
    const { count } = await this.prisma.session.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('Not one of your devices.');
  }

  /** Signs out every device but this one; answers how many were signed out. */
  async signOutOthers(userId: string, currentId: string): Promise<number> {
    const { count } = await this.prisma.session.deleteMany({
      where: { userId, id: { not: currentId } },
    });
    return count;
  }
}
