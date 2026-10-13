import { FIGURE_BRANDS, findFigureLine, type FigureBrand, type FigureLine } from './figure-brands';

/**
 * A figure's number as printed on the box: a line code and a number ("MMS 649"). Die-cast
 * versions add their own count after a "D" ("MMS 528 D30"); the base number still identifies
 * the figure.
 */
export type FigureNumber = {
  brand: FigureBrand;
  line: FigureLine;
  /** 649 */
  value: number;
  /** 30 in "MMS 528 D30". */
  diecast?: number;
  /** How we write it: "MMS 649", "MMS 528 D30" (no leading zeros). */
  text: string;
};

// Line code, optional separator, number (leading zeros allowed: "TMS007"), optional die-cast
// count. Numbers have at most 4 digits; 0 isn't a figure.
const NUMBER = /^([a-z]{2,5})[\s#.-]*(\d{1,4})(?:[\s-]*d[\s-]*(\d{1,3}))?$/i;
const IN_TEXT = /\b[a-z]{2,5}[\s#.-]*\d{1,4}(?:[\s-]*d[\s-]*\d{1,3})?\b/gi;

/**
 * Reads a figure number written any common way: "MMS 649", "MMS649", "mms-649", "TMS 007",
 * "DX 27", "MMS528D30". Null if it isn't one, or the line code isn't one we know.
 */
export function parseFigureNumber(
  input: string,
  brands: readonly FigureBrand[] = FIGURE_BRANDS,
): FigureNumber | null {
  const match = NUMBER.exec(input.trim());
  if (!match) return null;
  const [, prefix = '', digits = '', diecastDigits] = match;
  const found = findFigureLine(prefix, brands);
  const value = Number(digits);
  const diecast = diecastDigits === undefined ? undefined : Number(diecastDigits);
  if (!found?.line.prefix || value === 0 || diecast === 0) return null;
  const text = `${found.line.prefix} ${value}${diecast === undefined ? '' : ` D${diecast}`}`;
  return { ...found, value, ...(diecast !== undefined && { diecast }), text };
}

/**
 * The first figure number inside longer text, such as a search ("hot toys mms 649 gandalf") or
 * what's read off a box.
 */
export function findFigureNumber(
  text: string,
  brands: readonly FigureBrand[] = FIGURE_BRANDS,
): FigureNumber | null {
  for (const [candidate] of text.matchAll(IN_TEXT)) {
    const parsed = parseFigureNumber(candidate, brands);
    if (parsed) return parsed;
  }
  return null;
}

/** True if two numbers name the same figure: same line and number (die-cast count aside). */
export function sameFigureNumber(a: FigureNumber, b: FigureNumber): boolean {
  return a.brand.id === b.brand.id && a.line.id === b.line.id && a.value === b.value;
}
