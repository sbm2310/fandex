import { parseIsbn, type CatalogBook, type Isbn13 } from '@fandex/core';

import { moveDeviceCollectionToAccount } from '@/services/move-to-account';
import { createFakeCatalog, createMemoryCollection, dune, hobbit } from '@/test-utils/providers';

const withId = (book: CatalogBook, catalogId: string): CatalogBook => ({ ...book, catalogId });

describe('moveDeviceCollectionToAccount', () => {
  it('moves books with a catalog id and keeps their order', async () => {
    const device = createMemoryCollection();
    const account = createMemoryCollection();
    await device.add(withId(dune, 'c-dune'));
    await device.add(withId(hobbit, 'c-hobbit'));

    const result = await moveDeviceCollectionToAccount({
      device,
      account,
      catalog: createFakeCatalog(),
    });

    expect(result).toEqual({ moved: 2, failed: 0 });
    await expect(device.list()).resolves.toEqual([]);
    expect((await account.list()).map((item) => item.catalog.title)).toEqual([
      'The Hobbit',
      'Dune',
    ]);
  });

  it('finds the catalog entry by ISBN for books saved before the API existed', async () => {
    const isbn = parseIsbn('9780345445605') as Isbn13;
    const device = createMemoryCollection();
    const account = createMemoryCollection();
    await device.add({ ...hobbit, isbn13: isbn });
    const lookupIsbn = jest.fn(() =>
      Promise.resolve(withId({ ...hobbit, isbn13: isbn }, 'c-hobbit')),
    );

    await moveDeviceCollectionToAccount({
      device,
      account,
      catalog: createFakeCatalog({ lookupIsbn }),
    });

    expect(lookupIsbn).toHaveBeenCalledWith(isbn);
    await expect(account.list()).resolves.toMatchObject([{ catalog: { catalogId: 'c-hobbit' } }]);
  });

  it('falls back to a title search for books without an ISBN, matching the same edition', async () => {
    const device = createMemoryCollection();
    const account = createMemoryCollection();
    await device.add(dune);
    const otherEdition = withId({ ...dune, externalId: 'OL-OTHER' }, 'c-other');
    const search = jest.fn(() => Promise.resolve([otherEdition, withId(dune, 'c-dune')]));

    await moveDeviceCollectionToAccount({
      device,
      account,
      catalog: createFakeCatalog({ search }),
    });

    expect(search).toHaveBeenCalledWith('Dune');
    await expect(account.list()).resolves.toMatchObject([{ catalog: { catalogId: 'c-dune' } }]);
  });

  it('leaves books it cannot match or save on the device', async () => {
    const device = createMemoryCollection();
    const account = createMemoryCollection();
    await device.add(dune); // no ISBN, and the search won't find it
    await device.add(withId(hobbit, 'c-hobbit'));
    jest.spyOn(account, 'add').mockRejectedValueOnce(new Error('offline'));

    const result = await moveDeviceCollectionToAccount({
      device,
      account,
      catalog: createFakeCatalog(),
    });

    expect(result).toEqual({ moved: 0, failed: 2 });
    await expect(device.list()).resolves.toHaveLength(2);
  });
});
