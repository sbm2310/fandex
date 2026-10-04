import { CatalogError } from '@fandex/core';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import AddScreen from '@/app/(tabs)/add';
import {
  createFakeCatalog,
  createMemoryCollection,
  createWrapper,
  hobbit,
} from '@/test-utils/providers';

async function renderAddScreen(
  catalog = createFakeCatalog(),
  collection = createMemoryCollection(),
) {
  await render(<AddScreen />, { wrapper: createWrapper({ catalog, collection }) });
  return catalog;
}

async function typeQuery(text: string) {
  await fireEvent.changeText(screen.getByLabelText('Search books'), text);
}

describe('Add screen search', () => {
  it('starts with a hint and makes no request', async () => {
    const catalog = await renderAddScreen();

    expect(screen.getByText(/Search Open Library by title, author or ISBN/)).toBeOnTheScreen();
    expect(catalog.search).not.toHaveBeenCalled();
  });

  it('shows results with title, author and details', async () => {
    const catalog = await renderAddScreen(
      createFakeCatalog({ search: jest.fn(() => Promise.resolve([hobbit])) }),
    );

    await typeQuery('hobbit');

    expect(await screen.findByText('The Hobbit')).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Add The Hobbit' })).toBeOnTheScreen();
    expect(screen.getByText('J.R.R. Tolkien')).toBeOnTheScreen();
    expect(screen.getByText('2001 · Ballantine Books')).toBeOnTheScreen();
    expect(screen.getByText('Book data from Open Library')).toBeOnTheScreen();
    expect(catalog.search).toHaveBeenCalledWith('hobbit', expect.anything());
  });

  it('waits for a pause in typing and searches only the final query', async () => {
    const catalog = await renderAddScreen(
      createFakeCatalog({ search: jest.fn(() => Promise.resolve([hobbit])) }),
    );

    await typeQuery('ho');
    await typeQuery('hob');
    await typeQuery('hobbit');
    await screen.findByRole('button', { name: 'Add The Hobbit' });

    expect(catalog.search).toHaveBeenCalledTimes(1);
    expect(catalog.search).toHaveBeenCalledWith('hobbit', expect.anything());
  });

  it('ignores queries shorter than two characters', async () => {
    const catalog = await renderAddScreen();

    await typeQuery('h');

    // Wait past the debounce delay; act() lets React apply the timer's state update.
    await act(() => new Promise((resolve) => setTimeout(resolve, 500)));
    expect(catalog.search).not.toHaveBeenCalled();
    expect(screen.getByText(/Search Open Library by title, author or ISBN/)).toBeOnTheScreen();
  });

  it('says when nothing matches', async () => {
    await renderAddScreen();

    await typeQuery('zzzzqqq');

    expect(await screen.findByText('No books found for “zzzzqqq”.')).toBeOnTheScreen();
  });

  it('shows a placeholder when a book has no cover', async () => {
    const { coverUrl: _, ...noCover } = hobbit;
    await renderAddScreen(createFakeCatalog({ search: jest.fn(() => Promise.resolve([noCover])) }));

    await typeQuery('hobbit');

    expect(await screen.findByTestId('book-cover-placeholder')).toBeOnTheScreen();
    await screen.findByRole('button', { name: 'Add The Hobbit' });
  });

  it('explains errors and retries on request', async () => {
    const search = jest
      .fn()
      .mockRejectedValueOnce(new CatalogError('openlibrary', 'network', 'offline'))
      .mockResolvedValueOnce([hobbit]);
    await renderAddScreen(createFakeCatalog({ search }));

    await typeQuery('hobbit');
    expect(await screen.findByText(/Can't reach the book catalog/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('button', { name: 'Add The Hobbit' })).toBeOnTheScreen();
    expect(search).toHaveBeenCalledTimes(2);
  });
});

describe('Add screen adding to the collection', () => {
  const searchFindsHobbit = () =>
    createFakeCatalog({ search: jest.fn(() => Promise.resolve([hobbit])) });

  it('adds a result to the collection and marks it as owned', async () => {
    const collection = createMemoryCollection();
    await renderAddScreen(searchFindsHobbit(), collection);
    await typeQuery('hobbit');

    await fireEvent.press(await screen.findByRole('button', { name: 'Add The Hobbit' }));

    expect(await screen.findByText('✓ Owned')).toBeOnTheScreen();
    await expect(collection.list()).resolves.toMatchObject([{ catalog: hobbit }]);
  });

  it('shows books you already own as owned', async () => {
    const collection = createMemoryCollection();
    await collection.add(hobbit);
    await renderAddScreen(searchFindsHobbit(), collection);

    await typeQuery('hobbit');

    expect(await screen.findByLabelText('The Hobbit is in your collection')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add The Hobbit' })).toBeNull();
  });

  it('offers a retry when saving fails', async () => {
    const collection = createMemoryCollection();
    jest.spyOn(collection, 'add').mockRejectedValueOnce(new Error('disk full'));
    await renderAddScreen(searchFindsHobbit(), collection);
    await typeQuery('hobbit');

    await fireEvent.press(await screen.findByRole('button', { name: 'Add The Hobbit' }));
    await fireEvent.press(
      await screen.findByRole('button', { name: "Couldn't add The Hobbit. Try again" }),
    );

    expect(await screen.findByText('✓ Owned')).toBeOnTheScreen();
  });
});

describe('Add screen ISBN lookup', () => {
  it('looks up an ISBN exactly instead of running a text search', async () => {
    const catalog = await renderAddScreen(
      createFakeCatalog({ lookupIsbn: jest.fn(() => Promise.resolve(hobbit)) }),
    );

    await typeQuery('978-0-345-44560-5');

    expect(await screen.findByText('Exact match for ISBN 9780345445605')).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Add The Hobbit' })).toBeOnTheScreen();
    expect(catalog.lookupIsbn).toHaveBeenCalledWith('9780345445605', expect.anything());
    expect(catalog.search).not.toHaveBeenCalled();
  });

  it('converts an ISBN-10 before looking it up', async () => {
    const catalog = await renderAddScreen();

    await typeQuery('0345445600');

    await screen.findByText(/No book found for ISBN 9780345445605/);
    expect(catalog.lookupIsbn).toHaveBeenCalledWith('9780345445605', expect.anything());
  });

  it('flags a mistyped ISBN without making a request', async () => {
    const catalog = await renderAddScreen();

    await typeQuery('9780345445606');

    expect(await screen.findByText(/isn't a valid ISBN/)).toBeOnTheScreen();
    expect(catalog.lookupIsbn).not.toHaveBeenCalled();
    expect(catalog.search).not.toHaveBeenCalled();
  });

  it('explains when Open Library does not have the ISBN', async () => {
    await renderAddScreen();

    await typeQuery('9791999999994');

    expect(
      await screen.findByText(/No book found for ISBN 9791999999994.*Try searching by title/),
    ).toBeOnTheScreen();
  });

  it('adds the looked-up book to the collection', async () => {
    const collection = createMemoryCollection();
    await renderAddScreen(
      createFakeCatalog({ lookupIsbn: jest.fn(() => Promise.resolve(hobbit)) }),
      collection,
    );
    await typeQuery('9780345445605');

    await fireEvent.press(await screen.findByRole('button', { name: 'Add The Hobbit' }));

    expect(await screen.findByText('✓ Owned')).toBeOnTheScreen();
    await expect(collection.list()).resolves.toMatchObject([{ catalog: hobbit }]);
  });
});

describe('Add screen with the barcode scanner', () => {
  it('looks up an ISBN handed back by the scanner', async () => {
    const catalog = createFakeCatalog({ lookupIsbn: jest.fn(() => Promise.resolve(hobbit)) });
    const app = renderRouter(
      { add: AddScreen },
      { initialUrl: '/add?isbn=9780345445605&scan=1', wrapper: createWrapper({ catalog }) },
    );
    await app;

    expect(await screen.findByRole('button', { name: 'Add The Hobbit' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Search books').props.value).toBe('9780345445605');
    expect(catalog.lookupIsbn).toHaveBeenCalledWith('9780345445605', expect.anything());
  });

  it('opens the scanner from the Scan button', async () => {
    const app = renderRouter(
      { add: AddScreen, scan: () => null },
      { initialUrl: '/add', wrapper: createWrapper() },
    );
    await app;

    await fireEvent.press(screen.getByLabelText('Scan a barcode'));

    expect(app.getPathname()).toBe('/scan');
  });
});
