# Stage 7 plan: a figure catalog

**Goal:** premium figures get what books and LEGO already have — a shared catalog to search and add from. No public catalog or API covers Hot Toys or InArt (researched 2026-10-13, below), so Fandex builds its own: a hand-curated list to start, figures users add (shared once the owner approves them), and AI that reads a figure's box. This is the "potential moat" from the project brief. Launch moves to Stage 8.

**Demo at the end:** on the Add tab's Figures switch, search "Gandalf": the curated Hot Toys Gandalf the Grey (with its number, line and scale) comes up — add it or pre-order it; it lands on the Middle-earth page. Photograph a Hot Toys box: the AI reads brand, name and number, and Fandex finds that figure in the catalog. Add a figure the catalog doesn't have, by hand, and tick "Suggest it for the catalog"; as the owner, approve it on the admin screen — now every user can find it. Same in the iOS Simulator (a Maestro flow).

## Research (2026-10-13)

| Source                   | Hot Toys                                                                                                                                                                      | InArt                                                                                                                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Official API or database | None                                                                                                                                                                          | None                                                                                                                                                                                                                                                     |
| Official site terms      | Not found                                                                                                                                                                     | [global.inart.studio](https://global.inart.studio/policies/terms-of-service): content for "personal, non-commercial use" only; operated from France (UK/French law, where a site's database can itself be protected)                                     |
| Wikidata                 | Company item, **no figures** linked                                                                                                                                           | **Nothing** (no company item)                                                                                                                                                                                                                            |
| Checklists               | [Action Figure 411](https://www.actionfigure411.com/marvel/hot-toys-checklist.php) (a retailer's compilation); ihasstuff.com (contributor answers that contradict each other) | None found; retailer pages and news posts ([toy-people](https://www.toy-people.com/en/?tag=inart), [DC Collectors](https://dccollectors.com/2026/06/30/inart-supergirl-1-6-collectible-figure-officially-revealed-preorder-date-and-details-announced/)) |
| Licensed feed            | Sideshow's affiliate program (CJ / own network); a product feed not confirmed                                                                                                 | None found (not distributed by Sideshow)                                                                                                                                                                                                                 |
| Retailer terms           | [Sideshow](https://www.sideshow.com/terms): personal, non-commercial use                                                                                                      | —                                                                                                                                                                                                                                                        |

**So:** no scraping (against the terms, as with Rebrickable and Google Books), no copied text or images. Fandex stores **facts it writes itself** (name, brand, line, number, scale, character, dates, original price), each with the sources it was checked against. InArt is a small line (dozens of figures since about 2020), so it can be complete; Hot Toys has many hundreds, so the curated list starts with the owner's fandoms. A Sideshow affiliate feed stays a later option (it needs a public site and approval — a business decision).

## Decisions (settled 2026-10-13)

| Question                       | Decision                                                                                             | Why                                                                                                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where shared figures come from | **A curated list, plus figures users suggest that the owner approves**                               | Curated facts give a useful catalog on day one; suggestions let it grow with users while there's quality control. Private figures stay private unless their owner suggests them. |
| What's curated first           | **Every InArt figure, and Hot Toys for Star Wars, Marvel, DC, Middle-earth and the Wizarding World** | The owner's fandoms first; InArt is small enough to be complete. Claude drafts entries from several public sources, each listing its sources; the owner spot-checks.             |
| Pictures                       | **None for catalog entries yet** (a placeholder); private figures keep their image link              | Render's free plan has no disk for uploads, and product photos belong to the brands and retailers. User photo uploads can come later.                                            |
| Box AI                         | **In this stage**                                                                                    | Photographing the box is the fastest way to add a figure; it reuses the shelf-scan setup (Gemini free tier while the owner is the only user, Groq as fallback, quotas).          |
| Who approves                   | **The owner, on an admin screen**; admins listed by email in a server setting                        | Simple and enough for one approver; no roles system needed yet.                                                                                                                  |
| Cost                           | **$0**                                                                                               | No new services.                                                                                                                                                                 |

## Design

```
packages/core                                  apps/api                                   apps/mobile
 FIGURE_BRANDS (lines, number formats)          catalog_item (source "fandex": shared;      Add › Figures:
 parseFigureNumber ("MMS 649")                    "custom": private) + number, edition,       search the catalog → Add / Pre-order
 FIGURE_SEED (curated JSON, with sources) ───►    release, price, sources                     "Scan a box" → matches → Add / Pre-order
 sameFigure (duplicates)                         FigureSeedService (sync on start)           "Not here? Add by hand" (+ Suggest)
 box prompt + parser (+ eval set)                GET /catalog/search?kind=figures           Admin › Suggestions (admins only)
                                                POST /ai/figure-scans (photo → matches)
                                                figure_suggestion + admin approve/merge/reject
```

- **Curated data lives in the repository** (`packages/core`, like the universe seed): reviewable in pull requests, versioned, synced into `catalog_item` on startup with a hash (the `UniverseSeedService` pattern). Each entry has a stable id, and a test checks the list (unique numbers per brand, known universes and characters, at least one source each).
- **Shared vs private** reuses `catalog_item.source`: `custom` + `owner_id` (private, as today) and a new `fandex` source for shared figures. Search only returns shared figures; a user's own private figures show in their collection as today.
- **Approving a suggestion** either makes the private figure shared (no owner) or, when it duplicates an existing entry, merges it: the suggester's collection items and pre-orders move to the existing entry, in one transaction.

## Tasks (each leaves the app working)

**1. Figures in core.** ✅ `FIGURE_BRANDS` (`packages/core/src/figures/`): Hot Toys with its box codes — MMS, DX, TMS, VGM, CMS, QS (1/4), PPS, ACS, COSB — and InArt (one sixth-scale line, no printed number as far as we know; Task 2 confirms or adds lines and editions). `findFigureBrand` ("HOT TOYS", "HotToys"), `parseFigureNumber` ("MMS 649", "MMS649", "mms-649", "TMS007" → "TMS 7", "DX 27", die-cast "MMS 528 D30"; unknown codes, 0 and 5+ digits rejected) and `findFigureNumber` (inside a search or box text). `CatalogFigure` gains `source: 'fandex'` (shared), `number`, `edition`, `release` (`ReleaseDate`) and `price` (core's new `Money`). `sameFigure(a, b)`: different makers never match; both numbered → the number decides (die-cast count aside); otherwise names compared without maker, scale or "collectible figure", and scale, edition or characters that contradict rule it out (two rules mutation-checked). Contracts: catalog items carry `source: 'fandex'`, `figureNumber`, `edition`, `releaseDate`, `price` (`moneySchema`); `figureNumberSchema`. The add-by-hand request is unchanged until Task 3 stores the new fields. _Demo:_ tests.

**2. The curated list.** Format and validation test, then the entries: all InArt, Hot Toys for the five universes. Each entry: id, brand, line, number, name, character(s) and universe, scale, edition, announced / released, original price and currency, sources (links). Drafted by Claude from several sources and written fresh (no copied text); the owner spot-checks a sample before it ships. _Demo:_ the list, validated.

**3. The shared catalog in the API.** Migration (`fandex` source; number, edition, release, price, sources columns), `FigureSeedService`, `GET /api/catalog/search?kind=figures` (name, character, number; shared figures only), universe links from the curated characters. e2e tests, isolation of private figures kept (mutation-checked). _Demo:_ `curl` a search for Gandalf.

**4. Figure search in the app.** The Figures switch on the Add tab searches the catalog (Add / Pre-order, figure details on the item page: number, line, edition, release), with "Not here? Add by hand" leading to today's form. _Demo:_ add the curated Gandalf; he appears on the Middle-earth page.

**5. Suggestions.** "Suggest it for the catalog" on the add-by-hand form and on a private figure's page; table `figure_suggestion` (user, figure, status, note); admin endpoints (`ADMIN_EMAILS`): list, approve as new, merge into an existing entry (`sameFigure` proposes candidates), reject with a note. Suggesters see the status on the figure's page. e2e tests incl. merge moving collection items and pre-orders (mutation-checked). _Demo:_ `curl` an approval.

**6. The admin screen.** A hidden route, shown only to admins: pending suggestions with possible duplicates, Approve / Merge / Reject. _Demo:_ approve a suggestion in the app.

**7. Reading boxes, in core.** The prompt and parser (brand, line, number, name, character, scale, edition), matching readings to the catalog (number first, then name), and an evaluation set: the owner photographs a few boxes (gitignored, like the shelf photos), scored on Gemini and Groq. _Demo:_ the evaluation results.

**8. Box scanning in the API and app.** `POST /api/ai/figure-scans` (one photo, quota kind `figure_scan`, provider fallback as for shelves), a review screen: the matching catalog figure to Add / Pre-order, or a pre-filled add-by-hand form when there's no match. _Demo:_ scan a box in the Simulator (photo from the library).

**9. Polish.** Empty and error states, accessibility, a Maestro flow, README (the figure catalog, sources and terms), CLAUDE.md. Not deployed until the owner says so. _Demo:_ the demo above.

## Risks

- **Curation effort and accuracy:** Hot Toys numbering is inconsistent between sources (one site gave MMS 816 to two different figures), so entries need more than one source and the owner's spot checks; a wrong entry can be fixed like any suggestion.
- **Bare catalog without pictures:** entries show a placeholder; private figures keep their image links. User photo uploads need free storage (to research later).
- **Approval work:** the owner reviews every suggestion; fine with few users, needs trusted reviewers or automation later.
- **Box photos and privacy:** same as shelf scans — Gemini's free tier may use photos for training; the scan screen says so, and it moves to paid Gemini or Groq before other users.
- **Terms change:** sources are re-checked when the list is extended; nothing is scraped.
