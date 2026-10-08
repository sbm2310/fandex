import type { CatalogItemResponse, ShelfScanResponse } from '@fandex/core';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import AddScreen from '@/app/(tabs)/add';
import ShelfScanScreen from '@/app/shelf-scan';
import { ShelfScanError } from '@/services/shelf-scanner';
import {
  FakeAccountService,
  createFakeCatalog,
  createFakeShelfScanner,
  createMemoryCollection,
  createWrapper,
} from '@/test-utils/providers';

const mockPicked = { uri: 'file:///shelf.jpg', width: 4032, height: 3024 };
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: false, assets: [mockPicked] })),
  launchCameraAsync: jest.fn(async () => ({ canceled: false, assets: [mockPicked] })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));

const book = (id: string, title: string, category: 'book' | 'manga' = 'manga') =>
  ({
    id: `0199b5a0-0000-7000-8000-00000000000${id}`,
    category,
    source: 'openlibrary',
    externalId: `OL${id}M`,
    title,
    creators: ['Takehiko Inoue'],
    universes: [],
    characters: [],
  }) satisfies CatalogItemResponse;

const vagabond = book('1', 'Vagabond, Vol. 1');
const vizbig = book('2', 'Vagabond VIZBIG Edition, Vol. 1');
const demonSlayer = book('3', 'Demon Slayer, Vol. 1');
const falcon = {
  id: '0199b5a0-0000-7000-8000-000000000004',
  category: 'lego',
  source: 'rebrickable',
  externalId: '75375-1',
  title: 'Millennium Falcon',
  creators: [],
  setNumber: '75375',
  universes: ['star-wars'],
  characters: [],
} satisfies CatalogItemResponse;

const scanResult: ShelfScanResponse = {
  items: [
    {
      reading: { kind: 'manga', title: 'Vagabond', count: 8 },
      sure: true,
      candidates: [
        { item: vagabond, owned: false },
        { item: vizbig, owned: false },
      ],
    },
    {
      reading: { kind: 'manga', title: 'Demon Slayer', count: 23 },
      sure: true,
      candidates: [{ item: demonSlayer, owned: true }],
    },
    // Found by only one of the two readings.
    { reading: { kind: 'manga', title: 'UNLAND SAGA', count: 11 }, sure: false, candidates: [] },
    {
      reading: { kind: 'lego', title: 'Millennium Falcon', count: 1, setNumber: '75375' },
      sure: false,
      candidates: [{ item: falcon, owned: false }],
    },
  ],
  quota: { used: 1, limit: 5 },
};

async function signedIn() {
  const account = new FakeAccountService();
  account.register('Fan', 'fan@example.com', 'correct horse battery');
  await account.signIn({ email: 'fan@example.com', password: 'correct horse battery' });
  return account;
}

async function open(options: Parameters<typeof createWrapper>[0] = {}) {
  // renderRouter's promise carries router helpers; keep the reference, then await it.
  const app = renderRouter(
    { 'shelf-scan': ShelfScanScreen, '(tabs)/add': AddScreen },
    { initialUrl: '/shelf-scan', wrapper: createWrapper(options) },
  );
  await app;
  return { app };
}

