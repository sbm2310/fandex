import { parseIsbn, type CatalogBook, type Isbn13 } from '@fandex/core';
import type { BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import AddScreen from '@/app/(tabs)/add';
import CollectionScreen from '@/app/(tabs)/index';
import ScanScreen from '@/app/scan';
import { createFakeCatalog, createMemoryCollection, createWrapper } from '@/test-utils/providers';
import {
  addScan,
  booksToAdd,
  removeScan,
  retryScan,
  settleScan,
  type ScannedBook,
} from '@/utils/rapid-scan';

// The camera can't run under Jest: the stub hands its callback to the test, which "scans".
let scanBarcode: ((result: Pick<BarcodeScanningResult, 'data' | 'type'>) => void) | undefined;
jest.mock('expo-camera', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    CameraView: (props: { onBarcodeScanned?: typeof scanBarcode }) => {
      scanBarcode = props.onBarcodeScanned;
      return <View testID="camera" />;
    },
    useCameraPermissions: () => [
      { granted: true, canAskAgain: true, status: 'granted' },
      jest.fn(),
    ],
  };
});
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));

const isbn = (value: string) => parseIsbn(value)!;
const book = (id: string, title: string, isbn13: Isbn13): CatalogBook => ({
  source: 'openlibrary',
  externalId: id,
  category: 'book',
  title,
  authors: ['Brandon Sanderson'],
  isbn13,
});

const WAY_OF_KINGS = isbn('9780765326355');
const WORDS_OF_RADIANCE = isbn('9780765326362');
const OATHBRINGER = isbn('9780765326379');
const UNKNOWN = isbn('9781234567897');
const wayOfKings = book('OL1M', 'The Way of Kings', WAY_OF_KINGS);
const wordsOfRadiance = book('OL2M', 'Words of Radiance', WORDS_OF_RADIANCE);
const oathbringer = book('OL3M', 'Oathbringer', OATHBRINGER);

describe('rapid scan list', () => {
  it('lists each ISBN once, newest first, and records what the lookup found', () => {
    let list: ScannedBook[] = addScan([], WAY_OF_KINGS)!;
    list = addScan(list, OATHBRINGER)!;

    expect(addScan(list, WAY_OF_KINGS)).toBeNull(); // the camera reads it again
    list = settleScan(list, WAY_OF_KINGS, { book: wayOfKings });
    list = settleScan(list, OATHBRINGER, { error: new Error('offline') });

    expect(list).toEqual([
      { isbn: OATHBRINGER, status: 'failed' },
      { isbn: WAY_OF_KINGS, status: 'found', book: wayOfKings },
    ]);
    expect(retryScan(list, OATHBRINGER)[0]).toEqual({ isbn: OATHBRINGER, status: 'looking-up' });
    expect(removeScan(list, OATHBRINGER)).toHaveLength(1);
  });

  it('adds found books not owned yet, oldest scan first, each edition once', () => {
    const sameEdition = { ...wayOfKings, isbn13: isbn('0765326353') };
    const list: ScannedBook[] = [
      { isbn: UNKNOWN, status: 'not-found' },
      { isbn: OATHBRINGER, status: 'found', book: oathbringer },
      { isbn: isbn('0765326353'), status: 'found', book: { ...sameEdition, externalId: 'OL1M' } },
      { isbn: WORDS_OF_RADIANCE, status: 'found', book: wordsOfRadiance },
      { isbn: WAY_OF_KINGS, status: 'found', book: wayOfKings },
    ];
    const owned = [
      {
        id: '1',
        category: 'book' as const,
        catalog: wordsOfRadiance,
        addedAt: '2026-10-08T00:00:00.000Z',
      },
    ];

    expect(booksToAdd(list, owned).map((entry) => entry.title)).toEqual([
      'The Way of Kings',
      'Oathbringer',
    ]);
  });
});

describe('Rapid scan screen', () => {
  async function open() {
    const catalog = createFakeCatalog({
      lookupIsbn: jest.fn(
        async (value: Isbn13) =>
          [wayOfKings, wordsOfRadiance, oathbringer].find((entry) => entry.isbn13 === value) ??
          null,
      ),
    });
    const deviceCollection = createMemoryCollection();
    await deviceCollection.add(wordsOfRadiance);
    const app = renderRouter(
      { '(tabs)/index': CollectionScreen, '(tabs)/add': AddScreen, scan: ScanScreen },
      {
        initialUrl: '/scan?mode=rapid',
        wrapper: createWrapper({ catalog, deviceCollection }),
      },
    );
    await app;
    return { app, catalog, deviceCollection };
  }

  beforeEach(() => {
    scanBarcode = undefined;
    jest.clearAllMocks();
  });

  it('scans book after book, marks owned ones, and adds the rest in one tap', async () => {
    const { catalog, deviceCollection } = await open();

    // The camera reports a barcode many times a second while it's in view.
    await act(() => {
      scanBarcode?.({ data: '9780765326355', type: 'ean13' });
      scanBarcode?.({ data: '9780765326355', type: 'ean13' });
    });
    await act(() => scanBarcode?.({ data: '9780765326362', type: 'ean13' }));
    await act(() => scanBarcode?.({ data: '9781234567897', type: 'ean13' }));
    await act(() => scanBarcode?.({ data: '9780765326379', type: 'ean13' }));

    expect(await screen.findByRole('header', { name: '4 books scanned' })).toBeOnTheScreen();
    expect(catalog.lookupIsbn).toHaveBeenCalledTimes(4);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(4);
    expect(screen.getByLabelText('Words of Radiance is in your collection')).toBeOnTheScreen();
    expect(screen.getByText(/No book found for ISBN 9781234567897/)).toBeOnTheScreen();
    expect(screen.getByText('Already scanned. Next book!')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Add 2 books' }));

    expect(await screen.findByRole('header', { name: 'Added 2 books' })).toBeOnTheScreen();
    expect((await deviceCollection.list()).map((item) => item.catalog.title).sort()).toEqual([
      'Oathbringer',
      'The Way of Kings',
      'Words of Radiance',
    ]);
  });

  it('ignores barcodes that are not books, and lets a scan be removed', async () => {
    await open();

    await act(() => scanBarcode?.({ data: '0012345678905', type: 'ean13' }));
    expect(screen.getByText("That's not a book barcode")).toBeOnTheScreen();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();

    await act(() => scanBarcode?.({ data: '9780765326355', type: 'ean13' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove The Way of Kings' }));

    expect(screen.getByRole('header', { name: 'Scanned books appear here' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add 0 books' })).toBeDisabled();
  });

  it('retries a lookup that failed', async () => {
    const { catalog } = await open();
    jest.mocked(catalog.lookupIsbn).mockRejectedValueOnce(new Error('offline'));

    await act(() => scanBarcode?.({ data: '9780765326355', type: 'ean13' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByLabelText(/^The Way of Kings/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add 1 book' })).toBeOnTheScreen();
  });
});

describe('Add screen', () => {
  it('links to rapid scanning on the phone', async () => {
    const app = renderRouter(
      { '(tabs)/add': AddScreen, scan: ScanScreen },
      { initialUrl: '/add', wrapper: createWrapper() },
    );
    await app;

    await fireEvent.press(
      screen.getByRole('link', {
        name: 'Scan several books: barcode after barcode, then add them all',
      }),
    );

    expect(app.getPathname()).toBe('/scan');
    expect(app.getSearchParams()).toEqual({ mode: 'rapid' });
  });
});
