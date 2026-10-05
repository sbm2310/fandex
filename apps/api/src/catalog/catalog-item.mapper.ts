import type { CatalogBook, CatalogItemResponse, CatalogSet } from '@fandex/core';

import type { CatalogItem, Prisma } from '../generated/prisma/client.js';

/** Catalog data as stored: what we upsert from an external catalog. */
export function toCatalogItemData(entry: CatalogBook | CatalogSet): Prisma.CatalogItemCreateInput {
  return entry.category === 'lego' ? fromSet(entry) : fromBook(entry);
}

function fromSet(set: CatalogSet): Prisma.CatalogItemCreateInput {
  return {
    category: 'lego',
    source: set.source,
    externalId: set.externalId,
    title: set.title,
    creators: [],
    year: set.year ?? null,
    setNumber: set.setNumber,
    pieceCount: set.pieceCount ?? null,
    theme: set.theme ?? null,
    subtheme: set.subtheme ?? null,
    coverUrl: set.coverUrl ?? null,
    fetchedAt: new Date(),
  };
}

function fromBook(book: CatalogBook): Prisma.CatalogItemCreateInput {
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
    ...(row.setNumber !== null && { setNumber: row.setNumber }),
    ...(row.pieceCount !== null && { pieceCount: row.pieceCount }),
    ...(row.theme !== null && { theme: row.theme }),
    ...(row.subtheme !== null && { subtheme: row.subtheme }),
  };
}
