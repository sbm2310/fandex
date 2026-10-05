# Stage 2 plan: Real backend

**Goal (from the roadmap):** accounts, cloud sync phone ↔ web, and a unified catalog across categories.

**Demo at the end:** sign up on the iPhone, add a manga volume by scanning it and a LEGO set by searching, then open the web app, sign in, and see the same collection with category badges and filters.

## Decisions (settled 2026-10-05)

| Question                | Decision                                                 | Why                                                                                                                                                                                                                                                                                                                                       |
| ----------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comics & manga data     | **Open Library first**                                   | Manga volumes and comic trade paperbacks have ISBNs, and Open Library covers them (One Piece v1 and Batman: Year One both found). Comic Vine is non-commercial only; AniList bans use in "competing list/tracker" apps and is free only under $150/month revenue. Single comic issues come later (e.g. Metron, after checking its terms). |
| LEGO data               | **Rebrickable** (terms verified by hand first)           | Key-based API; the key stays on the server. Rebrickable's terms pages block automated reading, so Task 9 starts with a manual check. Fallback: Brickset (100 calls/day until approved for more; no "copycat" sites).                                                                                                                      |
| Backend                 | **NestJS + Prisma** in `apps/api`                        | NestJS mirrors ASP.NET Core (modules ≈ feature folders, providers ≈ DI services, guards ≈ authorization filters, pipes ≈ model binding/validation). Prisma's schema + migrations ≈ EF Core.                                                                                                                                               |
| Auth                    | **Better Auth**, running inside the API                  | Open-source; users, sessions and accounts live in our Postgres; no per-user fees, no vendor lock-in. The Expo plugin keeps the session in the iOS Keychain (`expo-secure-store`); web uses cookies.                                                                                                                                       |
| Sign-in methods         | **Email + password** in Stage 2                          | Works in Expo Go and on web. Apple/Google sign-in need our own build (Apple Developer account); added later. App Store rule to remember: offering Google sign-in requires also offering Sign in with Apple.                                                                                                                               |
| Database (dev & CI)     | **PostgreSQL in Docker Compose**                         | Same image locally and in GitHub Actions. Requires Docker Desktop to be running.                                                                                                                                                                                                                                                          |
| Hosting                 | **Free tiers only, chosen in the last task**             | Budget is $0. Build and test locally first; then Render's free web service (sleeps after 15 min idle, ~1 min wake-up) + Neon's free Postgres (0.5 GB). Railway is ruled out (not free). Only options that need no credit card.                                                                                                            |
| API contract            | **Zod schemas in `packages/core`** shared by API and app | One source of truth for request/response shapes (like a shared DTO library), validated on the server by NestJS 12's built-in Standard Schema support (`@Body({ schema })`, `StandardSchemaValidationPipe`); zod 4 implements Standard Schema, so no extra library, plus OpenAPI docs at `/docs`.                                          |
| Sync model              | **Online-first**                                         | Signed in: the server is the source of truth; TanStack Query caches and updates optimistically. Signed out: today's on-device collection keeps working ("guest mode"). On first sign-in, the guest collection is imported into the account (duplicates merged). Offline editing is out of scope.                                          |
| Apple Developer account | **Not needed in Stage 2**                                | Email + password runs in Expo Go. Buy it when we add Apple sign-in, push notifications (Stage 5) or TestFlight.                                                                                                                                                                                                                           |

## Data model

```
user, session, account, verification   ← generated by Better Auth

catalog_item                            ← cached from external catalogs
  id uuid PK
  category      book | manga | comic | lego
  source        openlibrary | rebrickable
  external_id   text            UNIQUE (source, external_id)
  title, subtitle, creators text[], year int, publisher text
  isbn13 text   (indexed)       set_number text (LEGO), piece_count int (LEGO)
  cover_url text, fetched_at timestamptz

collection_item                         ← a user's owned copy
  id uuid PK
  user_id → user                ON DELETE CASCADE
  catalog_item_id → catalog_item
  added_at timestamptz, notes text
  UNIQUE (user_id, catalog_item_id)
```

- Catalog data is cached in our database: lookups hit external APIs once, every user shares the cache, and Stage 3 can link items to universes and characters through stable ids.
- **Category for Open Library items** comes from their subjects (e.g. "Manga", "Comic books, strips, etc.", "Graphic novels"), via a tested classifier in `core`. A per-item override can come later if the heuristic misfiles things.
- Ownership stays per edition, as in Stage 1. Work-level "you own another edition" stays a Stage 3 topic.

## Tasks (each one leaves the app working)

