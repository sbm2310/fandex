import { UNIVERSE_SEED, type CatalogBook, type CatalogSet } from '@fandex/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import AddScreen from '@/app/(tabs)/add';
import UniverseScreen from '@/app/universe/[slug]/index';
import {
  FakeAccountService,
  createFakeLegoCatalog,
  createMemoryCollection,
  createWrapper,
  hobbit,
  rivendell,
} from '@/test-utils/providers';

describe('Universe page character list', () => {
  // A book with every Middle-earth character in it, and one with only Smaug.
  const everyone: CatalogBook = {
    ...hobbit,
    externalId: 'OL9M',
    title: 'The Complete Guide',
    universes: ['middle-earth'],
    characters: UNIVERSE_SEED[0]!.characters.map((c) => ({
      universe: 'middle-earth',
      character: c.slug,
    })),
  };
  const smaugBook: CatalogBook = {
    ...hobbit,
    universes: ['middle-earth'],
    characters: [{ universe: 'middle-earth', character: 'smaug' }],
  };

  it('shows the ten characters with the most items, then all of them on request', async () => {
    const deviceCollection = createMemoryCollection();
    await deviceCollection.add(everyone);
    await deviceCollection.add(smaugBook);
    const total = UNIVERSE_SEED[0]!.characters.length;
    const app = renderRouter(
      { 'universe/[slug]/index': UniverseScreen },
      { initialUrl: '/universe/middle-earth', wrapper: createWrapper({ deviceCollection }) },
    );
    await app;

    const characterLinks = () => screen.getAllByRole('link', { name: /items?$/ });
    await screen.findByRole('header', { name: 'Characters' });
    expect(characterLinks()).toHaveLength(10);
    // Smaug is in two items, so he leads.
    expect(characterLinks()[0]?.props.accessibilityLabel).toBe('Smaug, 2 items');

    await fireEvent.press(screen.getByRole('button', { name: `Show all ${total} characters` }));
    expect(characterLinks()).toHaveLength(total);

    await fireEvent.press(screen.getByRole('button', { name: 'Show fewer characters' }));
    expect(characterLinks()).toHaveLength(10);
  });
});

describe('Adding a LEGO set as a guest', () => {
  const fromSearch: CatalogSet = { ...rivendell };
  delete fromSearch.characters;

  async function addRivendell(options: { signedIn?: boolean; lookupFails?: boolean } = {}) {
    const legoCatalog = createFakeLegoCatalog({
      searchSets: jest.fn(() => Promise.resolve([fromSearch])),
      lookupSet: jest.fn(() =>
        options.lookupFails ? Promise.reject(new Error('offline')) : Promise.resolve(rivendell),
      ),
    });
    const deviceCollection = createMemoryCollection();
    const accountCollection = createMemoryCollection();
    const account = new FakeAccountService();
    if (options.signedIn) {
      account.register('Fan', 'fan@example.com', 'correct horse battery');
      await account.signIn({ email: 'fan@example.com', password: 'correct horse battery' });
    }
    await render(<AddScreen />, {
      wrapper: createWrapper({ legoCatalog, deviceCollection, accountCollection, account }),
    });
    await fireEvent.press(await screen.findByRole('radio', { name: 'LEGO' }));
    await fireEvent.changeText(screen.getByLabelText('Search LEGO sets'), 'rivendell');
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Add Lord of the Rings: Rivendell (set 10316)' }),
    );
    await screen.findByText('✓ Owned');
    return { legoCatalog, deviceCollection, accountCollection };
  }

  it('looks the set up first, so it knows its minifig characters', async () => {
    const { legoCatalog, deviceCollection } = await addRivendell();

    expect(legoCatalog.lookupSet).toHaveBeenCalledWith('10316-1');
    const [saved] = await deviceCollection.list();
    expect(saved?.catalog.characters).toEqual(rivendell.characters);
  });

  it('still adds the set when the lookup fails', async () => {
    const { deviceCollection } = await addRivendell({ lookupFails: true });

    const [saved] = await deviceCollection.list();
    expect(saved?.catalog.title).toBe('Lord of the Rings: Rivendell');
    expect(saved?.catalog).not.toHaveProperty('characters');
  });

  it("doesn't look it up for an account (the server fetches the minifigs)", async () => {
    const { legoCatalog, accountCollection } = await addRivendell({ signedIn: true });

    expect(legoCatalog.lookupSet).not.toHaveBeenCalled();
    expect(await accountCollection.list()).toHaveLength(1);
  });
});
