# Stage 3 plan: Universe layer

**Goal (from the roadmap):** organize the collection the way fans think about it — by universe and character, across books, manga, comics and LEGO.

**Demo at the end:** open the new Universes tab on the iPhone, tap **Middle-earth**, and see the Tolkien books and LEGO sets you own together; tap **Gandalf** and see every book he appears in and every set with his minifig. Fix one wrongly matched item by hand, then see the same pages on the web.

## Decisions (settled 2026-10-06)

| Question                  | Decision                                                                              | Why                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Where universes come from | **Curated seed + automatic matching**, with per-item manual fixes                     | A hand-checked list in `packages/core` (universes, aliases, LEGO theme ids, main characters), drafted from Wikidata (CC0, free for any use) and reviewed by us. Items are matched by rules over data we already get from our sources. Predictable and testable; growing it is a data change, not a code change. Live Wikidata lookups were too sparse per edition. |
| Starting universes        | **Middle-earth, Star Wars, Wizarding World, DC, Marvel**                              | The owner's own fandoms, so the demo runs on a real collection. More universes (One Piece and other manga) are added by extending the seed.                                                                                                                                                                                                                        |
| Characters                | **Universe and character pages** in Stage 3                                           | The data exists for both: Open Library lists characters per work (Bilbo, Gandalf; Harry Potter, Hermione; Batman), and Rebrickable lists each set's minifigs by character name (Rivendell: Aragorn, Bilbo Baggins, Gandalf the Grey…).                                                                                                                             |
| "You're missing…"         | **Deferred** (after Stage 3)                                                          | Stage 3 links what you own. Series gaps and LEGO suggestions need series/volume data (Wikidata has the Harry Potter order, for example) and are planned separately.                                                                                                                                                                                                |
| Matching signals          | **Title, series, characters, places, subjects** (books); **theme, minifigs** (LEGO)   | Open Library is inconsistent (One Piece vol. 1 lists Luffy, vols. 2–4 list nobody; one Star Wars novel lists its _author_ as a character; Spider-Man comics list no characters), so no single field is enough. Rules combine them, and authors are never treated as characters.                                                                                    |
| Where links live          | **On catalog items** (shared by everyone), plus **per-user overrides** on owned items | Matching once per catalog item serves every user. A user's fix ("this isn't Star Wars", "add Gandalf") only changes their own copy.                                                                                                                                                                                                                                |
| Guest mode                | **Links travel with the catalog entry**                                               | Search results already carry catalog data into on-device collections; they'll carry universe and character links too, so guest collections get universe pages without an account.                                                                                                                                                                                  |
| Cost                      | **$0**                                                                                | Same sources and free hosting as Stage 2. Minifig lookups are one extra Rebrickable call per set (still spaced 1 s apart). Wikidata is used once, offline, to draft the seed.                                                                                                                                                                                      |

## Data model (additions)

```
universe                                 ← from the seed
  id, slug UNIQUE, name, wikidata_id, description

character                                ← from the seed
  id, universe_id → universe, slug, name, aliases text[], wikidata_id
  UNIQUE (universe_id, slug)

catalog_item                             ← new columns
  match_signals jsonb    (people, places, series, subjects, minifig names, theme ids)
  work_key text          (Open Library work id, for "you own another edition")

catalog_item_universe / catalog_item_character   ← automatic links
  catalog_item_id, universe_id | character_id, PRIMARY KEY (both)

collection_item_link                     ← a user's manual fixes
  collection_item_id → collection_item ON DELETE CASCADE
  universe_id | character_id, action: include | exclude
```

- **Effective links** for an owned item = automatic links + the user's includes − the user's excludes.
- The seed has a version hash; on start the API syncs the seed and re-matches catalog items when it changes (the database is small, and this avoids a manual step on Render).
- Matching is a **pure function in `core`** (`matchUniverses(signals, seed)`), tested against recorded Open Library and Rebrickable responses, like the category classifier.

## Tasks (each one leaves the app working)

