import { createHash } from 'node:crypto';

import { UNIVERSE_MATCHER_VERSION, UNIVERSE_SEED, type UniverseSeed } from '@fandex/core';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { UniverseLinker } from './universe-linker.service.js';

const SYNC_NAME = 'universe-seed';

/** Changes whenever the seed or the matching rules change. */
export function seedHash(
  seed: readonly UniverseSeed[] = UNIVERSE_SEED,
  matcherVersion = UNIVERSE_MATCHER_VERSION,
): string {
  return createHash('sha256').update(JSON.stringify({ matcherVersion, seed })).digest('hex');
}

/**
 * Keeps the universe tables in line with the seed in `@fandex/core`. It runs on startup,
 * before requests are served, and only does work when the seed (or the matcher) changed:
 * then it updates universes and characters, removes ones the seed dropped, and re-matches
 * every catalog item. Deploying a seed change is all it takes; there's no manual step.
 */
@Injectable()
export class UniverseSeedService implements OnModuleInit {
  private readonly logger = new Logger(UniverseSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly linker: UniverseLinker,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.sync();
  }

  async sync(): Promise<'unchanged' | 'synced'> {
    const hash = seedHash();
    const state = await this.prisma.syncState.findUnique({ where: { name: SYNC_NAME } });
    if (state?.hash === hash) return 'unchanged';

    await this.prisma.$transaction(
      async (tx) => {
        const slugs = UNIVERSE_SEED.map((universe) => universe.slug);
        await tx.universe.deleteMany({ where: { slug: { notIn: slugs } } });

        for (const [position, seed] of UNIVERSE_SEED.entries()) {
          const fields = {
            name: seed.name,
            description: seed.description,
            wikidataId: seed.wikidataId,
            position,
          };
          const universe = await tx.universe.upsert({
            where: { slug: seed.slug },
            create: { slug: seed.slug, ...fields },
            update: fields,
          });
          await tx.character.deleteMany({
            where: {
              universeId: universe.id,
              slug: { notIn: seed.characters.map((character) => character.slug) },
            },
          });
          for (const [characterPosition, character] of seed.characters.entries()) {
            const characterFields = {
              name: character.name,
              aliases: character.aliases ?? [],
              wikidataId: character.wikidataId,
              position: characterPosition,
            };
            await tx.character.upsert({
              where: { universeId_slug: { universeId: universe.id, slug: character.slug } },
              create: { universeId: universe.id, slug: character.slug, ...characterFields },
              update: characterFields,
            });
          }
        }
      },
      // ~110 characters, one upsert each; Neon is a network hop away from Render.
      { timeout: 60_000 },
    );

    this.linker.invalidate();
    const relinked = await this.linker.relinkAll();
    await this.prisma.syncState.upsert({
      where: { name: SYNC_NAME },
      create: { name: SYNC_NAME, hash },
      update: { hash, syncedAt: new Date() },
    });
    this.logger.log(`Universe seed synced; ${relinked} catalog items re-matched`);
    return 'synced';
  }
}
