import {
  isBookCategory,
  type CatalogBook,
  type CatalogEntry,
  type CatalogItemResponse,
  type CatalogSet,
  type Isbn13,
} from '@fandex/core';

/** API catalog item → the app's CatalogBook (book categories only). */
export function toCatalogBook(item: CatalogItemResponse): CatalogBook | null {
  if (!isBookCategory(item.category) || item.source !== 'openlibrary') return null;
  return {
    source: item.source,
    externalId: item.externalId,
    category: item.category,
    catalogId: item.id,
    title: item.title,
    authors: item.creators,
    ...(item.subtitle && { subtitle: item.subtitle }),
    ...(item.year !== undefined && { publishedYear: item.year }),
    ...(item.publisher && { publisher: item.publisher }),
    ...(item.isbn13 && { isbn13: item.isbn13 as Isbn13 }),
    ...(item.coverUrl && { coverUrl: item.coverUrl }),
  };
}

/** API catalog item → the app's CatalogSet (LEGO only). */
export function toCatalogSet(item: CatalogItemResponse): CatalogSet | null {
  if (item.category !== 'lego' || item.source !== 'rebrickable' || !item.setNumber) return null;
  return {
    source: 'rebrickable',
    externalId: item.externalId,
    category: 'lego',
    catalogId: item.id,
    title: item.title,
    setNumber: item.setNumber,
    ...(item.year !== undefined && { year: item.year }),
    ...(item.pieceCount !== undefined && { pieceCount: item.pieceCount }),
    ...(item.theme && { theme: item.theme }),
    ...(item.subtheme && { subtheme: item.subtheme }),
    ...(item.coverUrl && { coverUrl: item.coverUrl }),
  };
}

/** Either kind, for items that can be books or sets (e.g. the collection). */
export function toCatalogEntry(item: CatalogItemResponse): CatalogEntry | null {
  return item.category === 'lego' ? toCatalogSet(item) : toCatalogBook(item);
}
