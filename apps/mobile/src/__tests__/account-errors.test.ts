import { toAccountError } from '@/services/account-errors';

describe('toAccountError', () => {
  it.each([
    [{ status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' }, 'sign-in', 'invalid-credentials'],
    [{ status: 422, code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' }, 'other', 'email-taken'],
    [{ status: 400, code: 'PASSWORD_TOO_SHORT' }, 'other', 'weak-password'],
    [{ status: 400, code: 'INVALID_PASSWORD' }, 'other', 'wrong-password'],
    [{ status: 400, code: 'INVALID_PASSWORD' }, 'sign-in', 'invalid-credentials'],
    [{ status: 429 }, 'other', 'rate-limited'],
    [{ status: 0 }, 'other', 'network'],
    [{ status: 500, code: 'SOMETHING_ELSE' }, 'other', 'unknown'],
  ] as const)('maps %j (%s) to %s', (error, context, kind) => {
    const result = toAccountError(error, context);
    expect(result.kind).toBe(kind);
    expect(result.message.length).toBeGreaterThan(10);
  });
});
