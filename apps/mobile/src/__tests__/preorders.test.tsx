import type { CatalogItemResponse } from '@fandex/core';
import { fireEvent, renderHook, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import AddScreen from '@/app/(tabs)/add';
import UpcomingScreen from '@/app/(tabs)/upcoming';
import BookScreen from '@/app/book/[id]';
import EditPreorderScreen from '@/app/preorder/[id]/edit';
import PreorderScreen from '@/app/preorder/[id]/index';
import NewPreorderScreen from '@/app/preorder/new';
import { useUpcoming } from '@/hooks/use-preorders';
import { ApiPreorders } from '@/services/preorders';
import { toCatalogBook } from '@/services/catalog-mapping';
import {
  FakeAccountService,
  createFakeCatalog,
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
      '(tabs)/upcoming': UpcomingScreen,
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

  it('starts in the currency chosen on the Account tab', async () => {
    const preorders = createFakePreorders();
    const account = await signedIn();
    await account.setPreferredCurrency('ILS');
    await open('/preorder/new?figure=1&title=Darth%20Vader&brand=Hot%20Toys', {
      preorders,
      account,
    });

    expect(await screen.findByRole('radio', { name: 'ILS' })).toBeChecked();
    await type('Price (optional)', '1650');
    await fireEvent.press(screen.getByRole('button', { name: 'Save pre-order' }));

    expect(await screen.findByText('On order')).toBeOnTheScreen();
    expect(preorders.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'ILS', price: 165000 }),
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

describe("an upcoming book's release date", () => {
  const upcoming: CatalogItemResponse = {
    ...book,
    id: '0199b5a0-0000-7000-8000-000000000002',
    externalId: 'OL62647322M',
    title: 'Clara & the Devil, Volume 2',
    publishDate: { date: '2027-03-02', precision: 'day' },
  };
  const searchFinding = (item: CatalogItemResponse) =>
    createFakeCatalog({ search: jest.fn(async () => [toCatalogBook(item)!]) });

  it("starts the pre-order with Open Library's date, which it then follows", async () => {
    const preorders = createFakePreorders({ [upcoming.id]: upcoming });
    await open('/add?q=clara&scan=1', {
      catalog: searchFinding(upcoming),
      preorders,
      account: await signedIn(),
    });

    await fireEvent.press(
      await screen.findByRole('link', { name: 'Pre-order Clara & the Devil, Volume 2' }),
    );

    expect(
      await screen.findByText(
        'From Open Library. Fandex checks it daily and moves the date if it changes.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Save pre-order' }));
    expect(preorders.create).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRelease: { date: '2027-03-02', precision: 'day' } }),
    );
    expect(
      await screen.findByLabelText('Expected: March 2, 2027 (Open Library, checked daily)'),
    ).toBeOnTheScreen();
  });

  it('drops the note once the date is changed by hand', async () => {
    await open(
      `/preorder/new?catalogId=${upcoming.id}&title=Clara&release=2027-03-02&releasePrecision=day`,
      { account: await signedIn() },
    );
    expect(await screen.findByText(/^From Open Library/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Month' }));

    expect(screen.queryByText(/^From Open Library/)).toBeNull();
  });

  it("doesn't offer a date that has passed, or a broken one", async () => {
    const published = {
      ...upcoming,
      publishDate: { date: '2026-09-01', precision: 'day' },
    } as const;
    await open('/add?q=clara&scan=1', {
      catalog: searchFinding(published),
      account: await signedIn(),
    });
    await fireEvent.press(
      await screen.findByRole('link', { name: 'Pre-order Clara & the Devil, Volume 2' }),
    );
    expect(await screen.findByRole('button', { name: 'Set expected release' })).toBeOnTheScreen();
    expect(screen.queryByText(/^From Open Library/)).toBeNull();
  });

  it('ignores a release date in the link that is not a date', async () => {
    await open(`/preorder/new?catalogId=${upcoming.id}&title=x&release=soon&releasePrecision=day`, {
      account: await signedIn(),
    });
    expect(await screen.findByRole('button', { name: 'Set expected release' })).toBeOnTheScreen();
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

  it('asks a signed-out visitor to sign in instead of loading forever, also when editing', async () => {
    await open('/preorder/0199b5a0-0000-7000-9000-000000000001/edit');

    expect(await screen.findByText('Sign in to see your pre-orders.')).toBeOnTheScreen();
  });

  it("says it couldn't load, rather than that it's gone, and tries again", async () => {
    const { preorders, id } = await withOne();
    preorders.list.mockRejectedValueOnce(new Error("Can't reach Fandex"));
    await open(`/preorder/${id}`, { preorders, account: await signedIn() });

    expect(await screen.findByText("Couldn't load this pre-order")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeOnTheScreen();
  });

  it("shows the server's reason when an action is refused", async () => {
    const { preorders, id } = await withOne();
    preorders.arrive.mockRejectedValueOnce(
      Object.assign(new Error('Refused'), { detail: 'This pre-order was cancelled' }),
    );
    await open(`/preorder/${id}`, { preorders, account: await signedIn() });

    await fireEvent.press(
      await screen.findByRole('button', { name: 'It arrived: add to collection' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('This pre-order was cancelled');
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
});

describe('the Upcoming tab', () => {
  const figure: CatalogItemResponse = {
    ...book,
    id: '0199b5a0-0000-7000-8000-000000000002',
    category: 'figure',
    source: 'custom',
    externalId: 'custom-2',
    title: 'Gandalf the Grey',
    creators: ['Hot Toys'],
  };
  const lego: CatalogItemResponse = {
    ...book,
    id: '0199b5a0-0000-7000-8000-000000000003',
    category: 'lego',
    source: 'rebrickable',
    externalId: '75192-1',
    title: 'Millennium Falcon',
    creators: [],
  };

  async function withSeveral() {
    const preorders = createFakePreorders({
      [book.id]: book,
      [figure.id]: figure,
      [lego.id]: lego,
    });
    // Balance due in 4 days: needs attention.
    const gandalf = await preorders.create({
      catalogItemId: figure.id,
      price: 35000,
      paid: 7000,
      balanceDueDate: '2026-10-15',
      expectedRelease: { date: '2027-03-01', precision: 'month' },
    });
    // Expected this month, nothing to pay.
    await preorders.create({
      catalogItemId: book.id,
      price: 3599,
      paid: 3599,
      expectedRelease: { date: '2026-10-28', precision: 'day' },
    });
    // No date yet.
    await preorders.create({ catalogItemId: lego.id, price: 10000 });
    return { preorders, gandalf };
  }

  it('puts what needs attention first, then by date, with what is still owed', async () => {
    const { preorders } = await withSeveral();
    await open('/upcoming', { preorders, account: await signedIn() });

    expect(await screen.findByLabelText('3 pre-orders on order')).toBeOnTheScreen();
    // $280.00 left on the figure + $100.00 on the set.
    expect(screen.getByLabelText('Still owed: $380.00')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Needs attention · 1' })).toBeOnTheScreen();
    expect(
      screen.getByRole('link', {
        name: 'Gandalf the Grey: On order, expected March 2027. Balance of $280.00 due October 15, 2026',
      }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Arriving this month · 1' })).toBeOnTheScreen();
    expect(
      screen.getByRole('link', { name: 'Wind and Truth: On order, expected October 28, 2026' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Date not known yet · 1' })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: /^Later/ })).toBeNull();
  });

  it('opens a pre-order from its row', async () => {
    const { preorders, gandalf } = await withSeveral();
    const { app } = await open('/upcoming', { preorders, account: await signedIn() });

    await fireEvent.press(await screen.findByRole('link', { name: /^Gandalf the Grey/ }));

    expect(app.getPathname()).toBe(`/preorder/${gandalf.id}`);
  });

  it('keeps arrived and cancelled pre-orders at the end, out of the totals', async () => {
    const preorders = createFakePreorders({ [book.id]: book });
    const created = await preorders.create({ catalogItemId: book.id, price: 3599 });
    await preorders.update(created.id, { status: 'cancelled' });
    await open('/upcoming', { preorders, account: await signedIn() });

    const section = await screen.findByRole('header', { name: 'Arrived or cancelled · 1' });
    expect(section).toBeOnTheScreen();
    expect(screen.getByLabelText('0 pre-orders on order')).toBeOnTheScreen();
    expect(screen.queryByText(/Still owed/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Wind and Truth: Cancelled' })).toBeOnTheScreen();
  });

  it("counts what needs attention for the tab's badge", async () => {
    const { preorders } = await withSeveral();
    const { result } = await renderHook(() => useUpcoming(), {
      wrapper: createWrapper({ preorders, account: await signedIn() }),
    });

    await waitFor(() => expect(result.current.groups).toBeDefined());
    expect(result.current.attentionCount).toBe(1);
  });

  it("offers to try again when the pre-orders couldn't load", async () => {
    const preorders = createFakePreorders();
    preorders.list.mockRejectedValueOnce(new Error("Can't reach Fandex"));
    await open('/upcoming', { preorders, account: await signedIn() });

    await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Nothing on order')).toBeOnTheScreen();
  });

  it('says how to start when there are none', async () => {
    await open('/upcoming', { account: await signedIn() });

    expect(await screen.findByText('Nothing on order')).toBeOnTheScreen();
  });

  it('asks guests to sign in', async () => {
    await open('/upcoming');

    expect(await screen.findByText('Sign in to track pre-orders')).toBeOnTheScreen();
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
