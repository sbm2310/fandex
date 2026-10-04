import { CatalogError } from '@fandex/core';

import { catalogErrorMessage } from '@/services/catalog-error-message';

describe('catalogErrorMessage', () => {
  it.each([
    ['network', /Check your connection/],
    ['rate-limited', /Too many searches/],
    ['http', /having trouble/],
    ['invalid-response', /having trouble/],
  ] as const)('explains %s errors', (kind, expected) => {
    expect(catalogErrorMessage(new CatalogError('openlibrary', kind, 'x'))).toMatch(expected);
  });

  it('falls back to a generic message for unknown errors', () => {
    expect(catalogErrorMessage(new Error('boom'))).toMatch(/Something went wrong/);
  });
});
