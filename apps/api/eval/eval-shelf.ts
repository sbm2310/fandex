/**
 * Measures how well the vision model reads shelf photos: sends the owner's photos
 * (eval/photos, not committed) in several variants, parses each reply with the same core code
 * the app will use, and scores it against eval/shelf-expected.json.
 *
 *   npm run eval:shelf -w @fandex/api                        # every variant, every photo
 *   npm run eval:shelf -w @fandex/api -- --variants shelf-halves --photos 6.jpeg
 *
 * Variants:
 *   photo         the whole photo as one image
 *   photo-strips  the whole photo cut into 3 overlapping strips (one request)
 *   shelf         each one-shelf crop ("bands" in the JSON) as one image, one request per shelf
 *   shelf-halves  each one-shelf crop cut into 2 halves (one request per shelf)
 * The shelf variants stand in for the one-shelf photos the app will ask for.
 *
 * Calls the real provider (its key from apps/api/.env), so it never runs in CI. Requests
 * are paced to stay under the free plan's tokens-per-minute limit; raw replies and a summary
 * are written to eval/runs/<time>/ (gitignored).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  parseShelfReply,
  planShelfTiles,
  scoreShelfReading,
  shelfPrompt,
  SHELF_READING_SETTINGS,
  type ExpectedShelfItem,
  type ImageTile,
} from '@fandex/core';
import { config } from 'dotenv';
import sharp from 'sharp';

import {
  ChatClient,
  AiProviderError,
  AiRateLimitError,
  type ChatResult,
} from '../src/ai/chat-client.js';

const here = dirname(fileURLToPath(import.meta.url));

type Band = ImageTile & { shelf: number };
type Photo = { file: string; shelves: number[]; note: string; bands?: Band[] };
type Expected = { items: (ExpectedShelfItem & { shelf: number })[]; photos: Photo[] };

/** One request: some images cut from a photo, and the shelves they show. */
type Job = { variant: string; photo: string; label: string; shelves: number[]; images: Buffer[] };

const VARIANT_NAMES = ['photo', 'photo-strips', 'shelf', 'shelf-halves'] as const;

const { values } = parseArgs({
  options: {
    variants: { type: 'string' },
    photos: { type: 'string' },
    /** "groq" (production), or "gemini" / "mistral" (comparisons; see docs/eval/shelf-recognition.md). */
    provider: { type: 'string', default: 'groq' },
    model: { type: 'string' },
    temperature: { type: 'string', default: String(SHELF_READING_SETTINGS.temperature) },
    'max-tokens': { type: 'string', default: String(SHELF_READING_SETTINGS.maxTokens) },
    /** "catalogue" (core's prompt) or an experimental prompt from PROMPTS below. */
    prompt: { type: 'string', default: 'catalogue' },
    bands: { type: 'string' },
  },
});

config({ path: join(here, '../.env'), quiet: true });
/**
 * Both providers speak the OpenAI chat-completions format, so one client serves both. Gemini's
 * free tier is used here only to compare models on the owner's photos.
 */
const PROVIDERS = {
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    keyName: 'GROQ_API_KEY',
    model: 'qwen/qwen3.8-27b',
    reasoningEffort: undefined,
    tokensPerMinute: 7_500,
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyName: 'GEMINI_API_KEY',
    // gemini-3.8-flash didn't answer at all on the free tier (2026-10-07); 3.5 did.
    model: 'gemini-3.5-flash',
    reasoningEffort: 'none', // Gemini 3 thinks by default, spending the reply budget
    tokensPerMinute: 200_000,
  },
  mistral: {
    baseUrl: 'https://api.mistral.ai/v1',
    keyName: 'MISTRAL_API_KEY',
    // The free plan allows only the Ministral models (Small and Medium answer 429, 0 per minute).
    model: 'ministral-14b-latest',
    reasoningEffort: undefined,
    tokensPerMinute: 900_000,
  },
} as const;
const provider = PROVIDERS[values.provider as keyof typeof PROVIDERS];
if (!provider) throw new Error(`Unknown provider "${values.provider}"`);
const model = values.model ?? provider.model;
const apiKey = process.env[provider.keyName];
if (!apiKey) throw new Error(`${provider.keyName} is missing from apps/api/.env`);

const expected = JSON.parse(readFileSync(join(here, 'shelf-expected.json'), 'utf8')) as Expected;
const pick = (list: string | undefined, all: readonly string[]) =>
  list ? all.filter((name) => list.split(',').includes(name)) : all;
