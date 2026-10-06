import type { CatalogBook, CatalogSet } from '@fandex/core';
import { act } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import UniversesScreen from '@/app/(tabs)/universes';
import BookDetailScreen from '@/app/book/[id]';
import EditItemScreen from '@/app/edit/[id]';
import UniverseScreen from '@/app/universe/[slug]/index';
import {
  FakeAccountService,
  createMemoryCollection,
  createWrapper,
  linkedHobbit,
  rivendell,
} from '@/test-utils/providers';

const routes = {
  '(tabs)/universes': UniversesScreen,
  'universe/[slug]/index': UniverseScreen,
  'book/[id]': BookDetailScreen,
  'edit/[id]': EditItemScreen,
};

async function collectionWith(...entries: (CatalogBook | CatalogSet)[]) {
  const collection = createMemoryCollection();
  for (const entry of entries) await collection.add(entry);
  return collection;
}

/** Opens an item's detail screen (renderRouter's promise carries router helpers). */
async function openDetail(
  collection: Awaited<ReturnType<typeof collectionWith>>,
  wrapper?: ReturnType<typeof createWrapper>,
) {
  const [item] = await collection.list();
  const app = renderRouter(routes, {
    initialUrl: `/book/${item!.id}`,
    wrapper: wrapper ?? createWrapper({ deviceCollection: collection }),
  });
  await app;
  return { app, id: item!.id };
}

const checkbox = (name: string) => screen.getByRole('checkbox', { name });

describe('Fixing an item', () => {
  it('changes universes, characters and category, everywhere', async () => {
    const collection = await collectionWith(linkedHobbit);
    const { app, id } = await openDetail(collection);

    await fireEvent.press(await screen.findByRole('button', { name: 'Fix details' }));
    expect(app.getPathname()).toBe(`/edit/${id}`);
    expect(checkbox('Middle-earth')).toBeChecked();
    expect(checkbox('Gandalf')).toBeChecked();
    expect(checkbox('Bilbo Baggins')).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'Yoda' })).not.toBeOnTheScreen();

    await fireEvent.press(checkbox('Bilbo Baggins'));
    await fireEvent.press(checkbox('Star Wars'));
    await fireEvent.press(checkbox('Yoda'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Comic' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    // Back on the detail screen, which shows the fixes.
    expect(await screen.findByRole('link', { name: 'Star Wars universe' })).toBeOnTheScreen();
    expect(app.getPathname()).toBe(`/book/${id}`);
    expect(screen.getByRole('link', { name: 'Yoda' })).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: 'Bilbo Baggins' })).not.toBeOnTheScreen();
    expect(screen.getByText('Comic')).toBeOnTheScreen();
    expect(screen.getByText("You've edited this item's details.")).toBeOnTheScreen();
    // Saved on the device, as differences from the automatic links.
    const [saved] = await collection.list();
    expect(saved).toMatchObject({
      category: 'comic',
      linkEdits: {
        addedUniverses: ['star-wars'],
        addedCharacters: [{ universe: 'star-wars', character: 'yoda' }],
        removedCharacters: [{ universe: 'middle-earth', character: 'bilbo-baggins' }],
      },
    });
  });

  it("removes a universe's characters along with it, and the item from that universe", async () => {
    // Newest first: The Hobbit is the item opened.
    const collection = await collectionWith(rivendell, linkedHobbit);
    const { app } = await openDetail(collection);
    await fireEvent.press(await screen.findByRole('button', { name: 'Fix details' }));

    await fireEvent.press(checkbox('Middle-earth'));
    expect(screen.queryByRole('checkbox', { name: 'Gandalf' })).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Fix details' });

    await act(() => router.push('/universe/middle-earth'));
    expect(app.getPathname()).toBe('/universe/middle-earth');
    // Only Rivendell is left in Middle-earth.
    expect(await screen.findByText('1 LEGO set')).toBeOnTheScreen();
  });

  it('resets to the automatic details', async () => {
    const collection = await collectionWith(linkedHobbit);
    const [item] = await collection.list();
    await collection.update(item!.id, {
      category: 'manga',
      links: { universes: [], characters: [] },
    });
    await openDetail(collection);
    expect(await screen.findByText("You've edited this item's details.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Fix details' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Reset to automatic' }));

    expect(await screen.findByRole('link', { name: 'Middle-earth universe' })).toBeOnTheScreen();
    expect(screen.queryByText("You've edited this item's details.")).not.toBeOnTheScreen();
    const [reset] = await collection.list();
    expect(reset).toMatchObject({ category: 'book' });
    expect(reset).not.toHaveProperty('linkEdits');
  });

  it('cancels without saving', async () => {
    const collection = await collectionWith(linkedHobbit);
    await openDetail(collection);
    await fireEvent.press(await screen.findByRole('button', { name: 'Fix details' }));

    await fireEvent.press(checkbox('Gandalf'));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('link', { name: 'Gandalf' })).toBeOnTheScreen();
    expect((await collection.list())[0]).not.toHaveProperty('linkEdits');
  });

  it("doesn't offer a category for a LEGO set, or a reset before anything was edited", async () => {
    const collection = await collectionWith(rivendell);
    await openDetail(collection);
    await fireEvent.press(await screen.findByRole('button', { name: 'Fix details' }));

    expect(screen.queryByRole('radiogroup', { name: 'Category' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Reset to automatic' })).not.toBeOnTheScreen();
  });

  it("saves to the signed-in account's collection", async () => {
    const account = new FakeAccountService();
    account.register('Fan', 'fan@example.com', 'correct horse battery');
    await account.signIn({ email: 'fan@example.com', password: 'correct horse battery' });
    const accountCollection = await collectionWith(linkedHobbit);
    const deviceCollection = createMemoryCollection();
    await openDetail(
      accountCollection,
      createWrapper({ account, accountCollection, deviceCollection }),
    );

    await fireEvent.press(await screen.findByRole('button', { name: 'Fix details' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Manga' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Manga')).toBeOnTheScreen();
    expect((await accountCollection.list())[0]?.category).toBe('manga');
    expect(await deviceCollection.list()).toEqual([]);
  });

  it('shows the item after saving when the edit screen was opened directly (no history)', async () => {
    const collection = await collectionWith(linkedHobbit);
    const [item] = await collection.list();
    const app = renderRouter(routes, {
      initialUrl: `/edit/${item!.id}`,
      wrapper: createWrapper({ deviceCollection: collection }),
    });
    await app;

    await fireEvent.press(await screen.findByRole('radio', { name: 'Manga' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('button', { name: 'Fix details' })).toBeOnTheScreen();
    expect(app.getPathname()).toBe(`/book/${item!.id}`);
  });
});
