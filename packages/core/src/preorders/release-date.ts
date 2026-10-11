/**
 * When something is expected: stores announce a day, a month, a quarter ("Q1 2027") or just a
 * year, and each of those is a different promise. A release date is the first day of that
 * period plus its precision; comparisons use the period's last day ("March 2027" isn't late
 * until April).
 */

export const RELEASE_PRECISIONS = ['day', 'month', 'quarter', 'year'] as const;
export type ReleasePrecision = (typeof RELEASE_PRECISIONS)[number];

export type ReleaseDate = {
  /** YYYY-MM-DD: the day, or the first day of the month, quarter or year. */
  date: string;
  precision: ReleasePrecision;
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function parts(day: string): [year: number, month: number, date: number] {
  const [year, month, date] = day.split('-').map(Number);
  return [year!, month!, date!];
}

function iso(year: number, month: number, date: number): string {
  return new Date(Date.UTC(year, month - 1, date)).toISOString().slice(0, 10);
}

/** A release date for any day in its period: "2027-03-17" at month precision → 2027-03-01. */
export function releaseDate(day: string, precision: ReleasePrecision): ReleaseDate {
  const [year, month] = parts(day);
  switch (precision) {
    case 'day':
      return { date: day, precision };
    case 'month':
      return { date: iso(year, month, 1), precision };
    case 'quarter':
      return { date: iso(year, Math.floor((month - 1) / 3) * 3 + 1, 1), precision };
    case 'year':
      return { date: iso(year, 1, 1), precision };
  }
}

/** The last day the promise covers: the day itself, or the end of the month, quarter or year. */
export function releasePeriodEnd({ date, precision }: ReleaseDate): string {
  const [year, month] = parts(date);
  switch (precision) {
    case 'day':
      return date;
    case 'month':
      return iso(year, month + 1, 0);
    case 'quarter':
      return iso(year, month + 3, 0);
    case 'year':
      return iso(year, 12, 31);
  }
}

/** "March 12, 2027", "March 2027", "Q1 2027", "2027". */
export function formatRelease({ date, precision }: ReleaseDate): string {
  const [year, month, day] = parts(date);
  switch (precision) {
    case 'day':
      return `${MONTHS[month - 1]} ${day}, ${year}`;
    case 'month':
      return `${MONTHS[month - 1]} ${year}`;
    case 'quarter':
      return `Q${Math.floor((month - 1) / 3) + 1} ${year}`;
    case 'year':
      return String(year);
  }
}

/** Negative if `a` ends before `b`, by the periods' last days (then the precision, finest first). */
export function compareReleases(a: ReleaseDate, b: ReleaseDate): number {
  const byEnd = releasePeriodEnd(a).localeCompare(releasePeriodEnd(b));
  return byEnd || RELEASE_PRECISIONS.indexOf(a.precision) - RELEASE_PRECISIONS.indexOf(b.precision);
}

/** Days from one YYYY-MM-DD to another (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** A day plus or minus some days. */
export function addDays(day: string, days: number): string {
  const [year, month, date] = parts(day);
  return iso(year, month, date + days);
}

/**
 * Where a pre-order that follows its catalog's date (Open Library's, for books) should move,
 * or null to stay put: the catalog's date when it differs, unless it only says less about the
 * same time ("2027" or "March 2027" after "March 2, 2027"). A vaguer date for another time
 * ("June 2027") is still a move.
 */
export function followCatalogDate(
  current: ReleaseDate | null,
  catalog: ReleaseDate | null,
): ReleaseDate | null {
  if (!catalog) return null;
  if (!current) return catalog;
  if (current.date === catalog.date && current.precision === catalog.precision) return null;
  const vaguer =
    RELEASE_PRECISIONS.indexOf(catalog.precision) > RELEASE_PRECISIONS.indexOf(current.precision);
  const covers =
    catalog.date <= current.date && releasePeriodEnd(current) <= releasePeriodEnd(catalog);
  return vaguer && covers ? null : catalog;
}
