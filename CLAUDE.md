# Fandex

A collection app for fans who collect across formats — comics, manga, fantasy books, premium figures (Hot Toys and similar), and LEGO — organized **by universe and character** rather than by product type, with AI that makes adding items nearly effortless.

## Why this exists

Existing collector apps are either single-category (LEGO-only like Brickset/Rebrickable apps, figure-only like iCollect or Toy Collector) or generic catalogers with blank fields (Koillection). AI photo scanners (Toyzie, SnapToy) already identify one item at a time and give a value, so "scan one item and value it" is not our differentiator.

Nobody connects a collection the way fans think about it: "everything I own from Middle-earth / Batman / One Piece" across books, figures and LEGO.

## Core features (differentiators)

1. **Universe layer** — franchise and character pages that link items across categories, with "you're missing…" suggestions.
2. **Shelf-photo import** — photograph a whole shelf; AI identifies every item and adds them in one go.
3. **Ask your collection** — natural-language questions ("What Batman stuff do I own?", "Which manga series am I missing volumes of?", "What's arriving this month?").
4. **Pre-orders & releases** — track pre-orders (Hot Toys can sit for a year+), payment reminders, release-date slips, LEGO retirements; event-driven notifications.

## Decisions made

- **Name:** Fandex
- **Market:** real users, English, launching for the US
- **Platforms:** iPhone first, then Android and web (same codebase)
- **Stack:** TypeScript end to end
  - Client: React Native + Expo (iOS, Android, web from one codebase)
  - Backend: Node.js with TypeScript — NestJS + Prisma (decided in Stage 2 planning)
  - Database: PostgreSQL
- **Dev machine:** Intel MacBook Pro — use Expo cloud builds (EAS) for iOS builds; test on a real iPhone via Expo Go / dev builds
- **Approach:** long-term project, delivered in stages; every stage ends with a working, demo-able version

## Catalog data sources

| Category                   | Source                                           | Notes                                                                                                                                                         |
| -------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Books / fantasy            | Open Library                                     | ISBN barcode scanning. Google Books rejected (see below)                                                                                                      |
| Comics                     | Open Library (trade paperbacks / graphic novels) | Comic Vine is **non-commercial only** (key revoked otherwise) — not used. Single issues later, e.g. Metron (terms unverified).                                |
| Manga                      | Open Library (volumes by ISBN)                   | AniList: free only under $150/mo revenue and bans use in "competing list/tracker" apps — not used without written permission.                                 |
| LEGO                       | Rebrickable (planned)                            | Terms not yet verified (pages block automated reads) — check by hand before integrating. Brickset fallback: 100 calls/day until approved; no "copycat" sites. |
| Hot Toys / premium figures | **No known public API**                          | Biggest risk. Build our own catalog: AI extraction from photos + community contributions. Potential moat.                                                     |

Verify current terms, rate limits and attribution requirements for each API before integrating.

