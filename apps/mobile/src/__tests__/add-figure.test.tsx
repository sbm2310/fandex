import { createFigure, type CatalogItemResponse } from '@fandex/core';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import AddScreen from '@/app/(tabs)/add';
import BookScreen from '@/app/book/[id]';
import { toCatalogEntry } from '@/services/catalog-mapping';
import { moveDeviceCollectionToAccount } from '@/services/move-to-account';
import {
  FakeAccountService,
  createFakeCatalog,
  createFakeCustomItems,
  createFakeLegoCatalog,
  createMemoryCollection,
  createWrapper,
} from '@/test-utils/providers';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'device-uuid-1' }));

async function signedIn() {
  const account = new FakeAccountService();
  account.register('Fan', 'fan@example.com', 'correct horse battery');
  await account.signIn({ email: 'fan@example.com', password: 'correct horse battery' });
  return account;
}

/** The Add tab with "Figures" picked. */
async function open(options: Parameters<typeof createWrapper>[0]) {
  // renderRouter's promise carries router helpers; keep the reference, then await it.
  const app = renderRouter(
    { '(tabs)/add': AddScreen, 'book/[id]': BookScreen },
    { initialUrl: '/add', wrapper: createWrapper(options) },
  );
  await app;
  await fireEvent.press(screen.getByRole('radio', { name: 'Figures' }));
  return { app };
}

async function fillIn({ name, brand, image }: { name: string; brand?: string; image?: string }) {
  await fireEvent.changeText(await screen.findByLabelText('Name'), name);
  if (brand) await fireEvent.changeText(screen.getByLabelText('Brand (optional)'), brand);
  if (image) await fireEvent.changeText(screen.getByLabelText('Picture link (optional)'), image);
}

describe('Add a figure', () => {
  it('is a choice on the Add tab, next to Books and LEGO, with no search', async () => {
    await open({});

    expect(screen.getByLabelText('Name')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Search books')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Books' }));
    expect(screen.getByLabelText('Search books')).toBeOnTheScreen();
  });

  it('saves a guest’s figure on the device, linked to its universe, and opens it', async () => {
    const deviceCollection = createMemoryCollection();
    const customItems = createFakeCustomItems();
    const { app } = await open({ deviceCollection, customItems });

    await fillIn({ name: 'Gandalf the Grey', brand: 'Hot Toys' });
    await fireEvent.press(screen.getByRole('button', { name: 'Scale 1/6' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add to collection' }));

    expect(await screen.findByText('Figure')).toBeOnTheScreen();
    const [item] = await deviceCollection.list();
    expect(item).toMatchObject({
      category: 'figure',
      catalog: {
        source: 'custom',
        externalId: 'device-uuid-1',
        title: 'Gandalf the Grey',
        brand: 'Hot Toys',
        scale: '1/6',
        universes: ['middle-earth'],
      },
    });
    expect(app.getPathname()).toBe(`/book/${item!.id}`);
    expect(screen.getByText('Hot Toys')).toBeOnTheScreen();
    expect(screen.getByText('Middle-earth')).toBeOnTheScreen();
    expect(customItems.createFigure).not.toHaveBeenCalled();
  });

  it('saves a signed-in user’s figure on the server, then adds it', async () => {
    const accountCollection = createMemoryCollection();
    const customItems = createFakeCustomItems();
    await open({ accountCollection, customItems, account: await signedIn() });

    await fillIn({ name: 'Darth Vader', image: 'https://example.com/vader.jpg' });
    await fireEvent.press(screen.getByRole('button', { name: 'Add to collection' }));

    expect(await screen.findByText('Figure')).toBeOnTheScreen();
    expect(customItems.createFigure).toHaveBeenCalledWith({
      title: 'Darth Vader',
      brand: '',
      line: '',
      scale: '',
      coverUrl: 'https://example.com/vader.jpg',
    });
    const [item] = await accountCollection.list();
    expect(item!.catalog).toMatchObject({ title: 'Darth Vader', universes: ['star-wars'] });
  });

  it('needs a name, and a picture link that starts with https://', async () => {
    await open({});
    const add = await screen.findByRole('button', { name: 'Add to collection' });
    expect(add).toBeDisabled();

    await fillIn({ name: 'Gandalf', image: 'http://example.com/a.jpg' });

    expect(screen.getByText('The picture link must start with https://')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add to collection' })).toBeDisabled();
  });
});

describe('figures from the API and into an account', () => {
  it('maps a custom catalog item to a figure', () => {
    const item: CatalogItemResponse = {
      id: '0199b5a0-0000-7000-8000-000000000009',
      category: 'figure',
      source: 'custom',
      externalId: 'abc',
      title: 'Gandalf the Grey',
      subtitle: 'Movie Masterpiece',
      creators: ['Hot Toys'],
      scale: '1/6',
      universes: ['middle-earth'],
      characters: [],
    };

    expect(toCatalogEntry(item)).toEqual({
      source: 'custom',
      externalId: 'abc',
      category: 'figure',
      catalogId: item.id,
      title: 'Gandalf the Grey',
      brand: 'Hot Toys',
      line: 'Movie Masterpiece',
      scale: '1/6',
      universes: ['middle-earth'],
    });
  });

  it('saves figures made on the device to the account when moving', async () => {
    const device = createMemoryCollection();
    const account = createMemoryCollection();
    const customItems = createFakeCustomItems();
    await device.add(
      createFigure({ title: 'Gandalf the Grey', brand: 'Hot Toys' }, { externalId: 'd1' }),
    );

    const result = await moveDeviceCollectionToAccount({
      device,
      account,
      catalog: createFakeCatalog(),
      legoCatalog: createFakeLegoCatalog(),
      customItems,
    });

    expect(result).toEqual({ moved: 1, failed: 0 });
    expect(customItems.createFigure).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Gandalf the Grey', brand: 'Hot Toys' }),
    );
    expect((await account.list())[0]!.catalog.catalogId).toBeDefined();
    await expect(device.list()).resolves.toEqual([]);
  });
});
