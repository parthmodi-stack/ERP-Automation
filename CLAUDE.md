# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Playwright end-to-end test suite for the ERPForce web app (the `erpforce-fe` repo, a separate
project). This repo only contains tests, page objects, and test data - no app source.

## Commands

```bash
# Run the whole regression suite (headless: false, per playwright.config.js)
npm test
npm run test:regression

# Headed / debug modes
npm run test:headed
npm run test:debug

# View the last HTML report
npm run test:report

# Run one module's suite
npm run test:procurement

# Run a single spec file directly (preferred way to run just one file/test)
npx playwright test tests/inventory/04-uom.spec.js
npx playwright test tests/procurement/03-rfq.spec.js -g "TC-RFQ-02"

# Smoke subset only (tests tagged @smoke)
npm run test:smoke
```

Requires `ERPForce` (`erpforce-fe`) running locally, or `BASE_URL` in `.env` pointed at a live
environment. `global-setup.js` logs in once via the UI and writes `auth.json`, which every test
reuses as `storageState` - if a test fails with an "Auth failure: 401/403" error thrown from
`BasePage`'s response listener, re-run (or delete `auth.json` and re-run) rather than debugging it
as a UI bug.

If `npx playwright test` fails with a missing Chromium executable error, run
`npx playwright install chromium` - see the note at the top of `playwright.config.js`.

## Architecture

### Execution model

- `fullyParallel: false`, `workers: 4` (see `playwright.config.js`): tests **within** one spec
  file always run in-order on the same worker, because later tests in a file reuse module-level
  `let` state (an id/seriesNumber) created by an earlier test in that same file. Different spec
  files still run concurrently across workers. Never assume test isolation within a file, and
  don't reorder tests inside a `describe` block without checking what state they share.
- `test.describe.configure({ timeout: 150000 })` is bumped well above the 30s default in the
  larger module suites - multi-step flows (create + edit + approve + delete-attempt) can run
  close to 90s under real concurrent load. Keep this in mind before assuming a slow test is broken.
- Data is **shared and cumulative**, not reset between runs: specs create real records against a
  real account/environment and later tests (including other files) may depend on records that
  already exist from previous runs. Don't add cleanup that would break a sibling suite's
  assumptions unless you've checked `config/testData.js`'s comments for that field first.

### Layers

```
tests/<module>/<NN>-<feature>.spec.js   # Test cases (TC-<MODULE>-<NN> naming), grouped by domain
pages/<Feature>Page.js                  # Page Object Model - one class per ERPForce module/page
pages/BasePage.js                       # Shared helpers, extended/composed by feature page objects
config/testData.js                      # All test fixture data, keyed by module
config/testDataFactory.js               # Generators for FREE-TEXT fields only (names, narrations,
                                         #   reference numbers) - never for FK-reference values
helpers/dropdown.js                     # Generic custom-dropdown helper (older pattern, mostly
                                         #   superseded by BasePage's DynamicSelect-family helpers)
global-setup.js                         # Runs once before the suite; produces auth.json
```

### `config/testData.js` conventions

- Free-text fields (names, narrations, quantities, reference numbers) are generated via
  `testDataFactory` to guarantee uniqueness across runs.
- Foreign-key-reference fields (vendor, location, item, currency, company, purchase
  representative, approver names) are **hardcoded to real, live-verified master data** in this
  project's actual environment - faker cannot invent valid ones. Every such value has an inline
  comment explaining why it was chosen and what was confirmed live (exact combobox option text,
  known app bugs like a Location search box never firing its filter API, currency lists scoped to
  the selected vendor, etc). Read these comments before changing a pinned value - they record real
  debugging, not arbitrary choices.
- `approverName` fields must match whichever user is actually logged in per `credentials.valid`
  (currently `dipen.modi@trootech.com` / "Dipen Modi"), because the Accept/Reject split-button
  only renders for the user an approval was actually routed to. Keep these in sync if
  `credentials.valid` changes.

### `pages/BasePage.js` conventions

All feature page objects extend or compose `BasePage`, which centralizes patterns that are
identical across every ERPForce "document" module (Procurement Request, Purchase Agreement,
Purchase Order, Vendor Return Authorization, etc.):

