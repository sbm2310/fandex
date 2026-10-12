import type { Category } from '../category';
import { parseVolume, type VolumeCategory } from './volumes';

/**
 * The volume after the highest one owned, found with an ordinary catalog search. Open Library
 * wants every word of a query to match, so "one piece 114" finds ONE PIECE 114 (with its
 * release date when it's upcoming) among noise like "Decameron, Vol. 114"; only a result whose
 * title reads as the same series and number counts. Search results are often misfiled (a manga
 * volume as a "book"), so they're read as the series' category.
 */

type Candidate = {
  category: Category;
  title: string;
  subtitle?: string | undefined;
  publishDate?: unknown;
  isbn13?: string | undefined;
};

export type SeriesRef = { key: string; category: VolumeCategory; highest: number };

/** What to search for: the series (normalized, so "&" and "×" don't get in the way) and number. */
export function nextVolumeQuery(series: Pick<SeriesRef, 'key'>, volume: number): string {
  return `${series.key} ${volume}`;
}

/**
 * The result that is this series' given volume, or null. Several can match (editions):
 * one filed in the series' category first, then one with a known date, then one with an ISBN.
 */
export function pickVolume<T extends Candidate>(
  series: Pick<SeriesRef, 'key' | 'category'>,
  volume: number,
  candidates: readonly T[],
): T | null {
  const matching = candidates.filter((candidate) => {
    const parsed = parseVolume({ ...candidate, category: series.category });
    return parsed?.key === series.key && parsed.volume === volume;
  });
  const score = (candidate: T) =>
    (candidate.category === series.category ? 4 : 0) +
    (candidate.publishDate ? 2 : 0) +
    (candidate.isbn13 ? 1 : 0);
  return [...matching].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** Searches for the volume after the highest owned; null if the catalog doesn't have it (yet). */
export async function findNextVolume<T extends Candidate>(
  series: SeriesRef,
  search: (query: string) => Promise<readonly T[]>,
): Promise<{ volume: number; entry: T } | null> {
  const volume = series.highest + 1;
  const entry = pickVolume(series, volume, await search(nextVolumeQuery(series, volume)));
  return entry ? { volume, entry } : null;
}
