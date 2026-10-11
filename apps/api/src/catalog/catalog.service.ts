import {
  BadGatewayException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CatalogError,
  type BookCatalog,
  type CatalogBook,
  type CatalogItemResponse,
  type CatalogRequestOptions,
  type CatalogSearchKind,
  type CatalogSet,
  type Isbn13,
  type LegoCatalog,
  type NewFigure,
} from '@fandex/core';
import { randomUUID } from 'node:crypto';

import { TtlCache } from '../common/ttl-cache.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { linksFromRow, linksInclude } from '../universes/item-links.js';
import { UniverseLinker } from '../universes/universe-linker.service.js';
import {
  figureData,
  needsSignals,
  readMatchSignals,
  toCatalogItemData,
  toCatalogItemResponse,
} from './catalog-item.mapper.js';

/** Injection token for the external catalog (Open Library in production, a fake in tests). */
export const BOOK_CATALOG = Symbol('BOOK_CATALOG');

/** Injection token for LEGO (Rebrickable); null when no API key is configured. */
export const LEGO_CATALOG = Symbol('LEGO_CATALOG');

/** Cached ISBN and set entries are refreshed from the source after this long. */
const ISBN_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Catalog lookups for the apps. Results are cached in our database (`catalog_item`), so every
 * user shares one copy, items get stable ids, and Open Library is asked as rarely as possible.
 */
@Injectable()
export class CatalogService {
  private readonly searchCache = new TtlCache<CatalogItemResponse[]>({
    ttlMs: 60 * 60 * 1000,
    maxEntries: 500,
  });

  constructor(
    @Inject(BOOK_CATALOG) private readonly catalog: BookCatalog,
    @Inject(LEGO_CATALOG) private readonly lego: LegoCatalog | null,
    private readonly prisma: PrismaService,
    private readonly linker: UniverseLinker,
  ) {}

  /** Whether LEGO is set up on this server (it needs a Rebrickable key). */
  get legoAvailable(): boolean {
    return this.lego !== null;
  }

  async search(query: string, kind: CatalogSearchKind = 'books'): Promise<CatalogItemResponse[]> {
    const key = `${kind}:${query.toLowerCase()}`;
    const cached = this.searchCache.get(key);
    if (cached) return cached;

    const entries =
      kind === 'lego'
        ? await this.fromSource(() => this.requireLego().searchSets(query))
        : await this.fromSource(() => this.catalog.search(query));
    // One at a time: parallel searches return overlapping items, and saving them all at once
    // multiplies lock contention (each save rewrites the item's universe links).
    const items: CatalogItemResponse[] = [];
    for (const entry of entries) items.push(await this.save(entry));
    this.searchCache.set(key, items);
    return items;
  }

  /**
   * A LEGO set by Rebrickable set number ("75192-1"), served from the database when fresh —
   * unless it was only seen in search results and its minifigs (its characters) are missing.
   */
  async lookupSet(setNum: string): Promise<CatalogItemResponse> {
    const stored = await this.prisma.catalogItem.findUnique({
      where: { source_externalId: { source: 'rebrickable', externalId: setNum } },
      include: linksInclude,
    });
    const fresh = stored && Date.now() - stored.fetchedAt.getTime() < ISBN_CACHE_MAX_AGE_MS;
    // Without a Rebrickable key there's no way to fetch the minifigs, so serve what we have.
    if (stored && fresh && (!needsSignals(stored) || !this.lego)) {
      return toCatalogItemResponse(stored, linksFromRow(stored));
    }
    const lego = this.requireLego();
    const set = await this.fromSource(() => lego.lookupSet(setNum)).catch((error) => {
      if (stored) return null;
      throw error;
    });
    if (set) return this.save(set);
    if (stored) return toCatalogItemResponse(stored, linksFromRow(stored));
    throw new NotFoundException(`No LEGO set ${setNum}`);
  }

  private requireLego(): LegoCatalog {
    if (!this.lego) {
      throw new ServiceUnavailableException('LEGO search is not set up on this server.');
    }
    return this.lego;
  }

