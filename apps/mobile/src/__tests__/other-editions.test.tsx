import { parseIsbn, type CatalogBook, type Isbn13 } from '@fandex/core';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import AddScreen from '@/app/(tabs)/add';
import BookDetailScreen from '@/app/book/[id]';
import {
  createFakeCatalog,
  createMemoryCollection,
  createWrapper,
  dune,
} from '@/test-utils/providers';

const isbn = (value: string) => parseIsbn(value) as Isbn13;

// Two editions of the same Open Library work.
const hardcover: CatalogBook = {
  source: 'openlibrary',
  category: 'book',
  externalId: 'OL1M',
  catalogId: '0199b5a0-0000-7000-8000-000000000001',
  title: 'The Hobbit',
  authors: ['J.R.R. Tolkien'],
  publishedYear: 1984,
  isbn13: isbn('9780395520215'),
  workKey: 'OL27482W',
};
const paperback: CatalogBook = {
  ...hardcover,
  externalId: 'OL2M',
  catalogId: '0199b5a0-0000-7000-8000-000000000002',
  publishedYear: 2012,
  isbn13: isbn('9780547928227'),
};

const routes = { '(tabs)/add': AddScreen, 'book/[id]': BookDetailScreen };

async function searchWith(owned: CatalogBook[], results: CatalogBook[]) {
  const deviceCollection = createMemoryCollection();
  for (const entry of owned) await deviceCollection.add(entry);
  const catalog = createFakeCatalog({ search: jest.fn(() => Promise.resolve(results)) });
  // renderRouter's promise carries router helpers; keep the reference, then await it.
  const app = renderRouter(routes, {
    initialUrl: '/add',
    wrapper: createWrapper({ deviceCollection, catalog }),
  });
  await app;
  await fireEvent.changeText(screen.getByLabelText('Search books'), 'hobbit');
  return { app, deviceCollection };
}

describe('"You own another edition"', () => {
  it('shows under a search result for an edition you don’t own, linking to yours', async () => {
    const { app, deviceCollection } = await searchWith([hardcover], [paperback]);

    const hint = await screen.findByRole('link', {
      name: 'You own another edition: The Hobbit, 1984',
    });
    // It's a different edition, so it can still be added.
    expect(screen.getByRole('button', { name: 'Add The Hobbit' })).toBeOnTheScreen();

    await fireEvent.press(hint);

    const [owned] = await deviceCollection.list();
    expect(app.getPathname()).toBe(`/book/${owned!.id}`);
  });

  it('is not shown for the edition you own, or for other books', async () => {
    await searchWith([hardcover], [hardcover, dune]);

    expect(await screen.findByLabelText('The Hobbit is in your collection')).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: /^You own/ })).not.toBeOnTheScreen();
  });

  it('counts several other editions', async () => {
    const third: CatalogBook = { ...hardcover, externalId: 'OL3M', isbn13: isbn('9780345339683') };
    await searchWith([hardcover, third], [paperback]);

    expect(await screen.findByText('You own 2 other editions')).toBeOnTheScreen();
  });

  it('appears on the detail screen of a book you own in two editions', async () => {
    const deviceCollection = createMemoryCollection();
    await deviceCollection.add(hardcover);
    const newest = await deviceCollection.add(paperback);
    const app = renderRouter(routes, {
      initialUrl: `/book/${newest.id}`,
      wrapper: createWrapper({ deviceCollection }),
    });
    await app;

    expect(
      await screen.findByRole('link', { name: 'You also own another edition: The Hobbit, 1984' }),
    ).toBeOnTheScreen();
  });
});
