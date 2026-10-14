import { createHash } from 'node:crypto';

import { UNIVERSE_MATCHER_VERSION, type FigureSeedEntry } from '@fandex/core';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UniverseLinker } from '../universes/universe-linker.service.js';
import { seedFigureData } from './catalog-item.mapper.js';

/** Injection token for the curated figure list (`@fandex/core/figure-seed`; a fixture in tests). */
export const FIGURE_SEED_ENTRIES = Symbol('FIGURE_SEED_ENTRIES');

export const FIGURE_SEED_SYNC = 'figure-seed';

/**
 * Keeps the shared figures (`catalog_item` rows with source `fandex`) in line with the curated
 * list, the way the universe seed is kept: on startup, only when the list changed. Entries are
 * upserted by id, so catalog ids (and everything users own) stay stable. An entry the list
 * drops is deleted unless someone owns or pre-ordered it; then it stays, and is logged. Shared
 * figures that came from approved suggestions are left alone.
 */
@Injectable()
export class FigureSeedService implements OnModuleInit {
  private readonly logger = new Logger(FigureSeedService.name);

  constructor(
    @Inject(FIGURE_SEED_ENTRIES) private readonly entries: readonly FigureSeedEntry[],
    private readonly prisma: PrismaService,
    private readonly linker: UniverseLinker,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Runs after the universe seed (its module is imported), so links can be made. */
  async onModuleInit(): Promise<void> {
    // Tests sync explicitly, after resetting the database (and usually with a small list).
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    await this.sync();
  }

  async sync(): Promise<'unchanged' | 'synced'> {
    const hash = createHash('sha256')
      .update(JSON.stringify({ matcher: UNIVERSE_MATCHER_VERSION, entries: this.entries }))
      .digest('hex');
    const state = await this.prisma.syncState.findUnique({ where: { name: FIGURE_SEED_SYNC } });
    if (state?.hash === hash) return 'unchanged';

    await this.prisma.$transaction(
      async (tx) => {
        for (const entry of this.entries) {
          const data = seedFigureData(entry);
          await tx.catalogItem.upsert({
            where: { source_externalId: { source: 'fandex', externalId: entry.id } },
            create: data,
            update: data,
          });
        }
      },
      // A few hundred upserts; Neon is a network hop away from Render.
      { timeout: 120_000 },
    );

    const ids = this.entries.map((entry) => entry.id);
    // Approved suggestions are shared figures too, but they aren't the list's to remove.
    const dropped = {
      source: 'fandex' as const,
      externalId: { notIn: ids },
      suggestion: { is: null },
    };
    const { count: deleted } = await this.prisma.catalogItem.deleteMany({
      where: { ...dropped, ownedBy: { none: {} }, preorders: { none: {} } },
    });
    const kept = await this.prisma.catalogItem.findMany({
      where: dropped,
      select: { externalId: true },
    });
    if (kept.length > 0) {
      this.logger.warn(
        `Kept figures the list dropped, because someone owns or pre-ordered them: ${kept
          .map((row) => row.externalId)
          .join(', ')}`,
      );
    }

    const linked = await this.linker.relinkAll({ source: 'fandex' });
    await this.prisma.syncState.upsert({
      where: { name: FIGURE_SEED_SYNC },
      create: { name: FIGURE_SEED_SYNC, hash },
      update: { hash, syncedAt: new Date() },
    });
    this.logger.log(`Figure catalog synced: ${linked} figures, ${deleted} removed`);
    return 'synced';
  }
}
