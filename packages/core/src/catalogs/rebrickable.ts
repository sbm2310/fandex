import type { CatalogRequestOptions } from '../book-catalog';
import { displaySetNumber, type CatalogSet } from '../catalog-set';
import type { LegoCatalog } from '../lego-catalog';
import { CatalogError } from './catalog-error';

/**
 * Rebrickable (https://rebrickable.com/api/) — LEGO sets, themes and images.
 *
 * Usage rules worth knowing (terms checked 2026-10-05):
 * - The API "may be used for any purpose, including commercial"; crediting Rebrickable is
 *   appreciated. Set images may be shown in apps (hotlinked from their CDN).
 * - No scraping or automated downloading outside the API; no use of their content to train AI.
 * - Requires an API key (free account). Throttled to about 1 request/second.
 */

export type RebrickableCatalogOptions = {
  apiKey: string;
  /** Injected for tests; defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Maximum search results (default 20). */
  searchLimit?: number;
  baseUrl?: string;
  /** How long the theme list is cached (default 24 h). */
  themeCacheMs?: number;
  now?: () => number;
};

type SetDoc = {
  set_num?: string;
  name?: string;
  year?: number;
  theme_id?: number;
  num_parts?: number;
  set_img_url?: string | null;
};

type ThemeDoc = { id: number; parent_id: number | null; name: string };

export class RebrickableCatalog implements LegoCatalog {
  private readonly fetch: typeof fetch;
  private readonly apiKey: string;
  private readonly searchLimit: number;
  private readonly baseUrl: string;
  private readonly themeCacheMs: number;
  private readonly now: () => number;
  private themes: { byId: Map<number, ThemeDoc>; loadedAt: number } | null = null;
  private themesLoading: Promise<Map<number, ThemeDoc>> | null = null;

  constructor(options: RebrickableCatalogOptions) {
    this.fetch = options.fetch ?? fetch.bind(globalThis);
    this.apiKey = options.apiKey;
    this.searchLimit = options.searchLimit ?? 20;
    this.baseUrl = options.baseUrl ?? 'https://rebrickable.com/api/v3/lego';
    this.themeCacheMs = options.themeCacheMs ?? 24 * 60 * 60 * 1000;
    this.now = options.now ?? Date.now;
  }

  async searchSets(query: string, options: CatalogRequestOptions = {}): Promise<CatalogSet[]> {
    const q = query.trim();
    if (!q) return [];
    const params = new URLSearchParams({
      search: q,
      // Merchandise (bags, keychains, books) has no pieces; it isn't a set.
      min_parts: '1',
      page_size: String(this.searchLimit),
    });
    const body = await this.request<{ results?: SetDoc[] }>(`/sets/?${params.toString()}`, options);
    const themes = await this.loadThemes(options);
    return (body?.results ?? []).flatMap((doc) => {
      const set = toCatalogSet(doc, themes);
      return set ? [set] : [];
    });
  }

  async lookupSet(setNum: string, options: CatalogRequestOptions = {}): Promise<CatalogSet | null> {
    const doc = await this.request<SetDoc>(`/sets/${encodeURIComponent(setNum)}/`, options, {
      allowNotFound: true,
    });
    if (!doc) return null;
    return toCatalogSet(doc, await this.loadThemes(options));
  }

  /** All ~500 themes come back in one call; cached so set lookups don't need extra requests. */
  private async loadThemes(options: CatalogRequestOptions): Promise<Map<number, ThemeDoc>> {
    if (this.themes && this.now() - this.themes.loadedAt < this.themeCacheMs)
      return this.themes.byId;
    this.themesLoading ??= this.request<{ results?: ThemeDoc[] }>(
      '/themes/?page_size=1000',
      options,
    )
      .then((body) => {
        const byId = new Map((body?.results ?? []).map((theme) => [theme.id, theme]));
        this.themes = { byId, loadedAt: this.now() };
        return byId;
      })
      .finally(() => {
        this.themesLoading = null;
      });
    return this.themesLoading;
  }

  private async request<T>(
    path: string,
    { signal }: CatalogRequestOptions,
    { allowNotFound = false } = {},
  ): Promise<T | null> {
    let response: Response;
    try {
      response = await this.fetch(`${this.baseUrl}${path}`, {
        headers: { Accept: 'application/json', Authorization: `key ${this.apiKey}` },
        ...(signal && { signal }),
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new CatalogError('rebrickable', 'network', 'Could not reach Rebrickable', undefined, {
        cause: error,
      });
    }
    if (allowNotFound && response.status === 404) return null;
    if (response.status === 429) {
      throw new CatalogError('rebrickable', 'rate-limited', 'Rebrickable rate limit hit', 429);
    }
    if (!response.ok) {
      throw new CatalogError(
        'rebrickable',
        'http',
        `Rebrickable responded ${response.status}`,
        response.status,
      );
    }
    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new CatalogError(
        'rebrickable',
        'invalid-response',
        'Unreadable Rebrickable response',
        response.status,
        {
          cause: error,
        },
      );
    }
  }
}

function toCatalogSet(doc: SetDoc, themes: Map<number, ThemeDoc>): CatalogSet | null {
  const title = doc.name?.trim();
  if (!doc.set_num || !title) return null;
  const set: CatalogSet = {
    source: 'rebrickable',
    externalId: doc.set_num,
    category: 'lego',
    title,
    setNumber: displaySetNumber(doc.set_num),
  };
  if (doc.year) set.year = doc.year;
  if (doc.num_parts) set.pieceCount = doc.num_parts;
  if (doc.set_img_url) set.coverUrl = doc.set_img_url;

  const [theme, ...rest] = themePath(doc.theme_id, themes);
  if (theme) set.theme = theme;
  const subtheme = rest.at(-1);
  if (subtheme) set.subtheme = subtheme;
  return set;
}

/** Theme names from the top level down, e.g. ["Star Wars", "Ultimate Collector Series"]. */
function themePath(themeId: number | undefined, themes: Map<number, ThemeDoc>): string[] {
  const path: string[] = [];
  let current = themeId === undefined ? undefined : themes.get(themeId);
  // Guard against cycles in external data.
  while (current && path.length < 10) {
    path.unshift(current.name);
    current = current.parent_id === null ? undefined : themes.get(current.parent_id);
  }
  return path;
}
