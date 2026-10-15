import { createFigure, type CatalogFigure, type CatalogItemResponse } from '@fandex/core';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import AddScreen from '@/app/(tabs)/add';
import BookScreen from '@/app/book/[id]';
import NewPreorderScreen from '@/app/preorder/new';
import UniverseScreen from '@/app/universe/[slug]/index';
import { toCatalogEntry } from '@/services/catalog-mapping';
import { moveDeviceCollectionToAccount } from '@/services/move-to-account';
import {
  FakeAccountService,
  createFakeCatalog,
  createFakeCustomItems,
  createFakeFigureCatalog,
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

/** The Add tab with "Figures" picked (its catalog search). */
async function openSearch(options: Parameters<typeof createWrapper>[0]) {
  // renderRouter's promise carries router helpers; keep the reference, then await it.
  const app = renderRouter(
    {
      '(tabs)/add': AddScreen,
      'book/[id]': BookScreen,
      'preorder/new': NewPreorderScreen,
      'universe/[slug]/index': UniverseScreen,
    },
    { initialUrl: '/add', wrapper: createWrapper(options) },
  );
  await app;
  await fireEvent.press(screen.getByRole('radio', { name: 'Figures' }));
  return { app };
}

/** …then "Not here? Add it by hand": the form for a figure the catalog doesn't have. */
async function open(options: Parameters<typeof createWrapper>[0]) {
  const opened = await openSearch(options);
  await fireEvent.press(screen.getByRole('button', { name: 'Not here? Add it by hand' }));
  return opened;
}

async function fillIn({ name, brand, image }: { name: string; brand?: string; image?: string }) {
  await fireEvent.changeText(await screen.findByLabelText('Name'), name);
  if (brand) await fireEvent.changeText(screen.getByLabelText('Brand (optional)'), brand);
  if (image) await fireEvent.changeText(screen.getByLabelText('Picture link (optional)'), image);
}

describe('Add a figure', () => {
  it('is behind "Not here? Add it by hand" under the figure search, and Back returns', async () => {
    await openSearch({});
    expect(screen.getByLabelText('Search figures')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Name')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Not here? Add it by hand' }));
    expect(screen.getByLabelText('Name')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Search figures')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: '‹ Back to search' }));
    expect(screen.getByLabelText('Search figures')).toBeOnTheScreen();
    // Switching kinds always starts at the search.
    await fireEvent.press(screen.getByRole('button', { name: 'Not here? Add it by hand' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Books' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Figures' }));
    expect(screen.getByLabelText('Search figures')).toBeOnTheScreen();
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
      number: '',
      edition: '',
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

const gandalf: CatalogFigure = {
  source: 'fandex',
  externalId: 'inart-gandalf-the-grey',
  category: 'figure',
  catalogId: '0199b5a0-0000-7000-8000-000000000101',
  title: 'Gandalf the Grey',
  brand: 'InArt',
  line: 'Sixth Scale Collectible Figure',
  scale: '1/6',
  release: { date: '2023-04-01', precision: 'quarter' },
  price: { amount: 44500, currency: 'USD' },
  sources: ['https://global.inart.studio/products/gandalf', 'https://www.toy-people.com/en/?p=1'],
  universes: ['middle-earth'],
  characters: [{ universe: 'middle-earth', character: 'gandalf' }],
};

const vader: CatalogFigure = {
  source: 'fandex',
  externalId: 'hot-toys-mms-279',
  category: 'figure',
  catalogId: '0199b5a0-0000-7000-8000-000000000102',
  title: 'Darth Vader (A New Hope)',
  brand: 'Hot Toys',
  number: 'MMS 279',
  line: 'Movie Masterpiece Series',
  scale: '1/6',
  universes: ['star-wars'],
};

const saruman: CatalogFigure = {
  source: 'fandex',
  externalId: 'inart-saruman',
  category: 'figure',
  catalogId: '0199b5a0-0000-7000-8000-000000000103',
  title: 'Saruman (The Fellowship of the Ring)',
  brand: 'InArt',
  scale: '1/6',
  release: { date: '2027-10-01', precision: 'quarter' },
  universes: ['middle-earth'],
};

describe("Fandex's figure catalog on the Add tab", () => {
  it('finds figures by name or number, with maker, number and scale', async () => {
    const figureCatalog = createFakeFigureCatalog({
      searchFigures: jest.fn(async (query: string) => (query === 'MMS 279' ? [vader] : [])),
    });
    await openSearch({ figureCatalog });
    expect(screen.getByText(/by name, character or box number/)).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Search figures'), 'MMS 279');

    expect(await screen.findByText('Darth Vader (A New Hope)')).toBeOnTheScreen();
    expect(screen.getByText('Hot Toys · MMS 279 · 1/6')).toBeOnTheScreen();
    expect(screen.getByText("Figures from Fandex's own catalog")).toBeOnTheScreen();
    expect(figureCatalog.searchFigures).toHaveBeenCalledWith('MMS 279', expect.anything());
  });

  it('adds a curated figure, which shows up on its universe page', async () => {
    const deviceCollection = createMemoryCollection();
    const figureCatalog = createFakeFigureCatalog({
      searchFigures: jest.fn(async () => [gandalf]),
    });
    await openSearch({ deviceCollection, figureCatalog });

    await fireEvent.changeText(screen.getByLabelText('Search figures'), 'gandalf');
    await fireEvent.press(await screen.findByRole('button', { name: 'Add Gandalf the Grey' }));

    expect(
      await screen.findByLabelText('Gandalf the Grey is in your collection'),
    ).toBeOnTheScreen();
    const [item] = await deviceCollection.list();
    expect(item!.catalog).toMatchObject({ source: 'fandex', catalogId: gandalf.catalogId });

    await act(() => router.push('/universe/middle-earth'));
    expect(await screen.findByText('Gandalf the Grey')).toBeOnTheScreen();
  });

  it('shows a curated figure’s facts and sources on its page', async () => {
    const deviceCollection = createMemoryCollection();
    const item = await deviceCollection.add(gandalf);
    const app = renderRouter(
      { 'book/[id]': BookScreen },
      { initialUrl: `/book/${item.id}`, wrapper: createWrapper({ deviceCollection }) },
    );
    await app;

    expect(await screen.findByText('Q2 2023')).toBeOnTheScreen();
    expect(screen.getByText('Released')).toBeOnTheScreen();
    expect(screen.getByText('$445.00')).toBeOnTheScreen();
    expect(screen.getByText('Sixth Scale Collectible Figure')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: /^Checked against \d+ sources$/ })).toBeOnTheScreen();
    expect(screen.getByText("From Fandex's figure catalog")).toBeOnTheScreen();
    expect(screen.getByText('global.inart.studio')).toBeOnTheScreen();
    expect(screen.getByText('toy-people.com')).toBeOnTheScreen();
  });

  it('offers the catalog’s expected release when pre-ordering an upcoming figure', async () => {
    const figureCatalog = createFakeFigureCatalog({
      searchFigures: jest.fn(async () => [saruman]),
    });
    await openSearch({ figureCatalog, account: await signedIn() });

    await fireEvent.changeText(screen.getByLabelText('Search figures'), 'saruman');
    await fireEvent.press(
      await screen.findByLabelText('Pre-order Saruman (The Fellowship of the Ring)'),
    );

    expect(await screen.findByText(/From Fandex's figure catalog/)).toBeOnTheScreen();
    expect(screen.queryByText(/From Open Library/)).not.toBeOnTheScreen();
  });

  it('offers to add a figure by hand when nothing is found, starting with what was typed', async () => {
    await openSearch({});

    await fireEvent.changeText(screen.getByLabelText('Search figures'), 'Spartan Warrior');
    expect(
      await screen.findByText("No figures found for “Spartan Warrior” in Fandex's catalog."),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Not here? Add it by hand' }));

    expect(screen.getByLabelText('Name')).toHaveDisplayValue('Spartan Warrior');
  });

  it('maps a shared catalog item, with its number, edition, release, price and sources', () => {
    const item: CatalogItemResponse = {
      id: '0199b5a0-0000-7000-8000-000000000201',
      category: 'figure',
      source: 'fandex',
      externalId: 'hot-toys-mms-700',
      title: 'Darth Vader (Return of the Jedi)',
      subtitle: 'Movie Masterpiece Series',
      creators: ['Hot Toys'],
      scale: '1/6',
      figureNumber: 'MMS 700',
      edition: 'Deluxe',
      releaseDate: { date: '2024-07-01', precision: 'quarter' },
      price: { amount: 34999, currency: 'USD' },
      sources: ['https://example.com/a'],
      universes: ['star-wars'],
      characters: [],
    };

    expect(toCatalogEntry(item)).toEqual({
      source: 'fandex',
      externalId: 'hot-toys-mms-700',
      category: 'figure',
      catalogId: item.id,
      title: 'Darth Vader (Return of the Jedi)',
      brand: 'Hot Toys',
      line: 'Movie Masterpiece Series',
      scale: '1/6',
      number: 'MMS 700',
      edition: 'Deluxe',
      release: { date: '2024-07-01', precision: 'quarter' },
      price: { amount: 34999, currency: 'USD' },
      sources: ['https://example.com/a'],
      universes: ['star-wars'],
    });
  });
});
