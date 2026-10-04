import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useDebouncedValue } from './use-debounced-value';

import { useCatalog } from '@/services/app-services';

export const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 400;

/**
 * Searches the catalog as the user types: waits for a pause in typing, skips very short
 * queries, keeps showing the previous results while the next ones load, and cancels
 * requests that a newer query has superseded (via the abort signal).
 */
export function useBookSearch(input: string) {
  const catalog = useCatalog();
  const query = useDebouncedValue(input.trim(), DEBOUNCE_MS);
  const enabled = query.length >= MIN_QUERY_LENGTH;

  const result = useQuery({
    queryKey: ['catalog', 'search', query],
    queryFn: ({ signal }) => catalog.search(query, { signal }),
    enabled,
    placeholderData: keepPreviousData,
  });

  return { ...result, query, enabled };
}
