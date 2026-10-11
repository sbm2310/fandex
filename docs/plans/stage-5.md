# Stage 5 plan: Pre-orders and releases

**Goal (from the roadmap):** track what's on order, what it costs, when it's due and when it arrives. Collectors pre-order Hot Toys a year or more ahead, pay a deposit and a balance later, and watch release dates slip.

**Demo at the end:** create a custom Hot Toys figure ("Hot Toys Gandalf the Grey, 1/6") and pre-order it: $350, $70 deposit paid, balance due in three weeks, expected in March, from Sideshow with the order link. Pre-order an upcoming book found in search; Fandex fills its release date from Open Library. Open the **Upcoming** tab: the balance due soon sits at the top, with a badge on the tab; the book is under "arriving this month". Move the figure's date from March to June: it shows "delayed once, originally March". Mark the book arrived: it moves into the collection in one tap. Ask "What's arriving this month?" and "How much do I still owe?" and get exact answers. Same on the web.

## Decisions (settled 2026-10-11)

| Question               | Decision                                                                                                             | Why                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reminders              | **In the app only**: an Upcoming tab with what needs attention first, and a badge count on the tab                   | Real push needs our own app build and an Apple Developer account ($99/yr); on-device notifications were possible for free, but the owner chose no notifications for now. Nothing has to run on a schedule, so no cron job is needed (Render's cron jobs are paid). Push can come with the Apple account in Stage 6.                                                             |
| Items not in a catalog | **Custom items, and a new Figure category**                                                                          | No public API covers Hot Toys or similar figures. A custom item has a name and optional brand, line, scale, image URL and notes; it's private to its owner and links to universes and characters (matched from the name, fixable by hand) like any other item. It's the first step toward the figures catalog (an open question since Stage 1).                                 |
| Release dates          | **Entered by the owner, plus book dates from Open Library**                                                          | No free source covers Hot Toys, manga or most LEGO dates. Open Library sometimes lists a future publish date for an upcoming edition; when a pre-ordered book has one, Fandex offers it and re-checks it when pre-orders are opened (at most daily), flagging a change as a slip. Brickset (LEGO retirements) and Metron (comics) were considered: their terms are unconfirmed. |
| What a pre-order holds | **Price, deposit, balance and its due date; expected release and its history; store, order number and link; status** | Everything the demo needs. Money is stored as integer minor units with a currency code (default USD), never floats. Every change of the expected date is kept, so slips are visible.                                                                                                                                                                                            |
| Arrival                | **One tap moves a pre-order into the collection**                                                                    | Marking it arrived creates the collection item (catalog or custom) and closes the pre-order, in one transaction on the server.                                                                                                                                                                                                                                                  |
| Who can use it         | **Pre-orders need an account; custom items work for guests too**                                                     | Pre-orders hold payments and dates you'd want on every device, and moving them from a device into an account would add a whole sync path. Custom items are collection items, so guest mode already handles them (they're stored as snapshots).                                                                                                                                  |
| Questions              | **"Ask your collection" learns pre-orders**                                                                          | "What's arriving this month?" was a roadmap question the AI declined in Stage 4. The query gets a pre-order scope (arriving between dates, balance due, delayed), answered by core from the user's pre-orders, still without sending them to the model.                                                                                                                         |
| Cost                   | **$0**                                                                                                               | No new services. Open Library as before.                                                                                                                                                                                                                                                                                                                                        |

## Design

```
App                                         API (NestJS)                           Data
 Add → "Add by hand" (custom item, Figure) ─► POST /catalog/custom ───────────────► catalog_item (source custom,
                                                                                     owner_id, private)
 Item / search result → "Pre-order"  ──────► POST /preorders ─────────────────────► preorder, preorder_date_change
 Upcoming tab ◄── GET /preorders ◄──────────  refresh book dates older than a day
   needs attention · arriving this month       (Open Library, spaced as today)
   · later · delayed                           → a changed date is recorded as a slip
 "Arrived" ────────────────────────────────► POST /preorders/:id/arrive ──────────► collection_item (+ preorder closed,
                                                                                     one transaction)
 Ask "What's arriving this month?" ────────► POST /ai/ask → query with scope "preorders" → core runs it on the preorders
```

