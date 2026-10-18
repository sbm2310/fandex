import { DISPLAY_NAME_MAX, displayNameSchema, meResponseSchema } from './account';

describe('meResponseSchema', () => {
  const valid = {
    id: '0199b5a0-7c1e-7a3b-9f00-1234567890ab',
    email: 'reader@example.com',
    name: 'Reader',
    emailVerified: false,
    createdAt: '2026-10-05T09:00:00.000Z',
  };

  it('accepts a valid response, not an admin unless it says so', () => {
    expect(meResponseSchema.parse(valid)).toEqual({ ...valid, isAdmin: false });
    expect(meResponseSchema.parse({ ...valid, isAdmin: true }).isAdmin).toBe(true);
  });

  it.each([
    ['a non-UUID id', { id: '42' }],
    ['an invalid email', { email: 'nope' }],
    ['a non-ISO date', { createdAt: 'yesterday' }],
  ])('rejects %s', (_, override) => {
    expect(meResponseSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});

describe('displayNameSchema', () => {
  it('trims the name', () => {
    expect(displayNameSchema.parse('  Shalom  ')).toBe('Shalom');
  });

  it('accepts up to the maximum length', () => {
    expect(displayNameSchema.safeParse('a'.repeat(DISPLAY_NAME_MAX)).success).toBe(true);
  });

  it.each([
    ['an empty name', ''],
    ['only spaces', '   '],
    ['a name that is too long', 'a'.repeat(DISPLAY_NAME_MAX + 1)],
  ])('rejects %s', (_, name) => {
    expect(displayNameSchema.safeParse(name).success).toBe(false);
  });
});
