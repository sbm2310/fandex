import { parseIsbn } from '@fandex/core';

// Guards the monorepo wiring: the API must be able to use the shared core package.
describe('@fandex/core from the API', () => {
  it('is importable', () => {
    expect(parseIsbn('0-306-40615-2')).toBe('9780306406157');
  });
});
