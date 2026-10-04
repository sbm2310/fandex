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
  - Backend: Node.js with TypeScript (NestJS is the leading option — confirm in planning)
  - Database: PostgreSQL
- **Dev machine:** Intel MacBook Pro — use Expo cloud builds (EAS) for iOS builds; test on a real iPhone via Expo Go / dev builds
- **Approach:** long-term project, delivered in stages; every stage ends with a working, demo-able version

## Catalog data sources

| Category                   | Source                     | Notes                                                                                                     |
| -------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------- |
| Books / fantasy            | Open Library, Google Books | ISBN barcode scanning                                                                                     |
| Comics                     | Comic Vine API             | Free API key; 200 requests per resource per hour → must cache in our own DB                               |
| Manga                      | AniList (GraphQL)          | Free                                                                                                      |
| LEGO                       | Rebrickable, Brickset APIs |                                                                                                           |
| Hot Toys / premium figures | **No known public API**    | Biggest risk. Build our own catalog: AI extraction from photos + community contributions. Potential moat. |

Verify current terms, rate limits and attribution requirements for each API before integrating.

**Open Library (verified 2026-10-04):** 1 req/s by default, 3 req/s with an identifying `User-Agent` (`Fandex/0.1 (https://github.com/sbm2310/fandex)`; native only, browsers can't set it). Cache responses; requests only on behalf of a person, no bulk crawling. Cover URLs by ISBN are limited to 100/IP/5 min — always build covers from cover IDs (`/b/id/{id}-M.jpg`), which are unlimited. No formal attribution requirement; we credit Open Library in the app and README anyway.

## Roadmap

| Stage                    | Target    | Demo at the end                                                                                  |
| ------------------------ | --------- | ------------------------------------------------------------------------------------------------ |
| 1. MVP                   | ~Week 1   | App on iPhone + web: add items by search or ISBN scan, see the collection with covers            |
| 2. Real backend          | Weeks 2–4 | Accounts, cloud sync phone ↔ web, unified catalog search across all sources                      |
| 3. Universe layer        | Month 2   | Franchise/character pages linking items across categories, missing-item suggestions              |
| 4. AI                    | Month 3   | Shelf photo → identified items; natural-language questions about the collection                  |
| 5. Pre-orders & releases | Month 4   | Release dates, payment reminders, push notifications (event-driven)                              |
| 6. Launch                | After     | TestFlight → App Store, shareable public collection pages, beta users from collector communities |

## Stage 1 decisions (settled 2026-10-04)

- **Scope:** books only (Open Library primary, Google Books fallback for ISBN lookups). Both are keyless and CORS-friendly, so the app calls them directly. Manga, comics and LEGO wait for the Stage 2 backend (Comic Vine/Rebrickable keys can't live in the client; Comic Vine has no CORS).
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
- **Two Jest versions:** `core` uses Jest 30 (ts-jest); the app uses Jest 29 (`jest-expo`). Each workspace runs its own.
- **App tests:** use `renderRouter` from `expo-router/testing-library`; it returns a promise with `getPathname()` etc. attached — keep the reference, then `await` it. Tests live in `src/__tests__/`, never in `src/app/`.
- **`<Link asChild>`:** the child must get a single flattened style object (`StyleSheet.flatten`), not an array or style function — otherwise it throws on web.
- **Expected `npm ls` warning:** `react-reconciler` (from RNTL's `test-renderer`) wants React ^19.3 and flags our pinned 19.2.3 as "invalid". Test-only and harmless; revisit when Expo moves to React 19.3.
- **App services via context:** screens get the `BookCatalog` from `CatalogProvider` (`useCatalog()`); tests wrap screens with `createWrapper(fakeCatalog)` from `src/test-utils/providers.tsx`. Never hit real APIs in tests.
- **Web focus rings:** RN style types can't express `outline-style: none`; web-only CSS lives in `src/global.css`.
- **Read the versioned Expo docs** before touching Expo APIs (see `apps/mobile/AGENTS.md`).

## Open questions (deferred to later stages)

- Backend framework (NestJS vs. lighter options) and hosting — Stage 2 planning
- Auth provider — Stage 2 planning
- Data model for "universe / character / item" links across categories — Stage 3
- Which AI/vision model to use for shelf-photo recognition, and cost per scan — Stage 4
- Apple Developer account — buy during Stage 2 (needed for dev builds/TestFlight; push notifications in Stage 5 at the latest)

## Working agreements

- The owner (Shalom) is an experienced full-stack C#/.NET + React developer, **new to React Native, Expo and Node backends**. Explain new concepts briefly when introducing them; map them to .NET equivalents where helpful.
- Plan each stage before coding it; break stages into small tasks that each leave the app working.
- Keep this file updated as decisions are made.
- This is also a portfolio project: favor clean architecture, tests, and a good README over shortcuts.