**1. Seed and matching engine (core).** ✅ The universe seed for the five starting universes (aliases, LEGO theme ids, ~15–25 main characters each, Wikidata ids), drafted from Wikidata and reviewed by hand. `matchUniverses(signals, seed)`: name normalization ("Batman (Fictitious character)", "Skywalker, Luke", "Gandalf The Grey - Cape, Hat"), title and series matching, author exclusion, multiple universes allowed (crossovers). Tests against recorded real responses (The Hobbit, Harry Potter, Heir to the Empire, Batman, Spider-Man, Rivendell, Millennium Falcon) plus false-positive cases (a book about bats, an author named like a character). _Demo:_ tests show which universes and characters each recorded item matches.

**2. Capture match signals.** ✅ The Open Library adapter returns people, places, series and work key; the Rebrickable adapter returns theme ids and, for a set lookup, its minifig names (one extra call, cached with the set). Migration adds `match_signals` and `work_key` to `catalog_item`. A backfill command refetches signals for items already in the database (rate-limited), and runs once on Render. _Demo:_ the Hobbit's catalog row holds Bilbo, Gandalf and Middle-earth.

**3. Universes in the API.** ✅ Tables and migration, seed sync on start, links computed on every catalog upsert, re-match when the seed changes. Public `GET /universes` and `GET /universes/:slug` (with characters). Catalog responses include universe and character refs, so the app can show them before an item is owned. _Demo:_ `curl /api/catalog/search?q=hobbit` shows `universes: [middle-earth]`.

**4. Your collection by universe (API).** ✅ Collection items carry their effective links; `GET /collection/universes` returns the universes and characters the user owns, with counts per category. User isolation tests extended to the new endpoints. _Demo:_ `curl` your universe summary.

**5. Universes tab (app).** ✅ A new tab listing the universes you own items from (with counts and cover thumbnails), and a universe page with your items grouped by category plus its characters. Works in guest mode from the links stored with each item. _Demo:_ open Middle-earth and see books and LEGO together.

**6. Character pages and item links (app).** Character page (everything you own with that character); universe and character chips on the item detail screen and on search results, each opening its page. _Demo:_ tap Gandalf on the Rivendell set, land on his page with The Hobbit on it.

**7. Manual fixes.** On an item's detail screen: add or remove a universe or character, and override the category (the Stage 2 classifier follow-up). API endpoints write `collection_item_link` (and a per-user category override); guest mode stores the same fixes on the device. _Demo:_ remove a wrong match, add a missing one, see the universe page update on phone and web.

**8. "You own another edition."** Using the Open Library work key: search results and detail show a hint when you own a different edition of the same book. _Demo:_ search a different printing of a book you own and see the hint.

**9. Polish and Stage 3 demo.** Empty states, a "show all" cap for long character lists on universe pages, accessibility labels, web tab titles, README (screenshots, architecture, data-source credits incl. Wikidata), publish the iPhone update and deploy, tag `v0.3.0`. _Demo:_ the end-to-end demo above, on the deployed app.

## New concepts, introduced as they come up

Postgres `jsonb` columns and join tables in Prisma (≈ owned types / many-to-many in EF Core), startup tasks in NestJS (`OnApplicationBootstrap` ≈ `IHostedService`), SPARQL against Wikidata (for drafting the seed), Expo Router dynamic routes for universe and character pages.

## Risks

- **Matching quality** (Tasks 1–2): source data is community-entered and patchy; expect misses and occasional false positives. Mitigations: combine several signals, tests with real recorded data including negative cases, and manual fixes (Task 7).
- **DC vs Marvel characters with shared names**, and crossovers (Task 1): an item may belong to several universes; character matching is scoped to the matched universe.
- **Backfill on Render** (Task 2): refetching every cached item must respect rate limits and not slow startup; run it as a separate, resumable command.
- **Seed licensing** (Task 1): Wikidata is CC0; Rebrickable's terms forbid using its content to train AI models but allow this use. Credit both in the README.

## Verification

- Every task: `npm run typecheck && npm run lint && npm test` at the root, API e2e tests against Docker Postgres, CI green.
- App tasks: checked on web in the browser and on the iPhone in Expo Go (published with `npm run update:ios -w @fandex/mobile`).
- Stage demo: the end-to-end flow above, on the deployed app.
