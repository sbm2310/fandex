/**
 * Scores two saved runs of the same photos read twice, as the app does: which readings both
 * runs agree on (core's combineShelfReadings), and how many of those are really on the shelf.
 * Calls no model.
 *
 *   npx tsx eval/agreement.ts eval/runs/<first run> eval/runs/<second run>
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  combineShelfReadings,
  scoreShelfReading,
  type ExpectedShelfItem,
  type ShelfReading,
} from '@fandex/core';

const here = dirname(fileURLToPath(import.meta.url));
const expected = JSON.parse(readFileSync(join(here, 'shelf-expected.json'), 'utf8')) as {
  items: (ExpectedShelfItem & { shelf: number })[];
};
const [first, second] = process.argv.slice(2);
if (!first || !second) throw new Error('Usage: agreement.ts <first run> <second run>');

type Saved = { job: { variant: string; shelves: number[] }; readings: ShelfReading[] };
const load = (run: string, file: string) =>
  JSON.parse(readFileSync(join(run, file), 'utf8')) as Saved;
const totals = new Map<
  string,
  Record<'expected' | 'one' | 'all' | 'sure', [number, number, number]>
>();

for (const file of readdirSync(first).filter((name) => name.endsWith('.json'))) {
  let other: Saved;
  try {
    other = load(second, file);
  } catch {
    continue; // not in both runs
  }
  const own = load(first, file);
  const items = expected.items.filter((item) => own.job.shelves.includes(item.shelf));
  const combined = combineShelfReadings(own.readings, other.readings);
  const row = totals.get(own.job.variant) ?? {
    expected: [0, 0, 0],
    one: [0, 0, 0],
    all: [0, 0, 0],
    sure: [0, 0, 0],
  };
  row.expected[0] += items.length;
  for (const [key, readings] of [
    ['one', own.readings],
    ['all', combined],
    ['sure', combined.filter((reading) => reading.sure)],
  ] as const) {
    const score = scoreShelfReading(items, readings);
    row[key][0] += score.found.length;
    row[key][1] += score.matches.length;
    row[key][2] += readings.length;
  }
  totals.set(own.job.variant, row);
}

console.log(
  '| Variant | Items | One reading: found, real | Both together: found, real | Sure: found, real |',
);
console.log('| --- | --- | --- | --- | --- |');
for (const [variant, row] of totals) {
  const cell = ([found, real, readings]: [number, number, number]) =>
    `${found}, ${real}/${readings} (${Math.round((100 * real) / Math.max(1, readings))}%)`;
  console.log(
    `| ${variant} | ${row.expected[0]} | ${cell(row.one)} | ${cell(row.all)} | ${cell(row.sure)} |`,
  );
}
