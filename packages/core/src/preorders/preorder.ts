import type { Currency } from './money';
import {
  compareReleases,
  daysBetween,
  formatRelease,
  releaseDate,
  releasePeriodEnd,
  type ReleaseDate,
} from './release-date';

/**
 * Pre-orders: what's on order, what's still owed, and when it's due. The rules here are pure
 * (a pre-order and "today" in, a verdict out), so the API, the app and "Ask" agree on what
 * needs attention, and the tests can pin "today".
 */

export const PREORDER_STATUSES = ['ordered', 'arrived', 'cancelled'] as const;
export type PreorderStatus = (typeof PREORDER_STATUSES)[number];

/** Who changed the expected date: the owner, or Open Library (a book's listed release). */
export const DATE_CHANGE_SOURCES = ['user', 'openlibrary'] as const;
export type DateChangeSource = (typeof DATE_CHANGE_SOURCES)[number];

/** One change of the expected release, kept so slips stay visible. */
export type DateChange = {
  from: ReleaseDate | null;
  to: ReleaseDate | null;
  /** ISO timestamp. */
  changedAt: string;
  source: DateChangeSource;
};

/** What the rules look at in a pre-order (the API's and the app's shapes both have it). */
export type PreorderTerms = {
  status: PreorderStatus;
  currency: Currency;
  /** The total price in minor units, when known. */
  price?: number | undefined;
  /** Paid so far (the deposit, and any payments since), in minor units. */
  paid: number;
  /** When the rest is due (YYYY-MM-DD). */
  balanceDueDate?: string | undefined;
  expectedRelease?: ReleaseDate | undefined;
  history: readonly DateChange[];
};

/** A payment or a release this close (in days) needs attention. */
export const ATTENTION_DAYS = 7;

/** What still has to be paid, in minor units; undefined when the price isn't known. */
export function balanceLeft(preorder: Pick<PreorderTerms, 'price' | 'paid'>): number | undefined {
  return preorder.price === undefined ? undefined : Math.max(0, preorder.price - preorder.paid);
}

export type AttentionReason =
  /** The balance's due date has passed. */
  | { kind: 'payment-overdue'; day: string }
  /** The balance is due within ATTENTION_DAYS. */
  | { kind: 'payment-due'; day: string }
  /** The whole expected period is over and it hasn't arrived: update the date, or mark it arrived. */
  | { kind: 'release-passed'; release: ReleaseDate }
  /** Expected on a day within ATTENTION_DAYS. */
  | { kind: 'arriving-soon'; day: string };

/** Why an open pre-order needs attention today, most urgent first (empty when it doesn't). */
export function needsAttention(preorder: PreorderTerms, today: string): AttentionReason[] {
  if (preorder.status !== 'ordered') return [];
  const reasons: AttentionReason[] = [];
  const left = balanceLeft(preorder);
  const due = preorder.balanceDueDate;
  if (due && left !== undefined && left > 0) {
    if (due < today) reasons.push({ kind: 'payment-overdue', day: due });
    else if (daysBetween(today, due) <= ATTENTION_DAYS)
      reasons.push({ kind: 'payment-due', day: due });
  }
  const release = preorder.expectedRelease;
  if (release) {
    if (releasePeriodEnd(release) < today) reasons.push({ kind: 'release-passed', release });
    else if (
      release.precision === 'day' &&
      release.date >= today &&
      daysBetween(today, release.date) <= ATTENTION_DAYS
    ) {
      reasons.push({ kind: 'arriving-soon', day: release.date });
    }
  }
  return reasons;
}

export type UpcomingGroups<T> = {
  /** Open pre-orders with something to do, most urgent first. */
  attention: { preorder: T; reasons: AttentionReason[] }[];
  /** Expected by the end of this month (and not already in `attention`). */
  thisMonth: T[];
  /** Expected after this month, soonest first. */
  later: T[];
  /** No expected date yet. */
  noDate: T[];
  /** Still owed on open pre-orders, per currency (minor units). */
  owed: Partial<Record<Currency, number>>;
};

const URGENCY: AttentionReason['kind'][] = [
  'payment-overdue',
  'release-passed',
  'payment-due',
  'arriving-soon',
];

function reasonDay(reason: AttentionReason): string {
  return reason.kind === 'release-passed' ? releasePeriodEnd(reason.release) : reason.day;
}

/** The Upcoming tab: open pre-orders grouped by what needs doing and when they're expected. */
export function groupUpcoming<T extends PreorderTerms>(
  preorders: readonly T[],
  today: string,
): UpcomingGroups<T> {
  const groups: UpcomingGroups<T> = {
    attention: [],
    thisMonth: [],
    later: [],
    noDate: [],
    owed: {},
  };
  const endOfMonth = releasePeriodEnd(releaseDate(today, 'month'));

  for (const preorder of preorders) {
    if (preorder.status !== 'ordered') continue;
    const left = balanceLeft(preorder);
    if (left) groups.owed[preorder.currency] = (groups.owed[preorder.currency] ?? 0) + left;

    const reasons = needsAttention(preorder, today);
    if (reasons.length > 0) groups.attention.push({ preorder, reasons });
    else if (!preorder.expectedRelease) groups.noDate.push(preorder);
    else if (releasePeriodEnd(preorder.expectedRelease) <= endOfMonth)
      groups.thisMonth.push(preorder);
    else groups.later.push(preorder);
  }

  groups.attention.sort((a, b) => {
    const [first] = a.reasons;
    const [second] = b.reasons;
    return (
      URGENCY.indexOf(first!.kind) - URGENCY.indexOf(second!.kind) ||
      reasonDay(first!).localeCompare(reasonDay(second!))
    );
  });
  const byRelease = (a: T, b: T) => compareReleases(a.expectedRelease!, b.expectedRelease!);
  groups.thisMonth.sort(byRelease);
  groups.later.sort(byRelease);
  return groups;
}

export type SlipSummary = {
  /** How many times the expected date moved later. */
  delays: number;
  /** The first expected date ever set. */
  original?: ReleaseDate;
};

/** How a pre-order's expected date has moved: moves to a later date count as delays. */
export function summarizeSlips(history: readonly DateChange[]): SlipSummary {
  const ordered = [...history].sort((a, b) => a.changedAt.localeCompare(b.changedAt));
  const first = ordered[0];
  const original = first ? (first.from ?? first.to ?? undefined) : undefined;
  const delays = ordered.filter(
    (change) => change.from && change.to && compareReleases(change.to, change.from) > 0,
  ).length;
  return { delays, ...(original && { original }) };
}

const TIMES = ['once', 'twice'];

/** "Delayed twice, originally March 2027"; undefined when it was never delayed. */
export function describeSlips(history: readonly DateChange[]): string | undefined {
  const { delays, original } = summarizeSlips(history);
  if (delays === 0) return undefined;
  const times = TIMES[delays - 1] ?? `${delays} times`;
  return original ? `Delayed ${times}, originally ${formatRelease(original)}` : `Delayed ${times}`;
}
