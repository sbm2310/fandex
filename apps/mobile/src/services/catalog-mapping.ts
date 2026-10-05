import {
  isBookCategory,
  type CatalogBook,
  type CatalogItemResponse,
  type Isbn13,
} from '@fandex/core';

/** API catalog item → the app's CatalogBook (book categories only; LEGO comes separately). */
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
