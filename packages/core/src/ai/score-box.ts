import { findFigureBrand } from '../figures/figure-brands';
import { parseFigureNumber, sameFigureNumber } from '../figures/figure-number';
import { containsPhrase, normalizeText } from '../universes/normalize-name';
import type { BoxReading } from './box-reading';

/** What's really on a box photo in the evaluation set (eval/boxes-expected.json). */
export type ExpectedBox = {
  file: string;
  brand: string;
  /** As printed, if the box shows one. */
  number?: string;
  /** The figure; any of the aliases in the reading's name or character counts as read. */
  name: string;
  aliases?: string[];
  /** The curated entry it is (`hot-toys-mms-279`), if the catalog has it. */
  figureId?: string;
};

/** null = nothing to check (the box shows no number; the catalog doesn't have the figure). */
export type BoxScore = {
  read: boolean;
  brand: boolean;
  number: boolean | null;
  name: boolean;
  /** Where the right catalog figure came: first, among the others offered, or not at all. */
  match: 'first' | 'listed' | 'missed' | null;
};

export function scoreBoxReading(
  reading: BoxReading | null,
  expected: ExpectedBox,
  candidateIds: readonly string[],
): BoxScore {
  const match = !expected.figureId
    ? null
    : candidateIds[0] === expected.figureId
      ? 'first'
      : candidateIds.includes(expected.figureId)
        ? 'listed'
        : 'missed';
  if (!reading) {
    return {
      read: false,
      brand: false,
      number: expected.number ? false : null,
      name: false,
      match,
    };
  }
  const brandId = (name: string) => findFigureBrand(name)?.id ?? normalizeText(name);
  const expectedNumber = expected.number ? parseFigureNumber(expected.number) : null;
  const readNumber = reading.number ? parseFigureNumber(reading.number) : null;
  const text = normalizeText([reading.name, reading.character].filter(Boolean).join(' '));
  return {
    read: true,
    brand: !!reading.brand && brandId(reading.brand) === brandId(expected.brand),
    number: !expected.number
      ? null
      : expectedNumber && readNumber
        ? sameFigureNumber(expectedNumber, readNumber)
        : normalizeText(reading.number ?? '') === normalizeText(expected.number),
    name: [expected.name, ...(expected.aliases ?? [])].some((alias) =>
      containsPhrase(text, normalizeText(alias)),
    ),
    match,
  };
}
