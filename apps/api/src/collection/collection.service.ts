import {
  summarizeCollectionUniverses,
  type CollectionItemResponse,
  type CollectionUniverse,
} from '@fandex/core';
import { Injectable, NotFoundException } from '@nestjs/common';

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
      category: row.catalogItem.category,
      coverUrl: row.catalogItem.coverUrl ?? undefined,
      addedAt: row.addedAt.toISOString(),
      ...linksFromRow(row.catalogItem),
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

  /** Removes the user's item. Someone else's item is reported as not found, not forbidden. */
  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.collectionItem.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('No such item in your collection');
  }
}

function toCollectionItemResponse(row: CollectionRow): CollectionItemResponse {
  return {
    id: row.id,
    addedAt: row.addedAt.toISOString(),
    ...(row.notes !== null && { notes: row.notes }),
    catalog: toCatalogItemResponse(row.catalogItem, linksFromRow(row.catalogItem)),
  };
}

/** P2002 = unique constraint violated, P2003 = foreign key constraint violated. */
function isPrismaError(error: unknown, code: 'P2002' | 'P2003'): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
