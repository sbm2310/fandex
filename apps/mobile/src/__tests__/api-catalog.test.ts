import { CatalogError, parseIsbn, type Isbn13 } from '@fandex/core';

import { ApiCatalog } from '@/services/api-catalog';
import type { ApiFetch } from '@/services/api-fetch';

const onePiece = {
  id: '0199b5a0-7c1e-7a3b-9f00-1234567890ab',
  category: 'manga',
  source: 'openlibrary',
  externalId: 'OL9218212M',
  title: 'One Piece, Vol. 1',
  subtitle: 'Romance Dawn',
  creators: ['Eiichiro Oda'],
  year: 2003,
  publisher: 'SHONEN JUMP',
  isbn13: '9781569319017',
  coverUrl: 'https://covers.openlibrary.org/b/id/1-M.jpg',
};

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

function catalogWith(handler: ApiFetch) {
  const apiFetch = jest.fn(handler);
  return { catalog: new ApiCatalog(apiFetch), apiFetch };
}

describe('ApiCatalog', () => {
  it('searches through the API and maps items to books with our catalog id', async () => {
    const { catalog, apiFetch } = catalogWith(() => json({ items: [onePiece] }));

    const [book] = await catalog.search('  one piece ');

    expect(apiFetch).toHaveBeenCalledWith('/catalog/search?q=one%20piece', {});
    expect(book).toEqual({
      source: 'openlibrary',
      externalId: 'OL9218212M',
      category: 'manga',
      catalogId: onePiece.id,
      title: 'One Piece, Vol. 1',
      subtitle: 'Romance Dawn',
      authors: ['Eiichiro Oda'],
      publishedYear: 2003,
      publisher: 'SHONEN JUMP',
      isbn13: '9781569319017',
      coverUrl: onePiece.coverUrl,
    });
  });

  it('skips non-book categories (LEGO has its own screens)', async () => {
    const lego = {
      ...onePiece,
      id: '0199b5a0-7c1e-7a3b-9f00-1234567890ac',
      category: 'lego',
      source: 'rebrickable',
    };
    const { catalog } = catalogWith(() => json({ items: [lego, onePiece] }));

    await expect(catalog.search('one piece')).resolves.toHaveLength(1);
  });

  it('does not call the API for very short queries', async () => {
    const { catalog, apiFetch } = catalogWith(() => json({ items: [] }));

    await expect(catalog.search(' a ')).resolves.toEqual([]);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('looks up an ISBN, returning null when the API says 404', async () => {
    const isbn = parseIsbn('9781569319017') as Isbn13;
    const found = catalogWith(() => json(onePiece));
    const missing = catalogWith(() => json({ message: 'Not found' }, 404));

    await expect(found.catalog.lookupIsbn(isbn)).resolves.toMatchObject({ category: 'manga' });
    expect(found.apiFetch).toHaveBeenCalledWith('/catalog/isbn/9781569319017', {});
    await expect(missing.catalog.lookupIsbn(isbn)).resolves.toBeNull();
  });

  it.each([
    [502, 'http'],
    [500, 'http'],
    [503, 'rate-limited'],
  ] as const)('maps HTTP %d to a %s CatalogError', async (status, kind) => {
    const { catalog } = catalogWith(() => json({}, status));

    await expect(catalog.search('one piece')).rejects.toMatchObject({
      name: 'CatalogError',
      source: 'fandex-api',
      kind,
    });
  });

  it('reports an unreachable API as a network error', async () => {
    const { catalog } = catalogWith(() => Promise.reject(new TypeError('Network request failed')));

    const error: unknown = await catalog.search('one piece').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CatalogError);
    expect(error).toMatchObject({ kind: 'network' });
  });

  it('passes the abort signal and lets aborts through unwrapped', async () => {
    const controller = new AbortController();
    const { catalog, apiFetch } = catalogWith(() => {
      controller.abort();
      return Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    });

    const error: unknown = await catalog
      .search('one piece', { signal: controller.signal })
      .catch((e: unknown) => e);

    expect(apiFetch).toHaveBeenCalledWith(expect.any(String), { signal: controller.signal });
    expect(error).not.toBeInstanceOf(CatalogError);
  });

  it('rejects responses that break the contract', async () => {
    const { catalog } = catalogWith(() => json({ items: [{ title: 'no id' }] }));

    await expect(catalog.search('one piece')).rejects.toThrow();
  });
});
