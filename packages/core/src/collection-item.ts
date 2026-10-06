import type { CatalogBook } from './catalog-book';
import type { CatalogEntry } from './catalog-entry';
import type { CatalogSet } from './catalog-set';
import type { BookCategory } from './category';
import { applyLinkEdits, diffLinks, type ItemLinks, type LinkEdits } from './universes/link-edits';

type CollectionItemBase = {
  id: string;
  /** ISO 8601 timestamp; a string so items round-trip through JSON storage unchanged. */
  addedAt: string;
  notes?: string;
  /** The user's fixes to the automatic universe and character links. */
  linkEdits?: LinkEdits;
};

/**
 * A copy the user owns. It keeps a snapshot of the catalog data so the collection renders
 * even if the source changes or is unreachable. A discriminated union on `category`: books
 * (incl. manga and comics) carry a CatalogBook, LEGO sets a CatalogSet. For books, `category`
 * is what the user sees: the catalog's, unless they corrected it (`catalog.category` keeps the
 * source's).
 */
export type CollectionItem =
  | (CollectionItemBase & { category: BookCategory; catalog: CatalogBook })
  | (CollectionItemBase & { category: 'lego'; catalog: CatalogSet });

/** Builds a new collection item. The id and clock are passed in so callers (and tests) control them. */
export function createCollectionItem(
  catalog: CatalogEntry,
  { id, now }: { id: string; now: Date },
): CollectionItem {
  const addedAt = now.toISOString();
  return catalog.category === 'lego'
    ? { id, category: 'lego', catalog, addedAt }
    : { id, category: catalog.category, catalog, addedAt };
}

/** The universes and characters the user sees for an item (automatic links plus their fixes). */
export function itemLinks(item: CollectionItem): ItemLinks {
  return applyLinkEdits(
    { universes: item.catalog.universes ?? [], characters: item.catalog.characters ?? [] },
    item.linkEdits,
  );
}

/** Whether the user changed this item's category or links. */
export function isEdited(item: CollectionItem): boolean {
  return item.linkEdits !== undefined || item.category !== item.catalog.category;
}

/**
 * Changes to an owned item. For each field, null resets it to what the catalog says and
 * leaving it out keeps it as it is. `links` is the full set the user wants to see.
 */
export type CollectionItemChanges = {
  category?: BookCategory | null;
  links?: ItemLinks | null;
};

/** Thrown for changes an item can't take (a LEGO set has no other category). */
export class InvalidItemChangeError extends Error {
  override readonly name = 'InvalidItemChangeError';
}

/** The item with `changes` applied (used on the device; the API applies the same rules). */
export function applyItemChanges(
  item: CollectionItem,
  changes: CollectionItemChanges,
): CollectionItem {
  let next: CollectionItem = item;
  if (changes.category !== undefined) {
    if (next.category === 'lego') {
      throw new InvalidItemChangeError("A LEGO set's category can't be changed");
    }
    next = { ...next, category: changes.category ?? next.catalog.category };
  }
  if (changes.links !== undefined) {
    const automatic = {
      universes: item.catalog.universes ?? [],
      characters: item.catalog.characters ?? [],
    };
    const edits = changes.links ? diffLinks(automatic, changes.links) : undefined;
    const { linkEdits: _old, ...rest } = next;
    next = (edits ? { ...rest, linkEdits: edits } : rest) as CollectionItem;
  }
  return next;
}
