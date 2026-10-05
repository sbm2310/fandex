import type { BookCatalog, CatalogEntry, CollectionRepository, LegoCatalog } from '@fandex/core';

export type MoveResult = { moved: number; failed: number };

/**
 * Moves the books and sets saved on this device into the signed-in account. Each is matched to
 * a Fandex catalog entry (its catalog id; for books, else its ISBN, else a title search for the
 * same edition; for LEGO, its set number),
 * added to the account (adding is idempotent, so duplicates merge), and only then removed from
 * the device. Books that can't be matched or saved stay on the device.
 */
export async function moveDeviceCollectionToAccount({
  device,
  account,
  catalog,
  legoCatalog,
}: {
  device: CollectionRepository;
  account: CollectionRepository;
  catalog: BookCatalog;
  legoCatalog: LegoCatalog;
}): Promise<MoveResult> {
  const result: MoveResult = { moved: 0, failed: 0 };
  // Oldest first, so the account keeps the device's "recently added" order.
  const items = [...(await device.list())].reverse();

  for (const item of items) {
    try {
      const book = await withCatalogId(item.catalog, catalog, legoCatalog);
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

async function withCatalogId(
  entry: CatalogEntry,
  catalog: BookCatalog,
  legoCatalog: LegoCatalog,
): Promise<CatalogEntry | null> {
  if (entry.catalogId) return entry;
  if (entry.category === 'lego') return legoCatalog.lookupSet(entry.externalId);
  const book = entry;
  if (book.isbn13) return catalog.lookupIsbn(book.isbn13);
  const matches = await catalog.search(book.title);
  return (
    matches.find((match) => match.source === book.source && match.externalId === book.externalId) ??
    null
  );
}
