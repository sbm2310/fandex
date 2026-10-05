import type { CatalogBook, CatalogItemResponse } from '@fandex/core';

import type { CatalogItem, Prisma } from '../generated/prisma/client.js';

/** Catalog data as stored: what we upsert from an external catalog. */
export function toCatalogItemData(book: CatalogBook): Prisma.CatalogItemCreateInput {
  return {
    category: book.category,
    source: book.source,
    externalId: book.externalId,
    title: book.title,
    subtitle: book.subtitle ?? null,
    creators: book.authors,
    year: book.publishedYear ?? null,
    publisher: book.publisher ?? null,
    isbn13: book.isbn13 ?? null,
    coverUrl: book.coverUrl ?? null,
    fetchedAt: new Date(),
  };
}

/** A stored row as the API returns it (null columns become absent fields). */
export function toCatalogItemResponse(row: CatalogItem): CatalogItemResponse {
  return {
    id: row.id,
    category: row.category,
    source: row.source,
    externalId: row.externalId,
    title: row.title,
    ...(row.subtitle !== null && { subtitle: row.subtitle }),
    creators: row.creators,
    ...(row.year !== null && { year: row.year }),
    ...(row.publisher !== null && { publisher: row.publisher }),
    ...(row.isbn13 !== null && { isbn13: row.isbn13 }),
    ...(row.coverUrl !== null && { coverUrl: row.coverUrl }),
  };
}
