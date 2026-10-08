import type { CatalogEntry, ShelfScanItem } from '@fandex/core';

import { toCatalogEntry } from '@/services/catalog-mapping';

/** What the user chose for one scanned item: which candidate, and whether to add it. */
export type ShelfChoice = { candidate: number; checked: boolean };

/**
 * The starting choices: each item's best candidate, ticked when both readings of the photo
 * found it and the user doesn't own it yet (less sure items, and items with no candidates,
 * start unticked).
 */
export function initialChoices(items: readonly ShelfScanItem[]): ShelfChoice[] {
  return items.map(({ candidates, sure }) => ({
    candidate: 0,
    checked: sure && candidates.length > 0 && !candidates[0]!.owned,
  }));
}

/** The order to list items in (indexes into `items`): sure ones first, as the server sent them. */
export function reviewOrder(items: readonly ShelfScanItem[]): number[] {
  const indexes = items.map((_, index) => index);
  return [
    ...indexes.filter((index) => items[index]!.sure),
    ...indexes.filter((index) => !items[index]!.sure),
  ];
}

/** Picking another candidate ticks it, unless it's one the user owns. */
export function chooseCandidate(
  items: readonly ShelfScanItem[],
  choices: readonly ShelfChoice[],
  index: number,
  candidate: number,
): ShelfChoice[] {
  const owned = items[index]?.candidates[candidate]?.owned ?? true;
  return choices.map((choice, i) => (i === index ? { candidate, checked: !owned } : choice));
}

export function toggleChoice(choices: readonly ShelfChoice[], index: number): ShelfChoice[] {
  return choices.map((choice, i) =>
    i === index ? { ...choice, checked: !choice.checked } : choice,
  );
}

/** The catalog entries to add: ticked, not owned, and never the same entry twice. */
export function chosenEntries(
  items: readonly ShelfScanItem[],
  choices: readonly ShelfChoice[],
): CatalogEntry[] {
  const seen = new Set<string>();
  return items.flatMap(({ candidates }, index) => {
    const choice = choices[index];
    const candidate = choice?.checked ? candidates[choice.candidate] : undefined;
    if (!candidate || candidate.owned || seen.has(candidate.item.id)) return [];
    seen.add(candidate.item.id);
    const entry = toCatalogEntry(candidate.item);
    return entry ? [entry] : [];
  });
}
