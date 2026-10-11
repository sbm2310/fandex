import type { CatalogItemResponse } from '@fandex/core';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import AddScreen from '@/app/(tabs)/add';
import BookScreen from '@/app/book/[id]';
import EditPreorderScreen from '@/app/preorder/[id]/edit';
import PreorderScreen from '@/app/preorder/[id]/index';
import NewPreorderScreen from '@/app/preorder/new';
import PreordersScreen from '@/app/preorders';
import { ApiPreorders } from '@/services/preorders';
import {
  FakeAccountService,
  createFakeCustomItems,
  createFakePreorders,
  createWrapper,
} from '@/test-utils/providers';
import { preorderErrorMessage } from '@/utils/preorder-error';

// "Today" for the form's dates and what needs attention.
jest.mock('@/utils/today', () => ({ localToday: () => '2026-10-11' }));

const book: CatalogItemResponse = {
  id: '0199b5a0-0000-7000-8000-000000000001',
  category: 'book',
  source: 'openlibrary',
  externalId: 'OL1M',
  title: 'Wind and Truth',
  creators: ['Brandon Sanderson'],
  universes: [],
  characters: [],
};

async function signedIn() {
  const account = new FakeAccountService();
  account.register('Fan', 'fan@example.com', 'correct horse battery');
  await account.signIn({ email: 'fan@example.com', password: 'correct horse battery' });
  return account;
}

async function open(url: string, options: Parameters<typeof createWrapper>[0] = {}) {
  // renderRouter's promise carries router helpers; keep the reference, then await it.
  const app = renderRouter(
    {
      '(tabs)/add': AddScreen,
      'book/[id]': BookScreen,
      preorders: PreordersScreen,
      'preorder/new': NewPreorderScreen,
      'preorder/[id]/index': PreorderScreen,
      'preorder/[id]/edit': EditPreorderScreen,
    },
    { initialUrl: url, wrapper: createWrapper(options) },
  );
  await app;
  return { app };
}

const type = async (label: string, text: string) =>
  fireEvent.changeText(await screen.findByLabelText(label), text);

describe('New pre-order', () => {
  it('records a book: price, deposit, due date and expected month, then opens it', async () => {
    const preorders = createFakePreorders({ [book.id]: book });
    const { app } = await open(`/preorder/new?catalogId=${book.id}&title=Wind%20and%20Truth`, {
      preorders,
      account: await signedIn(),
    });

    await type('Price (optional)', '35.99');
    await type('Paid so far', '5');
    expect(screen.getByText('Balance left: $30.99')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Set balance due' }));
    await type('Balance due: day', '15');
    await fireEvent.press(screen.getByRole('button', { name: 'Set expected release' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Expected release: next year' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Expected release: Mar' }));
    await type('Store (optional)', 'Barnes & Noble');
    await fireEvent.press(screen.getByRole('button', { name: 'Save pre-order' }));

    expect(preorders.create).toHaveBeenCalledWith({
      catalogItemId: book.id,
      currency: 'USD',
      price: 3599,
      paid: 500,
      balanceDueDate: '2026-10-15',
      expectedRelease: { date: '2027-03-01', precision: 'month' },
      store: 'Barnes & Noble',
      orderNumber: '',
      notes: '',
    });
    // The pre-order's page: what's owed, the reminder, the date.
    expect(await screen.findByText('Balance of $30.99 due October 15, 2026')).toBeOnTheScreen();
    expect(screen.getByLabelText('Expected: March 2027')).toBeOnTheScreen();
    expect(app.getPathname()).toMatch(/^\/preorder\/0199b5a0/);
  });

  it('saves a figure described on the Add tab together with its pre-order', async () => {
    const preorders = createFakePreorders();
    const customItems = createFakeCustomItems();
    await open('/preorder/new?figure=1&title=Darth%20Vader&brand=Hot%20Toys', {
      preorders,
      customItems,
      account: await signedIn(),
    });

    await type('Price (optional)', '450');
    await fireEvent.press(screen.getByRole('button', { name: 'Save pre-order' }));

    expect(await screen.findByText('On order')).toBeOnTheScreen();
    expect(customItems.createFigure).toHaveBeenCalledWith({
      title: 'Darth Vader',
      brand: 'Hot Toys',
    });
    // The fake server gives the new figure this id.
    expect(preorders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        catalogItemId: '0199b5a0-0000-7000-8000-000000000001',
        price: 45000,
      }),
    );
  });

  it('saves with the optional fields empty (an empty field is not a problem)', async () => {
    const preorders = createFakePreorders({ [book.id]: book });
    await open(`/preorder/new?catalogId=${book.id}&title=Wind%20and%20Truth`, {
      preorders,
      account: await signedIn(),
    });

    const save = await screen.findByRole('button', { name: 'Save pre-order' });
    expect(save).toBeEnabled();
  });

  it('explains what is wrong instead of saving', async () => {
    await open(`/preorder/new?catalogId=${book.id}&title=x`, { account: await signedIn() });

    await type('Price (optional)', '100');
    await type('Paid so far', '150');
    await type('Order link (optional)', 'sideshow order 123');

    expect(screen.getByText('What’s paid can’t be more than the price.')).toBeOnTheScreen();
    expect(screen.getByText('The order link must be a web address (https://…).')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save pre-order' })).toBeDisabled();
  });

  it('asks guests to sign in', async () => {
    await open(`/preorder/new?catalogId=${book.id}&title=x`);

    expect(await screen.findByText('Sign in to track pre-orders')).toBeOnTheScreen();
  });
});

