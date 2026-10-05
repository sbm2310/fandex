import type { CatalogBook } from '@fandex/core';
import { fireEvent, render, screen } from '@testing-library/react-native';

import AddScreen from '@/app/(tabs)/add';
import CollectionScreen from '@/app/(tabs)/index';
import {
  createFakeCatalog,
  createMemoryCollection,
  createWrapper,
  dune,
  FakeAccountService,
  hobbit,
} from '@/test-utils/providers';

const PASSWORD = 'correct horse battery';
const withId = (book: CatalogBook, catalogId: string): CatalogBook => ({ ...book, catalogId });

async function signedInAccount() {
  const account = new FakeAccountService();
  account.register('Reader', 'reader@example.com', PASSWORD);
  await account.signIn({ email: 'reader@example.com', password: PASSWORD });
  return account;
}

async function renderCollection(services: Parameters<typeof createWrapper>[0]) {
  await render(<CollectionScreen />, { wrapper: createWrapper(services) });
}

describe('Collection sync', () => {
  it('shows the account collection when signed in', async () => {
    const deviceCollection = createMemoryCollection();
    const accountCollection = createMemoryCollection();
    await accountCollection.add(withId(dune, 'c-dune'));

    await renderCollection({
      account: await signedInAccount(),
      deviceCollection,
      accountCollection,
    });

    expect(await screen.findByText('1 book')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: /^Dune/ })).toBeOnTheScreen();
  });

  it('shows the device collection when signed out', async () => {
    const deviceCollection = createMemoryCollection();
    const accountCollection = createMemoryCollection();
    await deviceCollection.add(hobbit);
    await accountCollection.add(withId(dune, 'c-dune'));

    await renderCollection({ deviceCollection, accountCollection });

    expect(await screen.findByRole('link', { name: /^The Hobbit/ })).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: /^Dune/ })).toBeNull();
  });

  it('adds search results to the account collection when signed in', async () => {
    const deviceCollection = createMemoryCollection();
    const accountCollection = createMemoryCollection();
    const catalog = createFakeCatalog({
      search: jest.fn(() => Promise.resolve([withId(dune, 'c-dune')])),
    });
    await render(<AddScreen />, {
      wrapper: createWrapper({
        account: await signedInAccount(),
        catalog,
        deviceCollection,
        accountCollection,
      }),
    });

    await fireEvent.changeText(screen.getByLabelText('Search books'), 'dune');
    await fireEvent.press(await screen.findByRole('button', { name: 'Add Dune' }));

    expect(await screen.findByText('✓ Owned')).toBeOnTheScreen();
    await expect(accountCollection.list()).resolves.toHaveLength(1);
    await expect(deviceCollection.list()).resolves.toHaveLength(0);
  });

  describe('moving device books into the account', () => {
    it('offers to move them, moves them, and reports the result', async () => {
      const deviceCollection = createMemoryCollection();
      const accountCollection = createMemoryCollection();
      await deviceCollection.add(withId(dune, 'c-dune'));
      await deviceCollection.add(withId(hobbit, 'c-hobbit'));
      await renderCollection({
        account: await signedInAccount(),
        deviceCollection,
        accountCollection,
      });

      expect(await screen.findByText('2 books are saved only on this device')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Move to my account' }));

      expect(await screen.findByText('Moved 2 books to your account.')).toBeOnTheScreen();
      expect(await screen.findByText('2 books')).toBeOnTheScreen();
      await expect(deviceCollection.list()).resolves.toEqual([]);
      await expect(accountCollection.list()).resolves.toHaveLength(2);
    });

    it('says how many books could not be moved', async () => {
      const deviceCollection = createMemoryCollection();
      await deviceCollection.add(dune); // no catalog id, no ISBN, and search finds nothing
      await renderCollection({ account: await signedInAccount(), deviceCollection });

      await fireEvent.press(await screen.findByRole('button', { name: 'Move to my account' }));

      expect(
        await screen.findByText(/1 book couldn't be matched to the catalog/),
      ).toBeOnTheScreen();
      await expect(deviceCollection.list()).resolves.toHaveLength(1);
    });

    it('can be dismissed', async () => {
      const deviceCollection = createMemoryCollection();
      await deviceCollection.add(withId(dune, 'c-dune'));
      await renderCollection({ account: await signedInAccount(), deviceCollection });

      await fireEvent.press(await screen.findByRole('button', { name: 'Not now' }));

      expect(screen.queryByText(/saved only on this device/)).toBeNull();
    });

    it('is not offered when signed out', async () => {
      const deviceCollection = createMemoryCollection();
      await deviceCollection.add(withId(dune, 'c-dune'));
      await renderCollection({ deviceCollection });

      await screen.findByText('1 book');
      expect(screen.queryByText(/saved only on this device/)).toBeNull();
    });
  });
});
