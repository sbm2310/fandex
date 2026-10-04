import type { BookCatalog } from '@fandex/core';
import { createContext, use, type ReactNode } from 'react';

const CatalogContext = createContext<BookCatalog | null>(null);

/**
 * Supplies the book catalog to screens (like registering a service in a DI container).
 * The app provides the real catalog in the root layout; tests provide a fake.
 */
export function CatalogProvider({
  catalog,
  children,
}: {
  catalog: BookCatalog;
  children: ReactNode;
}) {
  return <CatalogContext value={catalog}>{children}</CatalogContext>;
}

export function useCatalog(): BookCatalog {
  const catalog = use(CatalogContext);
  if (!catalog) throw new Error('useCatalog must be used inside <CatalogProvider>');
  return catalog;
}
