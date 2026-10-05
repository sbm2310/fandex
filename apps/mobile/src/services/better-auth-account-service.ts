import { meResponseSchema } from '@fandex/core';

import { toAccountError } from './account-errors';
import type { AccountService, AccountUser } from './account-service';
// Type-only: this file (and its tests) never load Better Auth's runtime.
import type { FandexAuthClient } from './auth-client';

/** AccountService backed by Better Auth on the Fandex API. */
export class BetterAuthAccountService implements AccountService {
  constructor(private readonly authClient: FandexAuthClient) {}

  /**
   * Uses Better Auth's session endpoint: it answers 200 with no session when signed out (no
   * console noise from 401s), and on native the Expo plugin caches the session in secure
   * storage so the signed-in state is known even offline.
   */
  async getCurrentUser(): Promise<AccountUser | null> {
    const { data, error } = await this.authClient.getSession();
    if (error) throw toAccountError(error);
    if (!data) return null;
    const { id, email, name, emailVerified, createdAt } = data.user;
    return meResponseSchema.parse({
      id,
      email,
      name,
      emailVerified,
      createdAt: new Date(createdAt).toISOString(),
    });
  }

  async signUp(input: { name: string; email: string; password: string }): Promise<void> {
    const { error } = await this.authClient.signUp.email(input);
    if (error) throw toAccountError(error);
  }

  async signIn(input: { email: string; password: string }): Promise<void> {
    const { error } = await this.authClient.signIn.email(input);
    if (error) throw toAccountError(error, 'sign-in');
  }

  async signOut(): Promise<void> {
    const { error } = await this.authClient.signOut();
    if (error) throw toAccountError(error);
  }

  async deleteAccount(input: { password: string }): Promise<void> {
    const { error } = await this.authClient.deleteUser(input);
    if (error) throw toAccountError(error);
  }
}
