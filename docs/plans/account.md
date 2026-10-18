# Account page plan

**Goal:** today the Account tab shows your name and email, Sign out and Delete account (plus figure suggestions for admins). Before beta users and the App Store (Stage 8), people should be able to manage their profile, see and take their data, see their AI allowance, and find credits, the privacy policy and a way to give feedback.

**Demo at the end:** on the iPhone (Simulator) and the web: change your name and password, set ILS as the default currency and see a new pre-order start in ILS, see today's AI allowance, export your collection as JSON and CSV, see the devices you're signed in on and sign out the others, and open About with credits, the version and the privacy policy (also reachable at a public URL).

## Decisions (settled 2026-10-18)

| Question                 | Decision                                                                                                                                    | Why                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Email change, reset      | **Not in this plan.** The screen says plainly that a forgotten password can't be recovered yet                                              | Both need an email provider, which needs a domain we don't own (open question)               |
| Appearance setting       | **None;** the app keeps following the phone                                                                                                 | Settled in the redesign                                                                      |
| Default currency         | **Stored on the account** (a Better Auth `additionalFields` field on `user`), one of core's `CURRENCIES`                                    | Pre-orders need an account anyway, and the choice should follow you between phone and web    |
| Export                   | **Built on the device** from data the app already has (collection and pre-orders); JSON (everything) and CSV (one row per item); guests too | No new endpoint; works offline and for the device collection                                 |
| Privacy policy and terms | **Pages of the web app** (`/privacy`, `/terms`), public, linked from About; written by us and reviewed by the owner                         | Free (served by the same Render service); Apple needs a privacy policy URL; not legal advice |
| Feedback                 | **A link to GitHub issues**                                                                                                                 | No email yet                                                                                 |
| Avatar, public page, SSO | **Later:** avatar (no free storage), "Public collection page" switch (Stage 8), Apple/Google sign-in (needs the Apple Developer account)    | Out of scope or not free                                                                     |
| Accounts in the app      | **Through `AccountService`** as today (`hooks/use-account.ts`); only `auth-client.ts` imports Better Auth; tests use `FakeAccountService`   | Existing rule (see `apps/mobile/CLAUDE.md`)                                                  |
| Cost                     | **$0**                                                                                                                                      | Better Auth features, our own pages, `expo-sharing` (free)                                   |

## Layout

Signed in, top to bottom: **Profile** (name, email, Change password) · **Preferences** (default currency) · **AI allowance** · **Your data** (Export) · **Signed-in devices** · **About** · **Admin** (admins only) · **Sign out** and **Delete account**.

Signed out: the sign-in form, then **Your data** (export the device collection, "N items on this device") and **About**.

Sections are `Card`s with `section` headings, in the redesign's style. Keep the existing accessibility labels ("Sign out", "Delete account", "Review figure suggestions"): tests and Maestro flows select by them.

## Tasks (each leaves the app working)

**1. Profile.** ✅ Edit the display name (trimmed, 1–50 characters; validated on the server too, e.g. a Better Auth `databaseHooks.user.update.before` hook, since Better Auth doesn't check names) and change the password (current + new, 8–128 like sign-up, option "Sign out other devices"). Better Auth 1.7: `updateUser({ name })`, `changePassword({ currentPassword, newPassword, revokeOtherSessions })` — check the 1.7 docs for exact names. Add both to `AccountService` and `FakeAccountService`; the current user query updates after a rename. Wrong current password and the rate limiter's 429 get clear messages. A note under the form: "Forgot your password? Recovery by email isn't available yet." e2e: rename validation; app tests for both forms. _Demo:_ rename on the phone, see it on the web; change the password and sign in with the new one.

**2. About.** ✅ Version (`expo-constants`, `expoConfig.version`), credits for Open Library, Rebrickable and **Wikidata** (series; not credited anywhere yet), links to the privacy policy, terms and GitHub issues ("Send feedback"), and the source code. New public routes `app/privacy.tsx` and `app/terms.tsx` (plain text pages, `PageTitle`, readable signed out; check the API's SPA fallback serves them on Render). The policy says what we store (name, email, collection, pre-orders, link fixes, AI usage counts — never photos), who processes it (Render, Neon, the AI provider in use and the fallback, matching the scan screen's privacy note), the data sources, how to export and delete, and that there are no ads or tracking. The owner reviews the wording. _Demo:_ About on the phone; `https://fandex-4mjc.onrender.com/privacy` opens in a browser.

**3. AI allowance and default currency.** Allowance: shelf scans, box scans and questions used of today's limit from the existing `GET /api/ai/quota` (reuse the cached `aiQuotaKey` query), "resets at midnight UTC", and the provider note (who reads photos, whether it may train on them); "AI is unavailable" when `available` is false. Default currency: `preferredCurrency` as a Better Auth user `additionalFields` entry (Prisma migration, column `preferred_currency`, default `USD`; validated against `CURRENCIES`), set with `updateUser`, shown as a picker; `PreorderForm` starts new pre-orders in it (edits keep the pre-order's own currency). _Demo:_ choose ILS, start a pre-order, the price field is in ₪; scan a shelf and the allowance goes up by one.

