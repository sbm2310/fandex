import type { CatalogSource } from '../catalog-book';

export type CatalogErrorKind = 'network' | 'rate-limited' | 'http' | 'invalid-response';

/** A catalog request failed. Aborted requests are not wrapped; they keep their AbortError. */
export class CatalogError extends Error {
  override readonly name = 'CatalogError';

  constructor(
    /** The external catalog, or the Fandex API when the app reaches catalogs through it. */
    readonly source: CatalogSource | 'fandex-api',
    readonly kind: CatalogErrorKind,
    message: string,
    readonly status?: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}