- **Dropdown/combobox selection** (`selectFieldByLabel`, `openDropdownAndPick`,
  `selectFirstAvailableOption`, `selectOptionFromListbox`): handles the app's DynamicSelect-family
  fields, including a known app bug where a field can render "No data available" if a sibling
  field's selection interrupts its fetch mid-flight - these helpers retry with an Escape + settle
  before falling back to picking whichever option renders first.
- **Listing page** (`searchList`, `clearSearch`, pagination helpers, `columnHeader`): shared
  MaterialTable component behavior, identical across every module's list view.
- **Approval workflow** (`quickApproval`, `accept`, `reject`, `openSubmitMenu`): the
  Submit/Accept split-button pattern shared by every approval-gated module - only toast wording
  differs per module.
- **Row status/actions** (`rowBySeriesNumber`, `openRowActionMenu`, `deleteFromList`,
  `isRowActionDisabled`): rows are matched by visible series-number text, not `getByRole('link')`,
  because these tables' row anchors have no real `href` and get no ARIA link role.
- Only add new shared logic to `BasePage` when it's byte-identical (or a strict superset) across
  modules - anything with real per-module behavioral differences (dropdown quirks, save/approval
  wording, field names) belongs in that module's own page object instead, to avoid reintroducing
  bugs that took multiple rounds of live debugging to isolate per-module.

### SPA navigation & shared-dataset gotchas (any module)

Found while building the HRMS Leave Management/Leave Request suite (`tests/hrms/15-*`,
`tests/hrms/16-*`) - all six apply to any module, not just Leave:

- **SPA route changes don't fire a real `load` event.** Clicking an in-app "View"/"Edit" menu item
  is a client-side route change, not a real navigation - `page.waitForLoadState('load')` plus a
  progressbar-hidden wait can resolve before the by-id GET actually completes, leaving the page
  rendering an entirely empty record (every field shows "-") at the moment assertions run. Wait on
  the real by-id GET response itself instead - match the URL path exactly (e.g.
  `/\/v1\/<resource>\/\d+$/`) so it doesn't also match a `/status` PATCH or the list endpoint's own
  query-string GET. See `LeaveManagementPage.waitForLeaveByIdFetch` for the pattern.
- **Fixed date offsets collide against this shared, cumulative dataset.** A module with
  duplicate/overlap-range validation will reject a real Save if ANY prior record (even a
  Draft/Cancelled leftover from an earlier run, in this OR a different spec file) overlaps the
  same date range. Generate a wide randomized day offset per test (e.g. 100-3000 days out) instead
  of a fixed `+N days`.
- **Re-navigating to the current URL right after an in-app action's own async refetch can throw
  `net::ERR_ABORTED`.** Reproduced right after a Delete/Cancel confirm followed immediately by a
  listing re-navigation. Retry the `page.goto()` once with a ~1s delay.
- **A still-open popover leaves a backdrop that intercepts unrelated clicks.** E.g. opening an
  Approval History dropdown and then immediately calling `logout()` (which clicks a header
  element) fails because the popover's invisible backdrop intercepts the click - press `Escape`
  before navigating away from a page with an open popover/menu.
- **A field's Yup error can be captured in `formState.errors` but never actually rendered.** Don't
  assert on inline error text without first confirming live that it's rendered - some forms only
  gate submission via a disabled Save button and never show the error message at all.
- **Multiline fields render as `<textarea>`, not `<input>`.** `BasePage.fieldInputByLabel()` only
  matches `input` - a field with an `is_multiline`/multiline prop needs its own structural lookup
  targeting `textarea`.

### Test naming

Tests are named `TC-<MODULE>-<NN> [+|+/-|-] <description>`, where `+` = happy path, `-` = negative/
validation case, `+/-` = a single test covering both. `@smoke` tag marks the subset run by
`npm run test:smoke`. `DEFAULT_TEST_CASES.md` documents the standard checklist (Core CRUD, Field
Validations, Approval Flow) expected for any new "document"-pattern module suite - consult it
before scaffolding tests for a new module so numbering and coverage stay consistent with existing
suites.
