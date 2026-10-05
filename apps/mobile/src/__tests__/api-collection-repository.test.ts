import { CollectionStorageError, type CatalogBook } from '@fandex/core';

import { ApiCollectionRepository } from '@/services/api-collection-repository';
import type { ApiFetch } from '@/services/api-fetch';

const catalogItem = {
  id: '0199b5a0-7c1e-7a3b-9f00-1234567890ac',
  category: 'manga',
  source: 'openlibrary',
  externalId: 'OL2M',
  title: 'One Piece, Vol. 1',
  creators: ['Eiichiro Oda'],
  isbn13: '9781569319017',
};
const owned = {
  id: '0199b5a0-7c1e-7a3b-9f00-1234567890ab',
  addedAt: '2026-10-05T10:00:00.000Z',
  catalog: catalogItem,
};

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));

function repositoryWith(handler: ApiFetch) {
  const apiFetch = jest.fn(handler);
  return { repository: new ApiCollectionRepository(apiFetch), apiFetch };
}

const book: CatalogBook = {
  source: 'openlibrary',
  externalId: 'OL2M',
  category: 'manga',
  catalogId: catalogItem.id,
  title: 'One Piece, Vol. 1',
  authors: ['Eiichiro Oda'],
};

describe('ApiCollectionRepository', () => {
  it('lists the account collection as collection items', async () => {
    const { repository, apiFetch } = repositoryWith(() => json({ items: [owned] }));

    await expect(repository.list()).resolves.toEqual([
      {
        id: owned.id,
        category: 'manga',
        addedAt: owned.addedAt,
        catalog: expect.objectContaining({
          catalogId: catalogItem.id,
          title: 'One Piece, Vol. 1',
          authors: ['Eiichiro Oda'],
        }),
      },
    ]);
    expect(apiFetch).toHaveBeenCalledWith('/collection', {});
  });

  it('adds by catalog id', async () => {
    const { repository, apiFetch } = repositoryWith(() => json(owned, 201));

    await expect(repository.add(book)).resolves.toMatchObject({ id: owned.id });
    const [path, init] = apiFetch.mock.calls[0] ?? [];
    expect(path).toBe('/collection');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ catalogItemId: catalogItem.id });
  });

  it('refuses to add a book without a catalog id', async () => {
    const { repository, apiFetch } = repositoryWith(() => json(owned, 201));
    const { catalogId: _, ...withoutId } = book;

    await expect(repository.add(withoutId)).rejects.toBeInstanceOf(CollectionStorageError);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('treats removing an item that is already gone as success', async () => {
    const { repository, apiFetch } = repositoryWith(() => json(undefined, 404));

    await expect(repository.remove(owned.id)).resolves.toBeUndefined();
    expect(apiFetch).toHaveBeenCalledWith(`/collection/${owned.id}`, { method: 'DELETE' });
  });

  it.each([
    ['a server error', () => json({}, 500)],
    ['an unreachable server', () => Promise.reject(new TypeError('Network request failed'))],
  ])('reports %s as a CollectionStorageError', async (_, handler) => {
    const { repository } = repositoryWith(handler);

    await expect(repository.list()).rejects.toBeInstanceOf(CollectionStorageError);
  });
});
