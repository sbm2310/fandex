/**
 * Measures how well the vision model reads figure boxes: sends the owner's box photos
 * (eval/box-photos, not committed) with core's prompt, parses each reply with the code the
 * app uses, matches it against the curated figure list and scores it against
 * eval/boxes-expected.json.
 *
 *   npm run eval:boxes -w @fandex/api                          # Groq, every box
 *   npm run eval:boxes -w @fandex/api -- --provider gemini --photos vader.jpeg
 *
 * Calls the real provider (its key from apps/api/.env), so it never runs in CI. Gemini's free
 * tier allows 20 requests a day for everything using that key. Raw replies and a summary are
 * written to eval/runs/boxes-<provider>-<time>/ (gitignored).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  boxPrompt,
  BOX_READING_SETTINGS,
  figureFromSeed,
  matchBoxReading,
  parseBoxReply,
  scoreBoxReading,
  type BoxScore,
  type ExpectedBox,
} from '@fandex/core';
import { FIGURE_SEED } from '@fandex/core/figure-seed';
import { config } from 'dotenv';
import sharp from 'sharp';

import { AiProviderError, AiRateLimitError, ChatClient } from '../src/ai/chat-client.js';

const here = dirname(fileURLToPath(import.meta.url));

/** A box in the evaluation set: its main photo, and other sides of it sent along. */
type Box = ExpectedBox & { sides?: string[]; note?: string };

const { values } = parseArgs({
  options: {
    provider: { type: 'string', default: 'groq' },
    model: { type: 'string' },
    photos: { type: 'string' },
  },
});

config({ path: join(here, '../.env'), quiet: true });
const PROVIDERS = {
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    keyName: 'GROQ_API_KEY',
    model: 'qwen/qwen3.8-27b',
    reasoningEffort: undefined,
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyName: 'GEMINI_API_KEY',
    model: 'gemini-3.5-flash',
    reasoningEffort: 'none', // Gemini 3 thinks by default, spending the reply budget
  },
} as const;
const provider = PROVIDERS[values.provider as keyof typeof PROVIDERS];
if (!provider) throw new Error(`Unknown provider "${values.provider}"`);
const model = values.model ?? provider.model;
const apiKey = process.env[provider.keyName];
if (!apiKey) throw new Error(`${provider.keyName} is missing from apps/api/.env`);

const { boxes } = JSON.parse(readFileSync(join(here, 'boxes-expected.json'), 'utf8')) as {
  boxes: Box[];
};
const chosen = values.photos
  ? boxes.filter((box) => values.photos!.split(',').includes(box.file))
  : boxes;
if (chosen.length === 0) {
  throw new Error(
    'No boxes to read: add photos to eval/box-photos and describe them in eval/boxes-expected.json',
  );
}

const catalog = FIGURE_SEED.map((entry) => {
  const figure = figureFromSeed(entry);
  return { ...figure, universes: figure.universes ?? [], characters: figure.characters ?? [] };
});

/** A photo as the app will send it: EXIF-rotated JPEG, long edge at most 2048 px. */
const load = (file: string) =>
  sharp(join(here, 'box-photos', file))
    .rotate()
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const client = new ChatClient({ apiKey, baseUrl: provider.baseUrl, timeoutMs: 90_000 });
const runDir = join(
  here,
  'runs',
  `boxes-${values.provider}-${new Date().toISOString().replace(/[:.]/g, '-')}`,
);
mkdirSync(runDir, { recursive: true });

type Row = { box: Box; score: BoxScore; first?: string; seconds: number; tokens: number };
const rows: Row[] = [];
const failures: string[] = [];

for (const box of chosen) {
  process.stdout.write(`${box.file.slice(0, 24).padEnd(24)} `);
  const images = await Promise.all([box.file, ...(box.sides ?? [])].map(load));
  let result;
  const started = Date.now();
  for (let attempt = 1; !result && attempt <= 5; attempt += 1) {
    try {
      result = await client.chat({
        model,
        ...(provider.reasoningEffort && { reasoningEffort: provider.reasoningEffort }),
        prompt: boxPrompt(images.length),
        images,
        ...BOX_READING_SETTINGS,
      });
    } catch (error) {
      const transient = error instanceof AiProviderError && [500, 503, 504].includes(error.status);
      if (!(error instanceof AiRateLimitError || transient) || attempt === 5) {
        console.log(`FAILED: ${error instanceof Error ? error.message : String(error)}`);
        failures.push(box.file);
        break;
      }
      await sleep(
        (error instanceof AiRateLimitError ? error.retryAfterMs : 15_000 * attempt) + 1_000,
      );
    }
  }
  if (!result) continue;
  const seconds = (Date.now() - started) / 1000;
  const reading = parseBoxReply(result.text);
  const candidates = reading ? matchBoxReading(reading, catalog) : [];
  const score = scoreBoxReading(
    reading,
    box,
    candidates.map(({ figure }) => figure.externalId),
  );
  const name = box.file.replace(/[^\w-]+/g, '_');
  writeFileSync(join(runDir, `${name}.txt`), result.text);
  writeFileSync(
    join(runDir, `${name}.json`),
    JSON.stringify(
      {
        reading,
        candidates: candidates.map(({ figure, by }) => [figure.externalId, by]),
        score,
        usage: result.usage,
      },
      null,
      2,
    ),
  );
  const tokens = result.usage.promptTokens + result.usage.completionTokens;
  rows.push({ box, score, first: candidates[0]?.figure.externalId, seconds, tokens });
  const mark = (ok: boolean | null) => (ok === null ? '·' : ok ? '✓' : '✗');
  console.log(
    `brand ${mark(score.brand)} number ${mark(score.number)} name ${mark(score.name)} match ${score.match ?? '·'}  (${reading?.number ?? '-'} · ${reading?.name ?? reading?.character ?? '-'})`,
  );
  // Groq's free plan allows 8,000 tokens a minute.
  if (values.provider === 'groq') await sleep(15_000);
}

const count = (pick: (score: BoxScore) => boolean | null) => {
  const relevant = rows.filter((row) => pick(row.score) !== null);
  const right = relevant.filter((row) => pick(row.score) === true).length;
  return relevant.length
    ? `${right}/${relevant.length} (${Math.round((100 * right) / relevant.length)}%)`
    : '—';
};
const lines = [
  `# Box evaluation — ${model} (${values.provider}), ${rows.length} boxes`,
  '',
  `- Read at all: ${count((s) => s.read)}`,
  `- Brand right: ${count((s) => s.brand)}`,
  `- Number right (boxes that show one): ${count((s) => s.number)}`,
  `- Name or character right: ${count((s) => s.name)}`,
  `- Right catalog figure first (boxes the catalog has): ${count((s) => (s.match === null ? null : s.match === 'first'))}`,
  `- Right catalog figure offered at all: ${count((s) => (s.match === null ? null : s.match !== 'missed'))}`,
  '',
  '| Box | Brand | Number | Name | Match | First offered | Seconds | Tokens |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...rows.map(
    ({ box, score, first, seconds, tokens }) =>
      `| ${box.file} | ${score.brand ? '✓' : '✗'} | ${score.number === null ? '·' : score.number ? '✓' : '✗'} | ${score.name ? '✓' : '✗'} | ${score.match ?? '·'} | ${first ?? '—'} | ${seconds.toFixed(1)} | ${tokens} |`,
  ),
];
if (failures.length) lines.push('', `Failed: ${failures.join(', ')}`);
writeFileSync(join(runDir, 'summary.md'), `${lines.join('\n')}\n`);
console.log(`\n${lines.join('\n')}\n\nReplies and scores: ${runDir}`);
