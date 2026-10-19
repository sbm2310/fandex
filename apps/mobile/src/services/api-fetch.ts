import { Platform } from 'react-native';

/** Returns the session cookie on native (kept in secure storage by the auth client). */
export type GetSessionCookie = () => Promise<string | null | undefined> | string | null | undefined;

export type ApiFetch = (path: string, init?: RequestInit) => Promise<Response>;

const unauthorizedListeners = new Set<() => void>();

/**
 * Called when the API answers 401: the session ended elsewhere (signed out from another
 * device, password changed). The root layout re-reads the current user, so the app shows
 * itself signed out at once instead of failing requests until the next check.
 */
export function onApiUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

/**
 * Fetches the Fandex API (routes under /api) with the session attached the right way for
 * each platform:
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
    const response = await fetchImpl(`${apiUrl}/api${path}`, {
      ...init,
      headers,
      credentials: platform === 'web' ? 'include' : 'omit',
    });
    if (response.status === 401) unauthorizedListeners.forEach((listener) => listener());
    return response;
  };
}
