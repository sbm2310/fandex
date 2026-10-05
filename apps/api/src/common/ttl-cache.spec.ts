import { TtlCache } from './ttl-cache.js';

describe('TtlCache', () => {
  let now = 0;
  const cache = () => new TtlCache<string>({ ttlMs: 1000, maxEntries: 2, now: () => now });

  beforeEach(() => {
    now = 0;
  });

  it('returns values until they expire', () => {
    const c = cache();
    c.set('a', 'A');

    now = 999;
    expect(c.get('a')).toBe('A');
    now = 1000;
    expect(c.get('a')).toBeUndefined();
  });

  it('evicts the oldest entry beyond the size cap', () => {
    const c = cache();
    c.set('a', 'A');
    c.set('b', 'B');
    c.set('c', 'C');

    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe('B');
    expect(c.get('c')).toBe('C');
  });

  it('refreshes an entry when it is set again', () => {
    const c = cache();
    c.set('a', 'A');
    c.set('b', 'B');
    c.set('a', 'A2');
    c.set('c', 'C');

    expect(c.get('a')).toBe('A2');
    expect(c.get('b')).toBeUndefined();
  });
});
