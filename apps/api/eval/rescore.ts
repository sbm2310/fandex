/**
 * Re-scores saved runs against the current shelf-expected.json, without calling a model:
 * for when the list of what's really on the shelf is corrected.
 *
 *   npx tsx eval/rescore.ts eval/runs/<run> [more runs…]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scoreShelfReading, type ExpectedShelfItem, type ShelfReading } from '@fandex/core';

const here = dirname(fileURLToPath(import.meta.url));
const expected = JSON.parse(readFileSync(join(here, 'shelf-expected.json'), 'utf8')) as {
  items: (ExpectedShelfItem & { shelf: number })[];
};

for (const run of process.argv.slice(2)) {
  for (const file of readdirSync(run).filter((name) => name.endsWith('.json'))) {
    const saved = JSON.parse(readFileSync(join(run, file), 'utf8')) as {
      job: { variant: string; photo: string; label: string; shelves: number[] };
      readings: ShelfReading[];
    };
    const items = expected.items.filter((item) => saved.job.shelves.includes(item.shelf));
    const score = scoreShelfReading(items, saved.readings);
    console.log(
      [
        run.split('/').pop(),
        saved.job.variant,
        saved.job.photo,
        saved.job.label,
        score.found.length,
        items.length,
        score.matches.length,
        saved.readings.length,
      ].join('\t'),
    );
  }
}
