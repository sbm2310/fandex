import type { CharacterRef } from '@fandex/core';

import type { Prisma } from '../generated/prisma/client.js';

/** A catalog item's universes and characters, in seed order. */
export type ItemLinks = { universes: string[]; characters: CharacterRef[] };

/** Loads a catalog item's links along with it (for responses). */
export const linksInclude = {
  universes: { select: { universe: { select: { slug: true, position: true } } } },
  characters: {
    select: {
      character: {
        select: {
          slug: true,
          position: true,
          universe: { select: { slug: true, position: true } },
        },
      },
    },
  },
} satisfies Prisma.CatalogItemInclude;

export type CatalogItemWithLinks = Prisma.CatalogItemGetPayload<{ include: typeof linksInclude }>;

/** The links loaded with `linksInclude`, sorted like the seed. */
export function linksFromRow(row: CatalogItemWithLinks): ItemLinks {
  const universes = row.universes
    .map((link) => link.universe)
    .sort((a, b) => a.position - b.position)
    .map((universe) => universe.slug);
  const characters = row.characters
    .map((link) => link.character)
    .sort((a, b) => a.universe.position - b.universe.position || a.position - b.position)
    .map((character) => ({ universe: character.universe.slug, character: character.slug }));
  return { universes, characters };
}
