import type { CatalogBook, CatalogItemResponse, CatalogSet } from '@fandex/core';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import CollectionScreen from '@/app/(tabs)/index';
import EverythingScreen from '@/app/collection';
import {
  FakeAccountService,
  createFakePreorders,
  createMemoryCollection,
  createWrapper,
  dune,
  hobbit,
  linkedFalcon,
  linkedHobbit,
  rivendell,
} from '@/test-utils/providers';

// "Today" for what needs attention.
jest.mock('@/utils/today', () => ({ localToday: () => '2026-10-11' }));

async function collectionWith(...entries: (CatalogBook | CatalogSet)[]) {
  const collection = createMemoryCollection();
  for (const entry of entries) await collection.add(entry);
  return collection;
}

async function openHome(wrapper: ReturnType<typeof createWrapper>) {
  // renderRouter's promise carries router helpers; keep the reference, then await it.
  const app = renderRouter(
    { '(tabs)/index': CollectionScreen, collection: EverythingScreen },
    { initialUrl: '/', wrapper },
  );
  await app;
  return { app };
}

describe('Home: Your shelf', () => {
  it('sums up the collection by universe and category', async () => {
    const deviceCollection = await collectionWith(linkedHobbit, rivendell, linkedFalcon);
    await openHome(createWrapper({ deviceCollection }));

    expect(
      await screen.findByRole('header', { name: '3 items across 2 universes' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('1 book')).toBeOnTheScreen();
    expect(screen.getByText('2 LEGO sets')).toBeOnTheScreen();
    // A card per universe, in the seed's order.
    expect(screen.getByRole('link', { name: /^Middle-earth,/ })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: /^Star Wars,/ })).toBeOnTheScreen();
  });

  it('says how many items there are when none belong to a universe', async () => {
    await openHome(createWrapper({ deviceCollection: await collectionWith(dune) }));

    expect(await screen.findByRole('header', { name: '1 item on your shelf' })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Your universes' })).toBeNull();
  });

  it('shows the six newest items, and everything on request', async () => {
    const deviceCollection = createMemoryCollection();
    const titles = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];
    for (const [index, title] of titles.entries()) {
      await deviceCollection.add({
        ...hobbit,
        externalId: `OL${index}M`,
        isbn13: undefined,
        title,
      } as CatalogBook);
    }
    const { app } = await openHome(createWrapper({ deviceCollection }));

    await screen.findByRole('header', { name: 'Recently added' });
    const recent = screen
      .getAllByRole('link', { name: /, by J\.R\.R\. Tolkien$/ })
      .map((link) => link.props.accessibilityLabel as string);
    expect(recent).toEqual(
      ['Seven', 'Six', 'Five', 'Four', 'Three', 'Two'].map(
        (title) => `${title}, by J.R.R. Tolkien`,
      ),
    );

    await fireEvent.press(screen.getByRole('link', { name: 'Everything: all 7 items' }));
    expect(app.getPathname()).toBe('/collection');
    expect(await screen.findByRole('header', { name: 'Everything' })).toBeOnTheScreen();
  });

  it("shows what's coming up for an account, what needs doing first", async () => {
    const account = new FakeAccountService();
    account.register('Fan', 'fan@example.com', 'correct horse battery');
    await account.signIn({ email: 'fan@example.com', password: 'correct horse battery' });
    const figure: CatalogItemResponse = {
      id: '0199b5a0-0000-7000-8000-000000000002',
      category: 'figure',
      source: 'custom',
      externalId: 'custom-2',
      title: 'Gandalf the Grey',
      creators: ['InArt'],
      universes: [],
      characters: [],
    };
    const preorders = createFakePreorders({ [figure.id]: figure });
    await preorders.create({
      catalogItemId: figure.id,
      price: 45000,
      paid: 17000,
      balanceDueDate: '2026-10-15',
    });
    await openHome(
      createWrapper({ account, accountCollection: await collectionWith(dune), preorders }),
    );

    expect(await screen.findByRole('header', { name: 'Coming up' })).toBeOnTheScreen();
    expect(
      screen.getByRole('link', {
        name: 'Gandalf the Grey: Balance of $280.00 due October 15, 2026',
      }),
    ).toBeOnTheScreen();
    expect(screen.getByText('$280.00 balance due')).toBeOnTheScreen();
  });

  it('shows nothing coming up for guests', async () => {
    await openHome(createWrapper({ deviceCollection: await collectionWith(dune) }));

    await screen.findByRole('header', { name: '1 item on your shelf' });
    expect(screen.queryByRole('header', { name: 'Coming up' })).toBeNull();
  });
});
