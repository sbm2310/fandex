import type { CatalogItemResponse } from '@fandex/core';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import UpcomingScreen from '@/app/(tabs)/upcoming';
import PreorderScreen from '@/app/preorder/[id]/index';
import { FakeAccountService, createFakePreorders, createWrapper } from '@/test-utils/providers';
import { confirm } from '@/utils/confirm';

jest.mock('@/utils/confirm', () => ({ confirm: jest.fn() }));
// "Today" for what needs attention and the countdowns.
jest.mock('@/utils/today', () => ({ localToday: () => '2026-10-11' }));

const mockConfirm = confirm as jest.MockedFunction<typeof confirm>;
beforeEach(() => mockConfirm.mockReset().mockResolvedValue(true));

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

async function openUpcoming(preorders: ReturnType<typeof createFakePreorders>) {
  // renderRouter's promise carries router helpers; keep the reference, then await it.
  const app = renderRouter(
    { '(tabs)/upcoming': UpcomingScreen, 'preorder/[id]/index': PreorderScreen },
    { initialUrl: '/upcoming', wrapper: createWrapper({ preorders, account: await signedIn() }) },
  );
  await app;
  return { app };
}

async function withBalanceDue() {
  const preorders = createFakePreorders({ [figure.id]: figure, [book.id]: book });
  // $280.00 left, due in 4 days: needs attention.
  const gandalf = await preorders.create({
    catalogItemId: figure.id,
    price: 35000,
    paid: 7000,
    balanceDueDate: '2026-10-15',
    expectedRelease: { date: '2027-03-01', precision: 'month' },
  });
  return { preorders, gandalf };
}

describe('Upcoming: needs attention', () => {
  it('shows how much is paid of the price, and what is still owed', async () => {
    const { preorders } = await withBalanceDue();
    await openUpcoming(preorders);

    expect(await screen.findByLabelText('$70.00 paid of $350.00')).toBeOnTheScreen();
    expect(screen.getByLabelText('Still owed: $280.00')).toBeOnTheScreen();
    expect(screen.getByLabelText('1 pre-order on order')).toBeOnTheScreen();
  });

  it('marks the balance paid with "I\'ve paid it", after asking', async () => {
    const { preorders, gandalf } = await withBalanceDue();
    await openUpcoming(preorders);

    await fireEvent.press(
      await screen.findByRole('button', { name: "I've paid Gandalf the Grey in full" }),
    );

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ confirmLabel: "I've paid it" }),
    );
    await waitFor(() => expect(preorders.update).toHaveBeenCalledWith(gandalf.id, { paid: 35000 }));
    // Nothing is due any more: it leaves "Needs attention", and nothing is owed.
    await waitFor(() =>
      expect(screen.queryByRole('header', { name: /^Needs attention/ })).toBeNull(),
    );
    expect(screen.queryByLabelText(/^Still owed/)).toBeNull();
    expect(screen.getByRole('header', { name: 'Later · 1' })).toBeOnTheScreen();
  });

  it('changes nothing when the payment is not confirmed', async () => {
    mockConfirm.mockResolvedValue(false);
    const { preorders } = await withBalanceDue();
    await openUpcoming(preorders);

    await fireEvent.press(
      await screen.findByRole('button', { name: "I've paid Gandalf the Grey in full" }),
    );

    expect(mockConfirm).toHaveBeenCalled();
    expect(preorders.update).not.toHaveBeenCalled();
    expect(screen.getByRole('header', { name: 'Needs attention · 1' })).toBeOnTheScreen();
  });

  it('offers no payment when nothing is left to pay', async () => {
    const preorders = createFakePreorders({ [book.id]: book });
    // Paid in full, but the expected month has passed: needs attention for the date only.
    await preorders.create({
      catalogItemId: book.id,
      price: 3599,
      paid: 3599,
      expectedRelease: { date: '2026-09-01', precision: 'month' },
    });
    await openUpcoming(preorders);

    expect(await screen.findByRole('header', { name: 'Needs attention · 1' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^I've paid/ })).toBeNull();
  });
});

describe('Upcoming: timeline', () => {
  it('says how far off each pre-order is, and whether it slipped', async () => {
    const preorders = createFakePreorders({ [book.id]: book, [figure.id]: figure });
    await preorders.create({
      catalogItemId: book.id,
      price: 3599,
      paid: 3599,
      expectedRelease: { date: '2026-10-28', precision: 'day' },
    });
    const later = await preorders.create({
      catalogItemId: figure.id,
      expectedRelease: { date: '2027-03-01', precision: 'month' },
    });
    // The figure slipped from March to June.
    await preorders.update(later.id, {
      expectedRelease: { date: '2027-06-01', precision: 'month' },
    });
    await openUpcoming(preorders);

    expect(await screen.findByText('in 17 days')).toBeOnTheScreen();
    expect(screen.getByText('in 8 months')).toBeOnTheScreen();
  });
});
