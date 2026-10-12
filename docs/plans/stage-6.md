# Stage 6 plan: "You're missing…"

**Goal:** the first core feature still missing since Stage 1 — Fandex knows which series you collect and tells you what's missing: the Stormlight books you don't have, the One Piece volumes between the ones you own, and the next volume (with its release date when it's upcoming). Launch moves to Stage 7.

**Demo at the end:** own _The Way of Kings_ and _Words of Radiance_: the item page says "Book 1 of 5 in The Stormlight Archive — you're missing 3, 4 and 5", each with Add / Pre-order. Own One Piece 1–3 and 5: the Series view lists One Piece with volume 4 missing and volume 114 coming out in February 2027 (pre-order it). Ask "Which manga series am I missing volumes of?" and get the answer. Same on the web and in the iOS Simulator (a Maestro flow).

## Decisions (settled 2026-10-12)

| Question       | Decision                                                                                                                                      | Why                                                                                                                                                                                                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope          | **Book series (Wikidata) + manga and comic volumes (from titles)**; LEGO themes later                                                         | Measured below: Wikidata knows novel series well and links each book to its Open Library work, which owned books already store (`workKey`). It's poor for manga volumes, but their number is in the titles Fandex already has. LEGO themes would list hundreds of sets and need filtering, so they wait. |
| Where it shows | **Item page, a Series view, and Ask**                                                                                                         | The item page answers "what's next after this one?"; the Series view gives the overview; Ask's "Which manga series am I missing volumes of?" has been declined since Stage 4.                                                                                                                            |
| Actions        | **Add or Pre-order** a missing item; no dismissing and no wishlist for now                                                                    | Keeps the first version small. "I don't collect this series" and a wishlist can follow if suggestions get noisy.                                                                                                                                                                                         |
| What counts    | **Numbered entries only** (Stormlight 1–5, not the novellas; ACOTAR 3.1 is a novella); volumes from 1 to the highest owned, plus the next one | Collectors complete the main line; side stories (no or fractional series ordinal) are listed separately, not as "missing".                                                                                                                                                                               |
| Guests         | **Works for guests too**                                                                                                                      | Series data is public and cached on the server; what's missing is computed on the device from the collection, like universe pages.                                                                                                                                                                       |
| Cost           | **$0**                                                                                                                                        | Wikidata Query Service: free, no key; a descriptive User-Agent, ≤ 5 parallel queries and 60 s of query time per minute (429 + `Retry-After` beyond); data CC0. Cached in our database, so it's asked once per work a month. Open Library as before.                                                      |

## Spike (2026-10-12)

- **From a work you own to its series:** one SPARQL query by Open Library work id (`wdt:P648`) returns the series (`P179`) with every member's ordinal (`P1545`), work id and publication date, in 2–4 s. _The Way of Kings_ → Stormlight 1–5 + 2 novellas; _Philosopher's Stone_ → Harry Potter 1–7 (+ Cursed Child, unnumbered; a "0.5" prequel); _Mistborn_ → 7 numbered books, in two series (Mistborn, and the Cosmere without ordinals); _A Court of Mist and Fury_ → 1, 2, 3, 3.1, 4; _The Hobbit_ → no series (correct). Members must be literary works (`P31/P279* Q7725634`), or film and TV seasons of the same name join in.
- **Manga in Wikidata:** One Piece and Jujutsu Kaisen mix volumes with episodes, chapters and seasons — unusable for volumes.
- **A missing book's edition:** Open Library search `key:/works/OL…W` returns the work with an English edition and ISBN.
- **Volume titles in real data:** "One Piece, Vol. 24: People's Dreams", "Hunter × Hunter, Volume 7", "ONE PIECE 113", "Ultimate X Men, Vol. 10", "New Avengers Vol. 4", "Oyayubihime Infinity" + subtitle "Volume 6 (…)". Traps: "Spider-Man 2099", "Comic Reader 3", omnibuses.

## Design

```
App (device)                                   API                                      Sources
 owned books' workKeys ─► GET /series/works?keys=… ─► series + work_series (cached 30 d) ◄── Wikidata SPARQL
 owned manga/comics ─► core parseVolume → gaps                                            (by Open Library work id)
 next volume? ────────► GET /catalog/search "<series> <n+1>" (core picks it) ─► Open Library (cached)
 missing book: Add / Pre-order ─► GET /catalog/work/:workKey ─► catalog_item (an English edition)
 Ask "missing volumes" ─► POST /ai/ask → query scope "series" → core on the user's items + cached series
```

- **Core owns the rules:** `parseVolume(title, subtitle, category)` → series name + number (tested on the real titles above), `seriesGaps(items, series)` → missing numbered entries and the next one, the Wikidata adapter (query, parsing, choosing the series the work is numbered in) with recorded fixtures.
- **Server caches, device decides:** like universes, the device compares its own collection with public series data, so guests and accounts share one path and it updates the moment something is added.

## Tasks (each leaves the app working)

**1. Volumes in core.** ✅ `parseVolume` and `volumeGaps` for manga and comics (series name normalized, "Vol."/"Volume"/"#"/trailing number for manga only, traps rejected), with the spike's real titles as tests. _Demo:_ tests.

**2. Wikidata series in core.** ✅ `WikidataSeriesCatalog.seriesForWork(workKey)` → `{ series: { id, name }, entries: [{ workKey, title, ordinal, published }] }` (numbered entries; side stories separate; the series the work is numbered in when there are several), contracts, recorded real responses. _Demo:_ tests.

**3. Series in the API.** ✅ Tables `series` (entries and extras as validated JSON, read and replaced whole) and `work_series` (work → series, including "none", re-checked after 30 days); `GET /api/series/works?keys=` (public, ≤ 50 keys, spaced Wikidata calls, a busy Wikidata → what's cached); `GET /api/catalog/work/:workKey` (an English edition, saved like any search result). e2e tests. _Demo:_ `curl` the Stormlight Archive.

**4. Next volume.** ✅ _Changed from the first plan:_ no new endpoint. Core's `findNextVolume(series, search)` searches with the app's existing book search (through the API, cached and spaced) for "<series> <n+1>" and `pickVolume` accepts only a result whose title reads as the same series and number (read as the series' category, since results are often misfiled; the right category, then a known date, then an ISBN first). Works for guests too. Tested on recorded real searches; live: One Piece 114 (February 2, 2027), Hunter × Hunter 38, Jujutsu Kaisen 27, none for Vagabond 38 (on hiatus). Known gap: Open Library sometimes picks a non-English edition (One Piece 114 is Carlsen's German one). _Demo:_ One Piece 114, February 2027.

**5. Item page.** ✅ "Book 2 of 5 in The Stormlight Archive", the missing numbered entries and the next volume, each with Add / Pre-order (catalog entry fetched on demand). _Demo:_ the item page in the Simulator.

**6. Series view.** Your incomplete series (books and volumes), what's missing and what's next; from the Collection tab. _Demo:_ the list.

**7. Ask about series.** "Which manga series am I missing volumes of?" / "What am I missing from Stormlight?" answered from the collection and cached series (scope `series`); prompt, schema, keyword fallback, replies re-recorded. _Demo:_ ask it.

**8. Polish.** Empty and error states, accessibility, a Maestro flow, README, CLAUDE.md. _Demo:_ the demo above. (Deploying waits until the owner wants it.)

## Risks

- **Wikidata coverage** is uneven outside well-known series, and some members lack Open Library ids (then they're shown by title, with a search link instead of Add).
- **Volume titles** vary; a misparse could invent a gap. Parsing is conservative (unrecognised titles count as standalone), and the tests use real titles.
- **Wikidata limits** (60 s of query time a minute): series are cached for a month and asked one work at a time, spaced.
