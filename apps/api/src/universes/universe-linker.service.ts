import { matchUniverses, type MatchSignals } from '@fandex/core';
import { Injectable } from '@nestjs/common';

import { readMatchSignals } from '../catalog/catalog-item.mapper.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ItemLinks } from './item-links.js';

/** Database ids by slug; characters are keyed by "universe/character". */
type Ids = { universes: Map<string, string>; characters: Map<string, string> };

const characterKey = (universe: string, character: string) => `${universe}/${character}`;

const RELINK_PAGE_SIZE = 500;

/** Attempts at rewriting an item's links when Postgres picks it as a deadlock victim. */
const DEADLOCK_ATTEMPTS = 3;

const isDeadlock = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';

/**
 * Stores which universes and characters each catalog item belongs to, as computed by
 * `matchUniverses` from its signals. Links live on catalog items, so every user who owns an
 * item shares them.
 */
@Injectable()
export class UniverseLinker {
  private ids: Promise<Ids> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Forgets the cached ids (after the seed sync changed the universe tables). */
  invalidate(): void {
    this.ids = null;
  }

  /** Replaces an item's links with what its signals match, and returns them. */
  async link(catalogItemId: string, signals: MatchSignals | null): Promise<ItemLinks> {
    const ids = await this.loadIds();
    const links = resolve(signals, ids);
    // Several requests can rewrite overlapping items at once (a shelf scan runs a dozen
    // searches in parallel); Postgres then aborts one transaction as a deadlock victim, and
    // retrying it is the standard remedy.
    for (let attempt = 1; ; attempt += 1) {
      try {
        await this.prisma.$transaction([
          ...this.deleteLinks([catalogItemId]),
          ...this.createLinks([{ catalogItemId, links }], ids),
        ]);
        return links;
      } catch (error) {
        if (!isDeadlock(error) || attempt === DEADLOCK_ATTEMPTS) throw error;
        await new Promise((resolve) => setTimeout(resolve, 20 * attempt + Math.random() * 30));
      }
    }
  }

  /** Recomputes every catalog item's links (after the seed or the matching rules changed). */
  async relinkAll(): Promise<number> {
    const ids = await this.loadIds();
    let cursor: string | undefined;
    let count = 0;
    for (;;) {
      const page = await this.prisma.catalogItem.findMany({
        select: { id: true, matchSignals: true },
        orderBy: { id: 'asc' },
        take: RELINK_PAGE_SIZE,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      });
      if (page.length === 0) return count;
      const items = page.map((row) => ({
        catalogItemId: row.id,
        links: resolve(readMatchSignals(row), ids),
      }));
      await this.prisma.$transaction([
        ...this.deleteLinks(page.map((row) => row.id)),
        ...this.createLinks(items, ids),
      ]);
      count += page.length;
      cursor = page.at(-1)?.id;
    }
  }

  private deleteLinks(catalogItemIds: string[]) {
    const where = { catalogItemId: { in: catalogItemIds } };
    return [
      this.prisma.catalogItemUniverse.deleteMany({ where }),
      this.prisma.catalogItemCharacter.deleteMany({ where }),
    ];
  }

  /** `items` must be resolved against the same `ids`, so every lookup succeeds. */
  /**
   * `skipDuplicates`: the same catalog item can be saved by two requests at once (a shelf scan
   * searches for every reading in parallel, and editions overlap). Each deletes and re-inserts
   * the item's links; both compute the same links, so the second insert just skips them.
   */
  private createLinks(items: { catalogItemId: string; links: ItemLinks }[], ids: Ids) {
    return [
      this.prisma.catalogItemUniverse.createMany({
        skipDuplicates: true,
        data: items.flatMap(({ catalogItemId, links }) =>
          links.universes.map((slug) => ({
            catalogItemId,
            universeId: ids.universes.get(slug) as string,
          })),
        ),
      }),
      this.prisma.catalogItemCharacter.createMany({
        skipDuplicates: true,
        data: items.flatMap(({ catalogItemId, links }) =>
          links.characters.map((ref) => ({
            catalogItemId,
            characterId: ids.characters.get(characterKey(ref.universe, ref.character)) as string,
          })),
        ),
      }),
    ];
  }

  private loadIds(): Promise<Ids> {
    this.ids ??= this.prisma.universe
      .findMany({
        select: { id: true, slug: true, characters: { select: { id: true, slug: true } } },
      })
      .then((rows) => {
        const ids: Ids = { universes: new Map(), characters: new Map() };
        for (const universe of rows) {
          ids.universes.set(universe.slug, universe.id);
          for (const character of universe.characters) {
            ids.characters.set(characterKey(universe.slug, character.slug), character.id);
          }
        }
        return ids;
      })
      .catch((error: unknown) => {
        this.ids = null;
        throw error;
      });
    return this.ids;
  }
}

/** Matches signals, keeping only universes and characters that exist in the database. */
function resolve(signals: MatchSignals | null, ids: Ids): ItemLinks {
  if (!signals) return { universes: [], characters: [] };
  const match = matchUniverses(signals);
  return {
    universes: match.universes.filter((slug) => ids.universes.has(slug)),
    characters: match.characters.filter((ref) =>
      ids.characters.has(characterKey(ref.universe, ref.character)),
    ),
  };
}
