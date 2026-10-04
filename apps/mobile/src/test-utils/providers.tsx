import {
  KeyValueCollectionRepository,
  type BookCatalog,
  type CatalogBook,
  type CollectionRepository,
  type KeyValueStore,
} from '@fandex/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { AppServicesProvider } from '@/services/app-services';

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

/** The real repository over an in-memory store, so tests exercise actual collection logic. */
export function createMemoryCollection({ now }: { now?: () => Date } = {}): CollectionRepository {
  const data = new Map<string, string>();
  const store: KeyValueStore = {
    getItem: (key) => Promise.resolve(data.get(key) ?? null),
    setItem: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
  let nextId = 1;
  return new KeyValueCollectionRepository({
    store,
    generateId: () => `item-${nextId++}`,
    ...(now && { now }),
  });
}

/**
 * Wraps a screen in the app's providers with test doubles and a fresh QueryClient per test
 * (no retries, so error states show immediately).
 */
export function createWrapper({
  catalog = createFakeCatalog(),
  collection = createMemoryCollection(),
}: { catalog?: BookCatalog; collection?: CollectionRepository } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AppServicesProvider services={{ catalog, collection }}>{children}</AppServicesProvider>
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

export const dune: CatalogBook = {
  source: 'openlibrary',
  externalId: 'OL1532643M',
  title: 'Dune',
  authors: ['Frank Herbert'],
  publishedYear: 1990,
  publisher: 'Ace',
};
