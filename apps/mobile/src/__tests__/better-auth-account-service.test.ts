import type { FandexAuthClient } from '@/services/auth-client';
import { BetterAuthAccountService } from '@/services/better-auth-account-service';

const user = {
  id: '0199b5a0-7c1e-7a3b-9f00-1234567890ab',
  email: 'reader@example.com',
  name: 'Reader',
  emailVerified: false,
  createdAt: '2026-10-05T09:00:00.000Z',
};

const ok = () => Promise.resolve({ data: {}, error: null });

/** Only the methods the service calls; Better Auth's client type is much larger. */
function fakeClient(overrides: Record<string, unknown> = {}) {
  return {
    signUp: { email: jest.fn(ok) },
    signIn: { email: jest.fn(ok) },
    signOut: jest.fn(ok),
    deleteUser: jest.fn(ok),
    ...overrides,
  } as unknown as FandexAuthClient;
}

describe('BetterAuthAccountService', () => {
  const sessionReturning = (result: { data: unknown; error: unknown }) =>
    fakeClient({ getSession: jest.fn(() => Promise.resolve(result)) });

  it('reads the signed-in user from the session (dates normalized to ISO strings)', async () => {
    const client = sessionReturning({
      data: { user: { ...user, createdAt: new Date(user.createdAt), image: null } },
      error: null,
    });
    const service = new BetterAuthAccountService(client);

    await expect(service.getCurrentUser()).resolves.toEqual(user);
  });

  it('returns null when signed out', async () => {
    const service = new BetterAuthAccountService(sessionReturning({ data: null, error: null }));

    await expect(service.getCurrentUser()).resolves.toBeNull();
  });

  it('rejects session data that does not match the contract', async () => {
    const service = new BetterAuthAccountService(
      sessionReturning({ data: { user: { ...user, id: '42' } }, error: null }),
    );

    await expect(service.getCurrentUser()).rejects.toThrow();
  });

  it('turns errors into AccountErrors', async () => {
    const service = new BetterAuthAccountService(
      sessionReturning({ data: null, error: { status: 0 } }),
    );

    await expect(service.getCurrentUser()).rejects.toMatchObject({ kind: 'network' });
  });

  it('passes sign-in details to Better Auth and maps its errors', async () => {
    const signIn = jest.fn(() =>
      Promise.resolve({ data: null, error: { status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' } }),
    );
    const service = new BetterAuthAccountService(fakeClient({ signIn: { email: signIn } }));

    await expect(service.signIn({ email: 'a@b.co', password: 'pw' })).rejects.toMatchObject({
      kind: 'invalid-credentials',
    });
    expect(signIn).toHaveBeenCalledWith({ email: 'a@b.co', password: 'pw' });
  });

  it('deletes the account with the password', async () => {
    const client = fakeClient();
    const service = new BetterAuthAccountService(client);

    await service.deleteAccount({ password: 'secret password' });

    expect(client.deleteUser).toHaveBeenCalledWith({ password: 'secret password' });
  });
});
