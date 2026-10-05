import type { CatalogRequestOptions } from './book-catalog';
import type { CatalogSet } from './catalog-set';

/** A searchable source of LEGO sets (Rebrickable). */
export interface LegoCatalog {
  /** Search by name or set number; merchandise without pieces (bags, keychains) is excluded. */
  searchSets(query: string, options?: CatalogRequestOptions): Promise<CatalogSet[]>;
  /** Exact lookup by Rebrickable set number ("75192-1"); null if unknown. */
  lookupSet(setNum: string, options?: CatalogRequestOptions): Promise<CatalogSet | null>;
}