describe('A pre-order', () => {
  async function withOne(fields: object = {}) {
    const preorders = createFakePreorders({ [book.id]: book });
    const created = await preorders.create({ catalogItemId: book.id, price: 3599, ...fields });
    preorders.create.mockClear();
    return { preorders, id: created.id };
  }

  it('is edited in full: fields emptied are cleared', async () => {
    const { preorders, id } = await withOne({
      store: 'Barnes & Noble',
      expectedRelease: { date: '2027-03-01', precision: 'month' },
    });
    await open(`/preorder/${id}/edit`, { preorders, account: await signedIn() });

    await type('Store (optional)', '');
    await fireEvent.press(screen.getByRole('button', { name: 'Expected release: Jun' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));

    expect(preorders.update).toHaveBeenCalledWith(id, {
      currency: 'USD',
      price: 3599,
      paid: 0,
      balanceDueDate: null,
      expectedRelease: { date: '2027-06-01', precision: 'month' },
      store: null,
      orderNumber: null,
      orderUrl: null,
      notes: null,
    });
  });

  it('arrives into the collection and opens the item', async () => {
    const { preorders, id } = await withOne();
    const { app } = await open(`/preorder/${id}`, { preorders, account: await signedIn() });

    await fireEvent.press(
      await screen.findByRole('button', { name: 'It arrived: add to collection' }),
    );

    expect(preorders.arrive).toHaveBeenCalledWith(id);
    expect(app.getPathname()).toBe('/book/0199b5a0-0000-7000-a000-000000000001');
  });

  it('is cancelled and reopened', async () => {
    const { preorders, id } = await withOne();
    await open(`/preorder/${id}`, { preorders, account: await signedIn() });

    await fireEvent.press(await screen.findByRole('button', { name: 'Cancel the pre-order' }));
    expect(await screen.findByText('Cancelled')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Reopen' }));
    expect(await screen.findByText('On order')).toBeOnTheScreen();
  });

  it('is listed, and opens from the list', async () => {
    const { preorders, id } = await withOne({
      expectedRelease: { date: '2027-03-01', precision: 'quarter' },
    });
    const { app } = await open('/preorders', { preorders, account: await signedIn() });

    await fireEvent.press(
      await screen.findByRole('link', { name: 'Wind and Truth: On order, expected Q1 2027' }),
    );

    expect(app.getPathname()).toBe(`/preorder/${id}`);
  });
});

describe('the date field', () => {
  it('keeps a day inside its month, and switches precision', async () => {
    await open(`/preorder/new?catalogId=${book.id}&title=x`, { account: await signedIn() });
    await fireEvent.press(await screen.findByRole('button', { name: 'Set expected release' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Day' }));
    await type('Expected release: day', '31');
    await fireEvent.press(screen.getByRole('button', { name: 'Expected release: Feb' }));

    expect(screen.getByLabelText('Expected release: February 28, 2026')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Quarter' }));
    expect(screen.getByLabelText('Expected release: Q1 2026')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Clear expected release' }));
    expect(screen.getByRole('button', { name: 'Set expected release' })).toBeOnTheScreen();
  });
});

describe('ApiPreorders', () => {
  it("passes on the server's explanation of a refusal", async () => {
    const apiFetch = jest.fn(async () =>
      Response.json({ message: "What's paid can't be more than the price" }, { status: 400 }),
    );

    const error = await new ApiPreorders(apiFetch)
      .update('x', { paid: 1 })
      .catch((caught: unknown) => caught);

    expect(preorderErrorMessage(error)).toBe("What's paid can't be more than the price");
    expect(preorderErrorMessage(new TypeError('boom'))).toBe(
      "Couldn't save the pre-order. Try again.",
    );
  });
});
