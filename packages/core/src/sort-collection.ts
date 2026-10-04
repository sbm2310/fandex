import { formatTitle } from './catalog-book';
import type { CollectionItem } from './collection-item';

export type CollectionSort = 'recent' | 'title';

/**
 * Sorts a collection without mutating it.
 * - `recent`: most recently added first.
 * - `title`: A–Z the way a bookshop shelves it: leading "The/A/An" ignored, case-insensitive,
 *   numbers compared naturally ("Book 2" before "Book 10").
 */
export function sortCollection(
  items: readonly CollectionItem[],
  sort: CollectionSort,
): CollectionItem[] {
  const sorted = [...items];
  if (sort === 'recent') {
    return sorted.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }
  return sorted.sort((a, b) =>
    titleSortKey(a).localeCompare(titleSortKey(b), 'en', { sensitivity: 'base', numeric: true }),
  );
}

function titleSortKey(item: CollectionItem): string {
  return formatTitle(item.catalog).replace(/^(the|a|an)\s+/i, '');
}
