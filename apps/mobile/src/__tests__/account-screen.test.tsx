import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import AccountScreen from '@/app/(tabs)/account';
import { validateAuthInput } from '@/components/auth-form';
import { AccountError } from '@/services/account-service';
import {
  createFakeAdminReviews,
  createFakeShelfScanner,
  createWrapper,
  FakeAccountService,
} from '@/test-utils/providers';
import { confirm } from '@/utils/confirm';

jest.mock('@/utils/confirm', () => ({ confirm: jest.fn() }));
const mockConfirm = jest.mocked(confirm);

const PASSWORD = 'correct horse battery';

async function renderAccount(
  account = new FakeAccountService(),
  shelfScanner = createFakeShelfScanner(),
) {
  await render(<AccountScreen />, {
    wrapper: createWrapper({ account, adminReviews, shelfScanner }),
  });
  return account;
}

async function fill(label: string, text: string) {
  await fireEvent.changeText(await screen.findByLabelText(label), text);
}

const press = async (name: string) => fireEvent.press(screen.getByRole('button', { name }));

// Not an admin: the server says so once signed in (GET /me).
let adminReviews = createFakeAdminReviews();
beforeEach(() => {
  adminReviews = createFakeAdminReviews();
});

/** Signed in as a regular user: the admin check comes back no, and no review button appears. */
async function expectNoAdminTools() {
  await waitFor(() => expect(adminReviews.isAdmin).toHaveBeenCalled());
  await act(async () => {});
  expect(screen.queryByRole('button', { name: 'Review figure suggestions' })).toBeNull();
}