const variants = pick(values.variants, VARIANT_NAMES);
const photoFiles = pick(
  values.photos,
  expected.photos.map((photo) => photo.file),
);

/** Cuts `region` of a photo into `count` overlapping pieces, as JPEGs no larger than 2048 px. */
async function cut(file: string, region: ImageTile | undefined, count: number): Promise<Buffer[]> {
  const source = sharp(join(here, 'photos', file)).rotate(); // apply EXIF orientation
  const { width = 0, height = 0 } = await source.metadata();
  const area = region ?? { left: 0, top: 0, width, height };
  const tiles = planShelfTiles(area, { count });
  return Promise.all(
    tiles.map((tile) =>
      source
        .clone()
        .extract({ ...tile, left: area.left + tile.left, top: area.top + tile.top })
        .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer(),
    ),
  );
}

async function jobsFor(variant: string, photo: Photo): Promise<Job[]> {
  const base = { variant, photo: photo.file };
  switch (variant) {
    case 'photo':
    case 'photo-strips':
      return [
        {
          ...base,
          label: 'all',
          shelves: photo.shelves,
          images: await cut(photo.file, undefined, variant === 'photo' ? 1 : 3),
        },
      ];
    default:
      return Promise.all(
        (photo.bands ?? [])
          .filter(
            (band) =>
              !values.bands || values.bands.split(',').includes(`${photo.file}:${band.shelf}`),
          )
          .map(async (band) => ({
            ...base,
            label: `shelf ${band.shelf}`,
            shelves: [band.shelf],
            images: await cut(photo.file, band, variant === 'shelf' ? 1 : 2),
          })),
      );
  }
}

// The free plan allows 8,000 tokens a minute, counting the reply's maximum length up front.
const TOKENS_PER_MINUTE = provider.tokensPerMinute;
const usage: { at: number; tokens: number }[] = [];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function paced(send: () => Promise<ChatResult>, estimate: number) {
  for (let attempt = 1; ; attempt += 1) {
    for (;;) {
      const recent = usage.filter((entry) => entry.at > Date.now() - 60_000);
      const used = recent.reduce((sum, entry) => sum + entry.tokens, 0);
      if (recent.length === 0 || used + estimate <= TOKENS_PER_MINUTE) break;
      await sleep(recent[0]!.at + 60_000 - Date.now() + 500);
    }
    try {
      const result = await send();
      usage.push({ at: Date.now(), tokens: estimate });
      return result;
    } catch (error) {
      // Timeouts and "overloaded" (Gemini's free tier answers 503 at busy times) are worth a retry.
      const transient = error instanceof AiProviderError && [500, 503, 504].includes(error.status);
      if (!(error instanceof AiRateLimitError || transient) || attempt === 6) throw error;
      const wait = error instanceof AiRateLimitError ? error.retryAfterMs : 15_000 * attempt;
      process.stdout.write(
        error instanceof AiRateLimitError
          ? ` (rate limited, waiting ${Math.ceil(wait / 1000)} s)`
          : ` (${error.status}, retrying in ${wait / 1000} s)`,
      );
      await sleep(wait + 1_000);
    }
  }
}

type Row = {
  variant: string;
  photo: string;
  label: string;
  expected: number;
  found: number;
  readings: number;
  unmatched: number;
  dropped: number;
  tokens: number;
  cutOff: boolean;
  seconds: number;
};

