import {
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
  NotFoundException,
} from '@nestjs/common';

import { toCatalogItemResponse } from '../catalog/catalog-item.mapper.js';
import { CollectionService } from '../collection/collection.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { linksFromRow, linksInclude } from '../universes/item-links.js';

const withDetails = {
  catalogItem: { include: linksInclude },
  dateChanges: { orderBy: { changedAt: 'asc' } },
} as const satisfies Prisma.PreorderInclude;
type PreorderRow = Prisma.PreorderGetPayload<{ include: typeof withDetails }>;

/** YYYY-MM-DD ↔ the DATE column (midnight UTC). */
const toDay = (value: string) => new Date(`${value}T00:00:00Z`);
const fromDay = (value: Date) => value.toISOString().slice(0, 10);

function releaseOf(date: Date | null, precision: ReleaseDate['precision'] | null) {
  return date && precision ? { date: fromDay(date), precision } : null;
}

const sameRelease = (a: ReleaseDate | null, b: ReleaseDate | null) =>
  a?.date === b?.date && a?.precision === b?.precision;

/**
 * Pre-orders: what the user has on order, what it costs and when it's due. Every query is
 * scoped by the signed-in user (another user's pre-order is "not found", like collection
 * items), every change of the expected date is recorded, and "arrived" moves the item into
 * the collection.
 */
@Injectable()
export class PreordersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collection: CollectionService,
  ) {}

  async list(userId: string): Promise<PreorderResponse[]> {
    const rows = await this.prisma.preorder.findMany({
      where: { userId },
      include: withDetails,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toPreorderResponse);
  }

  async get(userId: string, id: string): Promise<PreorderResponse> {
    return toPreorderResponse(await this.find(userId, id));
  }

  async create(userId: string, input: CreatePreorderInput): Promise<PreorderResponse> {
    // Like adding to the collection: someone else's custom item is reported as missing.
    const catalogItem = await this.prisma.catalogItem.findUnique({
      where: { id: input.catalogItemId },
      select: { ownerId: true },
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
