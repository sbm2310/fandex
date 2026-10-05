import { createApiFetch } from '@/services/api-fetch';

const ok = () => Promise.resolve(new Response('{}', { status: 200 }));
const fakeFetch = () => jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(ok);

describe('createApiFetch', () => {
  it('on native, sends the stored session cookie and no browser credentials', async () => {
    const fetch = fakeFetch();
    const apiFetch = createApiFetch('http://api.test', () => 'better-auth.session_token=abc', {
      fetch,
      platform: 'ios',
    });

    await apiFetch('/me');

    const [url, init = {}] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('http://api.test/me');
    expect(new Headers(init.headers).get('Cookie')).toBe('better-auth.session_token=abc');
    expect(init.credentials).toBe('omit');
  });

  it('on native, sends no cookie header when signed out', async () => {
    const fetch = fakeFetch();
    const apiFetch = createApiFetch('http://api.test', async () => null, {
      fetch,
      platform: 'ios',
    });

    await apiFetch('/catalog/search?q=x');

    const init = fetch.mock.calls[0]?.[1] ?? {};
    expect(new Headers(init.headers).has('Cookie')).toBe(false);
  });

  it('on web, lets the browser send its cookie (credentials included)', async () => {
    const fetch = fakeFetch();
    const getCookie = jest.fn(() => 'ignored');
    const apiFetch = createApiFetch('http://api.test', getCookie, { fetch, platform: 'web' });

    await apiFetch('/me');

    const init = fetch.mock.calls[0]?.[1] ?? {};
    expect(init.credentials).toBe('include');
    expect(new Headers(init.headers).has('Cookie')).toBe(false);
    expect(getCookie).not.toHaveBeenCalled();
  });
});
