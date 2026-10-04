import type { CatalogBook, CatalogSource } from './catalog-book';
import { parseIsbn, type Isbn13 } from './isbn';
import {
  CollectionStorageError,
  KeyValueCollectionRepository,
  type KeyValueStore,
} from './key-value-collection-repository';

const isbn = (value: string) => parseIsbn(value) as Isbn13;

const hobbit: CatalogBook = {
  source: 'openlibrary',
  externalId: 'OL22039557M',
  title: 'The Hobbit',
  authors: ['J.R.R. Tolkien'],
  isbn13: isbn('9780345445605'),
};
const dune: CatalogBook = {
  source: 'openlibrary',
  externalId: 'OL1M',
  title: 'Dune',
  authors: ['Frank Herbert'],
  isbn13: isbn('9780306406157'),
};

/** An in-memory KeyValueStore; async like the real thing, so ordering bugs still show up. */
class MemoryStore implements KeyValueStore {
  readonly data = new Map<string, string>();
  async getItem(key: string) {
    await Promise.resolve();
    return this.data.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    await Promise.resolve();
    this.data.set(key, value);
  }
}

function createRepository(store = new MemoryStore()) {
  let nextId = 1;
  let clock = Date.parse('2026-10-04T12:00:00Z');
  const repository = new KeyValueCollectionRepository({
    store,
    generateId: () => `item-${nextId++}`,
    now: () => new Date((clock += 1000)),
  });
  return { repository, store };
}

describe('KeyValueCollectionRepository', () => {
  it('starts empty', async () => {
    const { repository } = createRepository();

    await expect(repository.list()).resolves.toEqual([]);
  });

  it('adds books and lists them newest first', async () => {
    const { repository } = createRepository();

    const first = await repository.add(hobbit);
    const second = await repository.add(dune);

    expect(first).toMatchObject({ id: 'item-1', category: 'book', catalog: hobbit });
    expect((await repository.list()).map((item) => item.id)).toEqual([second.id, first.id]);
  });

  it('keeps the collection across instances (i.e. app restarts)', async () => {
    const { repository, store } = createRepository();
    await repository.add(hobbit);

    const afterRestart = createRepository(store).repository;

    await expect(afterRestart.list()).resolves.toMatchObject([{ catalog: hobbit }]);
  });

  it('returns the existing item instead of adding the same edition twice', async () => {
    const { repository } = createRepository();
    const original = await repository.add(hobbit);

    // Same ISBN from a (hypothetical) second catalog is still the same edition.
    const again = await repository.add({
      ...hobbit,
      source: 'another-catalog' as CatalogSource,
      externalId: 'x1',
    });

    expect(again).toEqual(original);
    await expect(repository.list()).resolves.toHaveLength(1);
  });

  it('does not lose data when adds happen concurrently', async () => {
    const { repository } = createRepository();

    await Promise.all([repository.add(hobbit), repository.add(dune)]);

    await expect(repository.list()).resolves.toHaveLength(2);
  });

  it('removes an item by id and ignores unknown ids', async () => {
    const { repository } = createRepository();
    const item = await repository.add(hobbit);
    await repository.add(dune);

    await repository.remove(item.id);
    await repository.remove('does-not-exist');

    await expect(repository.list()).resolves.toMatchObject([{ catalog: dune }]);
  });

  it('finds an item by ISBN', async () => {
    const { repository } = createRepository();
    await repository.add(hobbit);

    await expect(repository.findByIsbn(isbn('9780345445605'))).resolves.toMatchObject({
      catalog: hobbit,
    });
    await expect(repository.findByIsbn(isbn('9780306406157'))).resolves.toBeUndefined();
  });

  it('stores a versioned document', async () => {
    const { repository, store } = createRepository();
    await repository.add(hobbit);

    const stored = JSON.parse(store.data.get('fandex:collection') ?? '{}') as unknown;

    expect(stored).toMatchObject({ version: 1, items: [{ catalog: hobbit }] });
  });

  describe('with unreadable saved data', () => {
    it.each([
      ['invalid JSON', '{not json'],
      ['an unknown version', JSON.stringify({ version: 99, items: [] })],
      ['an unexpected shape', JSON.stringify([1, 2, 3])],
    ])('throws on %s and leaves the data untouched', async (_, raw) => {
      const store = new MemoryStore();
      store.data.set('fandex:collection', raw);
      const { repository } = createRepository(store);

      await expect(repository.list()).rejects.toBeInstanceOf(CollectionStorageError);
      await expect(repository.add(hobbit)).rejects.toBeInstanceOf(CollectionStorageError);
      expect(store.data.get('fandex:collection')).toBe(raw);
    });
  });

  it('keeps working after a failed operation', async () => {
    const store = new MemoryStore();
    const { repository } = createRepository(store);
    const setItem = jest.spyOn(store, 'setItem').mockRejectedValueOnce(new Error('disk full'));

    await expect(repository.add(hobbit)).rejects.toThrow('disk full');
    setItem.mockRestore();

    await expect(repository.add(dune)).resolves.toMatchObject({ catalog: dune });
    await expect(repository.list()).resolves.toHaveLength(1);
  });
});
