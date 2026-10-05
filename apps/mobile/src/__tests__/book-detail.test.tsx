import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import CollectionScreen from '@/app/(tabs)/index';
import BookDetailScreen from '@/app/book/[id]';
import {
  createMemoryCollection,
  createWrapper,
  dune,
  hobbit,
  onePiece,
} from '@/test-utils/providers';
import { confirm } from '@/utils/confirm';

jest.mock('@/utils/confirm', () => ({ confirm: jest.fn() }));
const mockConfirm = jest.mocked(confirm);

const routes = { index: CollectionScreen, 'book/[id]': BookDetailScreen };

async function collectionWith(...books: (typeof hobbit)[]) {
  const collection = createMemoryCollection({ now: () => new Date('2026-10-04T12:00:00Z') });
  for (const book of books) await collection.add(book);
  return collection;
}

async function renderApp(initialUrl: string, collection = createMemoryCollection()) {
  const app = renderRouter(routes, {
    initialUrl,
    wrapper: createWrapper({ deviceCollection: collection }),
  });
  await app;
  // Wrapped: returning the promise itself from an async function would unwrap it and lose getPathname.
  return { getPathname: () => app.getPathname() };
}

describe('Book detail', () => {
  beforeEach(() => mockConfirm.mockReset());

  it('opens when you tap a book in the collection', async () => {
    const app = await renderApp('/', await collectionWith(hobbit));

    await fireEvent.press(await screen.findByLabelText('The Hobbit, by J.R.R. Tolkien'));

    expect(app.getPathname()).toBe('/book/item-1');
    expect(await screen.findByRole('header', { name: 'The Hobbit' })).toBeOnTheScreen();
  });

  it('shows the book details', async () => {
    await renderApp('/book/item-1', await collectionWith(hobbit));

    expect(await screen.findByText('Ballantine Books')).toBeOnTheScreen();
    expect(screen.getByText('J.R.R. Tolkien')).toBeOnTheScreen();
    expect(screen.getByText('2001')).toBeOnTheScreen();
    expect(screen.getByText('October 4, 2026')).toBeOnTheScreen();
  });

  it('shows the type of item', async () => {
    await renderApp('/book/item-1', await collectionWith(onePiece));

    expect(await screen.findByText('Manga')).toBeOnTheScreen();
    expect(screen.getByText('Type')).toBeOnTheScreen();
  });

  it('leaves out details the catalog did not provide', async () => {
    await renderApp('/book/item-1', await collectionWith(dune));

    expect(await screen.findByText('Ace')).toBeOnTheScreen();
    expect(screen.queryByText('ISBN')).toBeNull();
  });

  it('says so when the book is not in the collection', async () => {
    await renderApp('/book/missing');

    expect(await screen.findByText('Not in your collection')).toBeOnTheScreen();
  });

  it('removes the book after confirmation and returns to the collection', async () => {
    mockConfirm.mockResolvedValue(true);
    const collection = await collectionWith(hobbit);
    const app = await renderApp('/book/item-1', collection);

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Remove The Hobbit from collection' }),
    );

    expect(await screen.findByText('Your collection is empty')).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/');
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ confirmLabel: 'Remove', destructive: true }),
    );
    await expect(collection.list()).resolves.toEqual([]);
  });

  it('keeps the book when you cancel', async () => {
    mockConfirm.mockResolvedValue(false);
    const collection = await collectionWith(hobbit);
    const app = await renderApp('/book/item-1', collection);

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Remove The Hobbit from collection' }),
    );

    expect(app.getPathname()).toBe('/book/item-1');
    await expect(collection.list()).resolves.toHaveLength(1);
  });
});
