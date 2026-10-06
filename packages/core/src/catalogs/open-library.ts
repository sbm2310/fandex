import type { BookCatalog, CatalogRequestOptions } from '../book-catalog';
import { formatTitle, type CatalogBook } from '../catalog-book';
import { classifyBookCategory } from '../classify-book-category';
import { parseIsbn, type Isbn13 } from '../isbn';
import { CatalogError } from './catalog-error';

/**
 * Open Library (https://openlibrary.org/developers/api) — free, keyless and CORS-enabled.
 *
 * Usage rules worth knowing:
 * - Rate limit: 1 request/second, or 3/second when the app identifies itself with a
 *   `User-Agent` such as `Fandex/0.1 (https://github.com/sbm2310/fandex)`. Browsers don't
 *   allow setting User-Agent, so only native clients pass it (see `headers`).
 * - Cache responses and only make requests on behalf of a person (no bulk crawling).
 * - Cover URLs by ISBN are limited to 100 per IP per 5 minutes; by cover ID they aren't,
 *   so we always build cover URLs from cover IDs.
 *
 * Both operations use the search endpoint. Search results are *works* (e.g. "The Hobbit"),
 * each carrying its best-matching *edition* (a specific printing with its own ISBN, publisher
 * and cover). Collectors own editions, so we map each result to that edition and fall back
 * to work-level data where the edition lacks a field.
 */

export type OpenLibraryCatalogOptions = {
  /** Injected for tests; defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Extra request headers, e.g. `User-Agent` on native platforms. */
  headers?: Record<string, string>;
  /** Maximum search results (default 20). */
  searchLimit?: number;
  baseUrl?: string;
  coversBaseUrl?: string;
};

const FIELDS = [
  'key',
  'title',
  'subtitle',
  'author_name',
  'first_publish_year',
  'cover_i',
  'subject',
  // Characters and places, for universe matching.
  'person',
  'place',
  'editions',
  'editions.key',
  'editions.title',
  'editions.subtitle',
  'editions.isbn',
  'editions.publisher',
  'editions.publish_year',
  'editions.cover_i',
].join(',');

/** The subset of a search.json response we read. Everything is optional: it's external data. */
type SearchResponse = { docs?: WorkDoc[] };

type WorkDoc = {
  key?: string;
  title?: string;
  subtitle?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  subject?: string[];
  person?: string[];
  place?: string[];
  editions?: { docs?: EditionDoc[] };
};

type EditionDoc = {
  key?: string;
  title?: string;
  subtitle?: string;
  isbn?: string[];
  publisher?: string[];
  publish_year?: number[];
  cover_i?: number;
};

export class OpenLibraryCatalog implements BookCatalog {
  private readonly fetch: typeof fetch;
  private readonly headers: Record<string, string>;
  private readonly searchLimit: number;
  private readonly baseUrl: string;
  private readonly coversBaseUrl: string;

  constructor(options: OpenLibraryCatalogOptions = {}) {
    // Bind so the global fetch isn't called with the catalog as `this` (throws in browsers).
    this.fetch = options.fetch ?? fetch.bind(globalThis);
    this.headers = { Accept: 'application/json', ...options.headers };
    this.searchLimit = options.searchLimit ?? 20;
    this.baseUrl = options.baseUrl ?? 'https://openlibrary.org';
    this.coversBaseUrl = options.coversBaseUrl ?? 'https://covers.openlibrary.org';
  }

  async search(query: string, options: CatalogRequestOptions = {}): Promise<CatalogBook[]> {
    const q = query.trim();
    if (!q) return [];

    const response = await this.request(
      { q, fields: FIELDS, limit: String(this.searchLimit), lang: 'en' },
      options,
    );
    return (response.docs ?? []).flatMap((doc) => {
      const book = this.toCatalogBook(doc);
      return book ? [book] : [];
    });
  }

