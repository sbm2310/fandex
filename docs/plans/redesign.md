# UI redesign plan: the collector's vitrine

**Goal:** Fandex works well but looks like a well-made template: pure black, the system font, one purple accent, text-heavy rows, and figures shown as grey squares with a letter. This redesign gives it a collector's look — warm surfaces, a colour per universe, a display typeface, money and dates that stand out, and box-art tiles for figures — without changing what the app does. It comes **between Stage 7 and Stage 8 (launch)**, which waits until the owner decides on its costs.

**Mockups:** [Fandex UI redesign](https://claude.ai/artifact/Jg7XsCESkUGT7ZkLzv2EjZ) (a canvas, private to the owner): 1 Home "Your shelf", 2 a universe, 3 a figure without a photo, 4 Upcoming, 5 Add › Figures, 6 the design system. The mockups are the target look, not pixel specs; their sample numbers ("38 items across 5 universes") are made up.

**Demo at the end:** on the iPhone (Simulator) and the web, in dark and light mode: the Collection tab opens on "Your shelf" (universes in their colours, what's coming up, recently added, Ask); a universe page in its colour with character avatars; a curated figure shown as a box-art tile with its facts as cards; Upcoming as a timeline with payment bars; the Add tab with category buttons and the scan button beside search. Every Jest test and Maestro flow still passes.

## Decisions (settled 2026-10-15)

| Question         | Decision                                                                                                                                                     | Why                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Light and dark   | **Both, dark first.** The app keeps following the phone's setting; the light version uses the same structure on a warm ivory ground                          | Dark is the mockups' look; people who use light mode shouldn't get a dark app                                        |
| Home             | **The Collection tab opens on "Your shelf"**; "Everything" opens today's full grid with its sort and filters                                                 | Universes are Fandex's core idea, so home should show them; the tab keeps its name, so tests and flows change little |
| Fonts            | **Bricolage Grotesque** (display: titles, numbers) and **Figtree** (text), from Google Fonts via `@expo-google-fonts/*`                                      | Free (SIL Open Font License), distinctive, readable; bundled with the app, so no network at runtime                  |
| Native tab bar   | **Kept native on iOS** (NativeTabs, SF Symbols), tinted with the new colours; the web top bar gets the new look                                              | The system tab bar is what iPhone users expect, and it can't take custom fonts anyway                                |
| Universe colours | **App-side** (`constants/universe-colors.ts`, by universe slug, with a neutral fallback), not in core's universe seed                                        | Colours are presentation; the API and core don't need them                                                           |
| Scope            | **Look and layout only**, plus two small additions the mockups need: "I've paid it" on a pre-order needing attention, and character counts on universe cards | No new data sources, no API changes                                                                                  |
| Cost             | **$0**                                                                                                                                                       | Free fonts, our own code                                                                                             |

## Design system

### Colours

| Token                         | Dark      | Light     | Used for                                           |
| ----------------------------- | --------- | --------- | -------------------------------------------------- |
| `background` (ground)         | `#121014` | `#F7F4EF` | Screens                                            |
| `backgroundElement` (surface) | `#1E1C22` | `#FFFFFF` | Cards, fields                                      |
| `backgroundSelected`          | `#26242B` | `#EFEBE4` | Selected chips, placeholders                       |
| `border` (line)               | `#312E36` | `#DDD6CC` | Borders, dividers                                  |
| `text` (ink)                  | `#F4F0EA` | `#1A1720` | Text                                               |
| `textSecondary`               | `#A8A1AE` | `#6A6370` | Meta text                                          |
| `accent` (violet)             | `#B7AAFF` | `#5B4BDB` | Actions, links, selection                          |
| `onAccent`                    | `#17112E` | `#FFFFFF` | Text on violet                                     |
| `money` (amber, new)          | `#F0B44C` | `#8A5A00` | Amounts owed, due dates, attention (text and bars) |
| `moneyGround` (new)           | `#2A2113` | `#FBEFD9` | The "needs attention" card                         |
| `danger`                      | `#FF8A80` | `#B3261E` | Remove, errors                                     |

Keep the token **names** (`text`, `background`, `backgroundElement`, …) so every screen picks up the new palette at once; add `money` and `moneyGround`. Check contrast: body text ≥ 4.5:1 on its ground in both modes (the light amber is darker for that reason).

### Universe colours (`constants/universe-colors.ts`)

Each universe has a `ground` (header and card background), an `accent` (bars, stripes, avatar rings) and an `onGround` text colour, per mode:

| Universe            | Dark ground / accent  | Light ground / accent |
| ------------------- | --------------------- | --------------------- |
| Middle-earth        | `#2B3A23` / `#9CC47F` | `#E3ECD9` / `#4F7A35` |
| Star Wars           | `#2A2614` / `#FFE81F` | `#F6EDB3` / `#8A7300` |
| Wizarding World     | `#3A1D24` / `#E05A6A` | `#F2DDE0` / `#9E2B3C` |
| DC                  | `#16263F` / `#5B8FE8` | `#DDE6F5` / `#2F5DB8` |
| Marvel              | `#3A1616` / `#FF6B5B` | `#F6DCD8` / `#C2362A` |
| (unknown, fallback) | surface / violet      | surface / violet      |

A figure's tile and stripe take the colour of its first universe.

### Type

React Native needs one font family per weight (e.g. `Figtree_700Bold`), so `ThemedText` maps each type to a family rather than relying on `fontWeight`. Keep the existing type names (dozens of screens use them) and restyle them; add two:

| `ThemedText` type                      | New style                                                              |
| -------------------------------------- | ---------------------------------------------------------------------- |
| `subtitle` (screen titles today)       | Display: Bricolage Grotesque 800, 34                                   |
| `section` (new)                        | Bricolage Grotesque 800, 21 — section headings                         |
| `default`                              | Figtree 400, 15                                                        |
| `smallBold`                            | Figtree 700, 14–15 — item titles                                       |
| `small`                                | Figtree 400, 13 — meta                                                 |
| `overline` (new)                       | Figtree 700, 12, uppercase, letter-spaced — "NEEDS ATTENTION"          |
| `title`, `link`, `linkPrimary`, `code` | Restyled to match; `title` (48) is barely used — check before changing |

### Components

- **`ItemArtwork`** (replaces direct `BookCover` use): the cover or product photo when there is one; otherwise a **box-art tile** for figures (maker and scale on top, the box number large in the universe accent — or the name when there's no number — and an accent stripe at the bottom) and a **title tile** for books and sets (the title set in Bricolage on a quiet tint). Sizes: grid, row, detail hero.
- **Buttons:** primary (violet), secondary (surface + line), money (amber, "I've paid it"), danger (outline). Height ≥ 44.
- **Chips:** universe chips in their ground/accent; character chips neutral; small status pills ("in 26 days", "Delayed once").
- **Cards:** surface, 16 px radius, 14–16 px padding. Fact cards (label above value) on item pages.
- **Category buttons** (Add tab): icon + label tiles, replacing the segmented control there.

## Tasks (each leaves the app working)

**1. Foundations.** ✅ New colour tokens in `constants/theme.ts` (both modes, names kept, `money` and `moneyGround` added); `constants/universe-colors.ts` with a `useUniverseColors(slug)` hook; fonts installed with `npx expo install @expo-google-fonts/bricolage-grotesque @expo-google-fonts/figtree` and loaded in the root layout with `useFonts`, keeping the splash screen up until they load (`expo-splash-screen`; read the versioned Expo docs first, see `apps/mobile/AGENTS.md`); `ThemedText` restyled with the new types. Web: the same font packages work; check `global.css` for leftovers. _Demo:_ every screen in the new colours and type, nothing moved. Check contrast in both modes.

**2. Item artwork.** ✅ `ItemArtwork` with the box-art tile and title tile, used everywhere a cover appears: collection grid, search and result rows, item page, universe and character pages, Upcoming, Series, shelf and box scan results. Keep the existing `testID`/accessibility behaviour (`book-cover-placeholder` is used by tests). _Demo:_ curated figures (no photos) look intentional everywhere.

**3. Shared components.** ✅ Buttons, chips (universe-tinted), cards, status pills, the Add tab's category buttons with icons and the scan button beside the search field (barcode for books, box scan for figures, hidden for LEGO), the web top tab bar restyled and the iOS native tab bar tinted. Recheck the web bar at 375 and 360 px (`scrollWidth === innerWidth`; see the "Five web tabs" note in CLAUDE.md). _Demo:_ the Add tab as mockup 5.

**4. The item page.** ✅ Artwork hero; title and subtitle centred; universe and character chips; facts as a two-column grid of cards (price, release or announced, edition, number, ISBN, pieces… whichever apply); figure sources as a "Checked against N sources" card; series and suggestion sections in cards; Fix details and Remove side by side at the end. _Demo:_ mockup 3 for Darth Vader (MMS 279), and a book and a LEGO set in the same style.

**5. Universes.** ✅ The Universes tab's cards in their universe colours, with a cover stack, item counts and **characters owned out of the seed's main characters** ("16 of 23 characters") with a small bar — computed on the device from `summarizeCollectionUniverses` and `UNIVERSE_SEED`. The universe page with a tinted header (back button, cover stack, name, description, count tiles: books, figures, LEGO, on order) and characters as round avatars (initials ringed in the accent, item count below), then its items by category. Character pages get the same header treatment, smaller. _Demo:_ mockup 2 for Middle-earth, in both modes.

**6. Upcoming.** ✅ Summary tiles (still owed in amber, items on order); "Needs attention" cards on the amber ground with a payment bar (paid of price) and **"I've paid it"** (sets paid to the price through the existing pre-order update, after a confirmation; only when a balance is due); the rest as a timeline — a date column (month and day, or quarter and year for vaguer dates) beside each pre-order card, with a countdown pill ("in 26 days", from core's `daysBetween`) or "Delayed once". Closed pre-orders stay last. _Demo:_ mockup 4.

**7. Home: "Your shelf".** ✅ The Collection tab opens on: an overline and a headline ("N items across M universes", or a welcome for an empty collection), category count chips, the Ask field, a horizontal row of universe cards (task 5's card, smaller), "Coming up" (the next two pre-order events — signed in only), "Recently added" (six artworks), "Your series ›", and the move-to-account banner where it is today. "Everything" opens the full grid with today's sort and filters (a new route, e.g. `/collection`). Guests and empty collections get their own copy. Update the tests that list every link on the Collection tab (`collection-screen`, `lego`; see CLAUDE.md). _Demo:_ mockup 1.

**8. Polish.** Light-mode pass on every screen; contrast check; loading skeletons where screens flash (no `act` warnings); README screenshots retaken (750 × 1624, the browser pane's mobile preset at scale 1, plus a few from the Simulator); all Maestro flows run (selectors are accessibility labels — keep them; the Collection tab's first screen changes, so the flows that start there need "Everything" or a new wait); CLAUDE.md updated. _Demo:_ the demo above.

## How to work

- **One task per session or commit**, in order; each must leave the app working and every test passing (`npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`).
- **Verify visually** in the browser pane at phone width (mobile preset) in both colour schemes (`resize_window` with `colorScheme`), and on the iOS Simulator for native-only parts (tab bar, fonts, splash). Compare with the mockups.
- **Keep accessibility labels and roles unchanged** unless a task says otherwise: Jest tests and Maestro flows select by them.
- **Don't change behaviour** beyond the two additions above; this is a look-and-layout project.
- The mockups use colours as fixed hexes; in code every colour goes through `useTheme()` or `useUniverseColors()`.

## Risks

- **Font loading:** a font that isn't loaded yet falls back to the system font for a frame; keep the splash screen up until `useFonts` reports loaded, on web too.
- **Contrast in light mode:** yellow (Star Wars) and amber need the darker light-mode accents above for text and thin bars.
- **Test churn:** restyling should keep labels, but the new Home changes what the Collection tab shows first; budget time in task 7 for tests and flows.
- **Scope creep:** the mockups suggest more (a universe "Missing from your shelf" list, user photos for figures); those are separate features, not part of this plan.
