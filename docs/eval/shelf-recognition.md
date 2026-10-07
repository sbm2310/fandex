# Shelf recognition: evaluation (Stage 4 Task 1)

How well a free vision model reads a collector's shelf, measured on the owner's own bookcase before any screens were built. Run with `npm run eval:shelf -w @fandex/api` (needs `GROQ_API_KEY`; never runs in CI). The photos stay on the owner's machine (`apps/api/eval/photos`, gitignored); the list of what is really on the shelf is [`apps/api/eval/shelf-expected.json`](../../apps/api/eval/shelf-expected.json).

## Setup (2026-10-07)

- **Model:** `qwen/qwen3.8-27b` on Groq's free plan (its only vision model), temperature 0.6, top-p 0.95, at most 800 reply tokens, reasoning off.
- **Photos:** 9 iPhone photos of one five-shelf bookcase: 4 of the whole bookcase, 5 closer ones. About 130 spines: English and Hebrew novels, manga (Demon Slayer, Vagabond, Vinland Saga), Marvel trade paperbacks, and built LEGO Star Wars sets on display stands.
- **Truth:** 26 items (a series run is one item, e.g. "Demon Slayer 1–23"), each with the phrases that identify it in any script.
- **Scores below** use the corrected list (the owner confirmed The Silmarillion and more Dragonlance titles that Gemini had named; `apps/api/eval/rescore.ts` re-scores saved runs without calling a model).
- **Scoring:** an item is _found_ when a reading's title contains one of its phrases (strictly: "UNLAND SAGA" does not count as Vinland Saga, because Open Library's search finds nothing for it either). _Precision_ is the share of readings that match something really on the shelf.

## Results

| How the photo is sent                                      | Items found  | Readings that were real | Replies cut off at the limit | Tokens per request |
| ---------------------------------------------------------- | ------------ | ----------------------- | ---------------------------- | ------------------ |
| Whole photo, one image                                     | 21/166 (13%) | 48/125 (38%)            | 9/9                          | 2,746              |
| One shelf per image                                        | 18/50 (36%)  | 38/89 (43%)             | 4/9                          | 2,092              |
| **One shelf, cut into 2 overlapping halves (one request)** | 21/50 (42%)  | 29/74 (39%)             | 4/9                          | 2,367              |

Counting only items in English (no Hebrew editions), the one-shelf variants found 18–19 of 40 (about 48%). LEGO: 2 of 8.

## What we learned

1. **One shelf per photo.** On a whole-bookcase photo spines are a few pixels wide; the model reads a handful and then loops, repeating one invented line until the reply is cut off. The app asks for one shelf at a time and sends it as two halves.
2. **English only.** Hebrew spines are not read at all: the model invents a Hebrew title and repeats it. Fandex targets English-language collections in the US, so this is a known limit, not a bug.
3. **It invents plausible titles.** After the real items it continues from memory ("X-Men: The End", Wheel of Time novels on a shelf without them). These exist in catalogs, so every guess goes to a review screen; nothing is added without the user's tick.
4. **Near misses are misses.** "UNLAND SAGA" / "ULTLAND Saga" for Vinland Saga: Open Library search has no typo tolerance (0 results vs 172).
5. **Built LEGO models are hard.** It named the Millennium Falcon with the right set number (75375) once and missed the rest. Boxes with printed names and numbers should do better (not in this shelf).
6. **Reasoning mode doesn't fit the free plan.** With `reasoning_effort: low` the model spent all 3,000 reply tokens thinking and returned nothing; on Hebrew it stopped looping but still invented titles.
7. **JSON vs lines.** A strict JSON schema looped just like free text and costs twice the tokens; the parser takes one line per item and drops malformed, publisher-only ("MARVEL") and repeated lines.
8. **Capacity.** Groq counts the prompt (≈1,000 tokens per image half) plus the _maximum_ reply length against the limits: about 3,000 tokens per shelf photo. The free plan's 8,000 tokens a minute allow two shelf photos a minute, and its 200,000 tokens a day roughly **60 shelf photos a day for all users together**. This evaluation (≈50 requests) used up a day's allowance.
9. **Requests can hang.** One request never answered; the client now gives up after 30 s.

## Comparison: Gemini's free tier (2026-10-07)

The same script with `--provider gemini` (`gemini-3.5-flash`, thinking off; `gemini-3.8-flash` never answered on the free tier). The owner agreed to send these photos; Gemini's free tier may use what it receives to improve Google's products. The run stopped after 4 photos at the free tier's limit of **20 requests a day per model** (several spent on "503 overloaded" retries).

| Same 4 photos, whole photo | Groq `qwen/qwen3.8-27b` | Gemini `gemini-3.5-flash` |
| -------------------------- | ----------------------- | ------------------------- |
| Items found                | 5/57 (9%)               | **36/57 (63%)**           |
| Readings that were real    | 11/26 (42%)             | 79/95 (83%)               |
| Hebrew spines              | none                    | read (4–5 Hebrew series)  |
| Built LEGO models          | none                    | all 4 on the closer photo |

Gemini reads far better, including Hebrew and built LEGO, and doesn't loop. Whole-bookcase photos still lose the small spines (it missed every manga and comic on the full bookcase). But its free tier can't serve the app: **20 requests a day for every user together**, frequent "overloaded" errors, content used for training, and no users in the EU/UK. Its paid tier needs a card.

## Decision

Shelf photos stay, as an _assist_: one shelf per photo, two halves per request, a review screen where the user ticks what to add and can search for anything missed. Because recall is about half, Stage 4 also adds a **rapid barcode mode** (scan book after book without leaving the camera) as the reliable way to add a whole shelf. Model ids are configuration, so a better free model can be measured with this script and swapped in. Gemini shows what a stronger model achieves; both speak the OpenAI chat format, so the provider (base URL, key, model) is configuration too, in case a free tier with workable limits and terms appears.

Not yet measured: a "copy the spine text, don't identify" prompt (one request ran before the daily limit: 3 of 5 readings real). Re-run it when changing the prompt.
