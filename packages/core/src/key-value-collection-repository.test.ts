import type { BookSource, CatalogBook } from './catalog-book';
import type { CatalogSet } from './catalog-set';
import { parseIsbn, type Isbn13 } from './isbn';
import {
  CollectionStorageError,
  KeyValueCollectionRepository,
  type KeyValueStore,
} from './key-value-collection-repository';

const isbn = (value: string) => parseIsbn(value) as Isbn13;

const hobbit: CatalogBook = {
  source: 'openlibrary',
  category: 'book',
  externalId: 'OL22039557M',
  title: 'The Hobbit',
  authors: ['J.R.R. Tolkien'],
  isbn13: isbn('9780345445605'),
};
const dune: CatalogBook = {
  source: 'openlibrary',
  category: 'book',
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
      source: 'another-catalog' as BookSource,
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

  it('treats items saved before categories existed as books', async () => {
    const store = new MemoryStore();
    const { category: _, ...stage1Catalog } = hobbit;
    store.data.set(
      'fandex:collection',
      JSON.stringify({
        version: 1,
        items: [
          {
            id: 'old',
            category: 'book',
            catalog: stage1Catalog,
            addedAt: '2026-10-04T12:00:00.000Z',
          },
        ],
      }),
    );
    const { repository } = createRepository(store);

    await expect(repository.list()).resolves.toMatchObject([
      { id: 'old', category: 'book', catalog: { category: 'book', title: 'The Hobbit' } },
    ]);
  });

  describe('LEGO sets', () => {
    const falcon: CatalogSet = {
      source: 'rebrickable',
      externalId: '75192-1',
      category: 'lego',
      title: 'Millennium Falcon',
      setNumber: '75192',
      pieceCount: 7541,
      theme: 'Star Wars',
    };

    it('stores sets alongside books', async () => {
      const { repository } = createRepository();
      await repository.add(hobbit);

      const set = await repository.add(falcon);

      expect(set).toMatchObject({ category: 'lego', catalog: { setNumber: '75192' } });
      expect((await repository.list()).map((item) => item.category)).toEqual(['lego', 'book']);
    });

    it('returns the existing item for the same set', async () => {
      const { repository } = createRepository();
      const first = await repository.add(falcon);

      await expect(repository.add({ ...falcon })).resolves.toEqual(first);
      await expect(repository.list()).resolves.toHaveLength(1);
    });

    it('ignores sets when looking up by ISBN', async () => {
      const { repository } = createRepository();
      await repository.add(falcon);

      await expect(repository.findByIsbn(isbn('9780345445605'))).resolves.toBeUndefined();
    });
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

  describe('update', () => {
    const linkedHobbit: CatalogBook = {
      ...hobbit,
      universes: ['middle-earth'],
      characters: [{ universe: 'middle-earth', character: 'gandalf' }],
    };

    it('corrects the category and stores link fixes, across restarts', async () => {
      const store = new MemoryStore();
      const { repository } = createRepository(store);
      const item = await repository.add(linkedHobbit);

      const updated = await repository.update(item.id, {
        category: 'comic',
        links: {
          universes: ['middle-earth'],
          characters: [{ universe: 'middle-earth', character: 'bilbo-baggins' }],
        },
      });

      expect(updated).toMatchObject({ category: 'comic', catalog: { category: 'book' } });
      expect(updated.linkEdits).toEqual({
        addedCharacters: [{ universe: 'middle-earth', character: 'bilbo-baggins' }],
        removedCharacters: [{ universe: 'middle-earth', character: 'gandalf' }],
      });
      const [reloaded] = await createRepository(store).repository.list();
      expect(reloaded).toEqual(updated);
    });

    it('resets to what the catalog says', async () => {
      const { repository } = createRepository();
      const item = await repository.add(linkedHobbit);
      await repository.update(item.id, {
        category: 'manga',
        links: { universes: [], characters: [] },
      });

      const reset = await repository.update(item.id, { category: null, links: null });

      expect(reset.category).toBe('book');
      expect(reset).not.toHaveProperty('linkEdits');
    });

    it('keeps fields that are left out', async () => {
      const { repository } = createRepository();
      const item = await repository.add(linkedHobbit);
      await repository.update(item.id, { category: 'manga' });

      const updated = await repository.update(item.id, {
        links: { universes: [], characters: [] },
      });

      expect(updated.category).toBe('manga');
      expect(updated.linkEdits).toEqual({ removedUniverses: ['middle-earth'] });
    });

    it("rejects a category change for a LEGO set, and an item that isn't there", async () => {
      const { repository } = createRepository();
      const set = await repository.add({
        source: 'rebrickable',
        category: 'lego',
        externalId: '10316-1',
        title: 'Rivendell',
        setNumber: '10316',
      });

      await expect(repository.update(set.id, { category: 'book' })).rejects.toThrow(
        "can't be changed",
      );
      await expect(repository.update('missing', { category: null })).rejects.toBeInstanceOf(
        CollectionStorageError,
      );
    });
  });
});