describe('Account screen', () => {
  beforeEach(() => mockConfirm.mockReset());

  it('offers sign-in when signed out and explains guest mode', async () => {
    await renderAccount();

    expect(await screen.findByText(/your books stay on this device/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
  });

  it('signs in', async () => {
    const account = new FakeAccountService();
    account.register('Reader', 'reader@example.com', PASSWORD);
    await renderAccount(account);

    await fill('Email', 'reader@example.com');
    await fill('Password', PASSWORD);
    await press('Sign in');

    expect(await screen.findByText('reader@example.com')).toBeOnTheScreen();
    expect(screen.getByText('Reader')).toBeOnTheScreen();
    await expectNoAdminTools();
  });

  it('shows a clear message for a wrong password', async () => {
    const account = new FakeAccountService();
    account.register('Reader', 'reader@example.com', PASSWORD);
    await renderAccount(account);

    await fill('Email', 'reader@example.com');
    await fill('Password', 'wrong password');
    await press('Sign in');

    expect(await screen.findByText(/don't match/)).toBeOnTheScreen();
  });

  it('creates an account and is signed in', async () => {
    await renderAccount();

    await fireEvent.press(await screen.findByRole('button', { name: /Create an account/ }));
    await fill('Name', 'New Reader');
    await fill('Email', 'new@example.com');
    await fill('Password', PASSWORD);
    await press('Create account');

    expect(await screen.findByText('new@example.com')).toBeOnTheScreen();
    await expectNoAdminTools();
  });

  it('checks input before contacting the server', async () => {
    const account = await renderAccount();
    const signIn = jest.spyOn(account, 'signIn');

    await fill('Email', 'not-an-email');
    await fill('Password', PASSWORD);
    await press('Sign in');

    expect(await screen.findByText('Enter a valid email address.')).toBeOnTheScreen();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('signs out', async () => {
    const account = new FakeAccountService();
    account.register('Reader', 'reader@example.com', PASSWORD);
    await account.signIn({ email: 'reader@example.com', password: PASSWORD });
    await renderAccount(account);

    await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
  });

  describe('profile', () => {
    async function renderSignedIn() {
      const account = new FakeAccountService();
      account.register('Reader', 'reader@example.com', PASSWORD);
      await account.signIn({ email: 'reader@example.com', password: PASSWORD });
      await renderAccount(account);
      await screen.findByText('reader@example.com');
      await expectNoAdminTools();
      return account;
    }

    it('renames the user', async () => {
      await renderSignedIn();

      await press('Edit name');
      await fill('Name', '  Shalom  ');
      await press('Save name');

      expect(await screen.findByText('Name saved.')).toBeOnTheScreen();
      expect(screen.getByText('Shalom')).toBeOnTheScreen();
      expect(screen.queryByLabelText('Name')).toBeNull();
    });

    it('checks the name before saving', async () => {
      await renderSignedIn();

      await press('Edit name');
      await fill('Name', '   ');
      await press('Save name');

      expect(screen.getByRole('alert')).toHaveTextContent('Enter your name.');
      await press('Cancel');
      expect(screen.getByText('Reader')).toBeOnTheScreen();
    });

    it('changes the password', async () => {
      const account = await renderSignedIn();

      await press('Change password');
      await fill('Current password', PASSWORD);
      await fill('New password', 'a brand new passphrase');
      await fill('New password again', 'a brand new passphrase');
      await press('Save password');

      expect(
        await screen.findByText('Password changed. Your other devices are signed out.'),
      ).toBeOnTheScreen();
      expect(account.passwordOf('reader@example.com')).toBe('a brand new passphrase');
    });

    it('explains a wrong current password', async () => {
      const account = await renderSignedIn();

      await press('Change password');
      await fill('Current password', 'not my password');
      await fill('New password', 'a brand new passphrase');
      await fill('New password again', 'a brand new passphrase');
      await press('Save password');

      expect(await screen.findByRole('alert')).toHaveTextContent("That password isn't right.");
      expect(account.passwordOf('reader@example.com')).toBe(PASSWORD);
    });

    it.each([
      ['a short new password', 'short', 'short', /at least 8 characters/],
      ['new passwords that differ', 'a brand new passphrase', 'a different one', /don't match/],
    ])('refuses %s before contacting the server', async (_, newPassword, repeated, message) => {
      const account = await renderSignedIn();

      await press('Change password');
      await fill('Current password', PASSWORD);
      await fill('New password', newPassword);
      await fill('New password again', repeated);
      await press('Save password');

      expect(screen.getByRole('alert')).toHaveTextContent(message);
      expect(account.passwordOf('reader@example.com')).toBe(PASSWORD);
    });

    it('says a forgotten password cannot be recovered yet', async () => {
      await renderSignedIn();

      await press('Change password');

      expect(screen.getByText(/Recovery by email isn't available yet/)).toBeOnTheScreen();
    });
  });

  describe('preferences and AI allowance', () => {
    async function renderSignedIn(shelfScanner = createFakeShelfScanner()) {
      const account = new FakeAccountService();
      account.register('Reader', 'reader@example.com', PASSWORD);
      await account.signIn({ email: 'reader@example.com', password: PASSWORD });
      await renderAccount(account, shelfScanner);
      await screen.findByText('reader@example.com');
      await expectNoAdminTools();
      return account;
    }

    it('sets the currency new pre-orders start in', async () => {
      const account = await renderSignedIn();
      expect(screen.getByRole('radio', { name: 'USD' })).toBeChecked();

      await fireEvent.press(screen.getByRole('radio', { name: 'EUR' }));

      await waitFor(() => expect(screen.getByRole('radio', { name: 'EUR' })).toBeChecked());
      expect((await account.getCurrentUser())?.preferredCurrency).toBe('EUR');
      expect(screen.getByRole('radio', { name: 'USD' })).not.toBeChecked();
    });

    it("shows today's allowance and who reads the photos", async () => {
      const shelfScanner = createFakeShelfScanner({
        quota: jest.fn(() =>
          Promise.resolve({
            available: true,
            shelfScans: { used: 2, limit: 5 },
            figureScans: { used: 5, limit: 5 },
            questions: { used: 0, limit: 30 },
            provider: { name: 'Google Gemini', usesPhotosForTraining: true, fallbackName: 'Groq' },
          }),
        ),
      });
      await renderSignedIn(shelfScanner);

      expect(await screen.findByLabelText('Shelf scans: 2 of 5 used today')).toBeOnTheScreen();
      expect(screen.getByLabelText('Box scans: 5 of 5 used today')).toBeOnTheScreen();
      expect(screen.getByLabelText('Questions: 0 of 30 used today')).toBeOnTheScreen();
      expect(screen.getByText(/Resets at midnight UTC/)).toBeOnTheScreen();
      expect(
        screen.getByText(/sent to Google Gemini.*free tier may use photos.*Groq/),
      ).toBeOnTheScreen();
    });

    it('says when AI is unavailable', async () => {
      const shelfScanner = createFakeShelfScanner({
        quota: jest.fn(() =>
          Promise.resolve({ available: false, shelfScans: { used: 0, limit: 0 } }),
        ),
      });
      await renderSignedIn(shelfScanner);

      expect(await screen.findByText(/AI features are unavailable right now/)).toBeOnTheScreen();
      expect(screen.queryByLabelText(/used today/)).toBeNull();
    });

    it("offers to try again when the allowance couldn't load", async () => {
      const quota = jest
        .fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValue({ available: true, shelfScans: { used: 1, limit: 5 } });
      await renderSignedIn(createFakeShelfScanner({ quota }));

      expect(await screen.findByText("Couldn't load your AI allowance.")).toBeOnTheScreen();
      await press('Try again');

      expect(await screen.findByLabelText('Shelf scans: 1 of 5 used today')).toBeOnTheScreen();
    });
  });

  describe('delete account', () => {
    async function renderSignedIn() {
      const account = new FakeAccountService();
      account.register('Reader', 'reader@example.com', PASSWORD);
      await account.signIn({ email: 'reader@example.com', password: PASSWORD });
      await renderAccount(account);
      await fireEvent.press(await screen.findByRole('button', { name: 'Delete account' }));
      return account;
    }

    it('deletes the account after the password and a confirmation', async () => {
      mockConfirm.mockResolvedValue(true);
      const account = await renderSignedIn();

      await fill('Password', PASSWORD);
      await press('Delete permanently');

      expect(await screen.findByText('Your account has been deleted.')).toBeOnTheScreen();
      expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true }));
      await expect(account.getCurrentUser()).resolves.toBeNull();
    });

    it('keeps the account when the confirmation is cancelled', async () => {
      mockConfirm.mockResolvedValue(false);
      const account = await renderSignedIn();

      await fill('Password', PASSWORD);
      await press('Delete permanently');

      await expect(account.getCurrentUser()).resolves.toMatchObject({
        email: 'reader@example.com',
      });
      expect(screen.getByText('reader@example.com')).toBeOnTheScreen();
    });

    it('explains a wrong password', async () => {
      mockConfirm.mockResolvedValue(true);
      await renderSignedIn();

      await fill('Password', 'not my password');
      await press('Delete permanently');

      expect(await screen.findByText("That password isn't right.")).toBeOnTheScreen();
    });

    it('requires the password before the button works', async () => {
      await renderSignedIn();

      expect(screen.getByRole('button', { name: 'Delete permanently' })).toBeDisabled();
    });
  });

  it('explains when the server is unreachable, without blocking the app', async () => {
    const account = new FakeAccountService();
    jest
      .spyOn(account, 'getCurrentUser')
      .mockRejectedValue(new AccountError('network', "Can't reach the Fandex server."));
    await renderAccount(account);

    expect(await screen.findByText("Can't reach the Fandex server.")).toBeOnTheScreen();
    expect(screen.getByText(/still works without an account/)).toBeOnTheScreen();
  });
});

describe('validateAuthInput', () => {
  const valid = { name: 'Reader', email: 'reader@example.com', password: PASSWORD };

  it.each([
    ['sign-up', { name: ' ' }, 'Enter your name.'],
    ['sign-in', { email: 'nope' }, 'Enter a valid email address.'],
    ['sign-up', { password: 'short' }, 'Use a password of at least 8 characters.'],
    ['sign-in', { password: '' }, 'Enter your password.'],
  ] as const)('%s with %j → %s', (mode, override, message) => {
    expect(validateAuthInput(mode, { ...valid, ...override })).toBe(message);
  });

  it('accepts valid input', () => {
    expect(validateAuthInput('sign-up', valid)).toBeNull();
    expect(validateAuthInput('sign-in', { ...valid, password: 'x' })).toBeNull();
  });
});
