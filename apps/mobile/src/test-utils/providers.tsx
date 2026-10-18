import {
  type BookSeries,
  createFigure,
  createPreorderRequestSchema,
  preorderSchema,
  KeyValueCollectionRepository,
  type CatalogItemResponse,
  type CreatePreorderRequest,
  type PreorderResponse,
  type UpdatePreorderRequest,
  type AiQuotaResponse,
  type ShelfScanResponse,
  type BookCatalog,
  type CatalogBook,
  type CatalogFigure,
  type FigureSuggestionResponse,
  type AdminFigureSuggestion,
  type CatalogSet,
  type CollectionRepository,
  type KeyValueStore,
  type LegoCatalog,
} from '@fandex/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { AccountError, type AccountService, type AccountUser } from '@/services/account-service';
import type { AdminReviews } from '@/services/admin-reviews';
import { AppServicesProvider } from '@/services/app-services';
import type { CustomItems } from '@/services/custom-items';
import type { FigureCatalog } from '@/services/figure-catalog';
import type { FigureScanner } from '@/services/figure-scanner';
import type { FigureSuggestions } from '@/services/figure-suggestions';
import type { Preorders } from '@/services/preorders';
import type { SeriesCatalog } from '@/services/series-catalog';
import { AskUnavailableError, type QuestionAsker } from '@/services/question-asker';
import type { ShelfPhoto, ShelfScanner } from '@/services/shelf-scanner';

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

/** A LEGO catalog whose methods are Jest mocks; by default it finds nothing. */
export function createFakeLegoCatalog(overrides: Partial<LegoCatalog> = {}) {
  return {
    searchSets: jest.fn<Promise<CatalogSet[]>, Parameters<LegoCatalog['searchSets']>>(() =>
      Promise.resolve([]),
    ),
    lookupSet: jest.fn<Promise<CatalogSet | null>, Parameters<LegoCatalog['lookupSet']>>(() =>
      Promise.resolve(null),
    ),
    ...overrides,
  };
}

/** A figure catalog whose search is a Jest mock; by default it finds nothing. */
export function createFakeFigureCatalog(overrides: Partial<FigureCatalog> = {}) {
  return {
    searchFigures: jest.fn<Promise<CatalogFigure[]>, Parameters<FigureCatalog['searchFigures']>>(
      () => Promise.resolve([]),
    ),
    ...overrides,
  };
}

/**
 * Figure suggestions kept in memory: `suggest` records a pending one (or returns the existing
 * one), `mine` lists them; tests can seed decided ones.
 */
export function createFakeFigureSuggestions(initial: FigureSuggestionResponse[] = []) {
  const suggestions = [...initial];
  return {
    suggestions,
    suggest: jest.fn(async (catalogItemId: string, note?: string) => {
      const existing = suggestions.find((s) => s.catalogItemId === catalogItemId);
      if (existing?.status === 'pending') return existing;
      const suggestion: FigureSuggestionResponse = {
        id:
          existing?.id ??
          `0199b5a0-0000-7000-8000-${String(suggestions.length + 1).padStart(12, '0')}`,
        status: 'pending',
        catalogItemId,
        ...(note && { note }),
        createdAt: '2026-10-14T10:00:00.000Z',
      };
      if (existing) suggestions.splice(suggestions.indexOf(existing), 1, suggestion);
      else suggestions.unshift(suggestion);
      return suggestion;
    }),
    mine: jest.fn(async () => [...suggestions]),
  } satisfies FigureSuggestions & { suggestions: FigureSuggestionResponse[] };
}

/**
 * An admin review queue in memory: `isAdmin` answers `admin`, decisions take the suggestion
 * off the queue (and answer with its new status), unknown ids reject.
 */
export function createFakeAdminReviews({
  admin = false,
  suggestions = [],
}: { admin?: boolean; suggestions?: AdminFigureSuggestion[] } = {}) {
  const queue = [...suggestions];
  const decide = (id: string, changes: Partial<FigureSuggestionResponse>) => {
    const index = queue.findIndex((suggestion) => suggestion.id === id);
    if (index < 0) return Promise.reject(new Error('No such suggestion'));
    const [suggestion] = queue.splice(index, 1);
    const { figure: _figure, suggestedBy: _by, candidates: _candidates, ...rest } = suggestion!;
    return Promise.resolve({ ...rest, ...changes, reviewedAt: '2026-10-14T12:00:00.000Z' });
  };
  return {
    queue,
    isAdmin: jest.fn(async () => admin),
    pending: jest.fn(async () => [...queue]),
    approve: jest.fn((id: string) => decide(id, { status: 'approved' })),
    merge: jest.fn((id: string, targetId: string) => {
      return decide(id, { status: 'merged', mergedIntoId: targetId, catalogItemId: undefined });
    }),
    reject: jest.fn((id: string, note: string) =>
      decide(id, { status: 'rejected', reviewNote: note }),
    ),
  } satisfies AdminReviews & { queue: AdminFigureSuggestion[] };
}

