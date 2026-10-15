import {
  balanceLeft,
  daysBetween,
  formatMoney,
  formatRelease,
  releasePeriodEnd,
  summarizeSlips,
  type AttentionReason,
  type Currency,
  type DateChange,
  type PreorderResponse,
  type ReleaseDate,
} from '@fandex/core';

/** "October 18, 2026" for a YYYY-MM-DD. */
export const day = (value: string) => formatRelease({ date: value, precision: 'day' });

/** One sentence per thing to do: "Balance of $280.00 due October 18, 2026". */
export function attentionText(reason: AttentionReason, preorder: PreorderResponse): string {
  const left = balanceLeft(preorder);
  const owed = left ? `Balance of ${formatMoney(left, preorder.currency as Currency)}` : 'Balance';
  switch (reason.kind) {
    case 'payment-overdue':
      return `${owed} was due ${day(reason.day)}`;
    case 'payment-due':
      return `${owed} due ${day(reason.day)}`;
    case 'release-passed':
      return `Expected ${formatRelease(reason.release)}: has it arrived? Mark it, or update the date.`;
    case 'arriving-soon':
      return `Arriving ${day(reason.day)}`;
  }
}

const SHORT_MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];
const PERIOD_NOUNS = { day: 'day', month: 'month', quarter: 'quarter', year: 'year' } as const;

/**
 * The timeline's date column, small line over big: "NOV" / "10" for a day, "2027" / "MAR" for a
 * month, "2027" / "Q1" for a quarter, "" / "2027" for a year.
 */
export function timelineDate({ date, precision }: ReleaseDate): { small: string; big: string } {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  switch (precision) {
    case 'day':
      return { small: SHORT_MONTHS[month - 1]!, big: String(day) };
    case 'month':
      return { small: String(year), big: SHORT_MONTHS[month - 1]! };
    case 'quarter':
      return { small: String(year), big: `Q${Math.floor((month - 1) / 3) + 1}` };
    case 'year':
      return { small: '', big: String(year) };
  }
}

/**
 * How far off a release is, for a pill: "today", "tomorrow", "in 26 days", "in 5 months",
 * "this month" (inside a vaguer period), or undefined once the period is over.
 */
export function countdownText(release: ReleaseDate, today: string): string | undefined {
  if (releasePeriodEnd(release) < today) return undefined;
  if (release.date <= today) return `this ${PERIOD_NOUNS[release.precision]}`;
  const days = daysBetween(today, release.date);
  if (days === 1) return 'tomorrow';
  if (days < 60) return `in ${days} days`;
  const months = Math.round(days / 30.44);
  return months < 24 ? `in ${months} months` : `in ${Math.round(days / 365.25)} years`;
}

const TIMES = ['once', 'twice'];

/** "Delayed once" / "Delayed twice" / "Delayed 3 times"; undefined when it never slipped. */
export function delayText(history: readonly DateChange[]): string | undefined {
  const { delays } = summarizeSlips(history);
  if (delays === 0) return undefined;
  return `Delayed ${TIMES[delays - 1] ?? `${delays} times`}`;
}
