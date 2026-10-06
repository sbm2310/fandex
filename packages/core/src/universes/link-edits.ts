import type { CharacterRef } from './match-universes';

/** An item's universes and characters. */
export type ItemLinks = { universes: string[]; characters: CharacterRef[] };

/**
 * A user's fixes to an item's automatic links, kept as differences rather than a full copy:
 * if matching improves later, the fixes still apply and new automatic links still show up.
 */
export type LinkEdits = {
  addedUniverses?: string[];
  removedUniverses?: string[];
  addedCharacters?: CharacterRef[];
  removedCharacters?: CharacterRef[];
};

const characterKey = (ref: CharacterRef) => `${ref.universe}/${ref.character}`;

function uniqueBy<T>(values: readonly T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const k = key(value);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * The links a user sees: automatic ones plus their additions, minus their removals. A
 * character only shows while its universe does (removing Middle-earth removes Gandalf).
 */
export function applyLinkEdits(automatic: ItemLinks, edits?: LinkEdits): ItemLinks {
  if (!edits) return automatic;
  const removedUniverses = new Set(edits.removedUniverses);
  const removedCharacters = new Set((edits.removedCharacters ?? []).map(characterKey));
  const universes = uniqueBy(
    [...automatic.universes, ...(edits.addedUniverses ?? [])],
    (slug) => slug,
  ).filter((slug) => !removedUniverses.has(slug));
  const characters = uniqueBy(
    [...automatic.characters, ...(edits.addedCharacters ?? [])],
    characterKey,
  ).filter((ref) => !removedCharacters.has(characterKey(ref)) && universes.includes(ref.universe));
  return { universes, characters };
}

/**
 * The edits that turn `automatic` into `desired`; undefined when they're the same. A
 * desired character's universe counts as desired too, so edits are always consistent.
 */
export function diffLinks(automatic: ItemLinks, desired: ItemLinks): LinkEdits | undefined {
  const wantedUniverses = uniqueBy(
    [...desired.universes, ...desired.characters.map((ref) => ref.universe)],
    (slug) => slug,
  );
  const wantedCharacters = uniqueBy(desired.characters, characterKey);
  const autoCharacterKeys = new Set(automatic.characters.map(characterKey));
  const wantedCharacterKeys = new Set(wantedCharacters.map(characterKey));

  const edits: LinkEdits = {};
  const addedUniverses = wantedUniverses.filter((slug) => !automatic.universes.includes(slug));
  const removedUniverses = automatic.universes.filter((slug) => !wantedUniverses.includes(slug));
  const addedCharacters = wantedCharacters.filter(
    (ref) => !autoCharacterKeys.has(characterKey(ref)),
  );
  // A character that disappears with its removed universe needs no separate removal.
  const removedCharacters = automatic.characters.filter(
    (ref) => !wantedCharacterKeys.has(characterKey(ref)) && wantedUniverses.includes(ref.universe),
  );
  if (addedUniverses.length) edits.addedUniverses = addedUniverses;
  if (removedUniverses.length) edits.removedUniverses = removedUniverses;
  if (addedCharacters.length) edits.addedCharacters = addedCharacters;
  if (removedCharacters.length) edits.removedCharacters = removedCharacters;
  return Object.keys(edits).length > 0 ? edits : undefined;
}
