import type { CatalogBook, CatalogSet } from '@fandex/core';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import UniversesScreen from '@/app/(tabs)/universes';
import BookDetailScreen from '@/app/book/[id]';
import UniverseScreen from '@/app/universe/[slug]/index';
import { categoryCountsLabel, charactersLabel } from '@/components/universe-card';
import {
  FakeAccountService,
  createMemoryCollection,
  createWrapper,
  dune,
  linkedFalcon,
  linkedHobbit,
  rivendell,
} from '@/test-utils/providers';

const routes = {
  '(tabs)/universes': UniversesScreen,
  'universe/[slug]/index': UniverseScreen,
  'book/[id]': BookDetailScreen,
};

async function collectionWith(...entries: (CatalogBook | CatalogSet)[]) {
  const collection = createMemoryCollection();
  for (const entry of entries) await collection.add(entry);
  return collection;
}

function renderAt(initialUrl: string, wrapper = createWrapper()) {
  // renderRouter's promise carries router helpers; keep the reference, then await it.
  const app = renderRouter(routes, { initialUrl, wrapper });
  return { app, ready: app };
}

describe('Universes tab', () => {
  it('explains what it shows while nothing belongs to a universe', async () => {
    const deviceCollection = await collectionWith(dune);
    const { ready } = renderAt('/universes', createWrapper({ deviceCollection }));
    await ready;

    expect(await screen.findByText('No universes yet')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Add something' })).toBeOnTheScreen();
  });

  it('lists your universes in a stable order, with counts and characters', async () => {
    const deviceCollection = await collectionWith(linkedFalcon, linkedHobbit, rivendell, dune);
    const { ready } = renderAt('/universes', createWrapper({ deviceCollection }));
    await ready;

    expect(await screen.findByText('2 universes')).toBeOnTheScreen();
    const cards = screen
      .getAllByRole('link')
      .map((card) => card.props.accessibilityLabel as string);
    expect(cards).toEqual([
      'Middle-earth, 1 book · 1 LEGO set, Gandalf, Bilbo Baggins and 1 more',
      'Star Wars, 1 LEGO set, Han Solo',
    ]);
  });

  it('shows the signed-in account’s universes', async () => {
    const account = new FakeAccountService();
    account.register('Fan', 'fan@example.com', 'correct horse battery');
    await account.signIn({ email: 'fan@example.com', password: 'correct horse battery' });
    const accountCollection = await collectionWith(linkedFalcon);
    const deviceCollection = await collectionWith(linkedHobbit);
    const { ready } = renderAt(
      '/universes',
      createWrapper({ account, accountCollection, deviceCollection }),
    );
    await ready;

    expect(await screen.findByText('1 universe')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: /^Star Wars,/ })).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: /^Middle-earth,/ })).not.toBeOnTheScreen();
  });

  it('opens a universe, then an item in it', async () => {
    const deviceCollection = await collectionWith(linkedHobbit, rivendell);
    const { app, ready } = renderAt('/universes', createWrapper({ deviceCollection }));
    await ready;

    await fireEvent.press(await screen.findByRole('link', { name: /^Middle-earth,/ }));

    expect(app.getPathname()).toBe('/universe/middle-earth');
    expect(screen.getByRole('header', { name: 'Middle-earth' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('link', { name: 'The Hobbit, by J.R.R. Tolkien' }));

    expect(app.getPathname()).toMatch(/^\/book\//);
  });
});

describe('Universe screen', () => {
  it('groups your items by category, with the characters in them', async () => {
    const deviceCollection = await collectionWith(linkedHobbit, rivendell, linkedFalcon);
    const { ready } = renderAt('/universe/middle-earth', createWrapper({ deviceCollection }));
    await ready;

    expect(await screen.findByRole('header', { name: 'Middle-earth' })).toBeOnTheScreen();
    expect(screen.getByText(/Tolkien's world/)).toBeOnTheScreen();
    expect(screen.getByText('1 book · 1 LEGO set')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Books · 1' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'LEGO · 1' })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Gandalf, 2 items' })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Bilbo Baggins, 1 item' })).toBeOnTheScreen();
    // Only Middle-earth items: the Millennium Falcon isn't here.
    expect(screen.getByRole('link', { name: 'The Hobbit, by J.R.R. Tolkien' })).toBeOnTheScreen();
    expect(
      screen.getByRole('link', { name: 'Lord of the Rings: Rivendell, lego, set 10316' }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: /^Millennium Falcon/ })).not.toBeOnTheScreen();
  });

  it('invites you to add something from a universe you have nothing from', async () => {
    const { ready } = renderAt('/universe/star-wars');
    await ready;

    expect(await screen.findByText('Nothing from Star Wars yet')).toBeOnTheScreen();
  });

  it('says so for a universe Fandex does not know', async () => {
    const { ready } = renderAt('/universe/narnia');
    await ready;

    expect(await screen.findByText('Universe not found')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'See your universes' })).toBeOnTheScreen();
  });
});

describe('universe card labels', () => {
  it('counts categories in a fixed order', () => {
    expect(categoryCountsLabel({ lego: 2, book: 1 })).toBe('1 book · 2 LEGO sets');
    expect(categoryCountsLabel({ manga: 3, comic: 1 })).toBe('3 manga · 1 comic');
  });

  it('names the characters with the most items first', () => {
    const characters = [
      { slug: 'a', name: 'Aragorn', itemCount: 1 },
      { slug: 'g', name: 'Gandalf', itemCount: 3 },
      { slug: 'f', name: 'Frodo Baggins', itemCount: 2 },
    ];
    expect(charactersLabel(characters)).toBe('Gandalf, Frodo Baggins and 1 more');
    expect(charactersLabel(characters.slice(0, 2))).toBe('Gandalf and Aragorn');
    expect(charactersLabel([])).toBeUndefined();
  });
});
