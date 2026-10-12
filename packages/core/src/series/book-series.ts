import type { BookSeries, SeriesEntry } from '../catalogs/wikidata-series';

export type SeriesProgress = {
  series: BookSeries;
  /** Main-line books the user owns (any edition of the work). */
  owned: SeriesEntry[];
  /** Main-line books they don't, in order (published or upcoming). */
  missing: SeriesEntry[];
};

/** Which books of a series' main line the user owns, by Open Library work id. */
export function seriesProgress(
  series: BookSeries,
  ownedWorkKeys: ReadonlySet<string>,
): SeriesProgress {
  const isOwned = (entry: SeriesEntry) => !!entry.workKey && ownedWorkKeys.has(entry.workKey);
  return {
    series,
    owned: series.entries.filter(isOwned),
    missing: series.entries.filter((entry) => !isOwned(entry)),
  };
}

/** Not published yet (dates are YYYY-MM-DD, `today` too). */
export function isUpcoming(entry: SeriesEntry, today: string): boolean {
  return entry.published !== undefined && entry.published > today;
}
