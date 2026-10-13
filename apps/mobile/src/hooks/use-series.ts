import {
  findNextVolume,
  isBookItem,
  seriesProgress,
  volumeGaps,
  type BookSeries,
  type CatalogBook,
  type CollectionItem,
  type SeriesEntry,
} from '@fandex/core';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useCollection } from './use-collection';

import { useCatalog, useSeriesCatalog } from '@/services/app-services';

/** Series data changes slowly (the API caches it for a month). */
const STALE_MS = 60 * 60 * 1000;
/** While Wikidata hasn't been asked about a work yet (it was slow), ask again this often. */
const PENDING_RETRY_MS = 20_000;
/** Missing books whose editions are looked up for Add / Pre-order (each is a search). */
export const MISSING_LOOKUPS = 10;

/** The Open Library works of every book in the collection (any edition counts as owning it). */
function ownedWorkKeys(items: readonly CollectionItem[] | undefined): Set<string> {
  return new Set((items ?? []).flatMap((item) => (isBookItem(item) && item.catalog.workKey) || []));
}

/**
 * A book's series from Wikidata (books only; manga and comics use their volume numbers), what
 * the collection has of its main line, and editions of the missing books to add or pre-order.
 */
export function useBookSeries(item: CollectionItem) {
  const workKey = item.category === 'book' && isBookItem(item) ? item.catalog.workKey : undefined;
  const seriesCatalog = useSeriesCatalog();
  const collection = useCollection();

  const lookup = useQuery({
    queryKey: ['series', 'work', workKey],
    queryFn: async () => {
      const { series, pending } = await seriesCatalog.seriesForWorks([workKey!]);
      return { series: series.get(workKey!) ?? null, pending: pending.has(workKey!) };
    },
    enabled: !!workKey,
    staleTime: STALE_MS,
    refetchInterval: (query) => (query.state.data?.pending ? PENDING_RETRY_MS : false),
  });
  const series = { ...lookup, data: lookup.data?.series };
  const progress =
    series.data && collection.data
      ? seriesProgress(series.data, ownedWorkKeys(collection.data))
      : undefined;

  const toLookUp = (progress?.missing ?? [])
    .filter((entry): entry is SeriesEntry & { workKey: string } => !!entry.workKey)
    .slice(0, MISSING_LOOKUPS);
  const editions = useQueries({
    queries: toLookUp.map((entry) => ({
      queryKey: ['catalog', 'work', entry.workKey],
      queryFn: () => seriesCatalog.lookupWork(entry.workKey),
      staleTime: STALE_MS,
    })),
  });
  const editionFor = (entry: SeriesEntry) => {
    const index = toLookUp.indexOf(entry as SeriesEntry & { workKey: string });
    return index < 0 ? undefined : editions[index];
  };

  return { progress, isPending: !!workKey && series.isPending, editionFor };
}

/**
 * The manga or comic series this item is a volume of (read from titles across the collection),
 * what's missing up to the highest owned volume, and the next volume if the catalog has it.
 */
export function useVolumeSeries(item: CollectionItem) {
  const collection = useCollection();
  const catalog = useCatalog();

  const books = (collection.data ?? []).filter(isBookItem).map((owned) => ({
    id: owned.id,
    category: owned.category,
    title: owned.catalog.title,
    subtitle: owned.catalog.subtitle,
  }));
  const series = volumeGaps(books).find((group) =>
    [...group.items.values()].some((copies) => copies.some((copy) => copy.id === item.id)),
  );
  const volume = series
    ? [...series.items.entries()].find(([, copies]) =>
        copies.some((copy) => copy.id === item.id),
      )?.[0]
    : undefined;

  const next = useQuery({
    queryKey: ['series', 'next', series?.category, series?.key, series?.highest],
    queryFn: () => findNextVolume(series!, (query) => catalog.search(query)),
    enabled: !!series,
    staleTime: STALE_MS,
  });

  return { series, volume, next: next.data ?? null };
}

