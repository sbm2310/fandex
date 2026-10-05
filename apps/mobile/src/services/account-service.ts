import type { MeResponse } from '@fandex/core';

export type AccountUser = MeResponse;

/**
 * Sign-in and account management, as the app needs it. The real implementation wraps
 * Better Auth (better-auth-account-service.ts); tests use a fake.
 */
export interface AccountService {
  /** The signed-in user, or null when signed out. */
  getCurrentUser(): Promise<AccountUser | null>;
  signUp(input: { name: string; email: string; password: string }): Promise<void>;
  signIn(input: { email: string; password: string }): Promise<void>;
  signOut(): Promise<void>;
  /** Permanently deletes the account; the password confirms it's really the owner. */
  deleteAccount(input: { password: string }): Promise<void>;
}

export type AccountErrorKind =
  | 'invalid-credentials'
  | 'email-taken'
  | 'weak-password'
  | 'wrong-password'
  | 'rate-limited'
  | 'network'
  | 'unknown';

export class AccountError extends Error {
  override readonly name = 'AccountError';

  constructor(
    readonly kind: AccountErrorKind,
    message: string,
  ) {
    super(message);
  }
}
