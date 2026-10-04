import { CollectionStorageError } from '@fandex/core';
import { fireEvent, render, screen } from '@testing-library/react-native';

import CollectionScreen from '@/app/(tabs)/index';
import { createMemoryCollection, createWrapper, dune, hobbit } from '@/test-utils/providers';

async function renderCollection(collection = createMemoryCollection()) {
  await render(<CollectionScreen />, { wrapper: createWrapper({ collection }) });
}

describe('Collection screen', () => {
  it('invites you to add books when the collection is empty', async () => {
    await renderCollection();

    expect(await screen.findByText('Your collection is empty')).toBeOnTheScreen();
  });

  it('shows saved books with a count, newest first', async () => {
    const collection = createMemoryCollection();
    await collection.add(hobbit);
    await collection.add(dune);

    await renderCollection(collection);

    expect(await screen.findByText('2 books')).toBeOnTheScreen();
    const labels = screen
      .getAllByRole('link')
      .map((element) => element.props.accessibilityLabel as string);
    expect(labels).toEqual(['Dune, by Frank Herbert', 'The Hobbit, by J.R.R. Tolkien']);
  });

  it('sorts by title when you pick Title, and back to recent', async () => {
    const collection = createMemoryCollection();
    await collection.add(dune);
    await collection.add(hobbit);
    await renderCollection(collection);
    const order = () =>
      screen.getAllByRole('link').map((el) => el.props.accessibilityLabel as string);
    const recentOrder = ['The Hobbit, by J.R.R. Tolkien', 'Dune, by Frank Herbert'];

    await screen.findByText('2 books');
    expect(order()).toEqual(recentOrder);

    await fireEvent.press(screen.getByRole('radio', { name: 'Sort by title' }));
    expect(order()).toEqual(['Dune, by Frank Herbert', 'The Hobbit, by J.R.R. Tolkien']);
    expect(screen.getByRole('radio', { name: 'Sort by title' })).toBeChecked();

    await fireEvent.press(screen.getByRole('radio', { name: 'Sort by recent' }));
    expect(order()).toEqual(recentOrder);
  });

  it('credits Open Library under the collection', async () => {
    const collection = createMemoryCollection();
    await collection.add(hobbit);

    await renderCollection(collection);

    expect(await screen.findByText('Book data and covers from Open Library')).toBeOnTheScreen();
  });

  it('uses the singular for one book', async () => {
    const collection = createMemoryCollection();
    await collection.add(hobbit);

    await renderCollection(collection);

    expect(await screen.findByText('1 book')).toBeOnTheScreen();
  });

  it('explains when saved data cannot be read, without implying it was lost', async () => {
    const collection = createMemoryCollection();
    jest.spyOn(collection, 'list').mockRejectedValue(new CollectionStorageError('corrupt'));

    await renderCollection(collection);

    expect(await screen.findByText("Couldn't load your collection")).toBeOnTheScreen();
    expect(screen.getByText(/haven't been deleted/)).toBeOnTheScreen();
  });
});
