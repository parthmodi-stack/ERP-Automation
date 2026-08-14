# skills.md

Reusable patterns for writing/extending Playwright suites in this repo. Read this before building a new module's page object or spec — most problems here have already been solved once.

## Starting a new module

1. Read `DEFAULT_TEST_CASES.md` first. It's the canonical TC-numbering checklist (core CRUD, field validation, approval flow, listing page) distilled from the Procurement Request suite, plus the "Adapting to a New Module" steps.
2. Decide whether the module is a simple master-data screen (like Inventory's Location/Bin/UOM — extend `pages/<Module>Page.js` directly) or a document-lifecycle module with Draft/Submit/Approve/Reject (like Procurement — extend `pages/BasePage.js`).
3. Follow the existing file layout: `pages/<Module>Page.js` + `tests/<area>/<NN>-<module>.spec.js` (or `.spec.ts`), numbered to reflect run/dependency order within `tests/inventory/` and `tests/procurement/`.

## `pages/BasePage.js` — what to reuse instead of reimplementing

Document-style page objects (Procurement Request, Purchase Agreement, Purchase Order, Vendor Return Authorization, Delivery Order, RFQ) extend this. It already handles, across every module:

- **Auth failure fast-fail** — a `response` listener throws immediately on a 401/403 instead of letting a stale `auth.json` session masquerade as a confusing UI timeout.
- **Dropdown selection** (`openDropdownAndPick`, `selectFieldByLabel`, `selectFirstOptionByLabel`, `selectFirstAvailableOption`) — handles the DynamicSelect fields' known live bug where a sibling field's selection can blank this field's option list mid-fetch; retries with Escape + settle, and falls back to "pick whatever's first" for fields whose exact live master-data value isn't pinned/verified.
- **Debounced computed fields** (`waitForItemAmountsToSettle`) — call this after filling Quantity/Rate in an item modal and before Save; saving too early submits null Gross/Tax/Net/Total amounts.
- **Approval workflow** (`openSubmitMenu`, `quickApproval`, `accept`, `reject`) — shared split-button pattern (main button vs. adjacent caret that opens Quick Approval/Accept/Reject) used by every approval-workflow module.
- **Row/list helpers** — `rowBySeriesNumber` (match by series-number text, not `getByRole('link')`, since these rows have no real `href`), `openRowActionMenu`, `deleteFromList`/`deleteFromView`/`confirmDelete`, `isDeleteAvailableFromList`, `isRowActionDisabled`.
- **Listing page** (shared `MaterialTable` across every module) — `searchList`/`clearSearch` (waits for the real `search=` network response, not a fixed timeout), `noDataRow`, `columnHeader`/`getColumnAriaSort`/`clickColumnHeader`, `prevPageButton`/`nextPageButton`/`goToPage`/`getPaginationLabel`.
- **Field read-back** — `getFieldValueOnView`, `getEditComboboxValue`, `getEditNarrationValue` for asserting persisted values on View/Edit pages, already stripped of MUI's stray zero-width-space artifacts.

Only add something new to `BasePage.js` if it's byte-identical (or a strict superset) across modules — a real behavioral difference (different wording, different field name, different retry count) belongs in that module's own page object, not merged into the shared base.

## Test data: `config/testData.js` vs `config/testDataFactory.js`

- `testData.js` — pinned, hand-verified master-data references (vendor, location, item, currency, purchase representative, approver names) that must exist in the real shared/live environment. Never generate these with faker; a random string isn't a valid foreign key.
- `testDataFactory.js` (`uniqueName`, `referenceNumber`, `narration`, `quantity`, `amount`) — for free-text/numeric fields only, where any value is valid. Use `Date.now()`-suffixed uniqueness for anything that must not collide across runs.

## Locator conventions

- Prefer `getByPlaceholder` / `getByRole` / `getByText` over CSS selectors; fall back to structural `xpath=following::...` only when there's genuinely no accessible name (documented case-by-case in `BasePage.js` comments — e.g. the pagination Prev/Next buttons and the "Go To" page input have no `aria-label`/`<label>` at all).
- MUI status toggle: assert on `input[name="status"]`, click `.MuiSwitch-root` (clicking the input directly doesn't register).
- Actions menu (`Actions` button → `menuitem` for Edit/Duplicate/Delete) repeats across every list-detail page.
- `helpers/dropdown.js` (`selectDropdown`) is the simpler generic version of the custom-search-dropdown pattern for Inventory-module pages that don't extend `BasePage`; reuse it there instead of inlining the click→search→click sequence again.

## Grouping and lifecycle conventions

- Document-lifecycle specs use `test.describe.serial()` with one shared browser context/page across `beforeAll`/`afterAll` (not Playwright's default fresh-page-per-test), because test cases within the file depend on state (`createdRequest`, `approvedRequest`, etc.) set by earlier ones.
- Bump `test.describe.configure({ timeout: ... })` for multi-step lifecycle files (150000ms is the current standard for Procurement Request/Purchase Agreement) — a hard per-test timeout doesn't just fail that test, it can restart the worker and reset every shared `let` in the file, cascading failures into every later test.
- Capture created-record IDs from the list's own network refetch after save (`page.waitForResponse(...)`), never by assuming "first row" — the list is a real, shared, persistent dataset.
- If a test reveals a genuine app bug (e.g. delete not actually blocked server-side for a Submitted/Approved record), keep the test and mark it `test.fail(true, 'reason')` instead of loosening the assertion — this keeps the gap visible in the HTML report and Playwright will flag it if the bug is ever fixed.

## Comment style (deliberate exception to "write minimal comments")

This repo writes dense, why-focused comments on anything non-obvious: a confirmed live app bug, a retry that exists because of a specific race, a locator choice that avoids a documented ARIA gap. Match that density and voice when adding to this codebase — it's cheaper to write once than to re-debug the same live app quirk a second time.