/** A box scanner whose scan is a Jest mock; by default it reads nothing. */
export function createFakeFigureScanner(overrides: Partial<FigureScanner> = {}) {
  return {
    scan: jest.fn<ReturnType<FigureScanner['scan']>, Parameters<FigureScanner['scan']>>(
      async () => ({ reading: null, candidates: [], quota: { used: 1, limit: 5 } }),
    ),
    ...overrides,
  };
}

/** A shelf scanner whose methods are Jest mocks; by default AI is available and finds nothing. */
export function createFakeShelfScanner(overrides: Partial<ShelfScanner> = {}) {
  return {
    quota: jest.fn<Promise<AiQuotaResponse>, []>(() =>
      Promise.resolve({
        available: true,
        shelfScans: { used: 0, limit: 5 },
        figureScans: { used: 0, limit: 5 },
        provider: { name: 'Groq', usesPhotosForTraining: false },
      }),
    ),
    scan: jest.fn<Promise<ShelfScanResponse>, [ShelfPhoto]>(() =>
      Promise.resolve({ items: [], quota: { used: 1, limit: 5 } }),
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
      isAdmin: false,
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

  async updateName({ name }: { name: string }) {
    const account = this.signedInEmail ? this.accounts.get(this.signedInEmail) : undefined;
    if (!account) throw new AccountError('unknown', 'Something went wrong. Try again.');
    account.user = { ...account.user, name: name.trim() };
  }

  async changePassword({
    currentPassword,
    newPassword,
  }: {
    currentPassword: string;
    newPassword: string;
    signOutOtherDevices: boolean;
  }) {
    const account = this.signedInEmail ? this.accounts.get(this.signedInEmail) : undefined;
    if (account?.password !== currentPassword) {
      throw new AccountError('wrong-password', "That password isn't right.");
    }
    account.password = newPassword;
  }

  /** The password an account has now (test assertions). */
  passwordOf(email: string) {
    return this.accounts.get(email)?.password;
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
/** Figures saved on the API: given a catalog id, as the server would. */
export function createFakeCustomItems(overrides: Partial<CustomItems> = {}) {
  let next = 0;
  return {
    createFigure: jest.fn<
      ReturnType<CustomItems['createFigure']>,
      Parameters<CustomItems['createFigure']>
    >(async (figure) => {
      next += 1;
      return {
        ...createFigure(figure, { externalId: `fig-${next}` }),
        catalogId: `0199b5a0-0000-7000-8000-${String(next).padStart(12, '0')}`,
      };
    }),
    ...overrides,
  };
}

/**
 * Pre-orders kept in memory with the server's main rules (history from the first date, paid ≤
 * price checked by the form, arrive closes it). `catalog` supplies the items they're for.
 */
export function createFakePreorders(catalog: Record<string, CatalogItemResponse> = {}) {
  let list: PreorderResponse[] = [];
  let next = 0;
  const now = () => new Date('2026-10-11T09:00:00.000Z').toISOString();
  const item = (id: string): CatalogItemResponse =>
    catalog[id] ?? {
      id,
      category: 'figure',
      source: 'custom',
      externalId: id,
      title: 'Figure',
      creators: [],
      universes: [],
      characters: [],
    };
  const service = {
    list: jest.fn(async () => list),
    create: jest.fn(async (request: CreatePreorderRequest) => {
      next += 1;
      const parsed = createPreorderRequestSchema.parse(request);
      const { catalogItemId, ...fields } = parsed;
      const created: PreorderResponse = preorderSchema.parse({
        ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
        id: `0199b5a0-0000-7000-9000-${String(next).padStart(12, '0')}`,
        status: 'ordered',
        catalog: item(catalogItemId),
        // Like the API: a book's pre-order started from Open Library's date keeps following it.
        followsCatalogDate:
          item(catalogItemId).source === 'openlibrary' &&
          item(catalogItemId).publishDate?.date === parsed.expectedRelease?.date &&
          item(catalogItemId).publishDate?.precision === parsed.expectedRelease?.precision,
        history: parsed.expectedRelease
          ? [{ from: null, to: parsed.expectedRelease, changedAt: now(), source: 'user' }]
          : [],
        createdAt: now(),
      });
      list = [created, ...list];
      return created;
    }),
    update: jest.fn(async (id: string, changes: UpdatePreorderRequest) => {
      const current = list.find((preorder) => preorder.id === id)!;
      const merged = { ...current } as Record<string, unknown>;
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) delete merged[key];
        else if (value !== undefined) merged[key] = value;
      }
      const updated = preorderSchema.parse(merged);
      list = list.map((preorder) => (preorder.id === id ? updated : preorder));
      return updated;
    }),
    arrive: jest.fn(async (id: string) => {
      const arrived = {
        ...list.find((preorder) => preorder.id === id)!,
        status: 'arrived' as const,
      };
      list = list.map((preorder) => (preorder.id === id ? arrived : preorder));
      return {
        preorder: arrived,
        item: {
          id: '0199b5a0-0000-7000-a000-000000000001',
          addedAt: now(),
          catalog: arrived.catalog,
        },
      };
    }),
    remove: jest.fn(async (id: string) => {
      list = list.filter((preorder) => preorder.id !== id);
    }),
  };
  return service;
}

/** Questions on the API: unavailable unless a test says otherwise (the app then uses keywords). */
export function createFakeQuestionAsker(overrides: Partial<QuestionAsker> = {}) {
  return {
    ask: jest.fn<ReturnType<QuestionAsker['ask']>, Parameters<QuestionAsker['ask']>>(() =>
      Promise.reject(new AskUnavailableError('No server in tests')),
    ),
    ...overrides,
  };
}

/**
 * Book series for tests: each series answers for every work in it; `works` are the editions
 * found for missing books (by work key). Methods are Jest mocks.
 */
export function createFakeSeriesCatalog({
  series = [],
  works = {},
}: { series?: BookSeries[]; works?: Record<string, CatalogBook> } = {}) {
  return {
    seriesForWorks: jest.fn(async (workKeys: readonly string[]) => {
      const found = new Map<string, BookSeries>();
      const pending = new Set<string>();
      for (const key of workKeys) {
        const match = series.find((s) =>
          [...s.entries, ...s.extras].some((entry) => entry.workKey === key),
        );
        if (match) found.set(key, match);
      }
      return { series: found, pending };
    }),
    lookupWork: jest.fn(async (workKey: string) => works[workKey] ?? null),
  } satisfies SeriesCatalog;
}

export function createWrapper({
  catalog = createFakeCatalog(),
  legoCatalog = createFakeLegoCatalog(),
  figureCatalog = createFakeFigureCatalog(),
  deviceCollection = createMemoryCollection(),
  accountCollection = createMemoryCollection(),
  account = new FakeAccountService(),
  shelfScanner = createFakeShelfScanner(),
  figureScanner = createFakeFigureScanner(),
  questionAsker = createFakeQuestionAsker(),
  customItems = createFakeCustomItems(),
  figureSuggestions = createFakeFigureSuggestions(),
  adminReviews = createFakeAdminReviews(),
  preorders = createFakePreorders(),
  seriesCatalog = createFakeSeriesCatalog(),
}: {
  catalog?: BookCatalog;
  legoCatalog?: LegoCatalog;
  figureCatalog?: FigureCatalog;
  deviceCollection?: CollectionRepository;
  accountCollection?: CollectionRepository;
  account?: AccountService;
  shelfScanner?: ShelfScanner;
  figureScanner?: FigureScanner;
  questionAsker?: QuestionAsker;
  customItems?: CustomItems;
  figureSuggestions?: FigureSuggestions;
  adminReviews?: AdminReviews;
  preorders?: Preorders;
  seriesCatalog?: SeriesCatalog;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AppServicesProvider
          services={{
            catalog,
            legoCatalog,
            figureCatalog,
            deviceCollection,
            accountCollection,
            account,
            shelfScanner,
            figureScanner,
            questionAsker,
            customItems,
            figureSuggestions,
            adminReviews,
            preorders,
            seriesCatalog,
          }}
        >
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

export const falcon: CatalogSet = {
  source: 'rebrickable',
  externalId: '75192-1',
  category: 'lego',
  title: 'Millennium Falcon',
  setNumber: '75192',
  year: 2017,
  pieceCount: 7541,
  theme: 'Star Wars',
  subtheme: 'Ultimate Collector Series',
  coverUrl: 'https://cdn.rebrickable.com/media/sets/75192-1/30881.jpg',
};

// Entries as the Fandex API returns them: with the universes and characters it matched.
export const linkedHobbit: CatalogBook = {
  ...hobbit,
  universes: ['middle-earth'],
  characters: [
    { universe: 'middle-earth', character: 'gandalf' },
    { universe: 'middle-earth', character: 'bilbo-baggins' },
  ],
};
export const rivendell: CatalogSet = {
  source: 'rebrickable',
  externalId: '10316-1',
  category: 'lego',
  title: 'Lord of the Rings: Rivendell',
  setNumber: '10316',
  universes: ['middle-earth'],
  characters: [
    { universe: 'middle-earth', character: 'gandalf' },
    { universe: 'middle-earth', character: 'frodo-baggins' },
  ],
};
export const linkedFalcon: CatalogSet = {
  ...falcon,
  universes: ['star-wars'],
  characters: [{ universe: 'star-wars', character: 'han-solo' }],
};
