import type { NewFigure } from '../catalog-figure';
import { findFigureBrand } from '../figures/figure-brands';
import { findFigureNumber, parseFigureNumber } from '../figures/figure-number';
import { scaleKey } from '../figures/same-figure';

/**
 * Reading a figure's box with a vision-language model: the prompt and the parser for its
 * reply. A box shows one figure, so the reply is a few labelled lines ("brand: Hot Toys");
 * the parser keeps what it recognizes and ignores the rest.
 */

/** What the model read on a box. Nothing here is verified yet. */
export type BoxReading = {
  /** The maker, written our way when we know it ("HOT TOYS" → "Hot Toys"). */
  brand?: string;
  /** The product line: "Movie Masterpiece Series". */
  line?: string;
  /** The box number, written our way when we can read it ("MMS279" → "MMS 279"). */
  number?: string;
  /** The figure's name as printed. */
  name?: string;
  /** The character it depicts. */
  character?: string;
  /** The film, show, game or comic. */
  from?: string;
  /** "1/6". */
  scale?: string;
  /** "Deluxe", "Special Edition"… */
  edition?: string;
};

/** Short replies: a box is a handful of lines. Low temperature: there's one right answer. */
export const BOX_READING_SETTINGS = { maxTokens: 300, temperature: 0.2, topP: 0.95 } as const;

/** The instructions for one box photo (or several photos of the same box). */
export function boxPrompt(imageCount = 1): string {
  const photos =
    imageCount > 1 ? ` The ${imageCount} images are different sides of the same box.` : '';
  return `This photo shows the box of a collectible figure (Hot Toys, InArt or similar).${photos}
Read what is printed on the box and answer with exactly these lines, nothing else:
brand: the maker, e.g. Hot Toys
line: the product line or series, e.g. Movie Masterpiece Series
number: the product code printed on the box, e.g. MMS279 or DX26
name: the figure's name as printed
character: the character it depicts
from: the film, show, game or comic it is from
scale: e.g. 1/6
edition: e.g. Deluxe, Special Edition, Premium
Write - for anything you cannot read on the box. Do not guess product codes.`;
}

const FIELDS = [
  'brand',
  'line',
  'number',
  'name',
  'character',
  'from',
  'scale',
  'edition',
] as const;
type Field = (typeof FIELDS)[number];

const NONE = new Set(['', '-', '–', '—', 'n/a', 'none', 'null', 'unknown', 'not visible']);

/**
 * Parses the model's reply into a reading, or null when it says nothing usable (no name,
 * character or number). Labels may come with list markers or bold ("**Brand:**").
 */
export function parseBoxReply(reply: string): BoxReading | null {
  const raw: Partial<Record<Field, string>> = {};
  for (const line of reply.split('\n')) {
    const match = /^[\s*>-]*\**\s*([a-z ]+?)\s*\**\s*:\s*\**\s*(.*?)\s*\**\s*$/i.exec(line);
    if (!match) continue;
    const key = match[1]!.toLowerCase() as Field;
    const value = match[2]!.trim();
    if (!FIELDS.includes(key) || raw[key] !== undefined || NONE.has(value.toLowerCase())) continue;
    raw[key] = value;
  }

  const reading: BoxReading = {};
  if (raw.brand) reading.brand = findFigureBrand(raw.brand)?.name ?? raw.brand;
  if (raw.line) reading.line = raw.line;
  // A number we know is written our way; another code (InArt's "A012") is kept as read.
  const number = raw.number ?? undefined;
  const known = number && (parseFigureNumber(number) ?? findFigureNumber(number));
  if (known) reading.number = known.text;
  else if (number) reading.number = number;
  if (raw.name) reading.name = raw.name;
  if (raw.character) reading.character = raw.character;
  if (raw.from) reading.from = raw.from;
  if (raw.scale) reading.scale = scaleKey(raw.scale);
  if (raw.edition) reading.edition = raw.edition;
  return reading.name || reading.character || reading.number ? reading : null;
}

/**
 * The figure to start the add-by-hand form with when the catalog doesn't have it: named after
 * what was printed (or the character), with the film when the name doesn't say it.
 */
export function boxReadingFigure(reading: BoxReading): NewFigure {
  const name = reading.name ?? reading.character ?? reading.number ?? '';
  const title =
    reading.from && !name.toLowerCase().includes(reading.from.toLowerCase())
      ? `${name} (${reading.from})`
      : name;
  return {
    title,
    ...(reading.brand && { brand: reading.brand }),
    ...(reading.line && { line: reading.line }),
    ...(reading.number && { number: reading.number }),
    ...(reading.scale && { scale: reading.scale }),
    ...(reading.edition && { edition: reading.edition }),
  };
}
