import type { CatalogFigure, FigureSuggestionResponse } from '@fandex/core';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import AddScreen from '@/app/(tabs)/add';
import BookScreen from '@/app/book/[id]';
import {
  FakeAccountService,
  createFakeCustomItems,
  createFakeFigureSuggestions,
  createMemoryCollection,
  createWrapper,
} from '@/test-utils/providers';

async function signedIn() {
  const account = new FakeAccountService();
  account.register('Fan', 'fan@example.com', 'correct horse battery');
  await account.signIn({ email: 'fan@example.com', password: 'correct horse battery' });
  return account;
}

const FIGURE_ID = '0199b5a0-0000-7000-8000-000000000301';

const spartan: CatalogFigure = {
  source: 'custom',
  externalId: 'abc',
  category: 'figure',
  catalogId: FIGURE_ID,
  title: 'Spartan Warrior',
  brand: 'Custom Studio',
};

const decided = (changes: Partial<FigureSuggestionResponse>): FigureSuggestionResponse => ({
  id: '0199b5a0-0000-7000-8000-000000000401',
  status: 'pending',
  catalogItemId: FIGURE_ID,
  createdAt: '2026-10-14T10:00:00.000Z',
  ...changes,
});

/** The figure's page, for a signed-in user who owns it. */
async function openFigure(
  figure: CatalogFigure,
  figureSuggestions = createFakeFigureSuggestions(),
  account?: FakeAccountService,
) {
  const accountCollection = createMemoryCollection();
  const deviceCollection = createMemoryCollection();
  const owner = account ?? (await signedIn());
  const signedOut = account && !(await account.getCurrentUser());
  const item = await (signedOut ? deviceCollection : accountCollection).add(figure);
  const app = renderRouter(
    { 'book/[id]': BookScreen },
    {
      initialUrl: `/book/${item.id}`,
      wrapper: createWrapper({
        accountCollection,
        deviceCollection,
        account: owner,
        figureSuggestions,
      }),
    },
  );
  await app;
  await screen.findByText(figure.title);
  return figureSuggestions;
}

describe('Suggesting a figure for the catalog', () => {
  it('is offered on a figure you added by hand, and then waits for review', async () => {
    const suggestions = await openFigure(spartan);

    expect(await screen.findByText(/Only you can see this figure/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: "Suggest it for Fandex's catalog" }));

    expect(await screen.findByText(/waiting for review/)).toBeOnTheScreen();
    expect(suggestions.suggest).toHaveBeenCalledWith(FIGURE_ID, undefined);
  });

  it('shows why a suggestion was not added, and lets you suggest it again', async () => {
    await openFigure(
      spartan,
      createFakeFigureSuggestions([
        decided({ status: 'rejected', reviewNote: 'Please add the number on the box.' }),
      ]),
    );

    expect(
      await screen.findByText(/Not added to Fandex's catalog: Please add the number on the box\./),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Suggest it again' }));
    expect(await screen.findByText(/waiting for review/)).toBeOnTheScreen();
  });

  it('says when it was approved: the figure is in the catalog now', async () => {
    const shared: CatalogFigure = { ...spartan, source: 'fandex' };
    await openFigure(shared, createFakeFigureSuggestions([decided({ status: 'approved' })]));
    expect(await screen.findByText(/it's in Fandex's catalog now/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Suggest/ })).not.toBeOnTheScreen();
  });

  it('says when it was merged: the copy now points to the catalog figure', async () => {
    const vader: CatalogFigure = {
      source: 'fandex',
      externalId: 'hot-toys-mms-279',
      category: 'figure',
      catalogId: '0199b5a0-0000-7000-8000-000000000302',
      title: 'Darth Vader (A New Hope)',
    };
    const merged = decided({ status: 'merged', mergedIntoId: vader.catalogId! });
    delete merged.catalogItemId;
    await openFigure(vader, createFakeFigureSuggestions([merged]));
    expect(await screen.findByText(/Fandex's catalog already had it/)).toBeOnTheScreen();
  });

  it("isn't offered for catalog figures, or to guests", async () => {
    await openFigure({ ...spartan, source: 'fandex' });
    expect(screen.queryByRole('button', { name: /Suggest/ })).not.toBeOnTheScreen();

    screen.unmount();
    await openFigure(spartan, undefined, new FakeAccountService());
    expect(screen.queryByRole('button', { name: /Suggest/ })).not.toBeOnTheScreen();
  });

  it('can be ticked on the add-by-hand form (signed in only)', async () => {
    const figureSuggestions = createFakeFigureSuggestions();
    const customItems = createFakeCustomItems();
    const app = renderRouter(
      { '(tabs)/add': AddScreen, 'book/[id]': BookScreen },
      {
        initialUrl: '/add',
        wrapper: createWrapper({ account: await signedIn(), customItems, figureSuggestions }),
      },
    );
    await app;
    await fireEvent.press(screen.getByRole('radio', { name: 'Figures' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Not here? Add it by hand' }));

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Spartan Warrior');
    const box = screen.getByRole('checkbox', { name: "Suggest it for Fandex's catalog" });
    expect(box).not.toBeChecked();
    await fireEvent.press(box);
    expect(box).toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Add to collection' }));

    expect(await screen.findByText(/waiting for review/)).toBeOnTheScreen();
    const created = await jest.mocked(customItems.createFigure).mock.results[0]!.value;
    expect(figureSuggestions.suggest).toHaveBeenCalledWith(created.catalogId, undefined);
  });

  it('has no checkbox for guests (their figures stay on the device)', async () => {
    const app = renderRouter(
      { '(tabs)/add': AddScreen },
      { initialUrl: '/add', wrapper: createWrapper({}) },
    );
    await app;
    await fireEvent.press(screen.getByRole('radio', { name: 'Figures' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Not here? Add it by hand' }));

    expect(screen.getByLabelText('Name')).toBeOnTheScreen();
    expect(screen.queryByRole('checkbox')).not.toBeOnTheScreen();
  });
});
