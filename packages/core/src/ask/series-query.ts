import type { Category } from '../category';
import type { SeriesStatus } from '../series/series-status';
import { containsPhrase, normalizeText } from '../universes/normalize-name';

import type { CollectionQuery, QueryResult } from './collection-query';

/**
 * Answers a question about series: the ones with something missing, filtered by category
 * ("manga series") and title words (in the series' name: "Stormlight"). Sorted by name.
 */
export function runSeriesQuery(
  statuses: readonly SeriesStatus[],
  query: CollectionQuery,
): QueryResult<SeriesStatus> {
  const words = query.titleWords.flatMap((word) => normalizeText(word).split(' ')).filter(Boolean);
  const series = statuses.filter((status) => {
    if (status.missing.length === 0) return false;
    if (query.categories.length > 0 && !query.categories.includes(status.category)) return false;
    const name = normalizeText(status.name);
    return words.every((word) => containsPhrase(name, word));
  });
  const categoryCounts: Partial<Record<Category, number>> = {};
  for (const status of series) {
    categoryCounts[status.category] = (categoryCounts[status.category] ?? 0) + 1;
  }
  return { items: [...series], categoryCounts, series };
}
