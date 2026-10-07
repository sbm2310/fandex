import type { CatalogEntry, ShelfScanItem } from '@fandex/core';

import { toCatalogEntry } from '@/services/catalog-mapping';

/** What the user chose for one scanned item: which candidate, and whether to add it. */
export type ShelfChoice = { candidate: number; checked: boolean };

/**
 * The starting choices: each item's best candidate, ticked unless the user already owns it
 * (items with no candidates have nothing to tick).
 */
export function initialChoices(items: readonly ShelfScanItem[]): ShelfChoice[] {
  return items.map(({ candidates }) => ({
    candidate: 0,
    checked: candidates.length > 0 && !candidates[0]!.owned,
  }));
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