**Open Library (verified 2026-10-04):** 1 req/s by default, 3 req/s with an identifying `User-Agent` (`Fandex/0.1 (https://github.com/sbm2310/fandex)`; native only, browsers can't set it). Cache responses; requests only on behalf of a person, no bulk crawling. Cover URLs by ISBN are limited to 100/IP/5 min — always build covers from cover IDs (`/b/id/{id}-M.jpg`), which are unlimited. No formal attribution requirement; we credit Open Library in the app and README anyway. Coverage check (2026-10-04): 10/10 sample ISBNs found with covers, incl. 2025 releases, manga and comics.

**Google Books — rejected (2026-10-04):** the Google APIs Terms forbid creating "permanent copies" of content or caching beyond cache headers (saving to a collection or our DB is a permanent copy); the Books terms forbid charging users without a separate agreement; display requires a "Powered by Google" logo and a link per result. Revisit only with a Google agreement.

## Roadmap

| Stage                    | Target    | Demo at the end                                                                                  |
| ------------------------ | --------- | ------------------------------------------------------------------------------------------------ |
| 1. MVP ✅ (v0.1.0)       | ~Week 1   | App on iPhone + web: add items by search or ISBN scan, see the collection with covers            |
| 2. Real backend          | Weeks 2–4 | Accounts, cloud sync phone ↔ web, unified catalog search across all sources                      |
| 3. Universe layer        | Month 2   | Franchise/character pages linking items across categories, missing-item suggestions              |
| 4. AI                    | Month 3   | Shelf photo → identified items; natural-language questions about the collection                  |
| 5. Pre-orders & releases | Month 4   | Release dates, payment reminders, push notifications (event-driven)                              |
| 6. Launch                | After     | TestFlight → App Store, shareable public collection pages, beta users from collector communities |

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

### Monorepo / tooling gotchas (learned in Task 1)

- **Single React version:** root `package.json` has `overrides` pinning `react`/`react-dom` to the app's versions. Without it npm hoists a newer React (peer `"*"`) to the root → duplicate React at runtime. Update the overrides whenever the Expo SDK bumps React. Check with `npm ls react`.
- **Add app dependencies with `npx expo install <pkg>`** (from `apps/mobile`) to get SDK-compatible versions; for dev deps, move them into `devDependencies` afterwards (its `-- --save-dev` passthrough is unreliable).
- **ESLint 9, not 10:** `eslint-config-expo` → `eslint-plugin-react` doesn't support ESLint 10 yet. `eslint-import-resolver-typescript` is a direct app devDependency so `eslint-plugin-import` can find it (npm nests it otherwise).
- **Test runners:** `core` uses Jest 30 (ts-jest); the app uses Jest 29 (`jest-expo`); the API uses Vitest (NestJS 12's default for ESM projects). Each workspace runs its own.
- **How `@fandex/core` is consumed:** its `exports` map points the `source` / `react-native` / `browser` conditions at `src/index.ts` (Metro, the app's tsc and Vitest use these — no build needed) and `types` / `default` at `dist/` (built with tsdown, for Node). Only the API's runtime, build and typecheck need `dist`; `npm run typecheck`, and the API's `build`/`dev` scripts, build core first. `dist/` is gitignored.
- **API (NestJS 12):** ESM project (`"type": "module"`, `module: nodenext`), so relative imports in `apps/api` need `.js` extensions (`./app.module.js`). Config is validated with a zod schema (`src/config/env.ts`) via `ConfigModule.forRoot({ validationSchema })`. Shared app setup lives in `setup-app.ts` so e2e tests use the same configuration as `main.ts`. OpenAPI docs at `/docs`.
- **Local database:** `npm run db:up` / `db:down` (Docker Compose, Postgres 18; dev-only credentials in `docker-compose.yml`). Requires Docker Desktop running. Copy `apps/api/.env.example` to `apps/api/.env`.
- **Prisma 7.10 (pinned stable):** npm's `latest` tag for the `prisma` CLI pointed at an 8.0 _release candidate_ (2026-10-05); don't upgrade to 8 until it's final. Prisma 7 specifics: connection URL lives in `apps/api/prisma.config.ts` (not the schema), the client is generated into `src/generated/prisma` (gitignored; `prisma generate` runs automatically before build/dev/typecheck/test), it connects via `@prisma/adapter-pg`, and `migrate dev` no longer runs `generate`. Schema changes: edit `prisma/schema.prisma`, then `npm run db:migrate -w @fandex/api -- --name <change>` and commit the migration.
- **Auth (Better Auth 1.7 via `@thallesp/nestjs-better-auth`):** routes under `/api/auth/*` (`sign-up/email`, `sign-in/email`, `sign-out`, `get-session`…). A **global guard protects every route**; mark public ones with `@AllowAnonymous()` and read the user with `@Session() session: UserSession`. Apps must be created with `appOptions` (`bodyParser: false`) from `setup-app.ts`. Gotchas found in Task 3: (1) with `generateId: 'uuid'` Better Auth sends **no** id, so auth models need `@default(uuid(7))`; (2) Better Auth **disables its origin/CSRF check when NODE_ENV=test** — we set `advanced.disableOriginCheck: false` so tests exercise production security; (3) its rate limiter (3 failed sign-ins → 429) is off in tests only. To see the tables Better Auth expects after an upgrade: `npx auth@<version> generate` against a throwaway config, then port the fields into `schema.prisma` with our snake_case mappings.
- **API e2e tests** use a separate `fandex_test` database: `test/global-setup.ts` creates it and runs `prisma migrate deploy`; files run sequentially; `resetDatabase()` truncates tables between tests. CI provides Postgres as a service container.
- **App tests:** use `renderRouter` from `expo-router/testing-library`; it returns a promise with `getPathname()` etc. attached — keep the reference, then `await` it. Tests live in `src/__tests__/`, never in `src/app/`. Don't `return` that promise from an async helper (it gets unwrapped and loses the methods); wrap it in a plain object.
- **`<Link asChild>`:** the child must get a single flattened style object (`StyleSheet.flatten`), not an array or style function — otherwise it throws on web.
- **Expected `npm ls` warning:** `react-reconciler` (from RNTL's `test-renderer`) wants React ^19.3 and flags our pinned 19.2.3 as "invalid". Test-only and harmless; revisit when Expo moves to React 19.3.
- **App services via context:** screens get the `BookCatalog` from `CatalogProvider` (`useCatalog()`); tests wrap screens with `createWrapper(fakeCatalog)` from `src/test-utils/providers.tsx`. Never hit real APIs in tests.
- **`act(...)` warnings usually mean a real UI flash:** twice in Task 5 the warning came from a component rendering an interim state (e.g. "Add" before ownership was known). Fix the component (don't render until the data is known; update the query cache in `onSuccess`) rather than silencing the test.
- **Routing:** root `Stack` (in `src/app/_layout.tsx`) holds the `(tabs)` group plus screens that slide over the tabs (e.g. `book/[id]`). Groups don't change URLs.
- **Platform-specific files:** `foo.web.ts` replaces `foo.ts` on web (e.g. `utils/confirm.web.ts`, since RN's `Alert` is a no-op in browsers).
- **Camera / barcode scanning** (`src/app/scan.tsx`) only runs on a real device; tests mock `expo-camera`. In Expo Go the iOS permission prompt shows Expo Go's text; our `cameraPermission` string in `app.json` applies to our own builds (dev build / TestFlight). React Native 0.86 removed `StyleSheet.absoluteFillObject`; spread `StyleSheet.absoluteFill`.
- **Web focus rings:** RN style types can't express `outline-style: none`; web-only CSS lives in `src/global.css`.
- **Read the versioned Expo docs** before touching Expo APIs (see `apps/mobile/AGENTS.md`).

## Stage 2 decisions (settled 2026-10-05)

Full plan and task list: [`docs/plans/stage-2.md`](docs/plans/stage-2.md).

- **Backend:** NestJS + Prisma in `apps/api`; PostgreSQL via Docker Compose locally and in CI.
- **Auth:** Better Auth inside the API (users in our Postgres); email + password in Stage 2; Apple/Google sign-in later with our own build. In-app account deletion is required (App Store).
- **Catalog:** served by our API and cached in `catalog_item`; Open Library for books, manga and comic trade paperbacks (category from subjects); Rebrickable for LEGO after a manual terms check.
- **Sync:** online-first when signed in; guest mode (on-device collection) when signed out; guest collection imported on first sign-in.
- **Contracts:** zod schemas in `packages/core`, shared by API and app.
- **Hosting:** decided in the last task of Stage 2, **free tiers only** (Render free web service + Neon free Postgres; Railway ruled out — not free). Re-verify limits and card requirements then.

## Open questions (deferred to later stages)

- Production hosting and email provider (free tiers only) — last task of Stage 2
- Data model for "universe / character / item" links across categories — Stage 3. Include work-level matching: ownership is per edition (ISBN), so search can show "Add" for a different printing of a book the user owns; a "you own another edition" hint belongs here.
- Which AI/vision model to use for shelf-photo recognition, and cost per scan — Stage 4
- Apple Developer account — not needed for Stage 2 (email + password works in Expo Go); buy when adding Apple sign-in, push notifications (Stage 5) or TestFlight

## Working agreements

- The owner (Shalom) is an experienced full-stack C#/.NET + React developer, **new to React Native, Expo and Node backends**. Explain new concepts briefly when introducing them; map them to .NET equivalents where helpful.
- Plan each stage before coding it; break stages into small tasks that each leave the app working.
- Keep this file updated as decisions are made.
- This is also a portfolio project: favor clean architecture, tests, and a good README over shortcuts.
- **Budget: $0.** Use only free services and free tiers, preferably ones that need no credit card. Flag anything that could cost money (or requires a card on file) and ask before using it.
