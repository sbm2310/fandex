import { envSchema } from './env.js';

describe('envSchema', () => {
  it('applies defaults', () => {
    expect(envSchema.parse({})).toEqual({ NODE_ENV: 'development', PORT: 3000 });
  });

  it('coerces the port from a string', () => {
    expect(envSchema.parse({ PORT: '8080' }).PORT).toBe(8080);
  });

  it.each([['abc'], ['0'], ['70000']])('rejects PORT=%s', (port) => {
    expect(envSchema.safeParse({ PORT: port }).success).toBe(false);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(envSchema.safeParse({ NODE_ENV: 'staging' }).success).toBe(false);
  });
});
