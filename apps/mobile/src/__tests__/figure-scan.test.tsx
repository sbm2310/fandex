import type { CatalogItemResponse, FigureScanResponse } from '@fandex/core';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import AddScreen from '@/app/(tabs)/add';
import BookScreen from '@/app/book/[id]';
import FigureScanScreen from '@/app/figure-scan';
import { ShelfScanError } from '@/services/shelf-scanner';
import {
  FakeAccountService,
  createFakeFigureScanner,
  createFakeShelfScanner,
  createMemoryCollection,
  createWrapper,
} from '@/test-utils/providers';

const mockPicked = { uri: 'file:///box.jpg', width: 3024, height: 4032 };
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: false, assets: [mockPicked] })),
  launchCameraAsync: jest.fn(async () => ({ canceled: false, assets: [mockPicked] })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));

const vader: CatalogItemResponse = {
  id: '0199b5a0-0000-7000-8000-000000000701',
  category: 'figure',
  source: 'fandex',
  externalId: 'hot-toys-mms-279',
  title: 'Darth Vader (A New Hope)',
  creators: ['Hot Toys'],
  subtitle: 'Movie Masterpiece Series',
  scale: '1/6',
  figureNumber: 'MMS 279',
  universes: ['star-wars'],
  characters: [],
};

const found: FigureScanResponse = {
  reading: { brand: 'Hot Toys', number: 'MMS 279', name: 'Darth Vader', scale: '1/6' },
  candidates: [{ item: vader, owned: false, by: 'number' }],
  quota: { used: 1, limit: 5 },
};

async function signedIn() {
  const account = new FakeAccountService();
  account.register('Fan', 'fan@example.com', 'correct horse battery');
  await account.signIn({ email: 'fan@example.com', password: 'correct horse battery' });
  return account;
}

async function open(options: Parameters<typeof createWrapper>[0], initialUrl = '/figure-scan') {
  const app = renderRouter(
    { 'figure-scan': FigureScanScreen, '(tabs)/add': AddScreen, 'book/[id]': BookScreen },
    { initialUrl, wrapper: createWrapper(options) },
  );
  await app;
  return { app };
}

describe('Scanning a figure box', () => {
  it('needs an account', async () => {
    await open({});
    expect(await screen.findByText('Sign in to scan a box')).toBeOnTheScreen();
  });

  it("shows today's box scans and where the photo goes", async () => {
    await open({ account: await signedIn() });

    expect(await screen.findByText('5 scans left today')).toBeOnTheScreen();
    expect(screen.getByText(/sent to Groq, an AI service, to read the box/)).toBeOnTheScreen();
  });

  it('finds the figure by its box number, and adds it', async () => {
    const accountCollection = createMemoryCollection();
    const figureScanner = createFakeFigureScanner({ scan: jest.fn(async () => found) });
    await open({ account: await signedIn(), figureScanner, accountCollection });

    await fireEvent.press(await screen.findByRole('button', { name: 'Choose a photo' }));

    expect(await screen.findByText('Found it')).toBeOnTheScreen();
    expect(figureScanner.scan).toHaveBeenCalledWith(mockPicked);
    expect(screen.getByText('Read on the box')).toBeOnTheScreen();
    expect(screen.getByText('Matched by its box number, MMS 279')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add Darth Vader (A New Hope)' }));
    expect(
      await screen.findByLabelText('Darth Vader (A New Hope) is in your collection'),
    ).toBeOnTheScreen();
    expect((await accountCollection.list())[0]!.catalog).toMatchObject({
      source: 'fandex',
      number: 'MMS 279',
    });
  });

  it('opens the add-by-hand form filled in from the box when the catalog lacks it', async () => {
    const figureScanner = createFakeFigureScanner({
      scan: jest.fn(async () => ({
        reading: {
          brand: 'Hot Toys',
          number: 'MMS 999',
          name: 'Boba Fett',
          from: 'Return of the Jedi',
          scale: '1/6',
          edition: 'Deluxe',
        },
        candidates: [],
        quota: { used: 1, limit: 5 },
      })),
    });
    const { app } = await open({ account: await signedIn(), figureScanner });

    await fireEvent.press(await screen.findByRole('button', { name: 'Choose a photo' }));
    expect(await screen.findByText(/isn't in Fandex's catalog yet/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add it by hand' }));

    expect(app.getPathname()).toBe('/add');
    expect(await screen.findByLabelText('Name')).toHaveDisplayValue(
      'Boba Fett (Return of the Jedi)',
    );
    expect(screen.getByLabelText('Brand (optional)')).toHaveDisplayValue('Hot Toys');
    expect(screen.getByLabelText('Number on the box (optional)')).toHaveDisplayValue('MMS 999');
    expect(screen.getByLabelText('Edition (optional)')).toHaveDisplayValue('Deluxe');
    expect(screen.getByLabelText('Scale (optional)')).toHaveDisplayValue('1/6');
  });

  it('says when nothing on the box could be read', async () => {
    await open({ account: await signedIn() }); // the fake reads nothing
    await fireEvent.press(await screen.findByRole('button', { name: 'Choose a photo' }));
    expect(await screen.findByText("Couldn't read this box")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try another photo' }));
    expect(await screen.findByRole('button', { name: 'Choose a photo' })).toBeOnTheScreen();
  });

  it("explains a used-up allowance, and stops offering photos once it's used", async () => {
    const figureScanner = createFakeFigureScanner({
      scan: jest.fn(async () => {
        throw new ShelfScanError('quota', "You've used today's 5 box scans.");
      }),
    });
    const shelfScanner = createFakeShelfScanner();
    await open({ account: await signedIn(), figureScanner, shelfScanner });
    await fireEvent.press(await screen.findByRole('button', { name: 'Choose a photo' }));
    expect(await screen.findByText("You've used today's 5 box scans.")).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeOnTheScreen();

    screen.unmount();
    jest.mocked(shelfScanner.quota).mockResolvedValue({
      available: true,
      shelfScans: { used: 0, limit: 5 },
      figureScans: { used: 5, limit: 5 },
    });
    await open({ account: await signedIn(), shelfScanner });
    expect(await screen.findByText(/You've used today's 5 box scans/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Choose a photo' })).not.toBeOnTheScreen();
  });

  it('is offered on the Figures tab in place of the shelf scan', async () => {
    await open({}, '/add');
    await fireEvent.press(screen.getByRole('radio', { name: 'Figures' }));
    expect(
      screen.getByLabelText('Scan a box: find a figure from a photo of its box'),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText(/Scan a shelf/)).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Books' }));
    expect(screen.queryByLabelText(/Scan a box/)).not.toBeOnTheScreen();
    // LEGO box barcodes aren't ISBNs, so LEGO gets no scan button beside the search.
    await fireEvent.press(screen.getByRole('radio', { name: 'LEGO' }));
    expect(screen.queryByLabelText(/Scan a box/)).not.toBeOnTheScreen();
    expect(screen.queryByLabelText('Scan a barcode')).not.toBeOnTheScreen();
  });
});
