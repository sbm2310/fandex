import {
  applyLinkEdits,
  diffLinks,
  linkEditsSchema,
  summarizeCollectionUniverses,
  type CollectionItemResponse,
  type CollectionUniverse,
  type ItemLinks,
  type LinkEdits,
  type QueryableItem,
  type UpdateCollectionItemRequest,
} from '@fandex/core';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { toCatalogItemResponse } from '../catalog/catalog-item.mapper.js';
import { CatalogSignalsService } from '../catalog/catalog-signals.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { linksFromRow, linksInclude } from '../universes/item-links.js';

const withCatalog = { catalogItem: { include: linksInclude } } as const;
type CollectionRow = Prisma.CollectionItemGetPayload<{ include: typeof withCatalog }>;

/**
 * A user's collection. Every query is scoped to the user id from the session, never from the
 * request, so one user can't read or change another's items.
 */
@Injectable()
export class CollectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signals: CatalogSignalsService,
  ) {}

  async list(userId: string): Promise<CollectionItemResponse[]> {
    const rows = await this.prisma.collectionItem.findMany({
      where: { userId },
      include: withCatalog,
      orderBy: [{ addedAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toCollectionItemResponse);
  }

  /** The user's items as "Ask" queries see them (category and links as the user sees them). */
  async queryable(userId: string): Promise<(QueryableItem & { id: string })[]> {
    const rows = await this.prisma.collectionItem.findMany({
      where: { userId },
      include: withCatalog,
    });
    return rows.map((row) => ({
      id: row.id,
      category: row.categoryOverride ?? row.catalogItem.category,
      addedAt: row.addedAt.toISOString(),
      title: row.catalogItem.subtitle
        ? `${row.catalogItem.title}: ${row.catalogItem.subtitle}`
        : row.catalogItem.title,
      creators: row.catalogItem.creators,
      ...effectiveLinks(row),
    }));
  }

  /**
   * The universes the user owns items from, with counts, covers and characters. The
   * collection is small enough to summarize in memory, with the same function guest mode
   * uses on the device.
   */
  async universes(userId: string): Promise<CollectionUniverse[]> {
    const [rows, directory] = await Promise.all([
      this.prisma.collectionItem.findMany({ where: { userId }, include: withCatalog }),
      this.prisma.universe.findMany({
        orderBy: { position: 'asc' },
        select: {
          slug: true,
          name: true,
          characters: { orderBy: { position: 'asc' }, select: { slug: true, name: true } },
        },
      }),
    ]);
    const items = rows.map((row) => ({
      category: row.categoryOverride ?? row.catalogItem.category,
      coverUrl: row.catalogItem.coverUrl ?? undefined,
      addedAt: row.addedAt.toISOString(),
      ...effectiveLinks(row),
    }));
    return summarizeCollectionUniverses(items, directory);
  }

  /** Adds a catalog item; if the user already owns it, returns the existing item instead. */
  async add(
    userId: string,
    catalogItemId: string,
  ): Promise<{ item: CollectionItemResponse; created: boolean }> {
    try {
      const row = await this.prisma.collectionItem.create({
        data: { userId, catalogItemId },
        include: withCatalog,
      });
      // A LEGO set added from search has no minifigs yet; fetch them without making the user wait.
      this.signals.refreshSoon(row.catalogItem);
      return { item: toCollectionItemResponse(row), created: true };
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        const existing = await this.prisma.collectionItem.findUniqueOrThrow({
          where: { userId_catalogItemId: { userId, catalogItemId } },
          include: withCatalog,
        });
        return { item: toCollectionItemResponse(existing), created: false };
      }
      if (isPrismaError(error, 'P2003')) {
        throw new NotFoundException('No such catalog item');
      }
      throw error;
    }
  }

  /**
   * Fixes the user's copy: its category (books only) and the universes and characters it's
   * linked to. Only differences from the automatic links are stored, so later matching
   * improvements still show up. Someone else's item is reported as not found.
   */
  async update(
    userId: string,
    id: string,
    changes: UpdateCollectionItemRequest,
  ): Promise<CollectionItemResponse> {
    const row = await this.prisma.collectionItem.findFirst({
      where: { id, userId },
      include: withCatalog,
    });
    if (!row) throw new NotFoundException('No such item in your collection');

    const data: Prisma.CollectionItemUpdateInput = {};
    if (changes.category !== undefined) {
      if (row.catalogItem.category === 'lego') {
        throw new BadRequestException("A LEGO set's category can't be changed");
      }
      const override = changes.category ?? null;
      data.categoryOverride = override === row.catalogItem.category ? null : override;
    }
    if (changes.links !== undefined) {
      if (changes.links) await this.assertKnown(changes.links);
      const edits = changes.links
        ? diffLinks(linksFromRow(row.catalogItem), changes.links)
        : undefined;
      data.linkEdits = edits ? (edits as Prisma.InputJsonObject) : Prisma.DbNull;
    }

    const updated = await this.prisma.collectionItem.update({
      where: { id: row.id },
      data,
      include: withCatalog,
    });
    return toCollectionItemResponse(updated);
  }

  /** Rejects universes and characters the seed doesn't have (or a character in the wrong one). */
  private async assertKnown(links: ItemLinks): Promise<void> {
    const slugs = [...new Set([...links.universes, ...links.characters.map((c) => c.universe)])];
    const universes = await this.prisma.universe.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true, characters: { select: { slug: true } } },
    });
    const known = new Map(universes.map((u) => [u.slug, new Set(u.characters.map((c) => c.slug))]));
    const unknownUniverse = slugs.find((slug) => !known.has(slug));
    if (unknownUniverse) throw new BadRequestException(`Unknown universe "${unknownUniverse}"`);
    const unknownCharacter = links.characters.find(
      (ref) => !known.get(ref.universe)?.has(ref.character),
    );
    if (unknownCharacter) {
      throw new BadRequestException(
        `Unknown character "${unknownCharacter.character}" in "${unknownCharacter.universe}"`,
      );
    }
  }

  /** Removes the user's item. Someone else's item is reported as not found, not forbidden. */
  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.collectionItem.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('No such item in your collection');
  }
}

function toCollectionItemResponse(row: CollectionRow): CollectionItemResponse {
  const linkEdits = readLinkEdits(row);
  return {
    id: row.id,
    addedAt: row.addedAt.toISOString(),
    ...(row.notes !== null && { notes: row.notes }),
    category: row.categoryOverride ?? row.catalogItem.category,
    ...(linkEdits && { linkEdits }),
    // The catalog keeps the automatic links; the app applies linkEdits (as guest mode does).
    catalog: toCatalogItemResponse(row.catalogItem, linksFromRow(row.catalogItem)),
  };
}

function readLinkEdits(row: Pick<CollectionRow, 'linkEdits'>): LinkEdits | undefined {
  const parsed = linkEditsSchema.safeParse(row.linkEdits);
  return parsed.success ? parsed.data : undefined;
}

/** The links the user sees: automatic ones with their fixes applied. */
function effectiveLinks(row: CollectionRow): ItemLinks {
  return applyLinkEdits(linksFromRow(row.catalogItem), readLinkEdits(row));
}

/** P2002 = unique constraint violated, P2003 = foreign key constraint violated. */
function isPrismaError(error: unknown, code: 'P2002' | 'P2003'): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
