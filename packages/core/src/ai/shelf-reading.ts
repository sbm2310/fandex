/**
 * Reading a shelf photo with a vision-language model: the prompt we send and the parser for
 * its reply. Pure functions, so they're tested without the network; the API owns the HTTP call.
 *
 * The reply is one line per item ("kind | title | english | author | count | set number")
 * rather than JSON: it costs about half the tokens (the free plan allows 8K tokens a minute),
 * and the parser can drop the lines a model garbles instead of failing the whole reply.
 */

export const SHELF_ITEM_KINDS = ['book', 'manga', 'comic', 'lego'] as const;
export type ShelfItemKind = (typeof SHELF_ITEM_KINDS)[number];

/** One thing the model says it sees on the shelf. Nothing here is verified yet. */
export type ShelfReading = {
  kind: ShelfItemKind;
  /** As printed: may be Hebrew, Japanese… */
  title: string;
  /** The work's English title when the printed one isn't English. */
  englishTitle?: string;
  author?: string;
  /** Spines counted for this title (a run of volumes is one reading). */
  count: number;
  /** A LEGO set number, when a label shows it. */
  setNumber?: string;
};

/**
 * Request settings measured in Task 1 (docs/eval/shelf-recognition.md): a short reply limit
 * (providers count the maximum against their token limits; 800 fits a full shelf), some
 * temperature (at 0 the model loops on one line), reasoning off.
 */
export const SHELF_READING_SETTINGS = { maxTokens: 800, temperature: 0.6, topP: 0.95 } as const;

/** The instructions for one photo, sent as `imageCount` crops of it (left to right, top to bottom). */
export function shelfPrompt(imageCount = 1): string {
  const parts =
    imageCount > 1
      ? ` The ${imageCount} images are parts of one photo, in reading order; an item cut between two parts is still one item.`
      : '';
  return `Catalogue this photo of a collector's shelf.${parts}
Report books, manga, comics and LEGO sets; skip figures, statues and decorations. Go shelf by shelf, left to right.
Write one line per distinct title, in this exact format and nothing else:
kind | title as printed | English title if not English, else - | author or - | number of spines | LEGO set number or -
kind is book, manga, comic or lego. A run of numbered volumes of one series is ONE line with the series name and the number of spines.
Only report text you can read. Never repeat a line. If you cannot read a spine, skip it.`;
}

/**
 * Words that are a publisher, imprint or format rather than a title: a model reading a dense
 * row of spines often reports "MARVEL" once per spine.
 */
const GENERIC_TITLES = new Set([
  'marvel',
  'marvel comics',
  'dc',
  'dc comics',
  'viz',
  'viz media',
  'vizbig',
  'kodansha',
  'kodansha comics',
  'tor',
  'omnibus',
  'marvel omnibus',
  'the complete collection',
  'complete collection',
  'epic collection',
  'lego',
]);

const NONE = new Set(['', '-', '–', '—', 'n/a', 'none', 'null', 'unknown']);

function field(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || NONE.has(trimmed.toLowerCase()) ? undefined : trimmed;
}

/**
 * Lowercase letters and digits of any script ("Spider-Man: Big Time" → "spider man big time",
 * "הארי פוטר" stays Hebrew), for comparing what a model read.
 */
export function normalizeReading(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '') // accents and Hebrew vowel points
    .toLowerCase()
    .replace(/['’"׳״]/g, '') // "Ra's", "ג'ורג'"
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function isGenericTitle(title: string): boolean {
  return GENERIC_TITLES.has(normalizeReading(title));
}

export type ParsedShelfReply = {
  readings: ShelfReading[];
  /** Lines dropped as malformed, generic or repeated: a high number means the model looped. */
  droppedLines: number;
};

/**
 * Parses the model's reply. Malformed lines, publisher-only titles and repeats are dropped;
 * repeats (models sometimes loop, printing one line dozens of times) merge into the first
 * reading, keeping the higher spine count.
 */
export function parseShelfReply(reply: string): ParsedShelfReply {
  const byKey = new Map<string, ShelfReading>();
  let droppedLines = 0;

  for (const line of reply.split('\n')) {
    if (!line.includes('|')) continue; // prose, code fences, blank lines
    const [kindField, titleField, english, author, countField, setNumber] = line
      .replace(/^\s*[-*\d.)]*\s*/, '') // list markers: "- ", "3. "
      .split('|');
    const kind = kindField?.trim().toLowerCase();
    const title = field(titleField);
    if (!isShelfItemKind(kind) || !title || isGenericTitle(title)) {
      droppedLines += 1;
      continue;
    }
    const reading: ShelfReading = { kind, title, count: parseCount(countField) };
    const englishTitle = field(english);
    if (englishTitle && normalizeReading(englishTitle) !== normalizeReading(title)) {
      reading.englishTitle = englishTitle;
    }
    const authorName = field(author);
    if (authorName) reading.author = authorName;
    const set = field(setNumber)?.match(/\d{3,7}(?:-\d+)?/)?.[0];
    if (set && kind === 'lego') reading.setNumber = set;

    const key = `${kind}|${normalizeReading(title)}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count = Math.max(existing.count, reading.count);
      droppedLines += 1;
    } else {
      byKey.set(key, reading);
    }
  }
  return { readings: [...byKey.values()], droppedLines };
}

function isShelfItemKind(value: string | undefined): value is ShelfItemKind {
  return (SHELF_ITEM_KINDS as readonly string[]).includes(value ?? '');
}

function parseCount(value: string | undefined): number {
  const count = Number.parseInt(value?.trim() ?? '', 10);
  return Number.isFinite(count) && count > 0 ? Math.min(count, 200) : 1;
}
