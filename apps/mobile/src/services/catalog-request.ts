import { CatalogError, type CatalogRequestOptions } from '@fandex/core';

import type { ApiFetch } from './api-fetch';

/**
 * Calls a catalog endpoint on the Fandex API, turning failures into CatalogErrors the screens
 * know how to explain. Aborted requests are re-thrown unchanged.
 */
export async function requestCatalog(
  apiFetch: ApiFetch,
  path: string,
  { signal }: CatalogRequestOptions,
  { allowNotFound = false } = {},
): Promise<Response> {
  let response: Response;
  try {
    response = await apiFetch(path, signal ? { signal } : {});
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new CatalogError('fandex-api', 'network', 'Could not reach the Fandex API', undefined, {
      cause: error,
    });
  }
  if (response.ok || (allowNotFound && response.status === 404)) return response;
  if (response.status === 503 || response.status === 429) {
    throw new CatalogError('fandex-api', 'rate-limited', 'The catalog is busy', response.status);
  }
  throw new CatalogError(
    'fandex-api',
    'http',
    `Catalog request failed (${response.status})`,
    response.status,
  );
}
