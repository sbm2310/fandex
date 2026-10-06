import {
  matchSignalsSchema,
  type CatalogBook,
  type CatalogItemResponse,
  type CatalogSet,
  type MatchSignals,
} from '@fandex/core';

import type { CatalogItem, Prisma } from '../generated/prisma/client.js';
import type { ItemLinks } from '../universes/item-links.js';

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
    ...signalsData(set.matchSignals),
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
    ...(book.workKey && { workKey: book.workKey }),
    ...signalsData(book.matchSignals),
    fetchedAt: new Date(),
  };
}

/**
 * Signals are only written when the source provided them, so an upsert from a source that
 * didn't (or a test fake) never erases signals already stored.
 */
function signalsData(signals: MatchSignals | undefined) {
  return signals ? { matchSignals: toJson(signals) } : {};
}

/** The JSON column's input type is mutable; MatchSignals' arrays are readonly. */
export function toJson(signals: MatchSignals): Prisma.InputJsonObject {
  return signals as Prisma.InputJsonObject;
}

/** A stored row's signals, or null if none were stored (or they don't have the expected shape). */
export function readMatchSignals(row: Pick<CatalogItem, 'matchSignals'>): MatchSignals | null {
  const parsed = matchSignalsSchema.safeParse(row.matchSignals);
  return parsed.success ? parsed.data : null;
}

/**
 * Whether an item still needs signals from its source: stored before Stage 3 (none), or a
 * LEGO set seen only in search results (no minifigs yet).
 */
export function needsSignals(row: Pick<CatalogItem, 'category' | 'matchSignals'>): boolean {
  const signals = readMatchSignals(row);
  return signals === null || (row.category === 'lego' && signals.minifigs === undefined);
}

/** A stored row as the API returns it, with its links (null columns become absent fields). */
export function toCatalogItemResponse(row: CatalogItem, links: ItemLinks): CatalogItemResponse {
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
    universes: links.universes,
    characters: links.characters,
  };
}
