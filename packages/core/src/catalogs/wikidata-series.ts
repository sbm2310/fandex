import type { CatalogRequestOptions } from '../book-catalog';
import { CatalogError } from './catalog-error';

/**
 * Book series from Wikidata (https://query.wikidata.org): free, no key, data CC0. Fandex
 * starts from a book the user owns: its Open Library work id (`P648`, the `workKey` owned books
 * store) leads to its series (`P179`) and every member's place in it (`P1545`), Open Library
 * work id and publication date (`P577`).
 *
 * Usage rules: a descriptive User-Agent (Wikimedia's policy; clients without one get
 * blocked), at most 5 parallel queries and 60 s of query time per minute per client (HTTP 429
 * with Retry-After beyond that). Callers cache results and ask one work at a time.
 */

export type SeriesEntry = {
  /** The Wikidata item ("Q1234"). */
  wikidataId: string;
  title: string;
  /** Open Library work id ("OL16813053W"), when Wikidata has one. */
  workKey?: string;
  /** The place in the series: 1, 2… for the main line; 0.5 or 3.1 for side stories. */
  ordinal?: number;
  /** First publication, YYYY-MM-DD (Wikidata stores year-only dates as January 1). */
  published?: string;
};

export type BookSeries = {
  wikidataId: string;
  name: string;
  /** The main line: whole-number places 1, 2, 3…, in order (one entry per place). */
  entries: SeriesEntry[];
  /** Everything else in the series: novellas, prequels, unnumbered companions. */
  extras: SeriesEntry[];
};

export type WikidataSeriesCatalogOptions = {
  /** Injected for tests; defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Required by Wikimedia: who is asking and how to reach them. */
  userAgent: string;
  endpoint?: string;
};

const WORK_KEY = /^OL\d+W$/;

/**
 * The SPARQL query for a work's series. Members must be literary works (`P31/P279*
 * Q7725634`), or the films and TV seasons of the same series join in.
 */
export function seriesQuery(workKey: string): string {
  if (!WORK_KEY.test(workKey)) throw new Error(`Not an Open Library work id: ${workKey}`);
  return `SELECT ?series ?seriesLabel ?bookOrdinal ?member ?memberLabel ?ordinal ?workKey ?published WHERE {
  ?book wdt:P648 "${workKey}" ; p:P179 ?bookStatement .
  ?bookStatement ps:P179 ?series .
  OPTIONAL { ?bookStatement pq:P1545 ?bookOrdinal }
  ?member p:P179 ?memberStatement .
  ?memberStatement ps:P179 ?series .
  ?member wdt:P31/wdt:P279* wd:Q7725634 .
  OPTIONAL { ?memberStatement pq:P1545 ?ordinal }
  OPTIONAL { ?member wdt:P648 ?workKey }
  OPTIONAL { ?member wdt:P577 ?published }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
}`;
}

type Binding = Record<string, { value: string } | undefined>;
type SparqlResponse = { results?: { bindings?: Binding[] } };

const qid = (uri: string | undefined) => uri?.slice(uri.lastIndexOf('/') + 1);

export class WikidataSeriesCatalog {
  private readonly fetch: typeof fetch;
  private readonly headers: Record<string, string>;
  private readonly endpoint: string;

  constructor(options: WikidataSeriesCatalogOptions) {
    this.fetch = options.fetch ?? fetch.bind(globalThis);
    this.headers = { Accept: 'application/sparql-results+json', 'User-Agent': options.userAgent };
    this.endpoint = options.endpoint ?? 'https://query.wikidata.org/sparql';
  }

