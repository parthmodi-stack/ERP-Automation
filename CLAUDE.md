# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Playwright UI test automation for ERPForce (`https://dev.erpforce.co`), a hosted ERP web app. There is no application source code here, only tests, page objects, and fixtures that drive the live dev environment through a real browser.

## Commands

```bash
npm test                  # run the full suite (sequential, 1 worker)
npm run test:headed       # same, with browser visible (headless is already false by default)
npm run test:debug        # Playwright inspector/debug mode
npm run test:smoke        # only tests tagged @smoke
npm run test:regression   # alias for the full suite
npm run test:report       # open the last HTML report

# Run a single spec file directly (not wrapped in package.json):
npx playwright test tests/inventory/02-location.spec.js
npx playwright test tests/inventory/03-bin.spec.js --headed

# Run a single test case by name/title:
npx playwright test -g "TC-LOC-08"
```

There is no lint/build/typecheck step configured (`07-inventory-item.spec.ts` is plain TS run directly by Playwright's built-in esbuild transform; there's no separate `tsc` check).

## Architecture

**Global auth, not per-test login.** `global-setup.js` logs in once via UI and saves session state to `auth.json` (gitignored), which `playwright.config.js` sets as `use.storageState` for every test. Individual specs do NOT log in themselves except `tests/auth/login.spec.js`, which overrides with `test.use({ storageState: { cookies: [], origins: [] } })` to start unauthenticated. If you change credentials or the login flow, update both `global-setup.js` and `pages/LoginPage.js`.

**Tests run sequentially and depend on each other's state.** `fullyParallel: false` and `workers: 1` are intentional, not a default left unchanged, because specs mutate shared server-side records across files. The `tests/inventory/*.spec.js` files are numbered (`01-` through `07-`) to encode execution/dependency order:
- `02-location.spec.js` creates/renames a location to `testData.location.valid.updatedName`.
- `03-bin.spec.js` depends on that location existing; its `beforeAll` defensively re-creates or renames the location if a prior run didn't leave it in the expected state (see the retry/duplicate-handling logic there before touching location or bin specs).
- Specs intentionally leave some records behind for the next spec (e.g. `02-location.spec.js` skips deleting its main location — see the comment at the bottom of that file) and clean up only the records they duplicated for CRUD-cycle testing.

Because of this, do not casually reorder, parallelize, or cherry-pick individual inventory specs when running the suite for regression purposes; running an isolated later spec (e.g. bin) against a clean/empty environment relies on its own `beforeAll` bootstrap, not on the earlier spec having just run.

**Page Object Model** (`pages/*.js`): one class per app page/form. Constructor wires up locators as properties; methods are the actions/flows (`goto`, `fillForm`, `save`, `openEdit`, `createX`). Tests build assertions on top of these page objects rather than querying the DOM directly wherever a page object exists. Follow the existing shape when adding a new page object: `gotoList()` for the list view, `goto()` for the add form (navigates via list + Add button, not direct URL, to match real user flow), `openEdit(name)` for list → view → Actions → Edit, and a `createX(data)` convenience wrapper.

**Locator conventions seen across page objects** (match these when adding new ones, since the app doesn't expose stable test IDs):
- Prefer `getByPlaceholder`, `getByRole`, `getByText` over raw CSS where possible.
- MUI dropdowns/comboboxes need a click to open, then either `page.getByRole('option', ...)` or typing into an inner search input and waiting (`page.waitForTimeout(...)`) before clicking the option — see `selectFromDropdown` in `07-inventory-item.spec.ts` and `selectLocation`/`selectBinType` in `pages/BinPage.js` for the pattern (including why `.substring(0, N)` is used when typing into the search box: an exact-length match can make `.first()` land on the wrong element).
- `helpers/dropdown.js` (`selectDropdown`) is a shared, generic version of this same custom-search-dropdown pattern; reuse it for new dropdowns instead of re-implementing inline where it fits.
- Status is a MUI switch: `input[name="status"]` for the checked-state assertion, `.MuiSwitch-root` for the click target (clicking the actual input directly doesn't register).
- Actions menu pattern (`Actions` button → `menuitem` for Edit/Duplicate/Delete) repeats across Attribute, Location, Bin, and other list-detail pages.

**Test data** (`config/testData.js`): single shared module, one top-level key per feature area (`credentials`, `uom`, `attribute`, `location`, `bin`, etc.). Unique/collision-prone values (names that must be unique per run) are suffixed with a shared `Date.now()` timestamp (`ts`) computed once at module load, so all specs in the same run reference the same unique strings. `duplicatedName`/`updatedName` fields exist specifically to support the duplicate/edit/rename test cases and are cross-referenced between specs (e.g. `bin.location` is set to `location.updatedName` because bin tests need that location to already exist). When adding test data for a new feature, follow this same nested-object-with-`valid`-plus-negative-variants shape.

**Test IDs and structure**: tests are titled `TC-<AREA>-<NN> [+|-|+/-] <description>`, where `[+]` = positive case, `[-]` = negative/validation case, `[+/-]` = a single test covering both (common for duplicate-name flows: assert the validation error first, then complete the positive path). Smoke-critical tests carry `{ tag: '@smoke' }` as the second argument to `test()`. Keep this convention for new tests so `npm run test:smoke` stays meaningful.

**Screenshots** (`screenshots/`): a few page objects/tests take explicit debug screenshots (e.g. `LocationPage.screenshotBeforeSave`) independent of Playwright's automatic on-failure screenshots configured in `playwright.config.js`.
