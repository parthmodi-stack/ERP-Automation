# memory.md

Project context and decisions that aren't obvious from reading the code cold. Update this as the suite grows rather than letting context live only in commit messages or people's heads.

## What this is, and how it's expected to grow

Playwright UI automation for ERPForce (`https://dev.erpforce.co` / configurable via `BASE_URL`), a hosted ERP web app with no application source in this repo. This is a long-running effort (multi-year), built out module by module: Inventory (Attribute, Location, Bin, UOM, Item Category, Discounted Item, Inventory Item) shipped first, Procurement (Procurement Request, Purchase Agreement, RFQ, Purchase Order, Vendor Return Authorization, Delivery Order) added next. `DEFAULT_TEST_CASES.md` names Accounting, Sales, Manufacturing, Rental, PMS, Document, HRMS, Project as future candidates following the same document-lifecycle pattern.

## Multi-repo workspace

`ERP-Automation.code-workspace` opens this repo alongside three sibling app repos (one level up from this one):

- `../erpforce-be` — backend
- `../erpforce-common-hub-fe` — shared frontend components used across every module (the listing-page action bar, `confirm-modal.tsx`, the shared MaterialTable)
- `../erpforce-fe` — main frontend app: per-module `views/<feature>/...` and Yup validation schemas

When a locator, validation rule, or "is this actually a bug" question can't be answered from this test repo alone, the answer is in one of these. Some modules have since been extracted into their own standalone MFE repos (e.g. Accounting → `erpforce-accounting-fe`, HRMS → `erpforce-hrms-fe`) — check whether a module being tested has been split out before assuming its source still lives under `erpforce-fe`.

## Why the config looks the way it does

- **`workers: 4`, `fullyParallel: false`** — tests *within* one spec file share module-level state (a record created in one test is edited/approved/deleted by a later test in the same file) and must run in file order on one worker; different spec *files* don't depend on each other's state and can run in parallel across workers. Don't "fix" this by flipping `fullyParallel: true`, and don't assume a single global worker like the original inventory-only setup had.
- **`dotenv` + `BASE_URL` env var** — `baseURL` used to be hardcoded to `dev.erpforce.co`; it's now `process.env.BASE_URL || "http://localhost:7172"` so the same suite can target a local dev server. `global-setup.js` normalizes a bare host (no scheme) into a full URL before navigating.
- **Chromium binary going missing** — confirmed to happen repeatedly in this environment between sessions, unrelated to any code change. If `npx playwright test` fails with "Executable doesn't exist at .../chromium-XXXX/...", just run `npx playwright install chromium` again; it's environmental, not a regression.
- **150000ms `test.describe.configure` timeout** on Procurement Request / Purchase Agreement — this account's environment is slower than the 30s default allows for a full create+edit+approve+delete-attempt flow under concurrent (multi-worker) load. A hard timeout doesn't just fail one test — Playwright restarts the worker, which re-requires the spec file and resets every shared `let`, cascading failures into every later test in that file.

## Known live app bugs the suite works around (don't silently "fix" the test)

- **DynamicSelect dropdown fields** can render "No data available" when a sibling field's selection interrupts this field's own in-flight fetch. `BasePage.openDropdownAndPick`/`selectFieldByLabel` retry (Escape + settle) to recover instead of failing outright.
- **Delete is not always actually blocked server-side** for Submitted/Pending/Approved document records, even though the UI implies it should be (see TC016/TC017 in `DEFAULT_TEST_CASES.md`). Where confirmed, this is marked `test.fail(true, 'reason')` rather than the assertion being quietly loosened — so the report keeps flagging it until the app is fixed.
- **Edit forms don't always pre-populate every field that Add did** — e.g. Procurement Request's edit form does not carry over the previously saved Location; it must be re-selected or Save fails with "Location is required". Don't assume "same form" means "same pre-fill behavior" between Add and Edit for a given module.

## Data lifecycle across specs

Inventory specs intentionally share and mutate state across files in dependency order (encoded via the `NN-` filename prefix): `02-location.spec.js` creates/renames a location that `03-bin.spec.js` depends on and defensively re-creates in its `beforeAll` if missing. Some records are deliberately left behind for a later spec rather than cleaned up (see the comment at the bottom of `02-location.spec.js`). `config/testData.js`'s `ts`-suffixed unique names and `updatedName`/`duplicatedName` fields exist specifically to support this cross-spec referencing plus the edit/duplicate test cases — don't "clean up" a value there without checking who else reads it.

Procurement specs instead keep their created-record identity in module-level `let`s inside a single serial `describe` block (see Skills doc), rather than cross-file references — state doesn't leak between Procurement spec files the way it does across the Inventory ones.
