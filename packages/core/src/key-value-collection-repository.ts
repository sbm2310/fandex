import type { CatalogBook } from './catalog-book';
import type { CatalogEntry } from './catalog-entry';
import { createCollectionItem, type CollectionItem } from './collection-item';
import type { CollectionRepository } from './collection-repository';
import type { Isbn13 } from './isbn';
import { isSameEntry } from './same-book';

/** The minimal async key-value API we need; AsyncStorage (and a Map, in tests) fits it. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/** Stored data couldn't be read. We throw rather than overwrite, so nothing is lost. */
export class CollectionStorageError extends Error {
  override readonly name = 'CollectionStorageError';
}

const STORAGE_KEY = 'fandex:collection';
const SCHEMA_VERSION = 1;

/** Versioned so a future format change can migrate old data instead of misreading it. */
type StoredCollection = { version: typeof SCHEMA_VERSION; items: CollectionItem[] };

export type KeyValueCollectionRepositoryOptions = {
  store: KeyValueStore;
  generateId: () => string;
  now?: () => Date;
};

/**
 * Keeps the whole collection as one JSON document in a key-value store — simple and fast
 * for the hundreds of items a personal collection has. Stage 2 replaces this with the API.
 */
export class KeyValueCollectionRepository implements CollectionRepository {
  private readonly store: KeyValueStore;
  private readonly generateId: () => string;
  private readonly now: () => Date;
  /** Writes run one at a time so concurrent adds can't overwrite each other. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor({ store, generateId, now = () => new Date() }: KeyValueCollectionRepositoryOptions) {
    this.store = store;
    this.generateId = generateId;
    this.now = now;
  }

  async list(): Promise<CollectionItem[]> {
    await this.queue.catch(() => undefined);
    return this.read();
  }

  /** Adds an entry; if the same edition or set is already there, returns that item instead. */
  add(entry: CatalogEntry): Promise<CollectionItem> {
    return this.serialize(async () => {
      const items = await this.read();
      const existing = items.find((item) => isSameEntry(item.catalog, entry));
      if (existing) return existing;

      const item = createCollectionItem(entry, { id: this.generateId(), now: this.now() });
      await this.write([item, ...items]);
      return item;
    });
  }

  remove(id: string): Promise<void> {
    return this.serialize(async () => {
      const items = await this.read();
      const remaining = items.filter((item) => item.id !== id);
      if (remaining.length !== items.length) await this.write(remaining);
    });
  }

  async findByIsbn(isbn: Isbn13): Promise<CollectionItem | undefined> {
    return (await this.list()).find(
      (item) => item.category !== 'lego' && item.catalog.isbn13 === isbn,
    );
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.catch(() => undefined).then(operation);
    this.queue = result;
    return result;
  }

  /** Items, newest first (they're stored in that order). */
  private async read(): Promise<CollectionItem[]> {
    const raw = await this.store.getItem(STORAGE_KEY);
    if (raw === null) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new CollectionStorageError('Saved collection is not valid JSON', { cause: error });
    }
    if (!isStoredCollection(parsed)) {
      throw new CollectionStorageError('Saved collection has an unknown format');
    }
    return parsed.items.map(withCategory);
  }

  private async write(items: CollectionItem[]): Promise<void> {
    const data: StoredCollection = { version: SCHEMA_VERSION, items };
    await this.store.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

/**
 * Items saved before categories existed (Stage 1) have none; they were all books. Filling it
 * in on read is backward-compatible, so the storage format version stays the same.
 */
function withCategory(item: CollectionItem): CollectionItem {
  if (item.catalog.category) return item;
  const legacy = item as unknown as { catalog: Omit<CatalogBook, 'category'> };
  return { ...item, category: 'book', catalog: { ...legacy.catalog, category: 'book' } };
}

function isStoredCollection(value: unknown): value is StoredCollection {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    value.version === SCHEMA_VERSION &&
    'items' in value &&
    Array.isArray(value.items)
  );
}