**4. Export.** "Export my collection" → choose JSON or CSV. JSON: `{ fandexExport: 1, exportedAt, collection: [...], preorders: [...] }` with each item's catalog snapshot, the user's category and link fixes (as `itemLinks` and the raw `linkEdits`), added date, and pre-orders with money, dates and history (signed in only). CSV: one row per item (title, category, creators, ISBN / set number / figure number, universes, characters, added). Pure builders in `utils/export.ts` (tested), then a file: `expo-file-system` + `expo-sharing` share sheet on iOS/Android (`npx expo install expo-sharing`; read the versioned docs), a Blob download on the web (`export.web.ts`). Guests export the device collection. Import is a possible follow-up, not in this plan. _Demo:_ export on the phone into Files, on the web as a download; open the CSV in Numbers.

**5. Signed-in devices.** Better Auth `listSessions`, `revokeSession`, `revokeOtherSessions` through `AccountService`. Each row: a device name from the user agent (iPhone app / Expo Go, Safari on Mac, Chrome…; unknown → "Unknown device"), signed in and last active dates, "This device" for the current session; no IP addresses shown. "Sign out" per row and "Sign out everywhere else" (with `confirm`). Check what user agent the native app sends (Expo's `fetch`) and adjust the labels. e2e: one user can't see or revoke another's sessions. _Demo:_ signed in on the phone and the web, sign the web out from the phone; the web returns to the sign-in form on its next request.

**6. Polish.** Light and dark mode pass, phone width on the web (`scrollWidth === innerWidth`), loading and error states (no flashes, no `act` warnings), a Maestro flow for the account page (rename and change the password back; Keychain and password prompts per `apps/mobile/e2e/README.md`), README section and screenshot, CLAUDE.md notes in `apps/mobile/CLAUDE.md` / `apps/api/CLAUDE.md`, EAS Update to the phone and a Render deploy. _Demo:_ the demo above.

## How to work

- **One task per session or commit**, in order; each leaves every check passing (`npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`).
- Verify in the browser pane at phone width in both colour schemes, and on the iOS Simulator for native parts (share sheet, secure-storage session).
- Restart the `api` dev server after rebuilding core.

## Risks

- **Better Auth API names and behaviour** (1.7): confirm `updateUser`, `changePassword`, `listSessions`, `revokeSession(s)` and `additionalFields` against the docs; after an upgrade, compare the expected tables with `npx auth@<version> generate`.
- **Name validation** isn't Better Auth's job; without the server hook a client could store an empty or huge name (matters once names are public in Stage 8).
- **Session list on native:** the Expo plugin keeps the session in secure storage; revoking the current device's session must leave the app signed out cleanly, not in a half-signed-in state.
- **Privacy text** is ours, not legal advice; it must stay true when providers change (`AI_PROVIDER`), so keep it next to the code it describes and recheck it when the provider changes.
- **Export size:** the collection is small today; if it grows to thousands of items, building the file on the device may need a progress state.