  async lookupIsbn(isbn: Isbn13, options: CatalogRequestOptions = {}): Promise<CatalogBook | null> {
    const response = await this.request({ q: `isbn:${isbn}`, fields: FIELDS, limit: '1' }, options);
    const doc = response.docs?.[0];
    if (!doc?.editions?.docs?.[0]) return null;

    const book = this.toCatalogBook(doc);
    // The query matched this exact ISBN, so record it even if the edition lists only ISBN-10.
    return book && { ...book, isbn13: isbn };
  }

  private async request(
    params: Record<string, string>,
    { signal }: CatalogRequestOptions,
  ): Promise<SearchResponse> {
    const url = `${this.baseUrl}/search.json?${new URLSearchParams(params).toString()}`;

    let response: Response;
    try {
      response = await this.fetch(url, { headers: this.headers, ...(signal && { signal }) });
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) throw error;
      throw new CatalogError('openlibrary', 'network', 'Could not reach Open Library', undefined, {
        cause: error,
      });
    }

    if (response.status === 429) {
      throw new CatalogError('openlibrary', 'rate-limited', 'Open Library rate limit hit', 429);
    }
    if (!response.ok) {
      throw new CatalogError(
        'openlibrary',
        'http',
        `Open Library responded ${response.status}`,
        response.status,
      );
    }

    try {
      const body: unknown = await response.json();
      if (typeof body !== 'object' || body === null) throw new Error('Body is not an object');
      return body as SearchResponse;
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) throw error;
      throw new CatalogError(
        'openlibrary',
        'invalid-response',
        'Open Library returned an unreadable response',
        response.status,
        { cause: error },
      );
    }
  }

  private toCatalogBook(work: WorkDoc): CatalogBook | null {
    const edition = work.editions?.docs?.[0];
    const title = cleanTitle(edition?.title) ?? cleanTitle(work.title);
    const key = edition?.key ?? work.key;
    if (!title || !key) return null;

    const book: CatalogBook = {
      source: 'openlibrary',
      externalId: key.replace(/^\/(books|works)\//, ''),
      // Set below, once the edition's publisher is known.
      category: 'book',
      title,
      authors: (work.author_name ?? []).map(cleanText).filter(isPresent),
    };

    const subtitle = cleanText(edition?.subtitle) ?? cleanText(work.subtitle);
    if (subtitle) book.subtitle = subtitle;

    const year = edition?.publish_year?.[0] ?? work.first_publish_year;
    if (year) book.publishedYear = year;

    const publisher = cleanText(edition?.publisher?.[0]);
    if (publisher) book.publisher = publisher;
    book.category = classifyBookCategory({ subjects: work.subject, publisher });

    const isbn13 = (edition?.isbn ?? []).map(parseIsbn).find(isPresent);
    if (isbn13) book.isbn13 = isbn13;

    const coverId = edition?.cover_i ?? work.cover_i;
    if (coverId && coverId > 0) book.coverUrl = `${this.coversBaseUrl}/b/id/${coverId}-M.jpg`;

    const workKey = /^\/works\/(OL\d+W)$/.exec(work.key ?? '')?.[1];
    if (workKey) book.workKey = workKey;

    book.matchSignals = {
      title: formatTitle(book),
      authors: book.authors,
      ...(work.person?.length ? { people: work.person } : {}),
      ...(work.place?.length ? { places: work.place } : {}),
      ...(work.subject?.length ? { subjects: work.subject } : {}),
    };
    return book;
  }
}

/** Trims and collapses internal whitespace (Open Library has titles like "The  Hobbit"). */
function cleanText(value: string | undefined): string | undefined {
  const cleaned = value?.replace(/\s+/g, ' ').trim();
  return cleaned || undefined;
}

/** Like cleanText, and un-inverts library-style titles: "Hobbit Companion, The" → "The Hobbit Companion". */
function cleanTitle(value: string | undefined): string | undefined {
  return cleanText(value)?.replace(/^(.+), (the|a|an)$/i, '$2 $1');
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value != null;
}

/** Checks the name rather than `instanceof`: abort errors are DOMExceptions, which may come from another realm. */
function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}
