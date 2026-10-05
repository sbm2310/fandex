import { fireEvent, render, screen } from '@testing-library/react-native';

import AccountScreen from '@/app/(tabs)/account';
import { validateAuthInput } from '@/components/auth-form';
import { AccountError } from '@/services/account-service';
import { createWrapper, FakeAccountService } from '@/test-utils/providers';
import { confirm } from '@/utils/confirm';

jest.mock('@/utils/confirm', () => ({ confirm: jest.fn() }));
const mockConfirm = jest.mocked(confirm);

const PASSWORD = 'correct horse battery';

async function renderAccount(account = new FakeAccountService()) {
  await render(<AccountScreen />, { wrapper: createWrapper({ account }) });
  return account;
}

async function fill(label: string, text: string) {
  await fireEvent.changeText(await screen.findByLabelText(label), text);
}

const press = async (name: string) => fireEvent.press(screen.getByRole('button', { name }));

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
