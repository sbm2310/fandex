import {
  UNIVERSE_SEED,
  summarizeCollectionUniverses,
  type CollectionItem,
  type UniverseLinkedItem,
} from '@fandex/core';

import { useCollection } from './use-collection';

/** The parts of an owned item the universe summary needs. */
function toLinkedItem(item: CollectionItem): UniverseLinkedItem {
  return {
    category: item.category,
    coverUrl: item.catalog.coverUrl,
    addedAt: item.addedAt,
    universes: item.catalog.universes ?? [],
    characters: item.catalog.characters ?? [],
  };
}

/**
 * The universes in the active collection (account or device), with counts, covers and
 * characters. Computed on the device from the links each item carries, with the seed that
 * ships in `@fandex/core` as the directory: one code path for guests and accounts, no extra
 * request, and it updates the moment an item is added or removed.
 */
export function useCollectionUniverses() {
  const collection = useCollection();
  const universes = collection.data
    ? summarizeCollectionUniverses(collection.data.map(toLinkedItem), UNIVERSE_SEED)
    : undefined;
  return { ...collection, universes };
}

/** One universe from the seed with the items you own from it (newest first). */
export function useUniverse(slug: string) {
  const collection = useCollection();
  const universe = UNIVERSE_SEED.find((candidate) => candidate.slug === slug);
  const items = collection.data?.filter((item) => item.catalog.universes?.includes(slug));
  const summary =
    universe && items
      ? summarizeCollectionUniverses(items.map(toLinkedItem), [universe])[0]
      : undefined;
  return { ...collection, universe, items, summary };
}
