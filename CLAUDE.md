# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Playwright end-to-end test automation suite for ERPForce, a web ERP application hosted at `https://dev.erpforce.co`. There is no application source code here, only tests, page objects, and fixtures that drive the live dev environment through the browser.

## Commands

```bash
npm test                  # run the full suite
npm run test:headed       # run with a visible browser
npm run test:debug        # run in Playwright's debug/inspector mode
npm run test:report       # open the last HTML report
npm run test:smoke        # run only tests tagged @smoke
npm run test:regression   # same as npm test (full suite)
npm run test:login        # tests/auth/login.spec.js only
npm run test:uom          # tests/inventory/04-uom.spec.js only
```

Run a single spec or test directly with the Playwright CLI:

```bash
npx playwright test tests/inventory/02-location.spec.js
npx playwright test tests/inventory/02-location.spec.js -g "TC-LOC-02"
```

There is no lint or typecheck script configured (one `.ts` spec exists but the project has no `tsconfig.json`; TypeScript is used only for its inline syntax, not checked).

## Architecture

**Global login, shared session.** `global-setup.js` (wired in via `globalSetup` in [playwright.config.js](playwright.config.js)) logs in once with the credentials in `config/testData.js` and writes the session to `auth.json`, which every test then reuses via `use.storageState`. Tests that need to exercise auth itself (e.g. `tests/auth/login.spec.js`) override this per-file with `test.use({ storageState: { cookies: [], origins: [] } })` to start unauthenticated. `auth.json` is gitignored — regenerated automatically before each run.

**Sequential execution, shared state across files.** `fullyParallel: false` and `workers: 1` are deliberate: many specs in `tests/inventory/` build on data created by earlier ones (e.g. `bin.valid.location` in `config/testData.js` references the location name created by the location spec's update test case). Numeric prefixes on inventory specs (`01-attribute`, `02-location`, `03-bin`, ...) encode required run order — do not reorder or parallelize these without checking cross-file data dependencies.

**Page Object Model.** Each `pages/*Page.js` file wraps one screen/form: locators in the constructor, actions as methods, and usually one high-level `createX()`/`loginAndWaitForDashboard()` method that composes the others for the common happy path. Specs call into page objects rather than locating elements directly; when a form needs interaction not yet covered by its page object, add a method there instead of inlining locators in the spec.

**Centralized test data.** `config/testData.js` holds all fixtures (credentials, form values, expected updated/duplicated names), keyed by feature (`uom`, `location`, `attribute`, etc.). A module-level `Date.now()` timestamp (`ts`) is baked into generated names once at import time so a name stays identical across the multiple test cases in a run (create → verify → update → duplicate) but is unique across runs, avoiding collisions against real leftover data in the shared dev environment. Follow this pattern for new features rather than inlining literals in specs.

**Test case IDs and tags.** Tests are named `TC-<AREA>-<NN> [+|-] <description>` (`+` = positive, `-` = negative case), grouped with `test.describe`. Smoke-critical happy-path tests are tagged `{ tag: '@smoke' }`; use this tag to keep `npm run test:smoke` meaningful when adding new happy-path coverage.

**Dropdown helpers.** The app's UI has more than one custom dropdown/combobox pattern (a generic searchable dropdown in `helpers/dropdown.js`; a MUI `mui-component-select-*` menu pattern reimplemented locally in `tests/inventory/07-inventory-item.spec.ts`). Check for an existing helper matching the widget style before writing new dropdown-interaction code, and prefer extracting a shared helper over copy-pasting a local one.

**Flaky-UI workarounds are intentional, read the comments before "fixing" them.** Several specs and page objects contain comments explaining non-obvious waits, retries, or loose selectors (e.g. retrying a `Save` click when validation feedback doesn't appear, scoping locators to a dialog to avoid strict-mode collisions, matching label text loosely because of untranslated locale keys). These exist because of real, observed flakiness or bugs in the dev environment, not stylistic choices, don't remove them without understanding why they were added.

**Excel test report generated on every run.** `reporters/excel-reporter.js` is registered in `playwright.config.js`'s `reporter` array and writes `Inventory_Test_Cases.xlsx` (gitignored) at the end of every `playwright test` invocation, one row per test actually executed in that run (id/type parsed from the `TC-<AREA>-<NN> [+|-|+/-] <description>` title convention, plus live status/duration/error/a hyperlinked path to that test's recorded video). It reflects whatever subset of tests ran (a single spec, `--grep`, or the full suite), not a fixed list, so it never goes stale relative to the code.

**Every test is video-recorded.** `use.video` is set to `'on'` (not the default `'on-first-retry'`), so every run - passing or failing - produces a `.webm` under `test-results/<test-name>/video.webm`. The Excel report's "Video Path" column links straight to each test's recording. This trades disk space for always having a replay to check, since `test-results/` is gitignored anyway.
