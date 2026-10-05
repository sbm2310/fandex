/** The e2e tests' own database, kept separate from development data. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://fandex:fandex@localhost:5432/fandex_test';
