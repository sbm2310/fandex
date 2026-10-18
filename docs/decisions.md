# Fandex — decisions and research

History of what was decided and why, by stage, plus the catalog data sources' terms. The current rules live in the CLAUDE.md files; read this when revisiting a decision or touching a data source.

## Catalog data sources

| Category                   | Source                                           | Notes                                                                                                                          |
| -------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Books / fantasy            | Open Library                                     | ISBN barcode scanning. Google Books rejected (see below)                                                                       |
| Comics                     | Open Library (trade paperbacks / graphic novels) | Comic Vine is **non-commercial only** (key revoked otherwise) — not used. Single issues later, e.g. Metron (terms unverified). |
| Manga                      | Open Library (volumes by ISBN)                   | AniList: free only under $150/mo revenue and bans use in "competing list/tracker" apps — not used without written permission.  |
| LEGO                       | Rebrickable                                      | In use (Task 9). Terms checked 2026-10-05 (see below). Brickset kept as fallback.                                              |
| Hot Toys / premium figures | **No known public API**                          | Biggest risk. Build our own catalog: AI extraction from photos + community contributions. Potential moat.                      |

Verify current terms, rate limits and attribution requirements for each API before integrating.

**Open Library (verified 2026-10-04):** 1 req/s by default, 3 req/s with an identifying `User-Agent` (`Fandex/0.1 (https://github.com/sbm2310/fandex)`; native only, browsers can't set it). Cache responses; requests only on behalf of a person, no bulk crawling. Cover URLs by ISBN are limited to 100/IP/5 min — always build covers from cover IDs (`/b/id/{id}-M.jpg`), which are unlimited. No formal attribution requirement; we credit Open Library in the app and README anyway. Coverage check (2026-10-04): 10/10 sample ISBNs found with covers, incl. 2025 releases, manga and comics.

**Rebrickable (terms checked 2026-10-05; archive copy read, confirmed on the live site by the owner):** "The Rebrickable API may be used for any purpose, including commercial." Crediting Rebrickable is appreciated (not required); set images may be shown/hotlinked. **Not allowed:** automated scraping/downloading outside the API, and **using Rebrickable content to train AI models** (a Stage 4 constraint). Requires a free API key: `REBRICKABLE_API_KEY` in `apps/api/.env` (optional; without it LEGO search answers 503 and cached sets are still served). Throttled to ~1 req/s (we space calls 1 s apart). The site is behind a Cloudflare bot check, so its pages can't be read by tools — never try to bypass it.

**Google Books — rejected (2026-10-04):** the Google APIs Terms forbid creating "permanent copies" of content or caching beyond cache headers (saving to a collection or our DB is a permanent copy); the Books terms forbid charging users without a separate agreement; display requires a "Powered by Google" logo and a link per result. Revisit only with a Google agreement.

## Stage 1 decisions (settled 2026-10-04)

- **Scope:** books only, from Open Library (keyless and CORS-friendly, so the app calls it directly). ISBN misses show a not-found message suggesting a title search; manual entry may come later. Manga, comics and LEGO wait for the Stage 2 backend (Comic Vine/Rebrickable keys can't live in the client; Comic Vine has no CORS).
- **Repo:** npm-workspaces monorepo — `apps/mobile` (Expo), `packages/core` (pure TS: domain types, ISBN utils, catalog adapters; consumed as TS source via `main: src/index.ts`). Stage 2 adds `apps/api`.
- **Client:** latest stable Expo SDK (57 at time of writing), TypeScript strict, Expo Router, `StyleSheet` + a small theme file (light/dark), TanStack Query for both catalog search and the collection.
- **Persistence:** local only, behind a `CollectionRepository` interface; Stage 1 implementation uses AsyncStorage. Stage 2 swaps in an API-backed repository.
- **Domain model:** catalog entries (`CatalogBook`) are separate from owned copies (`CollectionItem`, which snapshots the catalog entry).
- **ISBN scanning:** `expo-camera` on iOS/Android; manual ISBN entry everywhere (scan hidden on web).
- **Testing on device:** Expo Go on a real iPhone (no Xcode installed → no simulator). No Apple Developer account needed for Stage 1.
- **Tooling:** TypeScript pinned to **6.0.x** (matches Expo SDK 57; ts-jest and typescript-eslint don't support TS 7 yet). Jest (ts-jest in `core`, `jest-expo` in the app), ESLint flat config + Prettier, GitHub Actions CI (format, typecheck, lint, test). Each workspace owns its `typecheck`/`lint`/`test` scripts; the root runs them across workspaces.
- **Git:** public GitHub repo, one commit per task.

## Stage 2 decisions (settled 2026-10-05)

Full plan and task list: [`docs/plans/stage-2.md`](docs/plans/stage-2.md).

- **Backend:** NestJS + Prisma in `apps/api`; PostgreSQL via Docker Compose locally and in CI.
- **Auth:** Better Auth inside the API (users in our Postgres); email + password in Stage 2; Apple/Google sign-in later with our own build. In-app account deletion is required (App Store).
- **Catalog:** served by our API and cached in `catalog_item`; Open Library for books, manga and comic trade paperbacks (category from subjects); Rebrickable for LEGO after a manual terms check.
- **Sync:** online-first when signed in; guest mode (on-device collection) when signed out; guest collection imported on first sign-in.
- **Contracts:** zod schemas in `packages/core`, shared by API and app.
- **Hosting (Task 11):** Render free web service + Neon free Postgres, both without a card (Railway ruled out — not free). Live at https://fandex-4mjc.onrender.com.

## Stage 3 decisions (settled 2026-10-06)

Full plan and task list: [`docs/plans/stage-3.md`](docs/plans/stage-3.md).

- **Universes:** a curated seed in `packages/core` (aliases, LEGO theme ids, main characters, Wikidata ids), drafted from Wikidata (CC0) and reviewed by hand; items matched automatically by a pure, tested `matchUniverses` function; per-item manual fixes.
- **Starting universes:** Middle-earth, Star Wars, Wizarding World, DC, Marvel (the owner's fandoms). Others are added by extending the seed.
- **Characters:** universe and character pages both in Stage 3.
- **Signals:** books — title, series, Open Library people/places/subjects (authors never count as characters); LEGO — Rebrickable theme and minifig names. Open Library is patchy (some volumes list no characters, one novel lists its author), so rules combine signals.
- **Links:** automatic links on `catalog_item` (shared), user overrides on `collection_item`; links travel with catalog entries so guest mode works.
- **"You're missing…" suggestions:** deferred until after Stage 3.

## Stage 4 decisions (settled 2026-10-07)

Full plan and task list: [`docs/plans/stage-4.md`](docs/plans/stage-4.md).

- **AI provider (revised 2026-10-08):** for shelf scanning, **Gemini's free tier while the owner is the only user** (it read the owner's shelves far better: 94% vs 42% of items), then prepaid Gemini or Groq before inviting anyone — the free tier's limits and terms don't fit real users (below). The provider is one setting (`AI_PROVIDER`). Originally: Groq free plan (no card), behind our own `VisionModel` / `LanguageModel` interfaces. Its Services Agreement forbids Groq from training on inputs/outputs and allows end-user apps. Rejected: Gemini free tier (trains on content, "no personal information", no EU/UK users), Cloudflare Workers AI, GitHub Models (prototyping only), OpenAI/Anthropic (no free API).
- **Groq model:** `qwen/qwen3.8-27b` (Groq's only vision model; ≤ 3 images per request; strict JSON-schema outputs). Free plan: 30 req/min, 1,000 req/day, 8K tokens/min, **200K tokens/day**. Model ids are config — Groq retires models.
- **Access:** signed-in users only, per-user daily quotas plus a global guard; `GROQ_API_KEY` optional (AI endpoints answer 503 without it). Zero Data Retention in the Groq console is the owner's to turn on (the README says so conditionally until confirmed).
- **Shelf scan (revised after Task 1's measurements, [docs/eval/shelf-recognition.md](docs/eval/shelf-recognition.md)):** an assist — one shelf per photo, sent as two halves; the model finds about half the English items and invents some plausible titles, so every guess goes to a review screen (search for misses). Whole-bookcase photos and Hebrew spines don't work (that was Groq; Gemini reads Hebrew and ~94% of items). The model reads titles/authors/set numbers; our catalogs supply the entries. Photos are resized on the device and never stored. Figures later.
- **Rapid barcode scan** (added after Task 1): scan book after book, then add them all — the reliable bulk-add path; no AI, works for guests.
- **Ask your collection:** the model turns the question into a `CollectionQuery`; core runs it on the collection. The collection (and any Rebrickable content) is never sent to the model. Keyword fallback when AI is unavailable.

## Stage 5 decisions (settled 2026-10-11)

Full plan and task list: [`docs/plans/stage-5.md`](docs/plans/stage-5.md).

- **Reminders in the app only:** an Upcoming tab (needs attention first) with a badge count; no notifications for now (push needs the Apple Developer account, Stage 6), so no scheduled jobs.
- **Custom items and a `figure` category:** items not in any catalog (Hot Toys…) are created by hand, private to their owner (`catalog_item.source = custom` + `owner_id`), universe-linked like other items; guests can create them too.
- **Release dates:** entered by the owner; for books, Open Library's future publish date when it has one, re-checked when pre-orders are opened (at most daily), changes recorded as slips. Brickset/Metron not used (terms unconfirmed).
- **A pre-order holds** price, deposit, balance and its due date (money as integer minor units + currency, default USD), expected release (day + precision) with its change history, store/order number/link, status; "Arrived" moves it into the collection in one transaction.
- **Pre-orders need an account** (cross-device payments and dates; no device→account sync path).
- **Ask learns pre-orders** ("What's arriving this month?", "How much do I still owe?"), still without sending them to the model (done in Task 7).

## Stage 6 decisions (settled 2026-10-12)

Full plan and task list: [`docs/plans/stage-6.md`](docs/plans/stage-6.md).

- **Scope:** book series from **Wikidata** (by the owned book's Open Library work id, `P648` → series `P179` with ordinals `P1545`; CC0, no key, ≤ 5 parallel queries and 60 s of query time a minute, descriptive User-Agent) and manga/comic volumes parsed from titles, plus the next volume from Open Library. LEGO themes later.
- **Shown on** the item page, a Series view and Ask. **Actions:** Add / Pre-order only (no dismissing, no wishlist yet).
- **Numbered entries only** count as missing (novellas and fractional ordinals are side stories); volumes from 1 to the highest owned, plus the next.
- **Works for guests:** series data public and cached on the server (30 days), what's missing computed on the device.
- **Deployed** with Stage 7 on 2026-10-15.

## Stage 7 decisions (settled 2026-10-13)

Full plan and task list: [`docs/plans/stage-7.md`](docs/plans/stage-7.md).

- **No API exists for Hot Toys or InArt** (researched 2026-10-13: no official database, nothing in Wikidata, retailer and InArt terms allow personal non-commercial use only, InArt's site is under UK/French law). **No scraping, no copied text or images**: Fandex stores facts it writes itself, each with its sources.
- **Shared figures** come from a curated list in the repository (all InArt; a starter set of ~25 Hot Toys each for Star Wars, Marvel and DC — Hot Toys never made Middle-earth or Wizarding World figures; drafted by Claude from several sources, spot-checked by the owner) and from figures users suggest that the owner approves on an admin screen (admins by email in a server setting). Private figures stay private unless suggested.
- **No catalog pictures yet** (placeholder); private figures keep their image link. Render's free plan has no disk; photos belong to the brands.
- **Box-reading AI is in this stage** (same providers, fallback and quotas as shelf scans; an evaluation set of the owner's box photos).
- A Sideshow affiliate feed (Hot Toys) is a later option: it needs a public site and approval.

## UI redesign decisions (settled 2026-10-15)

Full plan and task list: [`docs/plans/redesign.md`](docs/plans/redesign.md); mockups: the owner's "Fandex UI redesign" canvas (https://claude.ai/artifact/Jg7XsCESkUGT7ZkLzv2EjZ). Done (Tasks 1–8, 2026-10-15); comes before Stage 8 (launch), which waits on the owner's cost decisions.

- **Look:** "the collector's vitrine" — warm near-black ground, violet for actions, amber only for money and due dates, a colour per universe (app-side, by slug), Bricolage Grotesque for display and Figtree for text (`@expo-google-fonts/*`, free), box-art tiles for figures without photos.
- **Both modes, dark first;** the app keeps following the phone's setting. Token names in `constants/theme.ts` stay the same.
- **Home:** the Collection tab opens on "Your shelf" (universes, coming up, recently added, Ask); "Everything" opens today's grid. The iOS tab bar stays native.
- **Look and layout only,** plus "I've paid it" on a pre-order needing attention and "N of M characters" on universe cards. Accessibility labels stay unchanged (tests and Maestro flows select by them).

- **Stage 7 status** (Task 9, 2026-10-15): built, tested, documented and **deployed with Stage 6 on 2026-10-15** (Render: all four migrations applied, "Figure catalog synced: 163 figures"; `ADMIN_EMAILS` set to the owner's email in the dashboard; iPhone app republished with EAS Update). Open: the owner's spot-check of the curated figure list, the box-reading evaluation (`eval:boxes`) and the live box-scan demo — both need the owner's box photos. Collection grid items are labelled "Title, category, by …" (Maestro flows must include the category for figures).
