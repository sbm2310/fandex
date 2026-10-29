/**
 * Records real match signals for the sample items in eval/signal-samples.json, through the
 * same core adapters the API uses, into core's universe test fixture
 * (packages/core/src/universes/__fixtures__/signals.json). Entries already in the fixture are
 * kept; only samples it lacks are recorded, unless --force. Calls the real Open Library and
 * Rebrickable (key: REBRICKABLE_API_KEY in apps/api/.env), so it never runs in CI.
 *
 *   npm run build -w @fandex/core
 *   npx tsx eval/record-signals.ts [name…] [--force] [--samples <file>] [--out <file>]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { OpenLibraryCatalog, RebrickableCatalog, type MatchSignals } from '@fandex/core';
import { config } from 'dotenv';
import { format, resolveConfig } from 'prettier';

import { RateLimitedCatalog } from '../src/catalog/rate-limited-catalog.js';
import { RequestSpacer } from '../src/catalog/request-spacer.js';

type Sample = { openLibrary: string } | { rebrickable: string };
type Fixture = Record<string, { recordedFrom: string; signals: MatchSignals }>;

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, '../../../packages/core/src/universes/__fixtures__/signals.json');
config({ path: join(here, '../.env'), quiet: true });
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    force: { type: 'boolean', default: false },
    samples: { type: 'string', default: join(here, 'signal-samples.json') },
    out: { type: 'string', default: FIXTURE },
  },
});

const samples = (
  JSON.parse(readFileSync(values.samples, 'utf8')) as { samples: Record<string, Sample> }
).samples;
const unknown = positionals.filter((name) => !(name in samples));
if (unknown.length > 0) throw new Error(`Not in ${values.samples}: ${unknown.join(', ')}`);

const out = resolve(values.out);
const fixture = JSON.parse(readFileSync(out, 'utf8')) as Fixture;
const wanted = Object.entries(samples).filter(
  ([name]) =>
    (positionals.length === 0 || positionals.includes(name)) &&
    (values.force || !(name in fixture)),
);
if (wanted.length === 0) {
  console.log('Every sample is already recorded (--force records them again).');
  process.exit(0);
}

// Same identification and spacing as the API (catalog.module.ts).
const openLibrary = new RateLimitedCatalog(
  new OpenLibraryCatalog({
    headers: { 'User-Agent': 'Fandex/0.2 (https://github.com/sbm2310/fandex)' },
  }),
  350,
);
const rebrickableKey = process.env.REBRICKABLE_API_KEY;
const rebrickableSpacer = new RequestSpacer(1000);
const rebrickable =
  rebrickableKey &&
  new RebrickableCatalog({
    apiKey: rebrickableKey,
    beforeRequest: () => rebrickableSpacer.run(async () => {}),
  });

const today = new Date().toISOString().slice(0, 10);

async function record(sample: Sample): Promise<Fixture[string]> {
  if ('openLibrary' in sample) {
    const id = sample.openLibrary;
    const isWork = /^OL\d+W$/.test(id);
    if (!isWork && !/^OL\d+M$/.test(id)) throw new Error(`"${id}" isn't an OL…M or OL…W key`);
    const [book] = await openLibrary.search(isWork ? `key:/works/${id}` : `edition_key:${id}`);
    if (!book?.matchSignals) throw new Error(`Open Library found nothing for ${id}`);
    return {
      recordedFrom: `Open Library ${isWork ? 'work' : 'edition'} ${id} → ${book.externalId} (${today})`,
      signals: book.matchSignals,
    };
  }
  if (!rebrickable) throw new Error('REBRICKABLE_API_KEY is missing from apps/api/.env');
  const setNum = sample.rebrickable.includes('-') ? sample.rebrickable : `${sample.rebrickable}-1`;
  const set = await rebrickable.lookupSet(setNum);
  if (!set?.matchSignals) throw new Error(`Rebrickable has no set ${setNum}`);
  // Absent minifigs mean the second request failed; a fixture should say what the set has.
  if (!set.matchSignals.minifigs) throw new Error(`Couldn't fetch ${setNum}'s minifigs`);
  return {
    recordedFrom: `Rebrickable set ${setNum} + minifigs (${today})`,
    signals: set.matchSignals,
  };
}

let failed = 0;
for (const [name, sample] of wanted) {
  const started = Date.now();
  try {
    const entry = await record(sample);
    const verb = name in fixture ? 'Re-recorded' : 'Recorded';
    fixture[name] = entry;
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`${verb} ${name}: ${entry.signals.title} (${entry.recordedFrom}, ${seconds} s)`);
  } catch (error) {
    failed += 1;
    console.error(`Skipped ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const text = `${JSON.stringify(fixture, null, 2)}\n`;
// Formatted with the repo's Prettier settings, so `format:check` passes (--out may be elsewhere).
const prettier = await resolveConfig(FIXTURE);
writeFileSync(out, await format(text, { ...prettier, filepath: FIXTURE }));
console.log(`\nSaved ${Object.keys(fixture).length} entries to ${out}`);
if (failed > 0) process.exitCode = 1;
