import { CatalogError } from '@fandex/core';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import AddScreen from '@/app/add';
import { createFakeCatalog, createWrapper, hobbit } from '@/test-utils/providers';

async function renderAddScreen(catalog = createFakeCatalog()) {
  await render(<AddScreen />, { wrapper: createWrapper(catalog) });
  return catalog;
}

async function typeQuery(text: string) {
  await fireEvent.changeText(screen.getByLabelText('Search books'), text);
}

describe('Add screen search', () => {
  it('starts with a hint and makes no request', async () => {
    const catalog = await renderAddScreen();

    expect(screen.getByText(/Search Open Library's catalog/)).toBeOnTheScreen();
    expect(catalog.search).not.toHaveBeenCalled();
  });

  it('shows results with title, author and details', async () => {
    const catalog = await renderAddScreen(
      createFakeCatalog({ search: jest.fn(() => Promise.resolve([hobbit])) }),
    );

    await typeQuery('hobbit');

    expect(await screen.findByText('The Hobbit')).toBeOnTheScreen();
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
    await screen.findByText('The Hobbit');

    expect(catalog.search).toHaveBeenCalledTimes(1);
    expect(catalog.search).toHaveBeenCalledWith('hobbit', expect.anything());
  });

  it('ignores queries shorter than two characters', async () => {
    const catalog = await renderAddScreen();

    await typeQuery('h');

    // Wait past the debounce delay; act() lets React apply the timer's state update.
    await act(() => new Promise((resolve) => setTimeout(resolve, 500)));
    expect(catalog.search).not.toHaveBeenCalled();
    expect(screen.getByText(/Search Open Library's catalog/)).toBeOnTheScreen();
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

    expect(await screen.findByText('The Hobbit')).toBeOnTheScreen();
    expect(search).toHaveBeenCalledTimes(2);
  });
});
