import { CatalogError } from '@fandex/core';
import { QueryClient } from '@tanstack/react-query';

/**
 * TanStack Query caches server data in memory, de-duplicates identical requests and
 * cancels stale ones. Catalog data rarely changes, so results stay fresh for an hour.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 60 * 1000,
        // One retry for flaky networks, but never hammer a rate-limited API.
        retry: (failureCount, error) =>
          failureCount < 1 && !(error instanceof CatalogError && error.kind === 'rate-limited'),
      },
    },
  });
}
