import {
  sameFigure,
  searchFigures,
  type AdminFigureSuggestion,
  type FigureSuggestionResponse,
  type FigureSuggestionStatus,
  type SuggestFigureRequest,
} from '@fandex/core';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { toCatalogItemResponse } from '../catalog/catalog-item.mapper.js';
import { CatalogService, figureView } from '../catalog/catalog.service.js';
import type { FigureSuggestion } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { linksFromRow, linksInclude } from '../universes/item-links.js';

/** Possible duplicates shown with each suggestion. */
const MAX_CANDIDATES = 5;

/**
 * Figures users suggest for the shared catalog, and the admin's decisions. Approving makes the
 * private figure shared (source `fandex`, no owner); merging moves the suggester's collection
 * item and pre-orders onto the existing shared figure and deletes the private copy.
 */
@Injectable()
export class FigureSuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  /**
   * Suggests one of the user's own figures. Suggesting it again while pending returns the same
   * suggestion; after a rejection it's reopened (they may have fixed the details).
   */
  async suggest(
    userId: string,
    { catalogItemId, note }: SuggestFigureRequest,
  ): Promise<{ suggestion: FigureSuggestionResponse; created: boolean }> {
    const figure = await this.prisma.catalogItem.findFirst({
      where: { id: catalogItemId, ownerId: userId, source: 'custom', category: 'figure' },
      include: { suggestion: true },
    });
    if (!figure) throw new NotFoundException('No such figure of yours');

    const existing = figure.suggestion;
    if (existing?.status === 'pending') return { suggestion: toResponse(existing), created: false };
    if (existing) {
      const reopened = await this.prisma.figureSuggestion.update({
        where: { id: existing.id },
        data: { status: 'pending', note: note ?? null, reviewNote: null, reviewedAt: null },
      });
      return { suggestion: toResponse(reopened), created: false };
    }
    const created = await this.prisma.figureSuggestion.create({
      data: { userId, catalogItemId, note: note ?? null },
    });
    return { suggestion: toResponse(created), created: true };
  }

  /** The user's suggestions, newest first. */
  async mine(userId: string): Promise<FigureSuggestionResponse[]> {
    const rows = await this.prisma.figureSuggestion.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toResponse);
  }

  /** Suggestions with this status, oldest first, each with its figure and possible duplicates. */
  async list(status: FigureSuggestionStatus): Promise<AdminFigureSuggestion[]> {
    const rows = await this.prisma.figureSuggestion.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { name: true, email: true } },
        catalogItem: { include: linksInclude },
      },
    });
    const shared = rows.length > 0 ? await this.catalog.sharedFigures() : [];
    return rows.map((row) => {
      const figure = row.catalogItem
        ? toCatalogItemResponse(row.catalogItem, linksFromRow(row.catalogItem))
        : undefined;
      const others = shared.filter((candidate) => candidate.item.id !== figure?.id);
      const view = figure && figureView(figure);
      const same = view ? others.filter((candidate) => sameFigure(view, candidate)) : [];
      const similar = view ? searchFigures(others, view.title) : [];
      const candidates = [
        ...same.map((candidate) => ({ item: candidate.item, sameFigure: true })),
        ...similar
          .filter((candidate) => !same.includes(candidate))
          .map((candidate) => ({ item: candidate.item, sameFigure: false })),
      ].slice(0, MAX_CANDIDATES);
      return {
        ...toResponse(row),
        ...(figure && { figure }),
        suggestedBy: row.user,
        candidates,
      };
    });
  }

  /**
   * Adds the figure to the shared catalog as it is: no owner any more, so every user can find
   * it. Its picture link is dropped: catalog figures have no pictures (they'd be the brands').
   */
  async approve(id: string): Promise<FigureSuggestionResponse> {
    const suggestion = await this.pending(id);
    return this.prisma.$transaction(async (tx) => {
      const decided = await tx.figureSuggestion.updateMany({
        where: { id, status: 'pending' },
        data: { status: 'approved', reviewedAt: new Date() },
      });
      if (decided.count === 0) throw notPending();
      await tx.catalogItem.update({
        where: { id: suggestion.catalogItemId },
        data: { source: 'fandex', ownerId: null, coverUrl: null },
      });
      return toResponse(await tx.figureSuggestion.findUniqueOrThrow({ where: { id } }));
    });
  }

  /**
   * The figure duplicates a shared one: everything that pointed at the private copy (the
   * suggester's collection item, pre-orders) now points at the shared figure, and the copy
   * goes, all in one transaction. If the suggester already owned the shared figure, their
   * duplicate item is dropped.
   */
  async merge(id: string, targetId: string): Promise<FigureSuggestionResponse> {
    const suggestion = await this.pending(id);
    const privateId = suggestion.catalogItemId;
    const target = await this.prisma.catalogItem.findFirst({
      where: { id: targetId, source: 'fandex', category: 'figure' },
      select: { id: true },
    });
    if (!target || targetId === privateId) {
      throw new BadRequestException('Merge into a figure from the shared catalog');
    }

    return this.prisma.$transaction(async (tx) => {
      const decided = await tx.figureSuggestion.updateMany({
        where: { id, status: 'pending' },
        // Detach first: deleting the private copy would otherwise delete the suggestion.
        data: {
          status: 'merged',
          mergedIntoId: targetId,
          catalogItemId: null,
          reviewedAt: new Date(),
        },
      });
      if (decided.count === 0) throw notPending();

      const copies = await tx.collectionItem.findMany({
        where: { catalogItemId: privateId },
        select: { id: true, userId: true },
      });
      for (const copy of copies) {
        const alreadyOwned = await tx.collectionItem.findUnique({
          where: { userId_catalogItemId: { userId: copy.userId, catalogItemId: targetId } },
          select: { id: true },
        });
        if (alreadyOwned) await tx.collectionItem.delete({ where: { id: copy.id } });
        else
          await tx.collectionItem.update({
            where: { id: copy.id },
            data: { catalogItemId: targetId },
          });
      }
      await tx.preorder.updateMany({
        where: { catalogItemId: privateId },
        data: { catalogItemId: targetId },
      });
      await tx.catalogItem.delete({ where: { id: privateId } });
      return toResponse(await tx.figureSuggestion.findUniqueOrThrow({ where: { id } }));
    });
  }

  /** Keeps the figure private; the suggester sees the note. */
  async reject(id: string, note: string): Promise<FigureSuggestionResponse> {
    await this.pending(id);
    const decided = await this.prisma.figureSuggestion.updateMany({
      where: { id, status: 'pending' },
      data: { status: 'rejected', reviewNote: note, reviewedAt: new Date() },
    });
    if (decided.count === 0) throw notPending();
    return toResponse(await this.prisma.figureSuggestion.findUniqueOrThrow({ where: { id } }));
  }

  private async pending(id: string): Promise<FigureSuggestion & { catalogItemId: string }> {
    const suggestion = await this.prisma.figureSuggestion.findUnique({ where: { id } });
    if (!suggestion) throw new NotFoundException('No such suggestion');
    if (suggestion.status !== 'pending' || !suggestion.catalogItemId) throw notPending();
    return { ...suggestion, catalogItemId: suggestion.catalogItemId };
  }
}

const notPending = () => new ConflictException('This suggestion was already reviewed');

function toResponse(row: FigureSuggestion): FigureSuggestionResponse {
  return {
    id: row.id,
    status: row.status,
    ...(row.catalogItemId !== null && { catalogItemId: row.catalogItemId }),
    ...(row.mergedIntoId !== null && { mergedIntoId: row.mergedIntoId }),
    ...(row.note !== null && { note: row.note }),
    ...(row.reviewNote !== null && { reviewNote: row.reviewNote }),
    createdAt: row.createdAt.toISOString(),
    ...(row.reviewedAt !== null && { reviewedAt: row.reviewedAt.toISOString() }),
  };
}
