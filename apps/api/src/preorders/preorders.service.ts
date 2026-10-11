import {
  followCatalogDate,
  queryablePreorder,
  type QueryablePreorder,
  type CollectionItemResponse,
  type CreatePreorderInput,
  type Currency,
  type PreorderResponse,
  type ReleaseDate,
  type UpdatePreorderInput,
} from '@fandex/core';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { toCatalogItemResponse } from '../catalog/catalog-item.mapper.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { fromDay, releaseOf, sameRelease, toDay } from '../common/days.js';
import { CollectionService } from '../collection/collection.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { linksFromRow, linksInclude } from '../universes/item-links.js';

const withDetails = {
  catalogItem: { include: linksInclude },
  dateChanges: { orderBy: { changedAt: 'asc' } },
} as const satisfies Prisma.PreorderInclude;
type PreorderRow = Prisma.PreorderGetPayload<{ include: typeof withDetails }>;

/** Open Library is asked about a pre-ordered book at most this often. */
const DATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** Per listing, at most this many books are checked, within this time (the rest wait). */
const DATE_CHECKS_PER_LIST = 5;
const DATE_CHECK_BUDGET_MS = 4000;

/** Whether a pre-order with this expected release follows its catalog item's date. */
function followsCatalog(
  catalogItem: {
    source: string;
    publishDate: Date | null;
    publishPrecision: ReleaseDate['precision'] | null;
  },
  release: ReleaseDate | null,
): boolean {
  return (
    catalogItem.source === 'openlibrary' &&
    sameRelease(release, releaseOf(catalogItem.publishDate, catalogItem.publishPrecision))
  );
}

/**
 * Pre-orders: what the user has on order, what it costs and when it's due. Every query is
 * scoped by the signed-in user (another user's pre-order is "not found", like collection
 * items), every change of the expected date is recorded, and "arrived" moves the item into
 * the collection.
 */
@Injectable()
export class PreordersService {
  private readonly logger = new Logger(PreordersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly collection: CollectionService,
    private readonly catalog: CatalogService,
  ) {}