describe('Shelf scan screen', () => {
  it('asks guests to sign in', async () => {
    const shelfScanner = createFakeShelfScanner();
    await open({ shelfScanner });

    expect(await screen.findByText('Sign in to scan a shelf')).toBeOnTheScreen();
    expect(shelfScanner.quota).not.toHaveBeenCalled();
  });

  it("explains when scanning isn't set up on the server", async () => {
    const shelfScanner = createFakeShelfScanner({
      quota: jest.fn(async () => ({ available: false, shelfScans: { used: 0, limit: 5 } })),
    });
    await open({ shelfScanner, account: await signedIn() });

    expect(await screen.findByText('Shelf scanning is unavailable')).toBeOnTheScreen();
  });

  it('reads a photo, lets the user fix the matches, and adds what is ticked', async () => {
    const shelfScanner = createFakeShelfScanner({ scan: jest.fn(async () => scanResult) });
    const accountCollection = createMemoryCollection();
    await open({ shelfScanner, accountCollection, account: await signedIn() });

    expect(await screen.findByText('5 scans left today')).toBeOnTheScreen();
    expect(
      screen.getByText(/sent to Groq, an AI service.*isn't stored or used to train AI/),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose a photo' }));

    expect(await screen.findByRole('header', { name: 'Found 4 items' })).toBeOnTheScreen();
    expect(shelfScanner.scan).toHaveBeenCalledWith(mockPicked);
    expect(screen.getByText('Read “Vagabond” · 8 on the shelf')).toBeOnTheScreen();
    // Owned: shown, not offered again. Unmatched: a search instead.
    expect(screen.getByLabelText('Demon Slayer, Vol. 1 is in your collection')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Search for UNLAND SAGA' })).toBeOnTheScreen();
    // Less sure: listed under their own heading, unticked.
    expect(screen.getByRole('header', { name: 'Less sure' })).toBeOnTheScreen();
    const set = screen.getByRole('checkbox', { name: 'Add Millennium Falcon (set 75375)' });
    expect(set).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Add 1 item' })).toBeOnTheScreen();

    // The set is there after all; and the other Vagabond edition.
    await fireEvent.press(set);
    await fireEvent.press(screen.getByRole('button', { name: 'Not this one? 1 other matches' }));
    await fireEvent.press(
      screen.getByRole('radio', { name: 'Choose Vagabond VIZBIG Edition, Vol. 1' }),
    );
    expect(
      screen.getByRole('checkbox', { name: 'Add Vagabond VIZBIG Edition, Vol. 1' }),
    ).toBeChecked();

    await fireEvent.press(screen.getByRole('button', { name: 'Add 2 items' }));

    expect(await screen.findByRole('header', { name: 'Added 2 items' })).toBeOnTheScreen();
    const items = await accountCollection.list();
    expect(items.map((saved) => saved.catalog.title).sort()).toEqual([
      'Millennium Falcon',
      'Vagabond VIZBIG Edition, Vol. 1',
    ]);
    expect(items.find((saved) => saved.category !== 'lego')!.catalog.catalogId).toBe(vizbig.id);
  });

  it('says when the provider may use photos to improve its products', async () => {
    const shelfScanner = createFakeShelfScanner({
      quota: jest.fn(async () => ({
        available: true,
        shelfScans: { used: 0, limit: 20 },
        provider: { name: 'Google Gemini', usesPhotosForTraining: true },
      })),
    });
    await open({ shelfScanner, account: await signedIn() });

    expect(
      await screen.findByText(/sent to Google Gemini.*may use photos to improve its products/),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/isn't stored/)).not.toBeOnTheScreen();
  });

  it('searches for something it could not match', async () => {
    const shelfScanner = createFakeShelfScanner({ scan: jest.fn(async () => scanResult) });
    const catalog = createFakeCatalog();
    const { app } = await open({ shelfScanner, catalog, account: await signedIn() });
    await fireEvent.press(await screen.findByRole('button', { name: 'Choose a photo' }));

    await fireEvent.press(await screen.findByRole('link', { name: 'Search for UNLAND SAGA' }));

    expect(app.getPathname()).toBe('/add');
    expect(await screen.findByDisplayValue('UNLAND SAGA')).toBeOnTheScreen();
  });

  it('shows the allowance message, without a retry', async () => {
    const shelfScanner = createFakeShelfScanner({
      scan: jest.fn(async () =>
        Promise.reject(new ShelfScanError('quota', "You've used today's 5 shelf scans.")),
      ),
    });
    await open({ shelfScanner, account: await signedIn() });

    await fireEvent.press(await screen.findByRole('button', { name: 'Choose a photo' }));

    expect(await screen.findByText("You've used today's 5 shelf scans.")).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeOnTheScreen();
  });

  it('retries the same photo when the AI was busy', async () => {
    const scan = jest
      .fn()
      .mockRejectedValueOnce(
        new ShelfScanError('busy', 'Shelf scanning is busy. Try again in a minute.'),
      )
      .mockResolvedValueOnce(scanResult);
    await open({ shelfScanner: createFakeShelfScanner({ scan }), account: await signedIn() });
    await fireEvent.press(await screen.findByRole('button', { name: 'Choose a photo' }));

    await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('header', { name: 'Found 4 items' })).toBeOnTheScreen();
    expect(scan).toHaveBeenNthCalledWith(2, mockPicked);
  });

  it('explains an unexpected failure too', async () => {
    const shelfScanner = createFakeShelfScanner({
      scan: jest.fn(async () => Promise.reject(new TypeError('Cannot read the image'))),
    });
    await open({ shelfScanner, account: await signedIn() });

    await fireEvent.press(await screen.findByRole('button', { name: 'Choose a photo' }));

    expect(await screen.findByText("Couldn't read this photo. Try again.")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  });

  it('says when no scans are left today', async () => {
    const shelfScanner = createFakeShelfScanner({
      quota: jest.fn(async () => ({ available: true, shelfScans: { used: 5, limit: 5 } })),
    });
    await open({ shelfScanner, account: await signedIn() });

    expect(
      await screen.findByText("You've used today's 5 shelf scans. They reset at midnight UTC."),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Choose a photo' })).not.toBeOnTheScreen();
  });
});

describe('Add screen', () => {
  it('links to shelf scanning', async () => {
    const app = renderRouter(
      { '(tabs)/add': AddScreen, 'shelf-scan': ShelfScanScreen },
      { initialUrl: '/add', wrapper: createWrapper() },
    );
    await app;

    await fireEvent.press(
      screen.getByRole('link', { name: 'Scan a shelf: add several items from one photo' }),
    );

    expect(app.getPathname()).toBe('/shelf-scan');
  });
});
