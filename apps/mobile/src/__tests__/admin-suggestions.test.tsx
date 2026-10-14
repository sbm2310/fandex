import type { AdminFigureSuggestion, CatalogItemResponse } from '@fandex/core';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import AccountScreen from '@/app/(tabs)/account';
import SuggestionsScreen from '@/app/admin/suggestions';
import { FakeAccountService, createFakeAdminReviews, createWrapper } from '@/test-utils/providers';
import { confirm } from '@/utils/confirm';

jest.mock('@/utils/confirm', () => ({ confirm: jest.fn() }));
const mockConfirm = jest.mocked(confirm);

async function signedIn() {
  const account = new FakeAccountService();
  account.register('Owner', 'owner@example.com', 'correct horse battery');
  await account.signIn({ email: 'owner@example.com', password: 'correct horse battery' });
  return account;
}

const figure = (changes: Partial<CatalogItemResponse>): CatalogItemResponse => ({
  id: '0199b5a0-0000-7000-8000-000000000501',
  category: 'figure',
  source: 'custom',
  externalId: 'abc',
  title: 'Darth Vader',
  creators: ['Hot Toys'],
  universes: ['star-wars'],
  characters: [],
  ...changes,
});

const vader = figure({
  id: '0199b5a0-0000-7000-8000-000000000502',
  source: 'fandex',
  externalId: 'hot-toys-mms-279',
  title: 'Darth Vader (A New Hope)',
  figureNumber: 'MMS 279',
  scale: '1/6',
});

const suggestion = (changes: Partial<AdminFigureSuggestion> = {}): AdminFigureSuggestion => ({
  id: '0199b5a0-0000-7000-8000-000000000601',
  status: 'pending',
  catalogItemId: '0199b5a0-0000-7000-8000-000000000501',
  note: 'Seen at SDCC',
  createdAt: '2026-10-14T10:00:00.000Z',
  figure: figure({}),
  suggestedBy: { name: 'Fan', email: 'fan@example.com' },
  candidates: [{ item: vader, sameFigure: true }],
  ...changes,
});

async function openQueue(adminReviews: ReturnType<typeof createFakeAdminReviews>) {
  const app = renderRouter(
    { 'admin/suggestions': SuggestionsScreen, '(tabs)/account': AccountScreen },
    {
      initialUrl: '/admin/suggestions',
      wrapper: createWrapper({ account: await signedIn(), adminReviews }),
    },
  );
  await app;
  return { app };
}

beforeEach(() => mockConfirm.mockReset().mockResolvedValue(true));

describe('The admin screen', () => {
  it('lists pending suggestions with the suggester, note and likely duplicates', async () => {
    await openQueue(createFakeAdminReviews({ admin: true, suggestions: [suggestion()] }));

    expect(
      await screen.findByText('1 figure is waiting for review.', { exact: false }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Suggested by Fan (fan@example.com)')).toBeOnTheScreen();
    expect(screen.getByText('“Seen at SDCC”')).toBeOnTheScreen();
    expect(screen.getByText('Likely the same figure')).toBeOnTheScreen();
    expect(screen.getByText('Hot Toys · MMS 279 · 1/6')).toBeOnTheScreen();
  });

  it('approves a suggestion after confirming, and takes it off the list', async () => {
    const reviews = createFakeAdminReviews({ admin: true, suggestions: [suggestion()] });
    await openQueue(reviews);

    await fireEvent.press(await screen.findByRole('button', { name: 'Approve Darth Vader' }));

    expect(await screen.findByText('Nothing to review')).toBeOnTheScreen();
    expect(reviews.approve).toHaveBeenCalledWith(suggestion().id);
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ confirmLabel: 'Approve' }));
  });

  it('merges into a catalog figure, and does nothing when the confirmation is cancelled', async () => {
    const reviews = createFakeAdminReviews({ admin: true, suggestions: [suggestion()] });
    await openQueue(reviews);
    const mergeButton = await screen.findByRole('button', {
      name: 'Merge into Darth Vader (A New Hope)',
    });

    mockConfirm.mockResolvedValueOnce(false);
    await fireEvent.press(mergeButton);
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
    expect(reviews.merge).not.toHaveBeenCalled();

    await fireEvent.press(mergeButton);
    expect(await screen.findByText('Nothing to review')).toBeOnTheScreen();
    expect(reviews.merge).toHaveBeenCalledWith(suggestion().id, vader.id);
  });

  it('rejects with a reason the suggester will see', async () => {
    const reviews = createFakeAdminReviews({ admin: true, suggestions: [suggestion()] });
    await openQueue(reviews);

    await fireEvent.press(await screen.findByRole('button', { name: 'Reject Darth Vader' }));
    const reject = screen.getByRole('button', { name: 'Reject' });
    expect(reject).toBeDisabled();
    await fireEvent.changeText(
      screen.getByLabelText('Why not? (the suggester sees this)'),
      ' Please add the number on the box. ',
    );
    await fireEvent.press(reject);

    expect(await screen.findByText('Nothing to review')).toBeOnTheScreen();
    expect(reviews.reject).toHaveBeenCalledWith(
      suggestion().id,
      'Please add the number on the box.',
    );
  });

  it("shows the server's reason when a decision fails", async () => {
    const reviews = createFakeAdminReviews({ admin: true, suggestions: [suggestion()] });
    reviews.approve.mockRejectedValueOnce(
      Object.assign(new Error('409'), { detail: 'This suggestion was already reviewed' }),
    );
    await openQueue(reviews);

    await fireEvent.press(await screen.findByRole('button', { name: 'Approve Darth Vader' }));

    expect(await screen.findByText('This suggestion was already reviewed')).toBeOnTheScreen();
  });

  it('is for admins only, and only admins see the link to it', async () => {
    await openQueue(createFakeAdminReviews({ admin: false, suggestions: [suggestion()] }));
    expect(await screen.findByText('Admins only')).toBeOnTheScreen();
    expect(screen.queryByText('Suggested by Fan (fan@example.com)')).not.toBeOnTheScreen();
    screen.unmount();

    for (const admin of [false, true]) {
      const app = renderRouter(
        { '(tabs)/account': AccountScreen, 'admin/suggestions': SuggestionsScreen },
        {
          initialUrl: '/account',
          wrapper: createWrapper({
            account: await signedIn(),
            adminReviews: createFakeAdminReviews({ admin }),
          }),
        },
      );
      await app;
      await screen.findByText('owner@example.com');
      if (admin) {
        await fireEvent.press(
          await screen.findByRole('button', { name: 'Review figure suggestions' }),
        );
        expect(await screen.findByText('Nothing to review')).toBeOnTheScreen();
        expect(app.getPathname()).toBe('/admin/suggestions');
      } else {
        expect(
          screen.queryByRole('button', { name: 'Review figure suggestions' }),
        ).not.toBeOnTheScreen();
      }
      screen.unmount();
    }
  });
});
