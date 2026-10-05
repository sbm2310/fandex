import type { BookCatalog } from '@fandex/core';

import { RateLimitedCatalog } from './rate-limited-catalog.js';

describe('RateLimitedCatalog', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    const started: number[] = [];
    const inner: BookCatalog = {
      search: async () => {
        started.push(Date.now());
        return [];
      },
      lookupIsbn: async () => {
        started.push(Date.now());
        return null;
      },
    };
    return { catalog: new RateLimitedCatalog(inner, 350), started };
  }

  it('spaces concurrent calls at least the interval apart', async () => {
    const { catalog, started } = setup();
    const t0 = Date.now();

    const calls = Promise.all([catalog.search('a'), catalog.search('b'), catalog.search('c')]);
    await vi.advanceTimersByTimeAsync(1000);
    await calls;

    expect(started.map((t) => t - t0)).toEqual([0, 350, 700]);
  });

  it('does not delay calls that are already far enough apart', async () => {
    const { catalog, started } = setup();
    const t0 = Date.now();

    await catalog.search('a');
    await vi.advanceTimersByTimeAsync(500);
    await catalog.search('b');

    expect(started.map((t) => t - t0)).toEqual([0, 500]);
  });
});