/** One line of the Series view: a book series or a manga/comic series, owned in part or whole. */
export type SeriesSummary = {
  id: string;
  kind: 'book' | 'manga' | 'comic';
  name: string;
  /** Owned books (by place) or volumes, out of `total` (the series' length, or the highest volume owned). */
  owned: number;
  total: number;
  /** Missing places or volume numbers (main line only). */
  missing: number[];
  /** An owned item, whose page has the details and the Add / Pre-order buttons. */
  itemId: string;
  /** The next manga/comic volume, when the catalog has it. */
  next?: { volume: number; publishDate?: CatalogBook['publishDate'] };
};

/** Asks the API for at most this many works at once. */
const WORKS_PER_REQUEST = 50;

/**
 * Every series the collection has something of: book series (Wikidata, one request for all
 * owned books) and manga/comic series (volume numbers), with what's missing and, for volumes,
 * the next one (shared with item pages' cache). Incomplete series first, then by name.
 */
export function useSeriesOverview() {
  const collection = useCollection();
  const seriesCatalog = useSeriesCatalog();
  const catalog = useCatalog();
  const items = collection.data ?? [];

  const books = items.filter(isBookItem).filter((item) => item.category === 'book');
  const workKeys = [
    ...new Set(books.flatMap((item) => (item.catalog.workKey ? [item.catalog.workKey] : []))),
  ].sort();
  const bookSeries = useQuery({
    queryKey: ['series', 'works', workKeys],
    queryFn: async () => {
      const found = new Map<string, BookSeries>();
      let pending = false;
      for (let i = 0; i < workKeys.length; i += WORKS_PER_REQUEST) {
        const chunk = await seriesCatalog.seriesForWorks(workKeys.slice(i, i + WORKS_PER_REQUEST));
        for (const [key, series] of chunk.series) found.set(key, series);
        pending ||= chunk.pending.size > 0;
      }
      return { found, pending };
    },
    enabled: collection.data !== undefined && workKeys.length > 0,
    staleTime: STALE_MS,
    refetchInterval: (query) => (query.state.data?.pending ? PENDING_RETRY_MS : false),
  });

  const volumeSeries = volumeGaps(
    items.filter(isBookItem).map((owned) => ({
      id: owned.id,
      category: owned.category,
      title: owned.catalog.title,
      subtitle: owned.catalog.subtitle,
    })),
  );
  const nexts = useQueries({
    queries: volumeSeries.map((series) => ({
      queryKey: ['series', 'next', series.category, series.key, series.highest],
      queryFn: () => findNextVolume(series, (query) => catalog.search(query)),
      staleTime: STALE_MS,
    })),
  });

  const summaries: SeriesSummary[] = [];
  const owned = ownedWorkKeys(items);
  const seen = new Set<string>();
  for (const book of books) {
    const series = book.catalog.workKey
      ? bookSeries.data?.found.get(book.catalog.workKey)
      : undefined;
    if (!series || seen.has(series.wikidataId)) continue;
    seen.add(series.wikidataId);
    const progress = seriesProgress(series, owned);
    summaries.push({
      id: `book:${series.wikidataId}`,
      kind: 'book',
      name: series.name,
      owned: progress.owned.length,
      total: series.entries.length,
      missing: progress.missing.flatMap((entry) => entry.ordinal ?? []),
      itemId: book.id,
    });
  }
  volumeSeries.forEach((series, index) => {
    const next = nexts[index]?.data;
    const [firstCopy] = [...series.items.values()].flat();
    summaries.push({
      id: `${series.category}:${series.key}`,
      kind: series.category,
      name: series.name,
      owned: series.owned.length,
      total: series.highest,
      missing: series.missing,
      itemId: firstCopy!.id,
      ...(next && {
        next: {
          volume: next.volume,
          ...(next.entry.publishDate && { publishDate: next.entry.publishDate }),
        },
      }),
    });
  });
  summaries.sort(
    (a, b) =>
      Number(b.missing.length > 0) - Number(a.missing.length > 0) || a.name.localeCompare(b.name),
  );

  return {
    summaries,
    isPending: collection.isPending || (workKeys.length > 0 && bookSeries.isPending),
    bookSeriesFailed: bookSeries.isError,
    retry: () => void bookSeries.refetch(),
  };
}
