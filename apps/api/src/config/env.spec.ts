import { envSchema } from './env.js';

const DATABASE_URL = 'postgresql://fandex:fandex@localhost:5432/fandex';

describe('envSchema', () => {
  it('applies defaults', () => {
    expect(envSchema.parse({ DATABASE_URL })).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL,
    });
  });

  it('coerces the port from a string', () => {
    expect(envSchema.parse({ DATABASE_URL, PORT: '8080' }).PORT).toBe(8080);
  });

  it.each([['abc'], ['0'], ['70000']])('rejects PORT=%s', (port) => {
    expect(envSchema.safeParse({ DATABASE_URL, PORT: port }).success).toBe(false);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(envSchema.safeParse({ DATABASE_URL, NODE_ENV: 'staging' }).success).toBe(false);
  });

  it('requires DATABASE_URL', () => {
    expect(envSchema.safeParse({}).success).toBe(false);
  });

  it.each([['not a url'], ['mysql://localhost/fandex']])('rejects DATABASE_URL=%s', (url) => {
    expect(envSchema.safeParse({ DATABASE_URL: url }).success).toBe(false);
  });

  it('accepts the postgres:// scheme too', () => {
    expect(envSchema.safeParse({ DATABASE_URL: 'postgres://u:p@db:5432/x' }).success).toBe(true);
  });
});
