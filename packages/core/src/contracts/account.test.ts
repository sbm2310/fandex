import { meResponseSchema } from './account';

describe('meResponseSchema', () => {
  const valid = {
    id: '0199b5a0-7c1e-7a3b-9f00-1234567890ab',
    email: 'reader@example.com',
    name: 'Reader',
    emailVerified: false,
    createdAt: '2026-10-05T09:00:00.000Z',
  };

  it('accepts a valid response', () => {
    expect(meResponseSchema.parse(valid)).toEqual(valid);
  });

  it.each([
    ['a non-UUID id', { id: '42' }],
    ['an invalid email', { email: 'nope' }],
    ['a non-ISO date', { createdAt: 'yesterday' }],
  ])('rejects %s', (_, override) => {
    expect(meResponseSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});
