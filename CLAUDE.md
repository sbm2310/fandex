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

## Where the notes live

This file holds what applies everywhere. Area notes load automatically when working in that folder — read them before changing code there:

- [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md) — NestJS, Prisma, auth, deployment, catalog/collection/AI/pre-order/series/figure endpoints
- [`apps/mobile/CLAUDE.md`](apps/mobile/CLAUDE.md) — Expo app: routing, services, tests, Maestro, Simulator, EAS Update, design system
- [`packages/core/CLAUDE.md`](packages/core/CLAUDE.md) — matching, parsing, money and dates, the Ask engine, figures and contracts
- [`docs/decisions.md`](docs/decisions.md) — decisions by stage and the data sources' terms (history; read when revisiting a decision or touching a data source)
- [`docs/plans/`](docs/plans/) — each stage's plan and task list

New gotchas go in the area's file; keep this one short.

## Roadmap

| Stage                            | Target    | Demo at the end                                                                                                      |
| -------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------- |
| 1. MVP ✅ (v0.1.0)               | ~Week 1   | App on iPhone + web: add items by search or ISBN scan, see the collection with covers                                |
| 2. Real backend ✅ (v0.2.0)      | Weeks 2–4 | Accounts, cloud sync phone ↔ web, unified catalog search across all sources                                          |
| 3. Universe layer ✅ (v0.3.0)    | Month 2   | Franchise/character pages linking items across categories (missing-item suggestions deferred)                        |
| 4. AI ✅ (v0.4.0)                | Month 3   | Shelf photo → identified items; natural-language questions about the collection                                      |
| 5. Pre-orders ✅ (v0.5.0)        | Month 4   | Pre-orders (custom figures too), payments due, release dates and slips, an Upcoming tab                              |
| 6. "You're missing…" ✅ (v0.6.0) | Month 5   | Book series (Wikidata) and manga/comic volumes: what's missing and what's next, on item pages, a Series view and Ask |
| 7. Figure catalog ✅ (v0.7.0)    | Month 6   | Curated Hot Toys and InArt figures, approved user suggestions, AI that reads a figure's box                          |
| 8. Launch                        | After     | TestFlight → App Store, shareable public collection pages, beta users from collector communities                     |

**Status (2026-10-15):** Stages 1–7 and the UI redesign are built; Stages 6 and 7 are deployed. Stage 8 waits on the owner's cost decisions. Next: the account page ([`docs/plans/account.md`](docs/plans/account.md), planned 2026-10-18). Open: the owner's spot-check of the curated figure list, the box-reading evaluation and a live box-scan demo (need the owner's box photos).

## Rules that apply everywhere

- **Data sources:** Open Library (books, manga, comic trades), Rebrickable (LEGO), Wikidata (series), our own curated figure list. Comic Vine, AniList and Google Books are rejected on their terms. Never scrape or bypass bot checks, never use Rebrickable content to train AI, and verify terms before adding a source (details: `docs/decisions.md`).
- **Contracts** are zod schemas in `packages/core`, shared by the API and the app.
- **Read an item's links through core's `itemLinks(item)`**, never `item.catalog.universes`; narrow entries with `isBookEntry` / `isBookItem`, not `category !== 'lego'`.
- **Tests never hit real APIs** (fakes in the app, overridden providers in the API); API tests ignore `.env`.
- **Before committing:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`. One commit per task.

## Monorepo / tooling

- **Tooling:** TypeScript pinned to **6.0.x** (matches Expo SDK 57; ts-jest and typescript-eslint don't support TS 7 yet). Jest (ts-jest in `core`, `jest-expo` in the app), ESLint flat config + Prettier, GitHub Actions CI (format, typecheck, lint, test). Each workspace owns its `typecheck`/`lint`/`test` scripts; the root runs them across workspaces.
- **Single React version:** root `package.json` has `overrides` pinning `react`/`react-dom` to the app's versions. Without it npm hoists a newer React (peer `"*"`) to the root → duplicate React at runtime. Update the overrides whenever the Expo SDK bumps React. Check with `npm ls react`.
- **Test runners:** `core` uses Jest 30 (ts-jest); the app uses Jest 29 (`jest-expo`); the API uses Vitest (NestJS 12's default for ESM projects). Each workspace runs its own.
- **How `@fandex/core` is consumed:** its `exports` map points the `source` / `react-native` / `browser` conditions at `src/index.ts` (Metro, the app's tsc and Vitest use these — no build needed) and `types` / `default` at `dist/` (built with tsdown, for Node). Only the API's runtime, build and typecheck need `dist`; `npm run typecheck`, and the API's `build`/`dev` scripts, build core first. `dist/` is gitignored.
- **Rebuilding core while the dev API runs can break it** (found 2026-10-13): `npm run build -w @fandex/core` empties `dist` and the watching API reloads mid-build — afterwards it ran without new service methods ("this.catalog.lookupWork is not a function", every lookup 500) while the e2e tests passed. Restart the `api` dev server after rebuilding core.

## Open questions (deferred to later stages)

- Email provider for verification and password reset (free tiers only) — needs a domain we own
- "You're missing…" for LEGO themes (sets in a theme you collect) — Stage 6 covers book series and manga/comic volumes
- Apple Developer account — not needed so far (email + password works in Expo Go; Stage 5 chose in-app reminders over push); buy when adding Apple sign-in, push notifications or TestFlight (Stage 6)

## Working agreements

- The owner (Shalom) is an experienced full-stack C#/.NET + React developer, **new to React Native, Expo and Node backends**. Explain new concepts briefly when introducing them; map them to .NET equivalents where helpful.
- Plan each stage before coding it; break stages into small tasks that each leave the app working.
- Keep the CLAUDE.md files and `docs/decisions.md` updated as decisions are made.
- This is also a portfolio project: favor clean architecture, tests, and a good README over shortcuts.
- **Budget: $0.** Use only free services and free tiers, preferably ones that need no credit card. Flag anything that could cost money (or requires a card on file) and ask before using it.
