import {
  findNextVolume,
  isBookItem,
  seriesProgress,
  volumeGaps,
  type CollectionItem,
  type SeriesEntry,
} from '@fandex/core';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useCollection } from './use-collection';

import { useCatalog, useSeriesCatalog } from '@/services/app-services';

/** Series data changes slowly (the API caches it for a month). */
const STALE_MS = 60 * 60 * 1000;
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

  const series = useQuery({
    queryKey: ['series', 'work', workKey],
    queryFn: async () => (await seriesCatalog.seriesForWorks([workKey!])).get(workKey!) ?? null,
    enabled: !!workKey,
    staleTime: STALE_MS,
  });
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
