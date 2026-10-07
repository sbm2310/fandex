# Stage 4 plan: AI

**Goal (from the roadmap):** make adding items nearly effortless and let you ask your collection questions in plain English.

**Demo at the end:** on the iPhone, photograph a shelf of Tolkien books, manga and LEGO boxes; Fandex lists what it recognised, matched to real catalog entries, with the ones you already own marked; untick a wrong guess and add the rest in one tap. Then ask "What Batman stuff do I own?" and "Which LEGO sets did I add this year?" and get exact answers. Same on the web.

## Decisions (settled 2026-10-07)

| Question                    | Decision                                                                                                               | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI provider                 | **Groq** (free plan, no card), behind our own interface                                                                | Its Services Agreement says Groq "is not permitted to use Inputs or Outputs for training" and allows apps for end users; the free plan is rate-limited, not billed. Rejected: Gemini free tier (content used to improve Google's products and human-reviewed; "do not submit… personal information"; no EU/UK users), Cloudflare Workers AI (10k neurons/day, weaker vision), GitHub Models (free tier is for prototyping), OpenAI/Anthropic (no free API). |
| Models (checked 2026-10-07) | **`qwen/qwen3.8-27b`** for photos (Groq's only vision model) and questions                                             | Supports images (≤ 3 per request, each counted as 2,048 tokens) and strict structured outputs (JSON schema). Free plan: 30 requests/min, 1,000/day, 8K tokens/min. `openai/gpt-oss-20b` is the fallback for questions. Model ids are config, not code: Groq retires models often.                                                                                                                                                                           |
| Who can use AI              | **Signed-in users only**, with per-user daily quotas                                                                   | The free allowance is shared by every user; quotas (and a global guard) keep one user from using it up. Guests see "Sign in to scan a shelf". Keys stay on the server.                                                                                                                                                                                                                                                                                      |
| Shelf scanning              | **Books, manga, comics and LEGO boxes**; AI guesses are matched to Open Library / Rebrickable and **confirmed by you** | The model only reads what it sees (title, author, volume, set number); our catalogs supply the real entries, so nothing invented reaches the collection. Premium figures need a catalog of our own — a later stage.                                                                                                                                                                                                                                         |
| "Ask your collection"       | **Question → structured query**, run by the app                                                                        | The model turns the question into a filter (universes, characters, categories, dates, count/list); a pure function in `core` runs it on your collection. Your collection is never sent to the AI, answers are exact and testable, and Rebrickable content never reaches a model (their terms forbid AI training on it). A keyword fallback answers simple questions when the AI is unavailable.                                                             |
| Photos                      | **Resized on the device, sent once, never stored**                                                                     | Smaller uploads and fewer tokens. Groq keeps request logs up to 30 days for abuse checks unless Zero Data Retention is on — we turn it on. The app says where the photo goes before the first scan.                                                                                                                                                                                                                                                         |
| Cost                        | **$0**                                                                                                                 | Groq free plan (requests fail with 429 when over the limit; there's nothing to bill). Same hosting as before.                                                                                                                                                                                                                                                                                                                                               |

## Design

```
App                                   API (NestJS)                          Groq
 photo → resize (expo-image-manipulator)
   POST /ai/shelf-scans  ───────────►  quota check (ai_usage)
                                       VisionModel.readShelf(image) ──────►  qwen3.8-27b + JSON schema
                                       ◄── candidates [{kind, title, author, volume, setNumber, confidence}]
                                       resolve each via CatalogService
                                       (Open Library / Rebrickable, spaced as today)
   ◄── candidates + best catalog match + alternatives + "owned"
 review screen → tick → add selected (existing collection API)

   POST /ai/ask {question} ─────────►  LanguageModel.toQuery(question, universe names) ─► JSON schema
   ◄── CollectionQuery (validated, names resolved to seed slugs)
 runCollectionQuery(items, query) in core → answer + items
```

- **Interfaces** (`VisionModel`, `LanguageModel`, like `IVisionModel` in .NET DI) with a `GroqClient` over Groq's OpenAI-compatible HTTP API (plain `fetch`, no SDK). Tests swap in fakes with `overrideProvider`, as with the catalogs; recorded Groq responses are fixtures.
- **Prompts and response schemas live in `core`** (pure: build the request, parse the reply with zod), so they're unit-tested without the network.
- **`GROQ_API_KEY` is optional:** without it the AI endpoints answer 503 and the app hides AI entry points (like LEGO without a Rebrickable key).
- **New table** `ai_usage (user_id, day, kind, count)` for quotas; nothing about the photo or question text is stored.
- **Where it lives in the app:** "Scan a shelf" on the Add tab next to the barcode scanner; "Ask" as a field on the Collection tab (no fifth tab — the web tab bar is already tight at phone width).

## Tasks (each one leaves the app working)

**1. Groq setup and a measured spike.** You create a free Groq account (no card), turn on Zero Data Retention, and put the key in `apps/api/.env`. Core: the shelf prompt and zod schema for candidates. An evaluation script (`npm run eval:shelf -w @fandex/api`, never in CI) runs ~10 photos of your own shelves against the model and scores the answers against a hand-written list of what's really on each shelf. Photos stay out of git; only the expected lists and the scores are committed. It decides image size and whether to split a wide shelf into 2–3 crops (each image costs 2,048 tokens). _Demo:_ a table of recall and precision per photo, and the chosen settings.

**2. AI in the API.** `AiModule` with `GroqClient`, `VisionModel` / `LanguageModel` tokens, config (`GROQ_API_KEY`, model ids), `ai_usage` table and per-user daily quotas (e.g. 10 scans, 50 questions), a global guard under Groq's free limits, Groq 429 → our 503 with "try again in a minute". `POST /ai/shelf-scans` (signed in; image as base64 JSON with a size cap) returns the model's candidates. e2e tests with a fake model: quotas, user isolation, oversize image, model errors, no key. _Demo:_ `curl` a photo and see the raw candidates.

**3. Matching guesses to the catalog.** Core: `rankMatches(candidate, results)` (title/author/volume similarity, set number exact) with tests on recorded searches. The API resolves each candidate through `CatalogService` (respecting the Open Library and Rebrickable spacing; set numbers via `lookupSet`, books via search), dedupes, marks items the user already owns, and returns the best match plus up to 3 alternatives; unmatched guesses come back as text so the user can search them. _Demo:_ the same photo now returns real catalog entries with covers.

**4. Shelf scan in the app.** Take or pick a photo (`expo-image-picker`, works in Expo Go and on the web), resize, upload with a progress state, then a review screen: each recognised item with its cover, a checkbox (owned ones shown as owned, unchecked), "Not this one" to pick an alternative or search, a list of what couldn't be matched, and "Add N items". Guests see a sign-in prompt; a first-use notice explains where the photo goes. _Demo:_ photograph a shelf on the iPhone and add what it found.

**5. Collection query engine (core).** `CollectionQuery` zod schema (universes, characters, categories, title words, added before/after, sort, list vs count, `unsupported` with a reason), `runCollectionQuery(items, query)` using `itemLinks`, `describeAnswer` ("You own 12 Batman items: 8 comics, 4 LEGO sets"), and a keyword fallback `parseQuestionLocally` (finds universe/character/category names in the question). Thorough tests. _Demo:_ tests answer the roadmap questions on a sample collection.

**6. Ask in the API.** `POST /ai/ask {question}` (signed in, quota): the model gets the question, today's date and the universe and category names (not the collection) and returns a `CollectionQuery` via strict JSON schema; the API validates it and resolves character names to seed slugs with core's name matching. Questions we can't answer yet ("what's arriving this month" → Stage 5, "which volumes am I missing" → deferred) come back as `unsupported` with a reason. e2e tests with a fake model, plus recorded real replies for the roadmap questions. _Demo:_ `curl` "What Batman stuff do I own?" and see the query.

**7. Ask in the app.** An "Ask your collection" field on the Collection tab with example questions; the answer sentence plus the matching items (tapping opens them); the keyword fallback when signed out, offline or over quota (labelled as such). _Demo:_ ask the roadmap questions on the iPhone and the web.

**8. Polish and Stage 4 demo.** Error and empty states (blurry photo, nothing recognised, quota reached), accessibility labels, a privacy section in the README (what goes to Groq, ZDR, nothing stored), README (screenshots, architecture with the AI layer, eval results), `GROQ_API_KEY` on Render, deploy, publish the iPhone update, tag `v0.4.0`. _Demo:_ the end-to-end demo above, on the deployed app.

## New concepts, introduced as they come up

Vision-language models and structured outputs (a JSON schema the model's reply must follow — like a typed DTO the model fills in), base64 image upload, rate limiting and quotas in NestJS (≈ ASP.NET Core rate-limiting middleware), evaluation sets for AI features (a test suite that measures quality instead of passing/failing), `expo-image-picker` and `expo-image-manipulator`.

## Risks

- **Recognition quality on spines** (Task 1): each image is limited to 2,048 tokens, so small spine text may be unreadable. Mitigations: crops of a wide shelf (up to 3 images per request), a size recommendation in the app, confirmation before adding. If it's poor, we learn it in Task 1, before building the screens.
- **Free limits** (Tasks 2, 6): 8K tokens/min means only ~3 photos a minute across all users. Fine for a portfolio app with a few users; quotas and clear "try again" messages cover bursts.
- **Model churn:** Groq retires models; ids are config, and the eval script re-checks a replacement.
- **Slow scans** (Task 3): resolving 20 guesses against Open Library (350 ms apart) and Rebrickable (1 s apart) can take 10–30 s; the app shows progress, and we cap candidates per photo. If it's too slow, resolution moves to a background job polled by the app.
- **Terms:** Rebrickable content is never sent to a model; Groq requires the account holder to be 18+.

## Verification

- Every task: `npm run typecheck && npm run lint && npm test` at the root, API e2e tests against Docker Postgres, CI green. Tests never call Groq.
- AI quality: `npm run eval:shelf` (and recorded question replies) re-run when prompts or models change.
- App tasks: checked on web in the browser and on the iPhone in Expo Go (published with `npm run update:ios -w @fandex/mobile`).
- Stage demo: the end-to-end flow above, on the deployed app.
