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
  type Isbn13,
} from '@fandex/core';

import { TtlCache } from '../common/ttl-cache.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toCatalogItemData, toCatalogItemResponse } from './catalog-item.mapper.js';

/** Injection token for the external catalog (Open Library in production, a fake in tests). */
export const BOOK_CATALOG = Symbol('BOOK_CATALOG');

/** Cached ISBN entries are refreshed from the source after this long. */
export const ISBN_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

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
    private readonly prisma: PrismaService,
  ) {}

  async search(query: string): Promise<CatalogItemResponse[]> {
    const key = query.toLowerCase();
    const cached = this.searchCache.get(key);
    if (cached) return cached;

    const books = await this.fromSource(() => this.catalog.search(query));
    const items = await Promise.all(books.map((book) => this.save(book)));
    this.searchCache.set(key, items);
    return items;
  }

  async lookupIsbn(isbn: Isbn13): Promise<CatalogItemResponse> {
    const stored = await this.prisma.catalogItem.findFirst({
      where: { isbn13: isbn },
      orderBy: { fetchedAt: 'desc' },
    });
    if (stored && Date.now() - stored.fetchedAt.getTime() < ISBN_CACHE_MAX_AGE_MS) {
      return toCatalogItemResponse(stored);
    }

    const book = await this.fromSource(() => this.catalog.lookupIsbn(isbn)).catch((error) => {
      // A stale copy beats an error while the source is down.
      if (stored) return null;
      throw error;
    });
    if (book) return this.save(book);
    if (stored) return toCatalogItemResponse(stored);
    throw new NotFoundException(`No book found for ISBN ${isbn}`);
  }

  /** Inserts or refreshes the item for this source record and returns it with our id. */
  private async save(book: CatalogBook): Promise<CatalogItemResponse> {
    const data = toCatalogItemData(book);
    const row = await this.prisma.catalogItem.upsert({
      where: { source_externalId: { source: book.source, externalId: book.externalId } },
      create: data,
      update: data,
    });
    return toCatalogItemResponse(row);
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
