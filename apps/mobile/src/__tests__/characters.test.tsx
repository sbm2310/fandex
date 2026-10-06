import type { CatalogBook, CatalogSet } from '@fandex/core';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import AddScreen from '@/app/(tabs)/add';
import BookDetailScreen from '@/app/book/[id]';
import CharacterScreen from '@/app/universe/[slug]/[character]';
import UniverseScreen from '@/app/universe/[slug]/index';
import {
  createFakeCatalog,
  createMemoryCollection,
  createWrapper,
  dune,
  linkedFalcon,
  linkedHobbit,
  rivendell,
} from '@/test-utils/providers';

const routes = {
  '(tabs)/add': AddScreen,
  'universe/[slug]/index': UniverseScreen,
  'universe/[slug]/[character]': CharacterScreen,
  'book/[id]': BookDetailScreen,
};

async function collectionWith(...entries: (CatalogBook | CatalogSet)[]) {
  const collection = createMemoryCollection();
  for (const entry of entries) await collection.add(entry);
  return collection;
}

/** renderRouter's promise carries router helpers; keep the reference, then await it. */
function renderAt(initialUrl: string, wrapper = createWrapper()) {
  return renderRouter(routes, { initialUrl, wrapper });
}

describe('Character screen', () => {
  it('opens from a character on the universe page and shows everything with them', async () => {
    const deviceCollection = await collectionWith(linkedHobbit, rivendell, linkedFalcon, dune);
    const app = renderAt('/universe/middle-earth', createWrapper({ deviceCollection }));
    await app;

    await fireEvent.press(await screen.findByRole('link', { name: 'Gandalf, 2 items' }));

    expect(app.getPathname()).toBe('/universe/middle-earth/gandalf');
    expect(screen.getByRole('header', { name: 'Gandalf' })).toBeOnTheScreen();
    expect(screen.getByText('1 book · 1 LEGO set')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'The Hobbit, by J.R.R. Tolkien' })).toBeOnTheScreen();
    expect(
      screen.getByRole('link', { name: 'Lord of the Rings: Rivendell, lego, set 10316' }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: /^Dune/ })).not.toBeOnTheScreen();
  });

  it('only shows items with that character (Frodo is in Rivendell, not The Hobbit)', async () => {
    const deviceCollection = await collectionWith(linkedHobbit, rivendell);
    const app = renderAt(
      '/universe/middle-earth/frodo-baggins',
      createWrapper({ deviceCollection }),
    );
    await app;

    expect(await screen.findByRole('header', { name: 'Frodo Baggins' })).toBeOnTheScreen();
    expect(screen.getByText('1 LEGO set')).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: /^The Hobbit/ })).not.toBeOnTheScreen();
  });

  it('links back to its universe', async () => {
    const deviceCollection = await collectionWith(linkedHobbit);
    const app = renderAt('/universe/middle-earth/gandalf', createWrapper({ deviceCollection }));
    await app;

    await fireEvent.press(await screen.findByRole('link', { name: 'Middle-earth' }));

    expect(app.getPathname()).toBe('/universe/middle-earth');
  });

  it('invites you to add something when you own nothing with the character', async () => {
    const app = renderAt('/universe/middle-earth/smaug');
    await app;

    expect(await screen.findByText('Nothing with Smaug yet')).toBeOnTheScreen();
  });

  it("says so for a character Fandex doesn't know, or one asked for in the wrong universe", async () => {
    const app = renderAt('/universe/star-wars/gandalf');
    await app;

    expect(await screen.findByText('Character not found')).toBeOnTheScreen();
  });
});

describe('Universe and character links on items', () => {
  it('shows them on the detail screen, each opening its page', async () => {
    const deviceCollection = await collectionWith(linkedHobbit);
    const [item] = await deviceCollection.list();
    const app = renderAt(`/book/${item!.id}`, createWrapper({ deviceCollection }));
    await app;

    expect(await screen.findByRole('link', { name: 'Middle-earth universe' })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Bilbo Baggins' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('link', { name: 'Gandalf' }));

    expect(app.getPathname()).toBe('/universe/middle-earth/gandalf');
  });

  it('shows no links section for an item outside the known universes', async () => {
    const deviceCollection = await collectionWith(dune);
    const [item] = await deviceCollection.list();
    const app = renderAt(`/book/${item!.id}`, createWrapper({ deviceCollection }));
    await app;

    expect(await screen.findByRole('header', { name: 'Dune' })).toBeOnTheScreen();
    expect(screen.queryByText('Characters')).not.toBeOnTheScreen();
    expect(screen.queryByText('Universe')).not.toBeOnTheScreen();
  });

  it('shows the universe on search results, opening its page', async () => {
    const catalog = createFakeCatalog({
      search: jest.fn(() => Promise.resolve([linkedHobbit, dune])),
    });
    const app = renderAt('/add', createWrapper({ catalog }));
    await app;

    await fireEvent.changeText(screen.getByLabelText('Search books'), 'hobbit');
    const universeLink = await screen.findByRole('link', { name: 'Middle-earth universe' });
    expect(screen.getAllByRole('link', { name: /universe$/ })).toHaveLength(1);

    await fireEvent.press(universeLink);

    expect(app.getPathname()).toBe('/universe/middle-earth');
  });
});
