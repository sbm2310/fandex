/**
 * Checks every Wikidata id in the universe seed against Wikidata's English label (Stage 3 found
 * a guessed id that was a volleyball player). Lists ids whose English label and aliases on
 * Wikidata match neither the seed's name nor one of its aliases (title aliases for a universe),
 * ids Wikidata doesn't know or redirects, and ids used twice. Calls the real Wikidata, so it
 * never runs in CI; run it before committing a seed change. Exits with 1 when anything needs a
 * look.
 *
 *   npm run build -w @fandex/core && npx tsx eval/verify-universe-seed.ts
 */
import { normalizeName, UNIVERSE_SEED } from '@fandex/core';

/** Wikimedia's policy asks for a descriptive User-Agent (same as the API's series lookups). */
const USER_AGENT = 'Fandex/0.2 (https://github.com/sbm2310/fandex)';
/** wbgetentities accepts at most 50 ids per request. */
const BATCH = 50;

/**
 * Right items whose Wikidata name isn't one Fandex uses, checked by hand (id → label then).
 * A changed label shows up again, so a later edit on Wikidata gets another look.
 */
const REVIEWED: Record<string, string> = {
  Q81738: "Tolkien's legendarium", // Middle-earth: "fictional universe by J. R. R. Tolkien"
  Q19786052: 'Star Wars universe', // "fictional background of Star Wars"
  Q16682047: 'One Piece universe', // "fictional narrative universe of One Piece"
  Q17562848: 'Pokémon universe', // "fictional universe"
};

type SeedId = { id: string; what: string; names: string[] };

type EntitiesResponse = {
  entities?: Record<
    string,
    {
      id?: string;
      missing?: string;
      redirects?: { from: string; to: string };
      labels?: Record<string, { value: string }>;
      aliases?: Record<string, { value: string }[]>;
      descriptions?: Record<string, { value: string }>;
    }
  >;
};

const ids: SeedId[] = UNIVERSE_SEED.flatMap((universe) => [
  {
    id: universe.wikidataId,
    what: `universe ${universe.slug}`,
    names: [universe.name, ...universe.titleAliases],
  },
  ...universe.characters.map((character) => ({
    id: character.wikidataId,
    what: `character ${universe.slug}/${character.slug}`,
    names: [character.name, ...(character.aliases ?? []), ...(character.titleNames ?? [])],
  })),
]);

const problems: string[] = [];

const seen = new Map<string, string>();
for (const { id, what } of ids) {
  const first = seen.get(id);
  if (first) problems.push(`${id} is used twice: ${first} and ${what}`);
  else seen.set(id, what);
}

type Found = { label: string; aliases: string[]; description: string };
const found = new Map<string, Found | null>();
const unique = [...seen.keys()];
for (let start = 0; start < unique.length; start += BATCH) {
  const batch = unique.slice(start, start + BATCH);
  const params = new URLSearchParams({
    action: 'wbgetentities',
    ids: batch.join('|'),
    props: 'labels|aliases|descriptions',
    // Some items only have a multilingual label (Harry Potter's series does).
    languages: 'en|mul',
    format: 'json',
  });
  const response = await fetch(`https://www.wikidata.org/w/api.php?${params.toString()}`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });
  if (!response.ok) throw new Error(`Wikidata responded ${response.status}`);
  const body = (await response.json()) as EntitiesResponse;
  for (const [key, entity] of Object.entries(body.entities ?? {})) {
    // A redirected id comes back under its target; report it under the id the seed uses.
    const requested = entity.redirects?.from ?? key;
    if (entity.redirects)
      problems.push(`${requested} redirects to ${entity.redirects.to} (${seen.get(requested)})`);
    const label = entity.labels?.en?.value ?? entity.labels?.mul?.value;
    found.set(
      requested,
      entity.missing === undefined && label
        ? {
            label,
            aliases: (entity.aliases?.en ?? []).map((alias) => alias.value),
            description: entity.descriptions?.en?.value ?? '',
          }
        : null,
    );
  }
}

for (const { id, what, names } of ids) {
  const item = found.get(id);
  if (!item) {
    problems.push(`${id} (${what}): Wikidata has no such item or no English label`);
    continue;
  }
  if (REVIEWED[id] === item.label) continue;
  const seedNames = new Set(names.map(normalizeName));
  if (![item.label, ...item.aliases].some((name) => seedNames.has(normalizeName(name))))
    problems.push(
      `${id} (${what}): Wikidata says "${item.label}" (${item.description || 'no description'}), seed says "${names[0]}"`,
    );
}

console.log(`Checked ${ids.length} Wikidata ids (${UNIVERSE_SEED.length} universes).`);
if (problems.length === 0) {
  console.log('Every label matches the seed.');
} else {
  console.log(`\n${problems.length} to look at:`);
  for (const problem of problems) console.log(`- ${problem}`);
  process.exitCode = 1;
}
