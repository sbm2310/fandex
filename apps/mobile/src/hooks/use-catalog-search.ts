import { looksLikeIsbn, parseIsbn, type CatalogEntry, type Isbn13 } from '@fandex/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useDebouncedValue } from './use-debounced-value';

import { useCatalog, useLegoCatalog } from '@/services/app-services';

export const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 400;

/** What the user is searching: books (incl. manga and comics) or LEGO sets. */
export type SearchKind = 'books' | 'lego';

/** What the user's input means: nothing yet, a text search, an ISBN, or a mistyped ISBN. */
export type SearchMode =
  | { kind: 'idle' }
  | { kind: 'text'; query: string }
  | { kind: 'isbn'; isbn: Isbn13 }
  | { kind: 'invalid-isbn'; input: string }
  | { kind: 'lego'; query: string };

export function classifySearch(input: string, searchKind: SearchKind = 'books'): SearchMode {
  const trimmed = input.trim();
  if (searchKind === 'lego') {
    // Set numbers ("75192") and names both go to the LEGO search.
    return trimmed.length >= MIN_QUERY_LENGTH ? { kind: 'lego', query: trimmed } : { kind: 'idle' };
  }
  if (looksLikeIsbn(trimmed)) {
    const isbn = parseIsbn(trimmed);
    return isbn ? { kind: 'isbn', isbn } : { kind: 'invalid-isbn', input: trimmed };
  }
  return trimmed.length >= MIN_QUERY_LENGTH ? { kind: 'text', query: trimmed } : { kind: 'idle' };
}

/**
 * Searches as the user types. Books: ISBNs (typed, pasted or scanned) get an exact lookup,
 * anything else a text search. LEGO: name or set number. Waits for a pause in typing, keeps
 * the previous results while the next load, and cancels superseded requests.
 */
export function useCatalogSearch(input: string, searchKind: SearchKind = 'books') {
  const catalog = useCatalog();
  const legoCatalog = useLegoCatalog();
  const mode = classifySearch(useDebouncedValue(input, DEBOUNCE_MS), searchKind);

  const result = useQuery({
    queryKey: queryKeyFor(mode),
    queryFn: async ({ signal }): Promise<CatalogEntry[]> => {
      switch (mode.kind) {
        case 'isbn': {
          const book = await catalog.lookupIsbn(mode.isbn, { signal });
          return book ? [book] : [];
        }
        case 'text':
          return catalog.search(mode.query, { signal });
        case 'lego':
          return legoCatalog.searchSets(mode.query, { signal });
        default:
          return [];
      }
    },
    enabled: mode.kind === 'text' || mode.kind === 'isbn' || mode.kind === 'lego',
    placeholderData: keepPreviousData,
  });

  return { ...result, mode };
}

function queryKeyFor(mode: SearchMode) {
  switch (mode.kind) {
    case 'isbn':
      return ['catalog', 'isbn', mode.isbn];
    case 'text':
      return ['catalog', 'search', mode.query];
    case 'lego':
      return ['catalog', 'lego', mode.query];
    default:
      return ['catalog', 'idle'];
  }
}
