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
  return sorted.sort((a, b) => compareTitles(formatTitle(a.catalog), formatTitle(b.catalog)));
}

/** Bookshop order for two titles: leading "The/A/An" ignored, case-insensitive, numbers natural. */
export function compareTitles(a: string, b: string): number {
  const key = (title: string) => title.replace(/^(the|a|an)\s+/i, '');
  return key(a).localeCompare(key(b), 'en', { sensitivity: 'base', numeric: true });
}
