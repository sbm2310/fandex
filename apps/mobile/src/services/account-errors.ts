import { AccountError, type AccountErrorKind } from './account-service';

type BetterAuthError = { status?: number; code?: string; message?: string };

const MESSAGES: Record<AccountErrorKind, string> = {
  'invalid-credentials': "That email and password don't match. Check them and try again.",
  'email-taken': 'An account with this email already exists. Try signing in instead.',
  'weak-password': 'Use a password of at least 8 characters.',
  'wrong-password': "That password isn't right.",
  'rate-limited': 'Too many attempts. Wait a minute and try again.',
  network: "Can't reach the Fandex server. Check your connection and try again.",
  unknown: 'Something went wrong. Try again.',
};

/** Turns a Better Auth error response into a user-facing AccountError. */
export function toAccountError(error: BetterAuthError, context: 'sign-in' | 'other' = 'other') {
  const kind = classify(error, context);
  return new AccountError(kind, MESSAGES[kind]);
}

function classify(error: BetterAuthError, context: 'sign-in' | 'other'): AccountErrorKind {
  const code = error.code ?? '';
  if (error.status === 429) return 'rate-limited';
  if (code.startsWith('USER_ALREADY_EXISTS')) return 'email-taken';
  if (code === 'PASSWORD_TOO_SHORT' || code === 'PASSWORD_TOO_LONG') return 'weak-password';
  if (code === 'INVALID_EMAIL_OR_PASSWORD') return 'invalid-credentials';
  if (code === 'INVALID_PASSWORD')
    return context === 'sign-in' ? 'invalid-credentials' : 'wrong-password';
  if (error.status === 0) return 'network';
  return 'unknown';
}
