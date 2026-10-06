import {
  CatalogError,
  type BookCatalog,
  type CatalogBook,
  type CatalogSet,
  type Isbn13,
  type LegoCatalog,
  type MatchSignals,
} from '@fandex/core';
import {
  Inject,
  Injectable,
  Logger,
  type BeforeApplicationShutdown,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';
import type { CatalogItem } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { needsSignals, toJson } from './catalog-item.mapper.js';
import { BOOK_CATALOG, LEGO_CATALOG } from './catalog.service.js';

export type RefreshResult = 'refreshed' | 'not-found' | 'skipped' | 'failed';

/**
 * Keeps universe-matching signals complete for items people own. Items cached before Stage 3
 * have none, and LEGO sets found by search have no minifigs yet. This refetches them from the
 * source — at startup in the background (Render has no free one-off jobs) and right after a
 * LEGO set is added — through the same rate-limited catalogs as everything else.
 */
@Injectable()
export class CatalogSignalsService implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(CatalogSignalsService.name);
  private readonly pending = new Set<Promise<unknown>>();

  constructor(
    @Inject(BOOK_CATALOG) private readonly books: BookCatalog,
    @Inject(LEGO_CATALOG) private readonly lego: LegoCatalog | null,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Starts the backfill without delaying startup (tests start it themselves). */
  onApplicationBootstrap(): void {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    this.inBackground(async () => {
      const result = await this.backfillOwned();
      if (result.refreshed + result.failed > 0) {
        this.logger.log(`Signals backfill: ${result.refreshed} refreshed, ${result.failed} failed`);
      }
    });
  }

  /** Lets in-flight refreshes finish before the database connection closes. */
  async beforeApplicationShutdown(): Promise<void> {
    await this.idle();
  }

  /** Resolves once all background work has finished. */
  async idle(): Promise<void> {
    while (this.pending.size > 0) await Promise.allSettled([...this.pending]);
  }

  /**
   * Fetches a LEGO set's minifigs in the background if it doesn't have them yet (sets found
   * by search don't). Books get complete signals from search already; old ones are covered
   * by the startup backfill.
   */
  refreshSoon(item: Pick<CatalogItem, 'id' | 'category' | 'matchSignals'>): void {
    if (item.category === 'lego' && needsSignals(item)) {
      this.inBackground(() => this.refresh(item.id));
    }
  }

  /** Refetches every owned item that still needs signals, one at a time. Resumable. */
  async backfillOwned(): Promise<{ refreshed: number; failed: number }> {
    const candidates = await this.prisma.catalogItem.findMany({
      where: { ownedBy: { some: {} } },
      select: { id: true, category: true, matchSignals: true },
      orderBy: { createdAt: 'asc' },
    });
    let refreshed = 0;
    let failed = 0;
    for (const item of candidates.filter(needsSignals)) {
      const result = await this.refresh(item.id);
      if (result === 'refreshed' || result === 'not-found') refreshed += 1;
      if (result === 'failed') failed += 1;
    }
    return { refreshed, failed };
  }

  /**
   * Refetches one item and stores its signals (and work key). Only those columns change:
   * the source may return a different edition for the same ISBN, and the item a user owns
   * must stay the same row.
   */
  async refresh(id: string): Promise<RefreshResult> {
    const item = await this.prisma.catalogItem.findUnique({ where: { id } });
    if (!item || !needsSignals(item)) return 'skipped';
    if (item.category === 'lego' && !this.lego) return 'skipped';

    let entry: CatalogBook | CatalogSet | null;
    try {
      entry = item.category === 'lego' ? await this.fetchSet(item) : await this.fetchBook(item);
    } catch (error) {
      if (!(error instanceof CatalogError)) throw error;
      this.logger.warn(`Could not refresh signals for ${item.externalId}: ${error.message}`);
      return 'failed';
    }

    // Gone from the source: record what we know so the item isn't retried on every start.
    const signals: MatchSignals = entry?.matchSignals ?? {
      title: item.title,
      ...(item.category === 'lego' ? { minifigs: [] } : { authors: item.creators }),
    };
    const workKey = entry && 'workKey' in entry ? entry.workKey : undefined;
    // updateMany: the item may have been deleted while the source was being asked.
    const { count } = await this.prisma.catalogItem.updateMany({
      where: { id },
      data: { matchSignals: toJson(signals), ...(workKey && { workKey }) },
    });
    if (count === 0) return 'skipped';
    return entry ? 'refreshed' : 'not-found';
  }

  private fetchSet(item: CatalogItem): Promise<CatalogSet | null> {
    return (this.lego as LegoCatalog).lookupSet(item.externalId);
  }

  /** By ISBN when we have one; otherwise by Open Library edition key (`OL123M`). */
  private async fetchBook(item: CatalogItem): Promise<CatalogBook | null> {
    if (item.isbn13) return this.books.lookupIsbn(item.isbn13 as Isbn13);
    if (!/^OL\d+M$/.test(item.externalId)) return null;
    const results = await this.books.search(`edition_key:${item.externalId}`);
    return results.find((book) => book.externalId === item.externalId) ?? null;
  }

  private inBackground(work: () => Promise<unknown>): void {
    const promise = work()
      .catch((error: unknown) => this.logger.error('Background signals refresh failed', error))
      .finally(() => this.pending.delete(promise));
    this.pending.add(promise);
  }
}