  /** The series this work belongs to, or null when Wikidata knows none. */
  async seriesForWork(
    workKey: string,
    options: CatalogRequestOptions = {},
  ): Promise<BookSeries | null> {
    const url = `${this.endpoint}?${new URLSearchParams({ query: seriesQuery(workKey), format: 'json' })}`;
    let response: Response;
    try {
      response = await this.fetch(url, {
        headers: this.headers,
        ...(options.signal && { signal: options.signal }),
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new CatalogError('wikidata', 'network', 'Could not reach Wikidata', undefined, {
        cause: error,
      });
    }
    if (response.status === 429) {
      throw new CatalogError('wikidata', 'rate-limited', 'Wikidata rate limit hit', 429);
    }
    if (!response.ok) {
      throw new CatalogError(
        'wikidata',
        'http',
        `Wikidata responded ${response.status}`,
        response.status,
      );
    }
    let body: SparqlResponse;
    try {
      body = (await response.json()) as SparqlResponse;
    } catch (error) {
      throw new CatalogError(
        'wikidata',
        'invalid-response',
        'Wikidata returned an unreadable response',
        response.status,
        { cause: error },
      );
    }
    return parseSeriesResponse(body.results?.bindings ?? []);
  }
}

function ordinalOf(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+(\.\d+)?$/.test(value.trim())) return undefined;
  return Number(value);
}

const isWhole = (ordinal: number | undefined): ordinal is number =>
  ordinal !== undefined && Number.isInteger(ordinal) && ordinal >= 1;

/**
 * The SPARQL rows as a series. A work can be in several series (Mistborn and the Cosmere):
 * the one it's numbered in wins, then the one with the most numbered books. Each place in the
 * main line keeps one entry, preferring one with an Open Library work id.
 */
export function parseSeriesResponse(rows: readonly Binding[]): BookSeries | null {
  type Candidate = { name: string; numbered: boolean; members: Map<string, SeriesEntry> };
  const bySeries = new Map<string, Candidate>();

  for (const row of rows) {
    const seriesId = qid(row.series?.value);
    const memberId = qid(row.member?.value);
    if (!seriesId || !memberId) continue;
    const candidate = bySeries.get(seriesId) ?? {
      name: row.seriesLabel?.value ?? seriesId,
      numbered: false,
      members: new Map<string, SeriesEntry>(),
    };
    if (isWhole(ordinalOf(row.bookOrdinal?.value))) candidate.numbered = true;

    const entry = candidate.members.get(memberId) ?? {
      wikidataId: memberId,
      title: row.memberLabel?.value ?? memberId,
    };
    const workKey = row.workKey?.value;
    if (workKey && WORK_KEY.test(workKey) && !entry.workKey) entry.workKey = workKey;
    const ordinal = ordinalOf(row.ordinal?.value);
    if (ordinal !== undefined && entry.ordinal === undefined) entry.ordinal = ordinal;
    const published = row.published?.value?.slice(0, 10);
    // The earliest date when Wikidata lists several (first publication).
    if (
      published &&
      /^\d{4}-\d{2}-\d{2}$/.test(published) &&
      (!entry.published || published < entry.published)
    ) {
      entry.published = published;
    }
    candidate.members.set(memberId, entry);
    bySeries.set(seriesId, candidate);
  }

  const numberedCount = (c: Candidate) =>
    [...c.members.values()].filter((entry) => isWhole(entry.ordinal)).length;
  const [chosen] = [...bySeries.entries()].sort(
    ([, a], [, b]) =>
      Number(b.numbered) - Number(a.numbered) || numberedCount(b) - numberedCount(a),
  );
  if (!chosen) return null;
  const [wikidataId, candidate] = chosen;

  const entries = new Map<number, SeriesEntry>();
  const extras: SeriesEntry[] = [];
  for (const entry of candidate.members.values()) {
    if (!isWhole(entry.ordinal)) {
      extras.push(entry);
      continue;
    }
    const current = entries.get(entry.ordinal);
    if (!current || (!current.workKey && entry.workKey)) {
      if (current) extras.push(current);
      entries.set(entry.ordinal, entry);
    } else {
      extras.push(entry);
    }
  }
  if (entries.size === 0) return null;

  const byOrdinal = (a: SeriesEntry, b: SeriesEntry) =>
    (a.ordinal ?? Infinity) - (b.ordinal ?? Infinity) || a.title.localeCompare(b.title);
  return {
    wikidataId,
    name: candidate.name,
    entries: [...entries.values()].sort(byOrdinal),
    extras: extras.sort(byOrdinal),
  };
}
