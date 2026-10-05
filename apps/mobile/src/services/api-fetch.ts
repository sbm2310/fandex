import { Platform } from 'react-native';

/** Returns the session cookie on native (kept in secure storage by the auth client). */
export type GetSessionCookie = () => Promise<string | null | undefined> | string | null | undefined;

export type ApiFetch = (path: string, init?: RequestInit) => Promise<Response>;

/**
 * Fetches the Fandex API with the session attached the right way for each platform:
 * - native: the cookie comes from secure storage and is sent as a header (no cookie jar);
 * - web: the browser sends its cookie; cross-origin requests need credentials included.
 */
export function createApiFetch(
  apiUrl: string,
  getSessionCookie: GetSessionCookie,
  {
    fetch: fetchImpl = fetch,
    platform = Platform.OS,
  }: { fetch?: typeof fetch; platform?: string } = {},
): ApiFetch {
  return async (path, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (platform !== 'web') {
      const cookie = await getSessionCookie();
      if (cookie) headers.set('Cookie', cookie);
    }
    return fetchImpl(`${apiUrl}${path}`, {
      ...init,
      headers,
      credentials: platform === 'web' ? 'include' : 'omit',
    });
  };
}
