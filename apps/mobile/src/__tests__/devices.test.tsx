import type { DeviceSession } from '@fandex/core';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import AccountScreen from '@/app/(tabs)/account';
import {
  createFakeAdminReviews,
  createFakeDeviceSessions,
  createWrapper,
  FakeAccountService,
} from '@/test-utils/providers';
import { confirm } from '@/utils/confirm';

jest.mock('@/utils/confirm', () => ({ confirm: jest.fn() }));
const mockConfirm = jest.mocked(confirm);

const PASSWORD = 'correct horse battery';
const session = (id: string, device: string, current = false): DeviceSession => ({
  id: `0199b5a0-0000-7000-8000-00000000d00${id}`,
  device,
  signedInAt: '2026-10-0' + id + 'T09:00:00.000Z',
  lastActiveAt: '2026-10-19T09:00:00.000Z',
  current,
});
const thisMac = session('1', 'Chrome on Mac', true);
const iPhone = session('2', 'Fandex on iPhone');
const oldLaptop = session('3', 'Safari on Mac');

const signedInDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

async function renderAccount(
  deviceSessions = createFakeDeviceSessions([thisMac, iPhone, oldLaptop]),
) {
  const account = new FakeAccountService();
  account.register('Reader', 'reader@example.com', PASSWORD);
  await account.signIn({ email: 'reader@example.com', password: PASSWORD });
  const adminReviews = createFakeAdminReviews();
  await render(<AccountScreen />, {
    wrapper: createWrapper({ account, adminReviews, deviceSessions }),
  });
  await screen.findByText('Signed-in devices');
  await waitFor(() => expect(adminReviews.isAdmin).toHaveBeenCalled());
  await act(async () => {});
  return deviceSessions;
}

const signOutButton = (device: DeviceSession) =>
  screen.getByRole('button', {
    name: `Sign out ${device.device}, signed in ${signedInDay(device.signedInAt)}`,
  });

describe('Signed-in devices', () => {
  beforeEach(() => mockConfirm.mockReset());

  it('lists the devices and marks this one, which has no sign-out button of its own', async () => {
    await renderAccount();

    expect(await screen.findByText('Fandex on iPhone')).toBeOnTheScreen();
    expect(screen.getByText('Safari on Mac')).toBeOnTheScreen();
    expect(screen.getByText('This device')).toBeOnTheScreen();
    expect(signOutButton(iPhone)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Sign out Chrome on Mac/ })).toBeNull();
  });

  it('signs out one other device', async () => {
    const sessions = await renderAccount();

    await screen.findByText('Fandex on iPhone');
    await fireEvent.press(signOutButton(iPhone));

    expect(await screen.findByText('Signed out of Fandex on iPhone.')).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByText('Fandex on iPhone')).toBeNull());
    expect(sessions.signOut).toHaveBeenCalledWith(iPhone.id);
  });

  it('signs out everywhere else after confirming', async () => {
    mockConfirm.mockResolvedValue(true);
    const sessions = await renderAccount();

    await fireEvent.press(await screen.findByRole('button', { name: 'Sign out everywhere else' }));

    expect(await screen.findByText('Signed out of 2 other devices.')).toBeOnTheScreen();
    expect(sessions.sessions.map((s) => s.device)).toEqual(['Chrome on Mac']);
    await waitFor(() => expect(screen.queryByText('Safari on Mac')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Sign out everywhere else' })).toBeNull();
  });

  it('keeps every device when the confirmation is cancelled', async () => {
    mockConfirm.mockResolvedValue(false);
    const sessions = await renderAccount();

    await fireEvent.press(await screen.findByRole('button', { name: 'Sign out everywhere else' }));

    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(sessions.signOutOthers).not.toHaveBeenCalled();
  });

  it('offers no "everywhere else" with only one other device', async () => {
    await renderAccount(createFakeDeviceSessions([thisMac, iPhone]));

    expect(await screen.findByText('Fandex on iPhone')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Sign out everywhere else' })).toBeNull();
  });

  it("offers to try again when the devices couldn't load", async () => {
    const sessions = createFakeDeviceSessions([thisMac, iPhone]);
    sessions.list.mockRejectedValueOnce(new Error('offline'));
    await renderAccount(sessions);

    expect(await screen.findByText("Couldn't load your devices.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Fandex on iPhone')).toBeOnTheScreen();
  });

  it("shows the server's reason when signing out fails", async () => {
    const sessions = createFakeDeviceSessions([thisMac, iPhone]);
    sessions.signOut.mockRejectedValueOnce(new Error('Not one of your devices.'));
    await renderAccount(sessions);

    await screen.findByText('Fandex on iPhone');
    await fireEvent.press(signOutButton(iPhone));

    expect(await screen.findByText('Not one of your devices.')).toBeOnTheScreen();
  });
});
