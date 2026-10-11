import { releaseDate, type ReleaseDate } from '../preorders/release-date';

/**
 * Open Library's `publish_date` is free text typed by librarians or imported from publisher
 * feeds, in many shapes (recorded in October 2026): "2026-12-08", "Nov 10th 2026",
 * "March 16, 2027", "16th June 2026", "December 2014", "2000, January", "28.06.2027",
 * "01/12/2027", "2027", even "Mayo, 2026". This reads it as a release date as precise as the
 * text allows, or null when there's no year in it.
 */
export function parseOpenLibraryDate(text: string | undefined): ReleaseDate | null {
  const value = text?.replace(/\s+/g, ' ').trim();
  if (!value) return null;

  for (const [pattern, read] of RULES) {
    const match = pattern.exec(value);
    const date = match && read(match as unknown as string[]);
    if (date) return date;
  }
  // "2027", "c1995", "Mayo, 2026": a year is all we can read.
  const years = value.match(/(?<!\d)\d{4}(?!\d)/g);
  return years?.length === 1 ? yearOnly(years[0]!) : null;
}

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/** A month's full name or an abbreviation of at least three letters ("Sep", "Sept"). */
const MONTH = '([a-z]{3,9})\\.?';
const ORDINAL = '(?:st|nd|rd|th)?';

type Rule = [RegExp, (match: string[]) => ReleaseDate | null];

/** Tried in order; a rule that matches but reads nothing ("Mayo, 2026") lets the next one try. */
const RULES: Rule[] = [
  [/^(\d{4})-(\d{1,2})-(\d{1,2})$/, ([, y, m, d]) => day(y, m, d)],
  [/^(\d{4})-(\d{1,2})$/, ([, y, m]) => month(y, m)],
  // "March 16, 2027", "Feb 2nd 2027", "Sept. 3, 2026"
  [
    new RegExp(`^${MONTH} (\\d{1,2})${ORDINAL},? (\\d{4})$`, 'i'),
    ([, name, d, y]) => day(y, monthNumber(name), d),
  ],
  // "16th June 2026", "16 June, 2026"
  [
    new RegExp(`^(\\d{1,2})${ORDINAL} ${MONTH},? (\\d{4})$`, 'i'),
    ([, d, name, y]) => day(y, monthNumber(name), d),
  ],
  // "December 2014", "March, 2027"
  [new RegExp(`^${MONTH},? (\\d{4})$`, 'i'), ([, name, y]) => month(y, monthNumber(name))],
  // "2000, January"
  [new RegExp(`^(\\d{4}),? ${MONTH}$`, 'i'), ([, y, name]) => month(y, monthNumber(name))],
  // "28.06.2027": with dots, always day first.
  [/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, ([, d, m, y]) => day(y, m, d)],
  // "16/04/2025" is day first, "11/30/2027" month first; "01/12/2027" could be either.
  [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    ([, first = '', second = '', y = '']) => {
      if (Number(first) > 12 || first === second) return day(y, second, first);
      if (Number(second) > 12) return day(y, first, second);
      return yearOnly(y);
    },
  ],
];

function monthNumber(name: string | undefined): string | undefined {
  const lower = name?.toLowerCase() ?? '';
  const index = MONTH_NAMES.findIndex((month) => month.startsWith(lower));
  return index >= 0 && lower.length >= 3 ? String(index + 1) : undefined;
}

function plausibleYear(year: string | undefined): number | null {
  const value = Number(year);
  return value >= 1000 && value <= 2999 ? value : null;
}

function day(
  year: string | undefined,
  month: string | undefined,
  date: string | undefined,
): ReleaseDate | null {
  const y = plausibleYear(year);
  const m = Number(month);
  const d = Number(date);
  if (y === null || !(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return null;
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  // Rejects days the month doesn't have ("February 30").
  if (new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) !== iso) return null;
  return releaseDate(iso, 'day');
}

function month(year: string | undefined, month: string | undefined): ReleaseDate | null {
  const y = plausibleYear(year);
  const m = Number(month);
  if (y === null || !(m >= 1 && m <= 12)) return null;
  return releaseDate(`${y}-${pad(m)}-01`, 'month');
}

function yearOnly(year: string): ReleaseDate | null {
  const y = plausibleYear(year);
  return y === null ? null : releaseDate(`${y}-01-01`, 'year');
}

const pad = (value: number) => String(value).padStart(2, '0');
