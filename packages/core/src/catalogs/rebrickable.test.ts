import searchFixture from './__fixtures__/rebrickable-search-millennium-falcon.json';
import minifigsFixture from './__fixtures__/rebrickable-set-75192-1-minifigs.json';
import setFixture from './__fixtures__/rebrickable-set-75192-1.json';
import themesFixture from './__fixtures__/rebrickable-themes.json';
import { CatalogError } from './catalog-error';
import { RebrickableCatalog } from './rebrickable';

// Fixtures are real responses recorded from rebrickable.com (October 2026).

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Fake fetch that answers by path, like Rebrickable would. */
function catalogWith(routes: Record<string, () => Response>, extra: { now?: () => number } = {}) {
  const fetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>((input) => {
    const url = new URL(String(input));
    const route = Object.keys(routes).find((prefix) => url.pathname.endsWith(prefix));
    return Promise.resolve(
      route ? (routes[route] as () => Response)() : json({ detail: 'Not found.' }, 404),
    );
  });
  const catalog = new RebrickableCatalog({ apiKey: 'test-key', fetch, ...extra });
  const paths = () => fetch.mock.calls.map(([input]) => new URL(String(input)).pathname);
  return { catalog, fetch, paths };
}

const realRoutes = {
  '/sets/': () => json(searchFixture),
  '/themes/': () => json(themesFixture),
  '/sets/75192-1/': () => json(setFixture),
  '/sets/75192-1/minifigs/': () => json(minifigsFixture),
};

describe('RebrickableCatalog', () => {
  it('looks up a set with its theme and sub-theme', async () => {
    const { catalog } = catalogWith(realRoutes);

    await expect(catalog.lookupSet('75192-1')).resolves.toEqual({
      source: 'rebrickable',
      externalId: '75192-1',
      category: 'lego',
      title: 'Millennium Falcon',
      setNumber: '75192',
      year: 2017,
      pieceCount: 7541,
      theme: 'Star Wars',
      subtheme: 'Ultimate Collector Series',
      coverUrl: 'https://cdn.rebrickable.com/media/sets/75192-1/30881.jpg',
      matchSignals: {
        title: 'Millennium Falcon',
        legoThemeIds: [171, 158], // Ultimate Collector Series, then its parent Star Wars
        minifigs: minifigsFixture.results.map((fig) => fig.set_name),
      },
    });
  });

  it('includes theme ids but no minifigs in search results (one call per search)', async () => {
    const { catalog, paths } = catalogWith(realRoutes);

    const [first] = await catalog.searchSets('millennium falcon');

    expect(first?.matchSignals?.legoThemeIds?.length).toBeGreaterThan(0);
    expect(first?.matchSignals).not.toHaveProperty('minifigs');
    expect(paths().some((path) => path.includes('/minifigs/'))).toBe(false);
  });

  it('still returns the set when its minifigs cannot be loaded (to retry later)', async () => {
    const { catalog } = catalogWith({
      '/sets/75192-1/': () => json(setFixture),
      '/themes/': () => json(themesFixture),
      '/sets/75192-1/minifigs/': () => json({ detail: 'busy' }, 429),
    });

    const set = await catalog.lookupSet('75192-1');

    expect(set?.title).toBe('Millennium Falcon');
    expect(set?.matchSignals).toEqual({ title: 'Millennium Falcon', legoThemeIds: [171, 158] });
  });

  it('records an empty minifig list for a set without minifigs', async () => {
    const { catalog } = catalogWith({
      '/sets/75192-1/': () => json(setFixture),
      '/themes/': () => json(themesFixture),
      '/sets/75192-1/minifigs/': () => json({ count: 0, results: [] }),
    });

    const set = await catalog.lookupSet('75192-1');

    expect(set?.matchSignals?.minifigs).toEqual([]);
  });

  it('waits for beforeRequest before every HTTP request', async () => {
    const events: string[] = [];
    const fetch = jest.fn((input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      events.push(`fetch ${path.replace('/api/v3/lego', '')}`);
      const body = path.endsWith('/themes/')
        ? themesFixture
        : path.endsWith('/minifigs/')
          ? minifigsFixture
          : setFixture;
      return Promise.resolve(json(body));
    });
    const catalog = new RebrickableCatalog({
      apiKey: 'k',
      fetch,
      beforeRequest: () => {
        events.push('wait');
        return Promise.resolve();
      },
    });

    await catalog.lookupSet('75192-1');

    expect(events).toEqual([
      'wait',
      'fetch /sets/75192-1/',
      'wait',
      'fetch /themes/',
      'wait',
      'fetch /sets/75192-1/minifigs/',
    ]);
  });

  it('searches sets, excluding merchandise without pieces', async () => {
    const { catalog, fetch } = catalogWith(realRoutes);

    const sets = await catalog.searchSets(' millennium falcon ');

    expect(sets.length).toBeGreaterThan(0);
    expect(sets.every((set) => set.category === 'lego' && set.theme)).toBe(true);
    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.searchParams.get('search')).toBe('millennium falcon');
    expect(url.searchParams.get('min_parts')).toBe('1');
  });

  it('sends the API key', async () => {
    const { catalog, fetch } = catalogWith(realRoutes);

    await catalog.lookupSet('75192-1');

    expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: 'key test-key' });
  });

  it('loads the theme list once and reuses it', async () => {
    const { catalog, paths } = catalogWith(realRoutes);

    await catalog.lookupSet('75192-1');
    await catalog.searchSets('millennium falcon');
    await catalog.lookupSet('75192-1');

    expect(paths().filter((path) => path.endsWith('/themes/'))).toHaveLength(1);
  });

  it('refreshes the theme list after a day', async () => {
    let now = 0;
    const { catalog, paths } = catalogWith(realRoutes, { now: () => now });

    await catalog.lookupSet('75192-1');
    now = 24 * 60 * 60 * 1000 + 1;
    await catalog.lookupSet('75192-1');

    expect(paths().filter((path) => path.endsWith('/themes/'))).toHaveLength(2);
  });

  it('returns null for an unknown set', async () => {
    const { catalog } = catalogWith(realRoutes);

    await expect(catalog.lookupSet('99999999-1')).resolves.toBeNull();
  });

  it('leaves out fields Rebrickable does not provide', async () => {
    const { catalog } = catalogWith({
      '/sets/1-1/': () => json({ set_num: '1-1', name: ' Mystery ', theme_id: 99999 }),
      '/themes/': () => json(themesFixture),
    });

    await expect(catalog.lookupSet('1-1')).resolves.toEqual({
      source: 'rebrickable',
      externalId: '1-1',
      category: 'lego',
      title: 'Mystery',
      setNumber: '1',
      matchSignals: { title: 'Mystery', legoThemeIds: [] },
    });
  });

  it('does not call the API for a blank query', async () => {
    const { catalog, fetch } = catalogWith(realRoutes);

    await expect(catalog.searchSets('  ')).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [429, 'rate-limited'],
    [401, 'http'],
    [500, 'http'],
  ] as const)('reports HTTP %d as a %s CatalogError', async (status, kind) => {
    const { catalog } = catalogWith({ '/sets/': () => json({ detail: 'nope' }, status) });

    await expect(catalog.searchSets('falcon')).rejects.toMatchObject({
      source: 'rebrickable',
      kind,
    });
  });

  it('reports network failures', async () => {
    const fetch = jest.fn(() => Promise.reject(new TypeError('fetch failed')));
    const catalog = new RebrickableCatalog({ apiKey: 'k', fetch });

    await expect(catalog.searchSets('falcon')).rejects.toBeInstanceOf(CatalogError);
  });
});