- **Core owns the rules:** pre-order contracts (zod), pure functions for the balance left, what "needs attention" means (balance due within 7 days or overdue, arriving within 7 days, date unknown), grouping for the Upcoming tab, slip history ("delayed twice, originally March 2026"), and money formatting (`Intl.NumberFormat`).
- **Custom items** reuse `catalog_item` with `source = 'custom'` and an `owner_id`: catalog search never returns them, other users can't read them (404, like collection items), and they're deleted with their owner. The shared catalog stays shared; custom items stay private.
- **Category `figure`** joins the `Category` union: filters, badges, universe pages and Ask learn it. Figures have no ISBN or set number, so ownership is by catalog id.
- **Dates** are calendar days (`YYYY-MM-DD`), with an optional precision ("March 2026" when the store only says a month), because stores announce quarters and months.

## Tasks (each leaves the app working)

**1. Figure category and custom items.** ✅ Core: `figure` category, a `CatalogCustom` entry type (name, brand, line, scale, image URL; universes matched from the name with core's matcher), contracts. API: `catalog_item.source = custom` with `owner_id` (migration), `POST /catalog/custom` and `PATCH`/`DELETE` for the owner, excluded from search, isolation tests (mutation-checked). App: the Add tab's switch becomes Books | LEGO | Figures, Figures showing the form (works for guests: saved straight into the device collection), Figure badge and filter. _Demo:_ add "Hot Toys Gandalf the Grey" by hand; it appears in the collection and on the Middle-earth page.

**2. Pre-orders in core.** ✅ `preorderSchema` and request contracts; money as minor units + currency; `balanceDue`, `needsAttention(preorder, today)`, `groupUpcoming(preorders, today)` (needs attention, this month, later, no date), `describeSlips(history)`, `formatMoney`. Thorough tests with fixed dates. _Demo:_ tests.

**3. Pre-orders in the API.** ✅ Tables `preorder` and `preorder_date_change` (migration); `GET/POST/PATCH/DELETE /preorders` (signed in, scoped by user, 404 for others' — mutation-checked); every change of the expected date recorded; `POST /preorders/:id/arrive` adds the item to the collection and closes the pre-order in one transaction (idempotent). e2e tests. _Demo:_ `curl` a pre-order through its life.

**4. Pre-orders in the app.** ✅ "Pre-order" from a search result, an item page or a custom item; a form (price, deposit, balance due date, expected date and precision, store, order number, link, notes); a pre-order page with its history; edit, cancel, "Arrived". Account only (guests see why). _Demo:_ pre-order the custom Gandalf and a book on the iPhone.

**5. Upcoming tab.** ✅ A fifth tab: needs attention (balance due soon or overdue, arriving this week), arriving this month, later, date unknown, with totals still owed; a badge with the attention count. Check the web tab bar at phone width (five tabs). _Demo:_ the tab with its badge.

**6. Book release dates from Open Library.** Spike first: how often Open Library has future publish dates for upcoming editions (check a few real pre-orders). Then: offer Open Library's date when creating a book pre-order, re-check pre-ordered books when pre-orders are listed (at most daily per book, same spacing and cache), record a changed date as a slip with its source. Recorded fixtures. _Demo:_ a book pre-order with its date filled in.

**7. Ask about pre-orders.** `CollectionQuery` gains `scope: collection | preorders` and pre-order filters (arriving after/before, balance due, delayed); `runPreorderQuery` and answers ("2 pre-orders arrive this month: …", "You still owe $280 on 1 pre-order"); prompt, schema and keyword fallback updated; real replies re-recorded. _Demo:_ ask the demo's questions on the iPhone.

**8. Polish and Stage 5 demo.** Empty and error states, accessibility labels, README (screenshots of Upcoming and a pre-order, the model), deploy, publish the iPhone update, tag `v0.5.0`. _Demo:_ the end-to-end demo above, on the deployed app.

## Risks

- **Open Library rarely knows future dates** — then book pre-orders rely on what you enter, like figures; Task 6 starts with a spike to find out.
- **Five tabs** — the web tab bar already needed tightening at phone width with four.
- **No reminders outside the app** — by choice; the Upcoming badge is the reminder. Revisit with the Apple account (push) in Stage 6.