  /** The user's pre-orders, after bringing book release dates up to date with Open Library. */
  async list(userId: string, now = new Date()): Promise<PreorderResponse[]> {
    await this.checkCatalogDates(userId, now);
    await this.followCatalogDates(userId);
    const rows = await this.prisma.preorder.findMany({
      where: { userId },
      include: withDetails,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toPreorderResponse);
  }

  /** The user's pre-orders as "Ask" sees them, as stored (no date checks: a question is quick). */
  async queryable(userId: string): Promise<(QueryablePreorder & { id: string })[]> {
    const rows = await this.prisma.preorder.findMany({ where: { userId }, include: withDetails });
    return rows.map((row) => {
      const preorder = toPreorderResponse(row);
      return { id: preorder.id, ...queryablePreorder(preorder) };
    });
  }

  async get(userId: string, id: string): Promise<PreorderResponse> {
    return toPreorderResponse(await this.find(userId, id));
  }

  async create(userId: string, input: CreatePreorderInput): Promise<PreorderResponse> {
    // Like adding to the collection: someone else's custom item is reported as missing.
    const catalogItem = await this.prisma.catalogItem.findUnique({
      where: { id: input.catalogItemId },
      select: { ownerId: true, source: true, publishDate: true, publishPrecision: true },
    });
    if (!catalogItem || (catalogItem.ownerId !== null && catalogItem.ownerId !== userId)) {
      throw new NotFoundException('No such catalog item');
    }
    const release = input.expectedRelease ?? null;
    const row = await this.prisma.preorder.create({
      data: {
        userId,
        catalogItemId: input.catalogItemId,
        currency: input.currency,
        price: input.price ?? null,
        paid: input.paid,
        balanceDueDate: input.balanceDueDate ? toDay(input.balanceDueDate) : null,
        releaseDate: release ? toDay(release.date) : null,
        releasePrecision: release?.precision ?? null,
        // Started from Open Library's date (or none yet, like Open Library): keep following it.
        followsCatalogDate: followsCatalog(catalogItem, release),
        store: input.store ?? null,
        orderNumber: input.orderNumber ?? null,
        orderUrl: input.orderUrl ?? null,
        notes: input.notes ?? null,
        // The first expected date counts as history too: it's what "originally" refers to.
        ...(release && {
          dateChanges: {
            create: { toDate: toDay(release.date), toPrecision: release.precision, source: 'user' },
          },
        }),
      },
      include: withDetails,
    });
    return toPreorderResponse(row);
  }

  async update(
    userId: string,
    id: string,
    changes: UpdatePreorderInput,
  ): Promise<PreorderResponse> {
    const row = await this.find(userId, id);
    if (row.status === 'arrived' && changes.status !== undefined) {
      throw new ConflictException("It's already arrived");
    }
    const price = changes.price === undefined ? row.price : changes.price;
    const paid = changes.paid ?? row.paid;
    if (price !== null && paid > price) {
      throw new BadRequestException("What's paid can't be more than the price");
    }

    const data: Prisma.PreorderUpdateInput = {
      ...(changes.status !== undefined && { status: changes.status }),
      ...(changes.currency !== undefined && { currency: changes.currency }),
      ...(changes.price !== undefined && { price: changes.price }),
      ...(changes.paid !== undefined && { paid: changes.paid }),
      ...(changes.balanceDueDate !== undefined && {
        balanceDueDate: changes.balanceDueDate ? toDay(changes.balanceDueDate) : null,
      }),
      ...(changes.store !== undefined && { store: changes.store ?? null }),
      ...(changes.orderNumber !== undefined && { orderNumber: changes.orderNumber ?? null }),
      ...(changes.orderUrl !== undefined && { orderUrl: changes.orderUrl ?? null }),
      ...(changes.notes !== undefined && { notes: changes.notes ?? null }),
    };
    if (changes.expectedRelease !== undefined) {
      const before = releaseOf(row.releaseDate, row.releasePrecision);
      const after = changes.expectedRelease;
      if (!sameRelease(before, after)) {
        data.releaseDate = after ? toDay(after.date) : null;
        data.releasePrecision = after?.precision ?? null;
        // The user's own date stops following the catalog, unless it's the catalog's again.
        data.followsCatalogDate = followsCatalog(row.catalogItem, after);
        data.dateChanges = {
          create: {
            fromDate: before ? toDay(before.date) : null,
            fromPrecision: before?.precision ?? null,
            toDate: after ? toDay(after.date) : null,
            toPrecision: after?.precision ?? null,
            source: 'user',
          },
        };
      }
    }
    const updated = await this.prisma.preorder.update({
      where: { id: row.id },
      data,
      include: withDetails,
    });
    return toPreorderResponse(updated);
  }

  /**
   * It's here: the item goes into the collection (or stays, if already owned) and the
   * pre-order is closed. Safe to repeat; a cancelled pre-order has to be reopened first.
   */
  async arrive(
    userId: string,
    id: string,
    now = new Date(),
  ): Promise<{ preorder: PreorderResponse; item: CollectionItemResponse }> {
    const row = await this.find(userId, id);
    if (row.status === 'cancelled') throw new ConflictException('This pre-order was cancelled');
    const { item } = await this.collection.add(userId, row.catalogItemId);
    if (row.status === 'arrived') return { preorder: toPreorderResponse(row), item };
    const updated = await this.prisma.preorder.update({
      where: { id: row.id },
      data: { status: 'arrived', arrivedAt: now },
      include: withDetails,
    });
    return { preorder: toPreorderResponse(updated), item };
  }

  /**
   * Deletes a pre-order. A figure the user added only for it (not in their collection, not
   * on another pre-order) goes too, as it would when removed from the collection.
   */
  async remove(userId: string, id: string): Promise<void> {
    const row = await this.find(userId, id);
    await this.prisma.$transaction([
      this.prisma.preorder.delete({ where: { id: row.id } }),
      this.prisma.catalogItem.deleteMany({
        where: {
          id: row.catalogItemId,
          ownerId: userId,
          ownedBy: { none: {} },
          preorders: { none: { id: { not: row.id } } },
        },
      }),
    ]);
  }

  /**
   * Asks Open Library again about open book pre-orders' editions not checked for a day (a few
   * per listing, within a time budget, spaced like every other request). Best effort: if it
   * can't be reached, the dates stay as they are and the next listing tries again.
   */
  private async checkCatalogDates(userId: string, now: Date): Promise<void> {
    const due = await this.prisma.catalogItem.findMany({
      where: {
        source: 'openlibrary',
        fetchedAt: { lt: new Date(now.getTime() - DATE_CHECK_INTERVAL_MS) },
        preorders: { some: { userId, status: 'ordered', followsCatalogDate: true } },
      },
      select: { id: true },
      orderBy: { fetchedAt: 'asc' },
      take: DATE_CHECKS_PER_LIST,
    });
    if (due.length === 0) return;
    const signal = AbortSignal.timeout(DATE_CHECK_BUDGET_MS);
    for (const { id } of due) {
      if (signal.aborted) return;
      try {
        await this.catalog.refreshEdition(id, { signal });
      } catch (error) {
        this.logger.warn(`Could not check the release date of ${id}: ${String(error)}`);
      }
    }
  }

  /**
   * Moves open pre-orders that follow their book's Open Library date to that date, recording
   * each move (a slip, when later) with Open Library as its source.
   */
  private async followCatalogDates(userId: string): Promise<void> {
    const rows = await this.prisma.preorder.findMany({
      where: {
        userId,
        status: 'ordered',
        followsCatalogDate: true,
        catalogItem: { publishDate: { not: null } },
      },
      select: {
        id: true,
        releaseDate: true,
        releasePrecision: true,
        catalogItem: { select: { publishDate: true, publishPrecision: true } },
      },
    });
    for (const row of rows) {
      const before = releaseOf(row.releaseDate, row.releasePrecision);
      const after = followCatalogDate(
        before,
        releaseOf(row.catalogItem.publishDate, row.catalogItem.publishPrecision),
      );
      if (!after) continue;
      await this.prisma.$transaction(async (tx) => {
        // Only if nothing changed it meanwhile (another listing, or the user), so a move is
        // recorded once.
        const { count } = await tx.preorder.updateMany({
          where: {
            id: row.id,
            status: 'ordered',
            followsCatalogDate: true,
            releaseDate: row.releaseDate,
            releasePrecision: row.releasePrecision,
          },
          data: { releaseDate: toDay(after.date), releasePrecision: after.precision },
        });
        if (count === 0) return;
        await tx.preorderDateChange.create({
          data: {
            preorderId: row.id,
            fromDate: row.releaseDate,
            fromPrecision: row.releasePrecision,
            toDate: toDay(after.date),
            toPrecision: after.precision,
            source: 'openlibrary',
          },
        });
      });
    }
  }

  private async find(userId: string, id: string): Promise<PreorderRow> {
    const row = await this.prisma.preorder.findFirst({
      where: { id, userId },
      include: withDetails,
    });
    if (!row) throw new NotFoundException('No such pre-order');
    return row;
  }
}

function toPreorderResponse(row: PreorderRow): PreorderResponse {
  const release = releaseOf(row.releaseDate, row.releasePrecision);
  return {
    id: row.id,
    status: row.status,
    catalog: toCatalogItemResponse(row.catalogItem, linksFromRow(row.catalogItem)),
    currency: row.currency as Currency,
    ...(row.price !== null && { price: row.price }),
    paid: row.paid,
    ...(row.balanceDueDate && { balanceDueDate: fromDay(row.balanceDueDate) }),
    ...(release && { expectedRelease: release }),
    followsCatalogDate: row.followsCatalogDate,
    ...(row.store !== null && { store: row.store }),
    ...(row.orderNumber !== null && { orderNumber: row.orderNumber }),
    ...(row.orderUrl !== null && { orderUrl: row.orderUrl }),
    ...(row.notes !== null && { notes: row.notes }),
    history: row.dateChanges.map((change) => ({
      from: releaseOf(change.fromDate, change.fromPrecision),
      to: releaseOf(change.toDate, change.toPrecision),
      changedAt: change.changedAt.toISOString(),
      source: change.source,
    })),
    createdAt: row.createdAt.toISOString(),
    ...(row.arrivedAt && { arrivedAt: row.arrivedAt.toISOString() }),
  };
}