**1. API skeleton.** ✅ `apps/api` with NestJS (strict TS), config validated with zod (fails fast on missing env vars), `GET /health`, OpenAPI at `/docs`, Jest unit tests + Supertest e2e test, CI job. Give `packages/core` a build step so Node can consume it (Metro and Jest keep using the source). `docker-compose.yml` with Postgres. _Demo:_ `curl localhost:3000/health` → `ok`; the app is unchanged.

**2. Database & Prisma.** ✅ Prisma schema for `catalog_item` (users come next), first migration, Prisma service in Nest, health check includes the DB. CI runs e2e tests against a Postgres service container. _Demo:_ `/health` reports the database as up.

**3. Auth on the API.** ✅ Better Auth with the Prisma adapter (generates user/session/account tables), email + password, built-in rate limiting on auth routes, an `AuthGuard` (≈ `[Authorize]`), `GET /me`. e2e tests: sign up, sign in, `/me` with and without a session. _Demo:_ sign up and call `/me` with `curl`.

**4. Accounts in the app.** An Account screen with sign up / sign in / sign out using the Better Auth Expo client (Keychain storage on iOS, cookies on web; CORS configured for the web origin). **Delete account** (an App Store requirement for any app with sign-up). Guest mode keeps working unchanged. Tests with a fake auth client. _Demo:_ create an account on the iPhone, sign in with it on web.

**5. Catalog API.** `GET /catalog/search?q=` and `GET /catalog/isbn/:isbn` on the server using core's `OpenLibraryCatalog` (with our User-Agent everywhere now, including for web users), results upserted into `catalog_item`, ISBN lookups served from the cache when present. Category classification from Open Library subjects. e2e tests with recorded fixtures (no live calls). _Demo:_ `curl` a manga ISBN → `category: "manga"`.

**6. App uses the catalog API.** An `ApiCatalog` implementing `BookCatalog` replaces direct Open Library calls (screens don't change). Category badges on results and in the collection. _Demo:_ scanning a manga volume shows a "Manga" badge.

**7. Collection API.** `GET/POST/DELETE /collection` for the signed-in user: idempotent add, newest first, items returned with their catalog data. e2e tests including **user isolation** (user A can never see or remove user B's items). _Demo:_ add and list items with `curl`.

**8. Cloud sync in the app.** An `ApiCollectionRepository` implementing `CollectionRepository`: used when signed in, local storage when signed out. Optimistic add/remove. On first sign-in, offer to import the guest collection (merged by edition), then clear it locally. _Demo:_ add a book on the iPhone, refresh the web app, it's there.

**9. LEGO.** Verify Rebrickable's terms and attribution by hand (switch to Brickset or defer if they don't fit). A `RebrickableCatalog` adapter on the server (key in env), search by name or set number (e.g. "75192"), cached as `category: lego` with set number, year, piece count and image. _Demo:_ search "Millennium Falcon", add the set.

**10. Unified search & filters.** Category filter chips on the Add screen (All / Books / Manga / Comics / LEGO) and in the collection; LEGO rows show set number and piece count; detail screen adapts per category. _Demo:_ filter the collection to just LEGO.

**11. Deploy & Stage 2 demo.** Re-verify free-tier limits and card requirements, then deploy on free tiers only (no paid services), provision production Postgres, run migrations in the deploy pipeline, set up a free email provider for verification and password reset (or defer email if none fits), environment-specific API URLs for the app, and point the iPhone and web apps at the deployed API. Update README (architecture diagram, API docs link) and tag `v0.2.0`. _Demo:_ the full end-to-end demo above, on the deployed backend.

## New concepts, introduced as they come up

NestJS modules/providers/guards/pipes (vs. ASP.NET Core), Prisma schema & migrations (vs. EF Core), Docker Compose, Better Auth sessions (cookie vs. bearer token on native), CORS with credentials, zod schemas as shared contracts, Supertest e2e tests (≈ `WebApplicationFactory`), environment-specific config in Expo (`app.config.ts`, EAS environment variables).

## Risks

- **Free tiers change** (Task 11): limits or card requirements may differ from what was researched; re-check before deploying, and keep the app usable in guest mode regardless.

- **Rebrickable terms** (Task 9): unverified; fallback Brickset or defer LEGO to Stage 3.
- **Open Library category heuristics** (Task 5): subjects are community-entered and inconsistent; expect misclassifications and consider a manual override.
- **Better Auth's NestJS adapter is community-maintained** (Task 3): if it's a problem, mount Better Auth's own request handler on a route directly; it's framework-agnostic.
- **Expo Go + cookies on web across origins** (Task 4): needs correct CORS and `trustedOrigins`; verified early in that task.

## Verification

- Every task: `npm run typecheck && npm run lint && npm test` at the root, API e2e tests against Docker Postgres, CI green.
- App tasks: checked on web in the browser pane and on your iPhone in Expo Go.
- Stage demo: the end-to-end flow above, on the deployed API.