const client = new ChatClient({ apiKey, baseUrl: provider.baseUrl, timeoutMs: 90_000 });
const runDir = join(here, 'runs', new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(runDir, { recursive: true });
const rows: Row[] = [];
const failures: string[] = [];
const percent = (value: number) => `${Math.round(value * 100)}%`;
const maxTokens = Number(values['max-tokens']);

/** Prompts under test; the winner moves into core's shelfPrompt. */
const PROMPTS: Record<string, (imageCount: number) => string> = {
  catalogue: shelfPrompt,
  transcribe: (imageCount) => `Read the spines and boxes in this photo of a collector's shelf${
    imageCount > 1 ? ` (the ${imageCount} images are parts of one photo, left to right)` : ''
  }.
For each book, manga volume, comic or LEGO box, copy the largest text printed on it exactly as written. Do not name things you cannot read; do not use your own knowledge to fill in titles.
Write one line per distinct text, in this exact format and nothing else:
kind | text as printed | English title if not English, else - | author if printed, else - | number of spines with this text | LEGO set number if printed, else -
kind is book, manga, comic or lego. Spines that repeat the same text (volumes of a series) are ONE line with their count. Never repeat a line.`,
};
const prompt = PROMPTS[values.prompt];
if (!prompt) throw new Error(`Unknown prompt "${values.prompt}"`);

for (const variant of variants) {
  for (const photo of expected.photos.filter((entry) => photoFiles.includes(entry.file))) {
    for (const job of await jobsFor(variant, photo)) {
      const items = expected.items.filter((item) => job.shelves.includes(item.shelf));
      process.stdout.write(
        `${variant.padEnd(13)} ${photo.file.slice(0, 16).padEnd(16)} ${job.label.padEnd(8)}`,
      );
      let seconds = 0;
      const result = await paced(
        async () => {
          const started = Date.now();
          const reply = await client.chat({
            model,
            ...(provider.reasoningEffort && { reasoningEffort: provider.reasoningEffort }),
            prompt: prompt(job.images.length),
            images: job.images,
            maxTokens,
            temperature: Number(values.temperature),
            topP: SHELF_READING_SETTINGS.topP,
          });
          seconds = (Date.now() - started) / 1000; // the model's time, not our pacing
          return reply;
        },
        1_400 * job.images.length + 300 + maxTokens,
      ).catch((error: unknown) => {
        // A provider that stays overloaded skips this request rather than ending the run.
        console.log(` FAILED: ${error instanceof Error ? error.message : String(error)}`);
        failures.push(`${variant} ${photo.file} ${job.label}`);
        return undefined;
      });
      if (!result) continue;
      const parsed = parseShelfReply(result.text);
      const score = scoreShelfReading(items, parsed.readings);

      const name = `${variant}-${photo.file}-${job.label}`.replace(/[^\w-]+/g, '_');
      writeFileSync(join(runDir, `${name}.txt`), result.text);
      writeFileSync(
        join(runDir, `${name}.json`),
        JSON.stringify(
          { job: { ...job, images: job.images.length }, usage: result.usage, ...parsed, score },
          null,
          2,
        ),
      );
      const row: Row = {
        variant,
        photo: photo.file,
        label: job.label,
        expected: items.length,
        found: score.found.length,
        readings: parsed.readings.length,
        unmatched: score.unmatched.length,
        dropped: parsed.droppedLines,
        tokens: result.usage.promptTokens + result.usage.completionTokens,
        cutOff: result.finishReason === 'length',
        seconds,
      };
      rows.push(row);
      console.log(
        ` found ${row.found}/${row.expected}, ${row.readings - row.unmatched}/${row.readings} readings right,` +
          ` ${row.dropped} dropped, ${row.tokens} tokens${row.cutOff ? ', CUT OFF' : ''}`,
      );
    }
  }
}

// Totals per variant (sums over every request, not averages of ratios).
const lines = [
  `# Shelf evaluation — ${model}, prompt ${values.prompt}, temperature ${values.temperature}, max ${maxTokens} reply tokens`,
  '',
  '| Variant | Items found | Recall | Readings right | Precision | Lines dropped | Requests cut off | Tokens per request |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
];
for (const variant of variants) {
  const own = rows.filter((row) => row.variant === variant);
  if (own.length === 0) continue;
  const sum = (key: keyof Row) => own.reduce((total, row) => total + Number(row[key]), 0);
  const right = sum('readings') - sum('unmatched');
  lines.push(
    `| ${variant} | ${sum('found')}/${sum('expected')} | ${percent(sum('found') / sum('expected'))}` +
      ` | ${right}/${sum('readings')} | ${sum('readings') ? percent(right / sum('readings')) : '—'}` +
      ` | ${sum('dropped')} | ${own.filter((row) => row.cutOff).length}/${own.length}` +
      ` | ${Math.round(sum('tokens') / own.length)} |`,
  );
}
lines.push('', '| Variant | Photo | Part | Found | Readings right | Dropped | Tokens | Seconds |');
lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const row of rows) {
  lines.push(
    `| ${row.variant} | ${row.photo} | ${row.label} | ${row.found}/${row.expected}` +
      ` | ${row.readings - row.unmatched}/${row.readings} | ${row.dropped} | ${row.tokens}${row.cutOff ? ' (cut off)' : ''}` +
      ` | ${row.seconds.toFixed(1)} |`,
  );
}
if (failures.length) lines.push('', `Failed after retries: ${failures.join('; ')}`);
writeFileSync(join(runDir, 'summary.md'), `${lines.join('\n')}\n`);
console.log(`\n${lines.join('\n')}\n\nReplies and scores: ${runDir}`);
