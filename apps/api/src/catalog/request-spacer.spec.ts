import type { BookCatalog } from '@fandex/core';

import { RateLimitedCatalog } from './rate-limited-catalog.js';
import { RequestSpacer } from './request-spacer.js';

describe('RequestSpacer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts concurrent calls at least the interval apart, in order', async () => {
    const spacer = new RequestSpacer(350);
    const started: number[] = [];
    const t0 = Date.now();

    const calls = Promise.all(
      [1, 2, 3].map(() => spacer.run(async () => started.push(Date.now() - t0))),
    );
    await vi.advanceTimersByTimeAsync(1000);
    await calls;

    expect(started).toEqual([0, 350, 700]);
  });

  it('does not delay calls that are already far enough apart', async () => {
    const spacer = new RequestSpacer(350);
    const started: number[] = [];
    const t0 = Date.now();

    await spacer.run(async () => started.push(Date.now() - t0));
    await vi.advanceTimersByTimeAsync(500);
    await spacer.run(async () => started.push(Date.now() - t0));

    expect(started).toEqual([0, 500]);
  });
});

describe('RateLimitedCatalog', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('spaces search and ISBN calls through one shared spacer', async () => {
    const started: number[] = [];
    const t0 = Date.now();
    const inner: BookCatalog = {
      search: async () => (started.push(Date.now() - t0), []),
      lookupIsbn: async () => (started.push(Date.now() - t0), null),
    };
    const catalog = new RateLimitedCatalog(inner, 350);

    const calls = Promise.all([catalog.search('a'), catalog.lookupIsbn('9780306406157' as never)]);
    await vi.advanceTimersByTimeAsync(500);
    await calls;

    expect(started).toEqual([0, 350]);
  });
});
