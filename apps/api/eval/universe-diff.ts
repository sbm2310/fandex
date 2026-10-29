/**
 * The review step for a seed change: matches every catalog item in the local database with a
 * base seed and a candidate seed (core's matchUniverses, built from the working tree) and
 * prints the items whose universe or character links change. New links should all be right,
 * and existing ones shouldn't move. Reads DATABASE_URL from apps/api/.env; local only.
 *
 *   npm run build -w @fandex/core
 *   npx tsx eval/universe-diff.ts [--base <git ref> | --base stored] [--candidate <seed.ts>]
 *
 * --base: the seed at a git revision (default HEAD), or "stored" for the links the local API
 *   saved (use that when the matching rules changed too, since both seeds share today's rules).
 * --candidate: a module exporting UNIVERSE_SEED (default: the working tree's seed).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import {
  matchSignalsSchema,
  matchUniverses,
  type UniverseMatch,
  type UniverseSeed,
} from '@fandex/core';
import { config } from 'dotenv';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = 'packages/core/src/universes/universe-seed.ts';
const repoRoot = join(here, '../../..');
config({ path: join(here, '../.env'), quiet: true });
const { values } = parseArgs({
  options: {
    base: { type: 'string', default: 'HEAD' },
    candidate: { type: 'string', default: join(repoRoot, SEED_PATH) },
  },
});

async function loadSeed(file: string): Promise<readonly UniverseSeed[]> {
  const module = (await import(pathToFileURL(resolve(file)).href)) as {
    UNIVERSE_SEED?: readonly UniverseSeed[];
  };
  if (!module.UNIVERSE_SEED) throw new Error(`${file} doesn't export UNIVERSE_SEED`);
  return module.UNIVERSE_SEED;
}

/** The seed file as committed at `ref`, imported from a temporary copy. */
async function seedAt(ref: string): Promise<readonly UniverseSeed[]> {
  const source = execFileSync('git', ['show', `${ref}:${SEED_PATH}`], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const dir = mkdtempSync(join(tmpdir(), 'fandex-seed-'));
  try {
    writeFileSync(join(dir, 'universe-seed.ts'), source);
    return await loadSeed(join(dir, 'universe-seed.ts'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is missing from apps/api/.env');
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url))
  throw new Error("DATABASE_URL isn't a local database; this script reads the local one only");

const candidate = await loadSeed(values.candidate);
const base = values.base === 'stored' ? null : await seedAt(values.base);

const client = new pg.Client({ connectionString: url });
await client.connect();
type Row = { id: string; title: string; category: string; match_signals: unknown };
const { rows } = await client.query<Row>(
  'SELECT id, title, category, match_signals FROM catalog_item ORDER BY category, title, id',
);

/** The links the API saved, as "universe" and "universe/character" keys per catalog item. */
const stored = new Map<string, Set<string>>();
if (!base) {
  const links = await client.query<{ item: string; link: string }>(`
    SELECT ciu.catalog_item_id AS item, u.slug AS link
      FROM catalog_item_universe ciu JOIN universe u ON u.id = ciu.universe_id
    UNION ALL
    SELECT cic.catalog_item_id, u.slug || '/' || c.slug
      FROM catalog_item_character cic
      JOIN character c ON c.id = cic.character_id
      JOIN universe u ON u.id = c.universe_id`);
  for (const { item, link } of links.rows)
    stored.set(item, (stored.get(item) ?? new Set()).add(link));
}
await client.end();

const keys = (match: UniverseMatch) =>
  new Set([
    ...match.universes,
    ...match.characters.map(({ universe, character }) => `${universe}/${character}`),
  ]);
const none: UniverseMatch = { universes: [], characters: [] };

let withoutSignals = 0;
const added = new Map<string, number>();
const removed = new Map<string, number>();
const changes: string[] = [];
for (const row of rows) {
  const parsed = matchSignalsSchema.safeParse(row.match_signals);
  if (!parsed.success) withoutSignals += 1;
  // Like the API's linker: no signals, no links.
  const match = (seed: readonly UniverseSeed[]) =>
    parsed.success ? matchUniverses(parsed.data, seed) : none;

  const before = base ? keys(match(base)) : (stored.get(row.id) ?? new Set<string>());
  const after = keys(match(candidate));
  const plus = [...after].filter((key) => !before.has(key));
  const minus = [...before].filter((key) => !after.has(key));
  if (plus.length === 0 && minus.length === 0) continue;

  for (const key of plus) added.set(key, (added.get(key) ?? 0) + 1);
  for (const key of minus) removed.set(key, (removed.get(key) ?? 0) + 1);
  changes.push(
    [
      `${row.title} [${row.category}] ${row.id}`,
      ...plus.map((key) => `  + ${key}`),
      ...minus.map((key) => `  - ${key}`),
    ].join('\n'),
  );
}

const summary = (counts: Map<string, number>) =>
  [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `  ${key}: ${count}`)
    .join('\n') || '  none';

console.log(
  `Base: ${base ? `seed at ${values.base}` : 'links stored in the database'}; candidate: ${values.candidate}`,
);
console.log(
  `${rows.length} catalog items (${withoutSignals} without signals), ${changes.length} with changed links.\n`,
);
if (changes.length > 0) console.log(`${changes.join('\n\n')}\n`);
console.log(`Links added:\n${summary(added)}\nLinks removed:\n${summary(removed)}`);
