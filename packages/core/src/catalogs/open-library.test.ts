import { parseIsbn, type Isbn13 } from '../isbn';
import isbnFixture from './__fixtures__/openlibrary-isbn-9780345445605.json';
import batmanFixture from './__fixtures__/openlibrary-isbn-batman-year-one.json';
import onePieceFixture from './__fixtures__/openlibrary-isbn-one-piece.json';
import notFoundFixture from './__fixtures__/openlibrary-isbn-not-found.json';
import searchFixture from './__fixtures__/openlibrary-search-hobbit.json';
import { CatalogError } from './catalog-error';
import { OpenLibraryCatalog } from './open-library';

// Fixtures are real responses recorded from openlibrary.org (October 2026).

function isbn(value: string): Isbn13 {
  const parsed = parseIsbn(value);
  if (!parsed) throw new Error(`Invalid test ISBN: ${value}`);
  return parsed;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A catalog whose fetch returns `response` and records the requests made. */
function catalogReturning(response: Response | (() => Promise<Response>), headers = {}) {
  const fetch = jest.fn<Promise<Response>, Parameters<typeof globalThis.fetch>>(
    typeof response === 'function' ? response : () => Promise.resolve(response),
  );
  const catalog = new OpenLibraryCatalog({ fetch, headers });
  const requestedUrl = () => new URL(String(fetch.mock.calls[0]?.[0]));
  const requestInit = () => fetch.mock.calls[0]?.[1];
  return { catalog, fetch, requestedUrl, requestInit };
}

/** A minimal search response with one work, for edge cases the recorded fixtures don't cover. */
function oneWork(work: Record<string, unknown>) {
  return jsonResponse({ docs: [work] });
}

describe('OpenLibraryCatalog.search', () => {
  it('maps each work to its best-matching edition', async () => {
    const { catalog } = catalogReturning(jsonResponse(searchFixture));

    const results = await catalog.search('the hobbit');

    expect(results).toHaveLength(5);
    expect(results[0]).toEqual({
      source: 'openlibrary',
      externalId: 'OL51709286M',
      category: 'book',
      title: 'The Hobbit',
      authors: ['J.R.R. Tolkien'],
      publishedYear: 1984,
      publisher: 'Houghton Mifflin Company',
      isbn13: '9780395520215',
      coverUrl: 'https://covers.openlibrary.org/b/id/15223072-M.jpg',
    });
  });

  it('cleans up messy titles from real data', async () => {
    const { catalog } = catalogReturning(jsonResponse(searchFixture));

    const titles = (await catalog.search('the hobbit')).map((book) => book.title);

    expect(titles).toContain('The Hobbit'); // edition title "The  Hobbit" (double space)
    expect(titles).toContain('The Hobbit Companion'); // edition title "Hobbit Companion, The"
  });

  it('omits the ISBN for editions that have none', async () => {
    const { catalog } = catalogReturning(jsonResponse(searchFixture));

    const play = (await catalog.search('the hobbit')).find((book) => book.publishedYear === 1968);

    expect(play).toBeDefined();
    expect(play).not.toHaveProperty('isbn13');
  });

  it('sends the query, field list, limit and language', async () => {
    const { catalog, requestedUrl } = catalogReturning(jsonResponse(searchFixture));

    await catalog.search('  the hobbit ');

    const url = requestedUrl();
    expect(url.origin + url.pathname).toBe('https://openlibrary.org/search.json');
    expect(url.searchParams.get('q')).toBe('the hobbit');
    expect(url.searchParams.get('limit')).toBe('20');
    expect(url.searchParams.get('lang')).toBe('en');
    expect(url.searchParams.get('fields')).toContain('editions.isbn');
    expect(url.searchParams.get('fields')).toContain('subject');
  });

  it('sends configured headers (e.g. User-Agent on native)', async () => {
    const { catalog, requestInit } = catalogReturning(jsonResponse(searchFixture), {
      'User-Agent': 'Fandex/test',
    });

    await catalog.search('hobbit');

    expect(requestInit()?.headers).toEqual({
      Accept: 'application/json',
      'User-Agent': 'Fandex/test',
    });
  });

  it('returns no results for a blank query without calling the API', async () => {
    const { catalog, fetch } = catalogReturning(jsonResponse(searchFixture));

    await expect(catalog.search('   ')).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('falls back to work data when the edition lacks fields', async () => {
    const { catalog } = catalogReturning(
      oneWork({
        key: '/works/OL1W',
        title: 'Work Title',
        subtitle: 'Work Subtitle',
        first_publish_year: 1937,
        cover_i: 42,
        editions: { docs: [{ key: '/books/OL1M' }] },
      }),
    );

    const [book] = await catalog.search('x');

    expect(book).toEqual({
      source: 'openlibrary',
      externalId: 'OL1M',
      category: 'book',
      title: 'Work Title',
      subtitle: 'Work Subtitle',
      authors: [],
      publishedYear: 1937,
      coverUrl: 'https://covers.openlibrary.org/b/id/42-M.jpg',
    });
  });

  it('uses the work itself when there is no edition', async () => {
    const { catalog } = catalogReturning(oneWork({ key: '/works/OL1W', title: 'Only a Work' }));

    const [book] = await catalog.search('x');

    expect(book).toMatchObject({ externalId: 'OL1W', title: 'Only a Work' });
  });

  it('converts an ISBN-10-only edition to ISBN-13', async () => {
    const { catalog } = catalogReturning(
      oneWork({ key: '/works/OL1W', title: 'T', editions: { docs: [{ isbn: ['0306406152'] }] } }),
    );

    const [book] = await catalog.search('x');

    expect(book?.isbn13).toBe('9780306406157');
  });

  it('skips results without a title and ignores missing or invalid cover ids', async () => {
    const { catalog } = catalogReturning(
      jsonResponse({
        docs: [
          { key: '/works/OL1W', title: '   ' },
          { key: '/works/OL2W', title: 'No cover', cover_i: -1 },
        ],
      }),
    );

    const results = await catalog.search('x');

    expect(results).toHaveLength(1);
    expect(results[0]).not.toHaveProperty('coverUrl');
  });

  it('treats a response without docs as no results', async () => {
    const { catalog } = catalogReturning(jsonResponse({}));

    await expect(catalog.search('x')).resolves.toEqual([]);
  });
});

describe('OpenLibraryCatalog.lookupIsbn', () => {
  it('returns the matching edition', async () => {
    const { catalog, requestedUrl } = catalogReturning(jsonResponse(isbnFixture));

    const book = await catalog.lookupIsbn(isbn('9780345445605'));

    expect(requestedUrl().searchParams.get('q')).toBe('isbn:9780345445605');
    expect(book).toEqual({
      source: 'openlibrary',
      externalId: 'OL22039557M',
      // Chuck Dixon's graphic-novel adaptation, not Tolkien's novel.
      category: 'comic',
      title: 'The Hobbit',
      authors: ['Charles Dixon', 'Sean Deming', 'J.R.R. Tolkien'],
      publishedYear: 2001,
      publisher: 'Ballantine Books',
      isbn13: '9780345445605',
      coverUrl: 'https://covers.openlibrary.org/b/id/8406778-M.jpg',
    });
  });

  it.each([
    ['One Piece v1', onePieceFixture, '9781569319017', 'manga'],
    ['Batman: Year One', batmanFixture, '9781401207526', 'comic'],
  ] as const)('classifies %s as %s', async (_, fixture, value, category) => {
    const { catalog } = catalogReturning(jsonResponse(fixture));

    await expect(catalog.lookupIsbn(isbn(value))).resolves.toMatchObject({ category });
  });

  it('returns null when Open Library does not know the ISBN', async () => {
    const { catalog } = catalogReturning(jsonResponse(notFoundFixture));

    await expect(catalog.lookupIsbn(isbn('9791999999994'))).resolves.toBeNull();
  });

  it('records the requested ISBN even if the edition only lists ISBN-10', async () => {
    const { catalog } = catalogReturning(
      oneWork({ key: '/works/OL1W', title: 'T', editions: { docs: [{ key: '/books/OL1M' }] } }),
    );

    const book = await catalog.lookupIsbn(isbn('9780306406157'));

    expect(book?.isbn13).toBe('9780306406157');
  });
});

describe('OpenLibraryCatalog errors', () => {
  it('reports rate limiting', async () => {
    const { catalog } = catalogReturning(jsonResponse({}, 429));

    await expect(catalog.search('x')).rejects.toMatchObject({
      name: 'CatalogError',
      kind: 'rate-limited',
      status: 429,
    });
  });

  it('reports other HTTP errors with their status', async () => {
    const { catalog } = catalogReturning(jsonResponse({}, 503));

    await expect(catalog.search('x')).rejects.toMatchObject({ kind: 'http', status: 503 });
  });

  it('reports network failures', async () => {
    const { catalog } = catalogReturning(() => Promise.reject(new TypeError('Failed to fetch')));

    const error: unknown = await catalog.search('x').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CatalogError);
    expect(error).toMatchObject({ source: 'openlibrary', kind: 'network' });
  });

  it('reports an unreadable body', async () => {
    const { catalog } = catalogReturning(new Response('<html>oops</html>', { status: 200 }));

    await expect(catalog.search('x')).rejects.toMatchObject({ kind: 'invalid-response' });
  });

  it('passes the abort signal through and lets aborts propagate unwrapped', async () => {
    const controller = new AbortController();
    const { catalog, requestInit } = catalogReturning(() => {
      controller.abort();
      return Promise.reject(controller.signal.reason);
    });

    const error: unknown = await catalog
      .search('x', { signal: controller.signal })
      .catch((e: unknown) => e);

    expect(requestInit()?.signal).toBe(controller.signal);
    expect(error).not.toBeInstanceOf(CatalogError);
    expect(error).toMatchObject({ name: 'AbortError' });
  });
});
