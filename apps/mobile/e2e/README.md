# iPhone UI tests (Maestro)

[Maestro](https://maestro.mobile.dev) drives the real app in Expo Go on the iOS Simulator — taps,
typing, scrolling — and checks what's on screen. It complements the Jest tests, which render
screens without iOS (they can't see native pieces such as the tab bar or system alerts).

| Flow                         | What it covers                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `add-and-remove-a-book.yaml` | Guest: search, add, the item in the collection with its universe and characters, remove (native alert)                         |
| `ask.yaml`                   | Guest: a question answered on the device, the matching item, a pre-order question needing an account                           |
| `book-series.yaml`           | Guest: a book's page shows its series and the books missing from it (live Wikidata and Open Library)                           |
| `series-view.yaml`           | Guest: the Series view lists a book series and a manga series with what's missing and the next volume (live data)              |
| `preorder-lifecycle.yaml`    | Account: sign in, pre-order an upcoming book with Open Library's date, amounts, Upcoming's total, "It arrived", delete account |

Every flow starts from a clean slate (`common/open.yaml`: keychain and app data cleared, so
signed out with nothing saved). The account flow creates a throwaway account through the local
API (`scripts/create-account.js`) and deletes it through the app at the end.

## Running them

Once: Xcode 26.3 with the iOS 26 simulator (see `CLAUDE.md`), Java 21 and Maestro (`~/.maestro`).

1. Start the API (`npm run dev:api`, with `npm run db:up`) and the Expo dev server on port 8082
   (`npm run start -w @fandex/mobile -- --port 8082`, or the `api` and `mobile-ios` launch configs).
2. Boot a simulator with Expo Go installed (`xcrun simctl boot "iPhone 17 Pro"`; opening
   `exp://127.0.0.1:8082` once installs Expo Go).
3. `npm run e2e:ios -w @fandex/mobile` runs every flow (about 7 minutes on the Intel Mac);
   `npm run e2e:ios -w @fandex/mobile -- flows/ask.yaml` runs one.

Failed steps leave a screenshot and the screen's element tree in `e2e/output/` (gitignored).
The pre-order and series flows use live data (Open Library: Clara & the Devil, Volume 2
expected March 2, 2027; Wikidata: the Stormlight Archive); the series flows match counts with
patterns, but if a source changes a date or a title, a flow's expectation changes too.

## Writing flows: lessons from the first ones

- **Select by accessibility label.** Maestro sees what VoiceOver sees, so labels written for
  screen readers ("Add The Hobbit", "Remove … from collection") are the test selectors. A
  visible field label duplicated the input's name, so `FormField` hides it from accessibility
  (VoiceOver read each field twice anyway).
- **Put the keyboard away before tapping a button or tab** (`hideKeyboard`, or tap a text on a
  number pad, which has no return key): with the keyboard up, the first tap only ends editing.
- **Only what's on screen counts:** `scrollUntilVisible` before asserting or tapping lower down.
- **The Simulator lags on this Mac:** wait with `extendedWaitUntil` rather than asserting at once.
- **iOS steps in:** "Automatic Strong Password" replaces a new password typed into a sign-up
  form (hence the API-created account), and "Save Password?" appears a moment after signing in.
- **The session survives cleared app data** (it's in the Keychain): `clearKeychain` first.
- Screens that slide over the tabs have no tab bar: open tabs by link (`${APP_URL}/--/upcoming`).
- **Don't type searches; put them in the link** (`${APP_URL}/--/add?q=…&scan=1`): typing on the
  slow Simulator once produced "devily". Leave "&" out of the query: Expo Go decodes the link
  twice and cuts it there.
- **Make the target the first result.** Links near the bottom of a list sit behind the tab bar,
  and a tap right after scrolling lands where the link used to be (it once opened "Scan several
  books"); a specific query ("clara devil volume 2") avoids both.
- **Live sources are slow some mornings** (Open Library took 4–22 s a search): waits for search
  results are 60 s.
