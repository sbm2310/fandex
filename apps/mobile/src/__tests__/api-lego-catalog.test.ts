import type { ApiFetch } from '@/services/api-fetch';
import { ApiLegoCatalog } from '@/services/api-lego-catalog';

const falconItem = {
  id: '0199b5a0-7c1e-7a3b-9f00-1234567890ad',
  category: 'lego',
  source: 'rebrickable',
  externalId: '75192-1',
  title: 'Millennium Falcon',
  creators: [],
  year: 2017,
  setNumber: '75192',
  pieceCount: 7541,
  theme: 'Star Wars',
  subtheme: 'Ultimate Collector Series',
};

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('ApiLegoCatalog', () => {
  it('searches with kind=lego and maps sets', async () => {
    const apiFetch = jest.fn<ReturnType<ApiFetch>, Parameters<ApiFetch>>(() =>
      json({ items: [falconItem] }),
    );

    const [set] = await new ApiLegoCatalog(apiFetch).searchSets(' millennium falcon ');

    expect(apiFetch).toHaveBeenCalledWith('/catalog/search?q=millennium%20falcon&kind=lego', {});
    expect(set).toEqual({
      source: 'rebrickable',
      externalId: '75192-1',
      category: 'lego',
      catalogId: falconItem.id,
      title: 'Millennium Falcon',
      setNumber: '75192',
      year: 2017,
      pieceCount: 7541,
      theme: 'Star Wars',
      subtheme: 'Ultimate Collector Series',
    });
  });

  it('looks up a set, returning null for 404', async () => {
    const found = jest.fn<ReturnType<ApiFetch>, Parameters<ApiFetch>>(() => json(falconItem));
    const missing = jest.fn<ReturnType<ApiFetch>, Parameters<ApiFetch>>(() => json({}, 404));

    await expect(new ApiLegoCatalog(found).lookupSet('75192-1')).resolves.toMatchObject({
      setNumber: '75192',
    });
    expect(found).toHaveBeenCalledWith('/catalog/lego/75192-1', {});
    await expect(new ApiLegoCatalog(missing).lookupSet('1-1')).resolves.toBeNull();
  });

  it('reports a 503 (LEGO not set up, or busy) as a CatalogError', async () => {
    const apiFetch = jest.fn<ReturnType<ApiFetch>, Parameters<ApiFetch>>(() => json({}, 503));

    await expect(new ApiLegoCatalog(apiFetch).searchSets('falcon')).rejects.toMatchObject({
      name: 'CatalogError',
    });
  });
});
