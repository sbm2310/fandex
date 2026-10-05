import {
  KeyValueCollectionRepository,
  type BookCatalog,
  type CatalogBook,
  type CollectionRepository,
  type KeyValueStore,
} from '@fandex/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { AccountError, type AccountService, type AccountUser } from '@/services/account-service';
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
 * An in-memory AccountService that behaves like the real one: accounts with passwords,
 * one signed-in user at a time, the same error kinds.
 */
export class FakeAccountService implements AccountService {
  private readonly accounts = new Map<string, { user: AccountUser; password: string }>();
  private signedInEmail: string | null = null;

  /** Creates an account without signing in (test setup). */
  register(name: string, email: string, password: string): AccountUser {
    const user: AccountUser = {
      id: `0199b5a0-0000-7000-8000-${String(this.accounts.size + 1).padStart(12, '0')}`,
      name,
      email,
      emailVerified: false,
      createdAt: '2026-10-05T09:00:00.000Z',
    };
    this.accounts.set(email, { user, password });
    return user;
  }

  async getCurrentUser() {
    return this.signedInEmail ? (this.accounts.get(this.signedInEmail)?.user ?? null) : null;
  }

  async signUp({ name, email, password }: { name: string; email: string; password: string }) {
    if (this.accounts.has(email))
      throw new AccountError(
        'email-taken',
        'An account with this email already exists. Try signing in instead.',
      );
    this.register(name, email, password);
    this.signedInEmail = email;
  }

  async signIn({ email, password }: { email: string; password: string }) {
    if (this.accounts.get(email)?.password !== password) {
      throw new AccountError(
        'invalid-credentials',
        "That email and password don't match. Check them and try again.",
      );
    }
    this.signedInEmail = email;
  }

  async signOut() {
    this.signedInEmail = null;
  }

  async deleteAccount({ password }: { password: string }) {
    const email = this.signedInEmail;
    if (!email || this.accounts.get(email)?.password !== password) {
      throw new AccountError('wrong-password', "That password isn't right.");
    }
    this.accounts.delete(email);
    this.signedInEmail = null;
  }
}

/**
 * Wraps a screen in the app's providers with test doubles and a fresh QueryClient per test
 * (no retries, so error states show immediately).
 */
export function createWrapper({
  catalog = createFakeCatalog(),
  collection = createMemoryCollection(),
  account = new FakeAccountService(),
}: { catalog?: BookCatalog; collection?: CollectionRepository; account?: AccountService } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AppServicesProvider services={{ catalog, collection, account }}>
          {children}
        </AppServicesProvider>
      </QueryClientProvider>
    );
  };
}

export const hobbit: CatalogBook = {
  source: 'openlibrary',
  category: 'book',
  externalId: 'OL22039557M',
  title: 'The Hobbit',
  authors: ['J.R.R. Tolkien'],
  publishedYear: 2001,
  publisher: 'Ballantine Books',
  coverUrl: 'https://covers.openlibrary.org/b/id/8406778-M.jpg',
};

export const dune: CatalogBook = {
  source: 'openlibrary',
  category: 'book',
  externalId: 'OL1532643M',
  title: 'Dune',
  authors: ['Frank Herbert'],
  publishedYear: 1990,
  publisher: 'Ace',
};

export const onePiece: CatalogBook = {
  source: 'openlibrary',
  category: 'manga',
  externalId: 'OL9218212M',
  title: 'One Piece, Vol. 1',
  authors: ['Eiichiro Oda'],
  publishedYear: 2003,
  publisher: 'SHONEN JUMP',
};
