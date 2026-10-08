import { envSchema } from './env.js';

const DATABASE_URL = 'postgresql://fandex:fandex@localhost:5432/fandex';
const BETTER_AUTH_SECRET = 'x'.repeat(32);
const required = { DATABASE_URL, BETTER_AUTH_SECRET };

describe('envSchema', () => {
  it('applies defaults', () => {
    expect(envSchema.parse(required)).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL,
      BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: 'http://localhost:3000',
      AI_PROVIDER: 'groq',
      AI_SHELF_SCANS_PER_USER: 5,
      AI_SHELF_SCANS_PER_DAY: 30,
      AI_ASK_PROVIDER: 'groq',
      AI_QUESTIONS_PER_USER: 30,
      AI_QUESTIONS_PER_DAY: 100,
      TRUSTED_ORIGINS: ['http://localhost:8081', 'fandex://'],
    });
  });

  it('treats an empty AI key as missing and coerces the AI limits', () => {
    const env = envSchema.parse({
      ...required,
      GROQ_API_KEY: '',
      AI_SHELF_SCANS_PER_USER: '3',
      AI_SHELF_SCANS_PER_DAY: '0',
    });

    expect(env.GROQ_API_KEY).toBeUndefined();
    expect(env).toMatchObject({ AI_SHELF_SCANS_PER_USER: 3, AI_SHELF_SCANS_PER_DAY: 0 });
    expect(envSchema.safeParse({ ...required, AI_SHELF_SCANS_PER_DAY: '-1' }).success).toBe(false);
  });

  it('accepts the known AI providers only', () => {
    expect(envSchema.parse({ ...required, AI_PROVIDER: 'gemini-free' }).AI_PROVIDER).toBe(
      'gemini-free',
    );
    expect(envSchema.safeParse({ ...required, AI_PROVIDER: 'openai' }).success).toBe(false);
  });

  it('coerces the port from a string', () => {
    expect(envSchema.parse({ ...required, PORT: '8080' }).PORT).toBe(8080);
  });

  it.each([['abc'], ['0'], ['70000']])('rejects PORT=%s', (port) => {
    expect(envSchema.safeParse({ ...required, PORT: port }).success).toBe(false);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(envSchema.safeParse({ ...required, NODE_ENV: 'staging' }).success).toBe(false);
  });

  it('requires DATABASE_URL', () => {
    expect(envSchema.safeParse({ BETTER_AUTH_SECRET }).success).toBe(false);
  });

  it.each([['not a url'], ['mysql://localhost/fandex']])('rejects DATABASE_URL=%s', (url) => {
    expect(envSchema.safeParse({ BETTER_AUTH_SECRET, DATABASE_URL: url }).success).toBe(false);
  });

  it('accepts the postgres:// scheme too', () => {
    expect(
      envSchema.safeParse({ BETTER_AUTH_SECRET, DATABASE_URL: 'postgres://u:p@db:5432/x' }).success,
    ).toBe(true);
  });

  it('requires a long enough auth secret', () => {
    expect(envSchema.safeParse({ DATABASE_URL }).success).toBe(false);
    expect(envSchema.safeParse({ DATABASE_URL, BETTER_AUTH_SECRET: 'short' }).success).toBe(false);
  });

  it('splits trusted origins', () => {
    expect(
      envSchema.parse({ ...required, TRUSTED_ORIGINS: 'http://a.test, https://b.test,' })
        .TRUSTED_ORIGINS,
    ).toEqual(['http://a.test', 'https://b.test']);
  });

  it('treats an empty Rebrickable key as not set, and rejects a short one', () => {
    expect(
      envSchema.parse({ ...required, REBRICKABLE_API_KEY: '' }).REBRICKABLE_API_KEY,
    ).toBeUndefined();
    expect(envSchema.safeParse({ ...required, REBRICKABLE_API_KEY: 'short' }).success).toBe(false);
  });
});
