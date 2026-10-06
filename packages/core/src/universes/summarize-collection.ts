import type { Category } from '../category';
import type { CollectionUniverse } from '../contracts/universe';
import type { CharacterRef } from './match-universes';

/** An owned item, reduced to what the universe summary needs. */
export type UniverseLinkedItem = {
  category: Category;
  coverUrl?: string | undefined;
  /** ISO timestamp; newer items' covers come first. */
  addedAt: string;
  universes: readonly string[];
  characters: readonly CharacterRef[];
};

/** Universe names and characters, in display order (from the database or the seed). */
export type UniverseDirectory = readonly {
  slug: string;
  name: string;
  characters: readonly { slug: string; name: string }[];
}[];

const MAX_COVERS = 4;

/**
 * The universes a collection has items from, with counts per category, a few covers and the
 * characters involved. Universes and characters keep the directory's order; ones the
 * directory doesn't know are skipped. Shared by the API (accounts) and the app (guest mode).
 */
export function summarizeCollectionUniverses(
  items: readonly UniverseLinkedItem[],
  directory: UniverseDirectory,
): CollectionUniverse[] {
  const newestFirst = [...items].sort((a, b) => b.addedAt.localeCompare(a.addedAt));

  return directory.flatMap((universe) => {
    const owned = newestFirst.filter((item) => item.universes.includes(universe.slug));
    if (owned.length === 0) return [];

    const categoryCounts: CollectionUniverse['categoryCounts'] = {};
    for (const item of owned) {
      categoryCounts[item.category] = (categoryCounts[item.category] ?? 0) + 1;
    }
    const coverUrls = [
      ...new Set(owned.flatMap((item) => (item.coverUrl ? [item.coverUrl] : []))),
    ].slice(0, MAX_COVERS);
    const characters = universe.characters.flatMap((character) => {
      const itemCount = owned.filter((item) =>
        item.characters.some(
          (ref) => ref.universe === universe.slug && ref.character === character.slug,
        ),
      ).length;
      return itemCount > 0 ? [{ slug: character.slug, name: character.name, itemCount }] : [];
    });

    return [
      {
        slug: universe.slug,
        name: universe.name,
        itemCount: owned.length,
        categoryCounts,
        coverUrls,
        characters,
      },
    ];
  });
}
