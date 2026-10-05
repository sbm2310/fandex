import type { BookCatalog, CatalogBook, CollectionRepository } from '@fandex/core';

export type MoveResult = { moved: number; failed: number };

/**
 * Moves the books saved on this device into the signed-in account. Each book is matched to a
 * Fandex catalog entry (its catalog id; else its ISBN; else a title search for the same edition),
 * added to the account (adding is idempotent, so duplicates merge), and only then removed from
 * the device. Books that can't be matched or saved stay on the device.
 */
export async function moveDeviceCollectionToAccount({
  device,
  account,
  catalog,
}: {
  device: CollectionRepository;
  account: CollectionRepository;
  catalog: BookCatalog;
}): Promise<MoveResult> {
  const result: MoveResult = { moved: 0, failed: 0 };
  // Oldest first, so the account keeps the device's "recently added" order.
  const items = [...(await device.list())].reverse();

  for (const item of items) {
    try {
      const book = await withCatalogId(item.catalog, catalog);
      if (!book) {
        result.failed++;
        continue;
      }
      await account.add(book);
      await device.remove(item.id);
      result.moved++;
    } catch {
      result.failed++;
    }
  }
  return result;
}

async function withCatalogId(book: CatalogBook, catalog: BookCatalog): Promise<CatalogBook | null> {
  if (book.catalogId) return book;
  if (book.isbn13) return catalog.lookupIsbn(book.isbn13);
  const matches = await catalog.search(book.title);
  return (
    matches.find((match) => match.source === book.source && match.externalId === book.externalId) ??
    null
  );
}