  async lookupIsbn(isbn: Isbn13): Promise<CatalogItemResponse> {
    const stored = await this.prisma.catalogItem.findFirst({
      where: { isbn13: isbn },
      orderBy: { fetchedAt: 'desc' },
      include: linksInclude,
    });
    if (stored && Date.now() - stored.fetchedAt.getTime() < ISBN_CACHE_MAX_AGE_MS) {
      return toCatalogItemResponse(stored, linksFromRow(stored));
    }

    const book = await this.fromSource(() => this.catalog.lookupIsbn(isbn)).catch((error) => {
      // A stale copy beats an error while the source is down.
      if (stored) return null;
      throw error;
    });
    if (book) return this.save(book);
    if (stored) return toCatalogItemResponse(stored, linksFromRow(stored));
    throw new NotFoundException(`No book found for ISBN ${isbn}`);
  }

  /**
   * Saves a figure the user describes (no catalog has them), linked to the universes and
   * characters its name and line mention. Only its owner can see it or add it.
   */
  async createFigure(ownerId: string, figure: NewFigure): Promise<CatalogItemResponse> {
    const row = await this.prisma.catalogItem.create({
      data: figureData(figure, { ownerId, externalId: randomUUID() }),
    });
    const links = await this.linker.link(row.id, readMatchSignals(row));
    return toCatalogItemResponse(row, links);
  }

  /**
   * Asks Open Library about a book edition again (by its edition key) and stores what it says
   * now, e.g. a moved release date. An edition it no longer knows keeps its data. Returns
   * whether the source answered; failures are the caller's to ignore or report.
   */
  async refreshEdition(id: string, options: CatalogRequestOptions = {}): Promise<boolean> {
    const row = await this.prisma.catalogItem.findUnique({
      where: { id },
      select: { source: true, externalId: true },
    });
    if (row?.source !== 'openlibrary' || !/^OL\d+M$/.test(row.externalId)) return false;
    const books = await this.catalog.search(`edition_key:${row.externalId}`, options);
    const book = books.find((entry) => entry.externalId === row.externalId);
    if (book) await this.save(book);
    // Checked all the same, so it isn't asked again on every request.
    else
      await this.prisma.catalogItem.updateMany({ where: { id }, data: { fetchedAt: new Date() } });
    return true;
  }

  /** Inserts or refreshes the item for this source record, links it, and returns it with our id. */
  private async save(entry: CatalogBook | CatalogSet): Promise<CatalogItemResponse> {
    const data = toCatalogItemData(await this.withStoredMinifigs(entry));
    const row = await this.prisma.catalogItem.upsert({
      where: { source_externalId: { source: entry.source, externalId: entry.externalId } },
      create: data,
      update: data,
    });
    const links = await this.linker.link(row.id, readMatchSignals(row));
    return toCatalogItemResponse(row, links);
  }

  /**
   * LEGO search results come without minifigs (one call per set would be too many); keep the
   * ones a set lookup already stored rather than erasing them on every search.
   */
  private async withStoredMinifigs(
    entry: CatalogBook | CatalogSet,
  ): Promise<CatalogBook | CatalogSet> {
    if (entry.category !== 'lego' || !entry.matchSignals || entry.matchSignals.minifigs) {
      return entry;
    }
    const stored = await this.prisma.catalogItem.findUnique({
      where: { source_externalId: { source: entry.source, externalId: entry.externalId } },
      select: { matchSignals: true },
    });
    const minifigs = stored ? readMatchSignals(stored)?.minifigs : undefined;
    return minifigs ? { ...entry, matchSignals: { ...entry.matchSignals, minifigs } } : entry;
  }

  /** Calls the external catalog, translating its failures into HTTP errors. */
  private async fromSource<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof CatalogError && error.kind === 'rate-limited') {
        throw new ServiceUnavailableException('The book catalog is busy. Try again shortly.');
      }
      if (error instanceof CatalogError) {
        throw new BadGatewayException('The book catalog is unavailable right now.');
      }
      throw error;
    }
  }
}
