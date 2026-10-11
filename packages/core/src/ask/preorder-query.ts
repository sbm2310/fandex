import type { Category } from '../category';
import type { PreorderResponse } from '../contracts/preorders';
import { balanceLeft, summarizeSlips, type PreorderTerms } from '../preorders/preorder';
import { compareReleases, releasePeriodEnd } from '../preorders/release-date';
import type { Currency } from '../preorders/money';
import { compareTitles } from '../sort-collection';

import {
  matchesItem,
  type CollectionQuery,
  type QueryableItem,
  type QueryResult,
} from './collection-query';

/**
 * What a query looks at in a pre-order: its item (as for the collection, with `addedAt` the
 * day it was pre-ordered) and its terms. The API builds it from rows, the app from responses.
 */
export type QueryablePreorder = QueryableItem & PreorderTerms;

function matches(preorder: QueryablePreorder, query: CollectionQuery): boolean {
  // Arrived ones are in the collection; cancelled ones aren't coming.
  if (preorder.status !== 'ordered' || !matchesItem(preorder, query)) return false;

  if (query.arrivingAfter !== undefined || query.arrivingBefore !== undefined) {
    if (!preorder.expectedRelease) return false;
    const end = releasePeriodEnd(preorder.expectedRelease);
    if (query.arrivingAfter !== undefined && end < query.arrivingAfter) return false;
    if (query.arrivingBefore !== undefined && end >= query.arrivingBefore) return false;
  }
  if (query.balanceDue && !balanceLeft(preorder)) return false;
  if (query.delayed && summarizeSlips(preorder.history).delays === 0) return false;
  return true;
}

/** Soonest expected first (no date last), then the newest pre-order. */
function bySoonest(a: QueryablePreorder, b: QueryablePreorder): number {
  if (a.expectedRelease && b.expectedRelease) {
    const byRelease = compareReleases(a.expectedRelease, b.expectedRelease);
    if (byRelease) return byRelease;
  } else if (a.expectedRelease || b.expectedRelease) {
    return a.expectedRelease ? -1 : 1;
  }
  return b.addedAt.localeCompare(a.addedAt);
}

/**
 * Answers a query about pre-orders: open ones only, with the shared filters plus arriving,
 * balance due and delayed; sorted soonest first (or by title), with what's still owed.
 */
export function runPreorderQuery<T>(
  preorders: readonly T[],
  query: CollectionQuery,
  view: (preorder: T) => QueryablePreorder,
): QueryResult<T> {
  const found = preorders
    .map((preorder) => ({ preorder, seen: view(preorder) }))
    .filter(({ seen }) => matches(seen, query));
  found.sort((a, b) =>
    query.sort === 'title' ? compareTitles(a.seen.title, b.seen.title) : bySoonest(a.seen, b.seen),
  );
  const categoryCounts: Partial<Record<Category, number>> = {};
  const owed: Partial<Record<Currency, number>> = {};
  for (const { seen } of found) {
    categoryCounts[seen.category] = (categoryCounts[seen.category] ?? 0) + 1;
    const left = balanceLeft(seen);
    if (left) owed[seen.currency] = (owed[seen.currency] ?? 0) + left;
  }
  return { items: found.map(({ preorder }) => preorder), categoryCounts, owed };
}

/** A pre-order as the API returns it, as a query sees it (the API and the app both use this). */
export function queryablePreorder(preorder: PreorderResponse): QueryablePreorder {
  const { catalog } = preorder;
  return {
    category: catalog.category,
    addedAt: preorder.createdAt,
    title: catalog.subtitle ? `${catalog.title}: ${catalog.subtitle}` : catalog.title,
    creators: catalog.creators,
    universes: catalog.universes,
    characters: catalog.characters,
    status: preorder.status,
    currency: preorder.currency,
    price: preorder.price,
    paid: preorder.paid,
    balanceDueDate: preorder.balanceDueDate,
    expectedRelease: preorder.expectedRelease,
    history: preorder.history,
  };
}
