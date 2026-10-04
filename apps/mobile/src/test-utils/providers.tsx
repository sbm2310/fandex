import type { BookCatalog, CatalogBook } from '@fandex/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { CatalogProvider } from '@/services/catalog-context';

/** A catalog whose methods are Jest mocks; by default it finds nothing. */
export function createFakeCatalog(overrides: Partial<BookCatalog> = {}) {
  return {
    search: jest.fn<Promise<CatalogBook[]>, Parameters<BookCatalog['search']>>(() =>
      Promise.resolve([]),
    ),
    lookupIsbn: jest.fn<Promise<CatalogBook | null>, Parameters<BookCatalog['lookupIsbn']>>(() =>
      Promise.resolve(null),
    ),
    ...overrides,
  };
}

/**
 * Wraps a screen in the app's providers with test doubles: a fake catalog and a fresh
 * QueryClient per test (no retries, so error states show immediately).
 */
export function createWrapper(catalog: BookCatalog = createFakeCatalog()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <CatalogProvider catalog={catalog}>{children}</CatalogProvider>
      </QueryClientProvider>
    );
  };
}

export const hobbit: CatalogBook = {
  source: 'openlibrary',
  externalId: 'OL22039557M',
  title: 'The Hobbit',
  authors: ['J.R.R. Tolkien'],
  publishedYear: 2001,
  publisher: 'Ballantine Books',
  coverUrl: 'https://covers.openlibrary.org/b/id/8406778-M.jpg',
};
