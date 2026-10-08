import { fireEvent, render, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import AddScreen from '@/app/(tabs)/add';
import CollectionScreen from '@/app/(tabs)/index';
import BookDetailScreen from '@/app/book/[id]';
import { countLabel } from '@/components/category-filter';
import { classifySearch } from '@/hooks/use-catalog-search';
import {
  createFakeLegoCatalog,
  createMemoryCollection,
  createWrapper,
  dune,
  falcon,
  hobbit,
  onePiece,
} from '@/test-utils/providers';

describe('Add screen in LEGO mode', () => {
  async function renderLegoSearch(collection = createMemoryCollection()) {
    const legoCatalog = createFakeLegoCatalog({
      searchSets: jest.fn(() => Promise.resolve([falcon])),
    });
    await render(<AddScreen />, {
      wrapper: createWrapper({ legoCatalog, deviceCollection: collection }),
    });
    await fireEvent.press(screen.getByRole('radio', { name: 'LEGO' }));
    return { legoCatalog, collection };
  }

  it('searches sets and shows set number, pieces and theme', async () => {
    const { legoCatalog } = await renderLegoSearch();

    await fireEvent.changeText(screen.getByLabelText('Search LEGO sets'), 'millennium falcon');

    expect(await screen.findByText('75192 · 7,541 pieces')).toBeOnTheScreen();
    expect(screen.getByText('Star Wars · 2017')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Millennium Falcon, lego, set 75192/)).toBeOnTheScreen();
    expect(screen.getByText('Set data from Rebrickable')).toBeOnTheScreen();
    expect(legoCatalog.searchSets).toHaveBeenCalledWith('millennium falcon', expect.anything());
    await screen.findByRole('button', { name: 'Add Millennium Falcon (set 75192)' });
  });

  it('hides the book barcode scanner', async () => {
    await renderLegoSearch();

    expect(screen.queryByLabelText('Scan a barcode')).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Books' }));
    expect(screen.getByLabelText('Scan a barcode')).toBeOnTheScreen();
  });

  it('adds a set to the collection', async () => {
    const { collection } = await renderLegoSearch();

    await fireEvent.changeText(screen.getByLabelText('Search LEGO sets'), 'falcon');
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Add Millennium Falcon (set 75192)' }),
    );

    expect(await screen.findByText('✓ Owned')).toBeOnTheScreen();
    await expect(collection.list()).resolves.toMatchObject([
      { category: 'lego', catalog: { setNumber: '75192' } },
    ]);
  });
});

describe('classifySearch for LEGO', () => {
  it('sends names and set numbers to the LEGO search (no ISBN handling)', () => {
    expect(classifySearch('75192', 'lego')).toEqual({ kind: 'lego', query: '75192' });
    expect(classifySearch('9780345445605', 'lego')).toEqual({
      kind: 'lego',
      query: '9780345445605',
    });
    expect(classifySearch('x', 'lego')).toEqual({ kind: 'idle' });
  });
});

describe('Collection filters', () => {
  async function renderMixedCollection() {
    const collection = createMemoryCollection();
    await collection.add(hobbit);
    await collection.add(dune);
    await collection.add(onePiece);
    await collection.add(falcon);
    await render(<CollectionScreen />, {
      wrapper: createWrapper({ deviceCollection: collection }),
    });
  }

  it('offers only the categories you own, with counts', async () => {
    await renderMixedCollection();

    expect(await screen.findByText('4 items')).toBeOnTheScreen();
    for (const name of ['All, 4', 'Books, 2', 'Manga, 1', 'LEGO, 1']) {
      expect(screen.getByRole('radio', { name })).toBeOnTheScreen();
    }
    expect(screen.queryByRole('radio', { name: /^Comics/ })).toBeNull();
  });

  it('filters the grid by category', async () => {
    await renderMixedCollection();

    await fireEvent.press(await screen.findByRole('radio', { name: 'LEGO, 1' }));

    expect(screen.getByText('1 set')).toBeOnTheScreen();
    const items = screen
      .getAllByRole('link')
      .map((el) => el.props.accessibilityLabel as string)
      .filter((label) => !label.startsWith('Ask your collection'));
    expect(items).toEqual(['Millennium Falcon, lego, set 75192 · 7,541 pieces']);
    expect(screen.getByText('Data and images from Open Library and Rebrickable')).toBeOnTheScreen();
  });

  it('shows no filter when everything is one category', async () => {
    const collection = createMemoryCollection();
    await collection.add(hobbit);
    await collection.add(dune);
    await render(<CollectionScreen />, {
      wrapper: createWrapper({ deviceCollection: collection }),
    });

    expect(await screen.findByText('2 books')).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { name: /^All/ })).toBeNull();
  });
});

describe('countLabel', () => {
  it.each([
    ['all', 'all-books', '2 books'],
    ['all', 'mixed', '3 items'],
    ['lego', 'mixed', '1 set'],
    ['manga', 'mixed', '1 manga'],
  ] as const)('%s of %s → %s', async (filter, kind, expected) => {
    const collection = createMemoryCollection();
    await collection.add(hobbit);
    if (kind === 'all-books') await collection.add(dune);
    else {
      await collection.add(falcon);
      await collection.add(onePiece);
    }

    expect(countLabel(await collection.list(), filter)).toBe(expected);
  });
});

describe('LEGO detail', () => {
  it('shows set number, pieces, theme and release year', async () => {
    const collection = createMemoryCollection();
    await collection.add(falcon);
    const app = renderRouter(
      { 'book/[id]': BookDetailScreen },
      { initialUrl: '/book/item-1', wrapper: createWrapper({ deviceCollection: collection }) },
    );
    await app;

    expect(await screen.findByText('Set number')).toBeOnTheScreen();
    expect(screen.getByText('75192')).toBeOnTheScreen();
    expect(screen.getByText('7,541')).toBeOnTheScreen();
    expect(screen.getByText('Star Wars › Ultimate Collector Series')).toBeOnTheScreen();
    expect(screen.getByText('2017')).toBeOnTheScreen();
    expect(screen.queryByText('ISBN')).toBeNull();
  });
});
