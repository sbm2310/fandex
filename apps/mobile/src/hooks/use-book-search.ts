import { looksLikeIsbn, parseIsbn, type CatalogBook, type Isbn13 } from '@fandex/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useDebouncedValue } from './use-debounced-value';

import { useCatalog } from '@/services/app-services';

export const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 400;

/** What the user's input means: nothing yet, a free-text search, an ISBN, or a mistyped ISBN. */
export type SearchMode =
  | { kind: 'idle' }
  | { kind: 'text'; query: string }
  | { kind: 'isbn'; isbn: Isbn13 }
  | { kind: 'invalid-isbn'; input: string };

export function classifySearch(input: string): SearchMode {
  const trimmed = input.trim();
  if (looksLikeIsbn(trimmed)) {
    const isbn = parseIsbn(trimmed);
    return isbn ? { kind: 'isbn', isbn } : { kind: 'invalid-isbn', input: trimmed };
  }
  return trimmed.length >= MIN_QUERY_LENGTH ? { kind: 'text', query: trimmed } : { kind: 'idle' };
}

/**
 * Searches the catalog as the user types. ISBNs (typed, pasted or, later, scanned) get an exact
 * lookup; anything else is a text search. Waits for a pause in typing, keeps showing the previous
 * results while the next ones load, and cancels requests a newer query has superseded.
 */
export function useBookSearch(input: string) {
  const catalog = useCatalog();
  const mode = classifySearch(useDebouncedValue(input, DEBOUNCE_MS));

  const result = useQuery({
    queryKey:
      mode.kind === 'isbn'
        ? ['catalog', 'isbn', mode.isbn]
        : ['catalog', 'search', mode.kind === 'text' ? mode.query : ''],
    queryFn: async ({ signal }): Promise<CatalogBook[]> => {
      if (mode.kind === 'isbn') {
        const book = await catalog.lookupIsbn(mode.isbn, { signal });
        return book ? [book] : [];
      }
      return mode.kind === 'text' ? catalog.search(mode.query, { signal }) : [];
    },
    enabled: mode.kind === 'text' || mode.kind === 'isbn',
    placeholderData: keepPreviousData,
  });

  return { ...result, mode };
}
