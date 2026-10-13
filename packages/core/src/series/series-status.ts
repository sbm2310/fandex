import type { Category } from '../category';
import type { BookSeries } from '../catalogs/wikidata-series';
import { seriesProgress } from './book-series';
import { volumeGaps } from './volumes';

/** Where a series stands in a collection: what's owned of its main line and what's missing. */
export type SeriesStatus = {
  name: string;
  /** Book series come from Wikidata; manga and comic series from volume numbers. */
  category: 'book' | 'manga' | 'comic';
  owned: number;
  /** The series' length (books), or the highest volume owned (manga and comics). */
  total: number;
  /** Missing places or volume numbers, ascending. */
  missing: number[];
};

/** What summarizing needs from an owned item (the API builds it from rows, the app from items). */
export type SeriesSourceItem = {
  category: Category;
  title: string;
  subtitle?: string | undefined;
  /** Open Library work id, for book series. */
  workKey?: string | undefined;
};

/**
 * Every series the collection has something of, the same way on the server and the device:
 * book series (category "book") by work id from the series known for them, manga and comic
 * series from their volume numbers. Sorted by name.
 */
export function summarizeSeries(
  items: readonly SeriesSourceItem[],
  seriesForWork: (workKey: string) => BookSeries | undefined,
): SeriesStatus[] {
  const statuses: SeriesStatus[] = [];
  const owned = new Set(items.flatMap((item) => item.workKey ?? []));
  const seen = new Set<string>();
  for (const item of items) {
    if (item.category !== 'book' || !item.workKey) continue;
    const series = seriesForWork(item.workKey);
    if (!series || seen.has(series.wikidataId)) continue;
    seen.add(series.wikidataId);
    const progress = seriesProgress(series, owned);
    statuses.push({
      name: series.name,
      category: 'book',
      owned: progress.owned.length,
      total: series.entries.length,
      missing: progress.missing.flatMap((entry) => entry.ordinal ?? []),
    });
  }
  for (const series of volumeGaps(items)) {
    statuses.push({
      name: series.name,
      category: series.category,
      owned: series.owned.length,
      total: series.highest,
      missing: series.missing,
    });
  }
  return statuses.sort(
    (a, b) => a.name.localeCompare(b.name) || a.category.localeCompare(b.category),
  );
}
