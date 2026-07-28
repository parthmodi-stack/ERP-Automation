# Time Sheet — Playwright Automation Scenario Suite

Module path: HRMS → Time Tracking → Time Sheet (`/time-tracking/time-sheet`)

Source verified against `erpforce-hrms-fe/src/views/time-tracking/time-sheet/` (list, add, edit,
view, `components/time-sheet-table/`, `utils/{types,transform,commons,constants}.ts`,
`redux/actionCreators.ts`) and `erpforce-be/modules/hrms/lib/timesheets/` (routes, validators,
migrations) before writing any scenario below.

**Deliverable shape, per the two decisions made before writing this doc:**
- This repo is 100% CommonJS `.js` with **one spec file per module** (`tests/hrms/<NN>-<feature>.spec.js`),
  no TypeScript config, and no custom Playwright fixture/mock framework — `page.route()` interception
  is the established "mocking" pattern (see Leave Policy Master's Negative section). So instead of a
  `tests/timesheet/*.spec.ts` folder, every section below maps to ONE `test.describe(...)` block
  inside a single future `tests/hrms/07-time-sheet.spec.js`, and "Recommended Playwright fixtures"
  means "the default `{ page }` fixture from `@playwright/test`, reused via `LoanConfigurationPage`-style
  Page Object" — there is nothing else to recommend in this codebase today.
- Scenarios reflect only **confirmed real behavior**. See "Corrections" below for what the original
  prompt assumed that isn't real.

## Corrections to the requested module description (read before using these tables)

- **The daily grid is NOT a Present/Absent/Weekly-Off/Holiday/Leave/Half-Day/WFH/Overtime/
  Shift/Night-Shift cell-status grid.** The real grid (`time-sheet-table.tsx` + `utils/transform.ts`)
  has exactly three row types per employee: **Work Hours**, **OT Hours**, and a read-only **Total
  Hours** sum row. There is no cell-status enum, no color-coded status swatches, no Shift/Night-Shift
  cell type anywhere in code.
- **Leave is an overlay, not a cell status.** When `on_leave` is true and there are no actual
  hours, the cell renders a `LeaveBadge` (leave-category initials + tooltip) instead of a duration
  value, with an orange warning triangle if the underlying leave request isn't itself `Approved`.
  That is the full extent of "Leave" handling in this grid.
- **No weekend/holiday shading was found anywhere in the grid component or its CSS.** Flagged as
  unconfirmed/likely absent, not silently assumed to exist.
- **Cells are editable only when the backend explicitly flags that date as an override** —
  `enableEditing` checks `row[date + '_is_overridden'] === true` per column. Most cells are
  therefore read-only computed values, not freely editable; only backend-flagged override days
  can be hand-edited, and the Total Hours row is never editable.
- **The approval workflow has exactly five statuses**: `Draft`, `Pending`, `Submitted`, `Approved`,
  `Rejected` (confirmed identically in the FE type, the grid's status switch, and the DB `ENUM`).
  **"Resubmitted," "Cancelled," and "Returned for Correction" do not exist** as timesheet statuses
  anywhere in source — not in code paths, not in the DB enum for this table. (A separate, generic
  cross-module `approvals` table does have a `'Cancelled'` enum value, but no timesheet code path
  ever sets or reads it.)
- **"Regenerate" is not a distinct feature/endpoint** — it's the exact same `generateTimeSheetData`
  thunk (`POST /v1/timesheets/generate`) as the initial "Generate" button, just re-invoked once
  grid data already exists. There is no separate regenerate API, and no duplicate-existing-
  timesheet detection was found anywhere in the Add flow.
- **Employees are not chosen via a form field on the Add page itself** — the Add page's own filter
  bar only has Company (defaulted from the logged-in user), Department (multi-select), and Date
  Range (no future dates allowed, `maxDate = yesterday`). Employees are added afterward through a
  separate **"Add Employee" modal** (multi-select, company-scoped, active/non-draft employees only).
- **Buttons are exactly "Save as Draft" and "Submit"** (not "Save Draft"), and neither renders
  until Generate has produced grid data (`hasDaysData`). Submit is additionally disabled whenever
  there are zero employees in the grid.
- **Edit is not blocked by status at the route level.** Only the list page and the View page's
  Actions menu hide/disable the "Edit" affordance for non-Draft records
  (`canEditTimesheet = status === 'Draft' && canEdit`). Directly navigating to a non-Draft record's
  Edit URL is NOT blocked by any status check in `edit-time-sheet.hrms.tsx` itself — a genuine,
  confirmed edge case worth its own scenario, not a guess.
- **Delete is allowed for Draft or Pending only** (`canDeleteTimesheet`), not just Draft; it's
  disabled for Approved/Rejected from both the list and the View page.
- **There's a real, confirmed hard validation cap**: total Work + OT minutes for a single day
  cannot exceed 1440 (24h); exceeding it fires a snackbar (`TOTAL_HOURS_LIMIT_EXCEEDED`) and the
  row visually resets. This is a genuinely valuable, automatable boundary case.
- **"Audit trail" on View is really the "Approval History" dropdown** (`GET /:id/approval-history`),
  not a general activity-log feed — a separate `activity_logs` field IS fetched by the by-id API
  but was not found rendered anywhere in the View page.
- **No dedicated translation entries exist for this module's UI** (`hrms.time_sheet.*` isn't in
  `translations/hrms.json`) — every button/label/message is a hardcoded English string in
  `utils/constants.ts` or inline JSX, not a translation key. Locators below use those literal
  strings directly.
- **Backend response keys are `data.timesheets`** (list) and **`data.timesheet`** (by id) — not
  `data.time_sheet` or `data.timesheet_master`. Note this is yet a THIRD distinct naming pattern
  across this suite's HRMS modules (Leave Policy Master → `leave_policy_master`, Loan Configuration
  → `loan_master`, Time Sheet → `timesheets`) — always confirm the actual key per module rather
  than assuming consistency.

### Live-screenshot corrections (added after seeing the real Add/List pages)

- **Employee rows are collapsed by default to a single summary row**, not the 3 stacked Work/OT/
  Total rows described in the source read — a chevron/expand control sits to the left of each
  Employee name (visible in the real Add page). This CONFIRMS "Expand/Collapse rows" from the
  original prompt is real, just inverted from how Section 8 assumed it (3 rows always visible) —
  see the new Section 23 below for the corrected scenarios.
- **Every single day cell for every employee showed the identical "UL" badge** in a live-generated
  sheet (Company erp-force, 1–10 Jul 2026, 17 employees). Given the confirmed source behavior that
  a day cell only renders a `LeaveBadge` (leave-category initials) when `on_leave` is true with no
  actual hours, "UL" reads as "Unpaid Leave" initials — meaning either every one of these 17
  employees is genuinely marked on Unpaid Leave for all 10 days (implausible test data), or
  `on_leave`/the leave lookup is defaulting to true instead of reflecting real attendance. This is
  now a dedicated, screenshot-confirmed scenario (TC-TS-LIVE-01), not a hypothetical.
  - **PROMPT/USER SANITY CHECK**: this could also just mean the app's demo/dev data has no real
    attendance or time-card entries logged for this company/date range at all — if so, "UL" would
    actually be misleading placeholder-as-leave-badge rather than a genuine leave, which is itself
    still worth a scenario either way (a day with zero attendance data should not silently render
    as if the employee took Unpaid Leave).
- **The same employee ("Raj Nimaje") appeared twice in one generated sheet's employee list** (once
  mid-list, once as the final row) — this directly contradicts TC-TS-EMP-05's assumption that
  re-adding an already-present employee doesn't duplicate. Corrected to a confirmed-bug scenario,
  TC-TS-LIVE-02.
- **The List page's Department column can render the exact same chip twice in one row**
  (`TS-2026-000031`/`TS-2026-000030` both show "Purchase" "Purchase") — a duplicate-department
  rendering/data issue, not a dedup-on-display bug necessarily (could be two distinct department
  records that happen to share a display name), but worth a dedicated scenario either way,
  TC-TS-LIVE-03.
- **A blank Department renders as a plain "-" placeholder** on the list (`TS-2026-000033`),
  confirming the same convention already seen on every other master-data list in this suite.
- **Status chips confirmed for Pending (amber) and Approved (green)** in this real data sample;
  Draft/Rejected/Submitted colors remain unconfirmed live (no such rows existed in the sample) —
  Section 1's TC-TS-LIST-06 already covers verifying all 5, keep it as-is.
- **A previously-undiscovered shared feature**: the list page has a **saved-view/template
  selector** in its footer — a row of named view pills ("Default", a user-created "Test"), a "+"
  to create a new named view, and a "Save" button (disabled when the current view has no unsaved
  changes). This is the `usePages`/`schemaFields` system already referenced in passing in the Loan
  Configuration exploration but never covered by a test scenario in either doc — it's likely
  shared across every module using this listing infra, not Time-Sheet-specific. New Section 23
  scenarios below cover it for this module; worth revisiting Loan Configuration's/Leave Policy
  Master's own docs later since they may share the identical feature.
- **The Add page's own grid has its own Search box**, separate from the List page's search —
  confirmed a distinct in-grid employee search, not covered by Section 2 (which only covers the
  List page). Added to Section 23.
- **The Add page's Department filter renders as an "N Item(s) Selected" summary chip**, not named
  per-department chips like the List page's Department column — refines TC-TS-ADD-03's wording
  (still a multi-select, just a different chip-rendering convention on Add vs. List).

---

## 1. List Page (`describe('Time Sheet List')`)

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-LIST-01 | List loads at the correct URL with expected columns | Page Load | P0 | Logged in, `canView` | Navigate to `/time-tracking/time-sheet` | URL matches; columns are ID, Company, Department, From, To, Submitted By, Status | @smoke | `GET /v1/timesheets` | — | `{ page }` | none |
| TC-TS-LIST-02 | Table View renders existing records | Listing | P0 | ≥1 record exists | Load list page | ≥1 row with non-empty ID/Status | @smoke | `GET /v1/timesheets` | — | `{ page }` | none |
| TC-TS-LIST-03 | Grid View toggle renders the same records | View toggle | P1 | Records exist | Switch Table → Grid View | Same records render via `GridCard`, consistent field values | @regression | `GET /v1/timesheets` | — | `{ page }` | none |
| TC-TS-LIST-04 | Kanban/Calendar/Gantt views are absent | View toggle | P2 | List loaded | Open the view switcher | Only Table/Grid present (`disabledViews` confirmed) | @regression | — | — | `{ page }` | none |
| TC-TS-LIST-05 | Department column renders as Chips | UI | P2 | Record with departments | Load list page | Department cell renders one/more Chip elements, not plain text | @regression | — | — | `{ page }` | none |
| TC-TS-LIST-06 | Status badge renders distinctly for all 5 real statuses | UI | P1 | Records in Draft/Pending/Submitted/Approved/Rejected exist | Load list page | Each status renders visually distinct, matching only the 5 confirmed values | @regression | — | — | `{ page }` | none |
| TC-TS-LIST-07 | Empty state shows when zero records match | UI | P1 | No records / impossible filter | Load list / apply a no-match filter | Shared empty/no-data state renders | @regression | `GET /v1/timesheets` | — | `{ page }` | none |
| TC-TS-LIST-08 | Loading indicator shows during initial fetch | UI | P2 | Throttled network | Load list page | Loader visible until data resolves | @regression | `GET /v1/timesheets` | — | `{ page }` | `page.route` delay on `**/v1/timesheets` |
| TC-TS-LIST-09 | Edit is enabled from the list only for Draft records | RBAC/status | P0 | Draft + Approved + Rejected + Pending records exist | Open row menu for each | Edit enabled only for Draft; disabled for Approved/Rejected/Pending (confirmed condition) | @smoke @regression | — | 4 records, one per status | `{ page }` | none |
| TC-TS-LIST-10 | Delete is enabled from the list only for Draft/Pending | RBAC/status | P0 | Draft, Pending, Approved, Rejected records exist | Open row menu for each | Delete enabled for Draft/Pending; disabled for Approved/Rejected | @smoke @regression | — | 4 records, one per status | `{ page }` | none |
| TC-TS-LIST-11 | No Regenerate/Submit action exists on the list row menu | UI | P2 | Any record | Open row menu | Only View/Edit/Delete present — confirmed no Regenerate/Submit row action | @regression | — | — | `{ page }` | none |
| TC-TS-LIST-12 | Add button hidden without `canAdd` | RBAC | P0 | User lacking `canAdd` (Timesheets module) | Load list page | Add button not rendered | @smoke @regression | — | — | `{ page }` | none |
| TC-TS-LIST-13 | List route blocked without `canView` | RBAC | P0 | User lacking `canView` | Navigate directly to list URL | `ProtectedRoute module="Timesheets"` blocks access | @regression | — | — | `{ page }` | none |
| TC-TS-LIST-14 | List auto-refreshes after Add/Edit/Delete without manual reload | Functional | P1 | Just completed an Add | Return to list | New/updated/removed row reflects immediately | @smoke @regression | `GET /v1/timesheets` | — | `{ page }` | none |

## 2. Search (`describe('Search')`)

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-SRCH-01 | Search by Timesheet ID (series number) | Search | P0 | Record exists | Enter its series number | Matching row returned | @smoke | `GET /v1/timesheets?search=...` | series_number | `{ page }` | none |
| TC-TS-SRCH-02 | Search by Company name | Search | P1 | Record exists | Enter company name | Matching row(s) returned | @regression | `GET /v1/timesheets?search=...` | "erp-force" | `{ page }` | none |
| TC-TS-SRCH-03 | Search by Submitted By name | Search | P1 | Record exists | Enter creator's name | Matching row(s) returned | @regression | `GET /v1/timesheets?search=...` | — | `{ page }` | none |
| TC-TS-SRCH-04 | Partial-text search | Search | P1 | Record exists | Enter a substring of a known value | Matching row(s) returned | @regression | — | — | `{ page }` | none |
| TC-TS-SRCH-05 | Case-insensitive search | Search | P2 | Record exists | Enter value in different case | Same matches as exact case | @regression | — | — | `{ page }` | none |
| TC-TS-SRCH-06 | No-match search shows empty state | Search | P1 | — | Enter a nonsense string | Empty/no-data state renders | @regression | `GET /v1/timesheets?search=...` | "zzz-no-such-timesheet" | `{ page }` | none |
| TC-TS-SRCH-07 | Special characters don't error the request | Negative | P2 | — | Search `%`, `_`, `'` | No 500; literal-match or empty result | @negative | `GET /v1/timesheets?search=...` | — | `{ page }` | none |
| TC-TS-SRCH-08 | Clearing search restores the full list | Search | P1 | Search active | Clear search box | Full unfiltered list returns | @regression | `GET /v1/timesheets` | — | `{ page }` | none |
| TC-TS-SRCH-09 | Search resets to page 1 of results | Search | P2 | On page 2+ | Enter a search term | Result set resets to page 1, not a stale later page | @regression | — | — | `{ page }` | none |
| TC-TS-SRCH-10 | Department is NOT confirmed searchable via the plain search box | Search | P3 | — | Search a department name | Verify live whether Department participates in free-text search or only via Filters — unconfirmed from `useDataFetcher` alone | @regression | — | — | `{ page }` | none |

## 3. Filters (`describe('Filters')`)

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-FILT-01 | Filter by Company | Filter | P1 | Records across companies | Open Filters, set Company | Only matching-company rows shown | @regression | `GET /v1/timesheets?...` | "erp-force" | `{ page }` | none |
| TC-TS-FILT-02 | Filter by Department | Filter | P1 | Records with departments | Filter by a department | Only matching rows shown | @regression | — | — | `{ page }` | none |
| TC-TS-FILT-03 | Filter by Status | Filter | P0 | Mixed-status records | Filter by "Approved" | Only Approved rows shown | @smoke @regression | — | — | `{ page }` | none |
| TC-TS-FILT-04 | Filter by Submitted By | Filter | P2 | Records from multiple users | Filter by a user | Only matching rows shown | @regression | — | — | `{ page }` | none |
| TC-TS-FILT-05 | Filter by Date Range (From/To) | Filter | P1 | Records across dates | Set a From/To range | Only overlapping-range rows shown | @regression | — | — | `{ page }` | none |
| TC-TS-FILT-06 | Multiple filters combine (AND) | Filter | P1 | Multi-criteria records | Apply Company + Status together | Result narrowed by both simultaneously | @regression | — | — | `{ page }` | none |
| TC-TS-FILT-07 | Clear a single filter chip | Filter | P2 | Filter applied | Remove one filter chip | That filter's constraint lifts, others remain | @regression | — | — | `{ page }` | none |
| TC-TS-FILT-08 | Reset all filters | Filter | P1 | Multiple filters applied | Click Reset/Clear all | Full unfiltered list returns | @regression | — | — | `{ page }` | none |
| TC-TS-FILT-09 | Verify the actual API request fires with correct query params after applying a filter | API | P1 | — | Apply a Status filter, intercept the request | Request URL/query reflects the selected filter value | @api @regression | `GET /v1/timesheets?status=...` | — | `{ page }` | `page.waitForRequest` |

## 4. Sorting (`describe('Sorting')`)

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-SORT-01 | Sort ID ascending/descending | Sort | P1 | Multiple records | Click ID header twice | Order toggles correctly both directions | @regression | — | — | `{ page }` | none |
| TC-TS-SORT-02 | Sort Company alphabetically | Sort | P2 | Multiple companies | Click Company header | Correct alphabetical order both directions | @regression | — | — | `{ page }` | none |
| TC-TS-SORT-03 | Sort From/To dates chronologically, not lexically | Sort | P1 | Records with varied dates | Click From header | True date order, not string order | @regression | — | — | `{ page }` | none |
| TC-TS-SORT-04 | Sort Status | Sort | P2 | Mixed-status records | Click Status header | Consistent grouping both directions | @regression | — | — | `{ page }` | none |
| TC-TS-SORT-05 | Sort Submitted By | Sort | P2 | Multiple creators | Click Submitted By header | Correct alphabetical order | @regression | — | — | `{ page }` | none |
| TC-TS-SORT-06 | Default sort on first load | Sort | P2 | — | Load list fresh | Confirm live what the default order actually is — unconfirmed from source | @regression | — | — | `{ page }` | none |

## 5. Pagination (`describe('Pagination')`)

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-PAGE-01 | Pagination label shows "Page X of Y" | Pagination | P1 | Multiple pages | Load list | Label matches `/Page \d+ of \d+/` | @regression | `GET /v1/timesheets` | — | `{ page }` | none |
| TC-TS-PAGE-02 | Next/Previous move one page, disable at bounds | Pagination | P1 | Multiple pages | Click Next to the last page | Next disables at last page; Previous disables at first | @regression | — | — | `{ page }` | none |
| TC-TS-PAGE-03 | Changing items-per-page reloads with new size | Pagination | P1 | 20+ records | Change page size | List reloads with new row count | @regression | — | — | `{ page }` | none |
| TC-TS-PAGE-04 | Direct "Go To" page number navigation | Pagination | P2 | Multiple pages | Enter a target page number | Navigates directly there | @regression | — | — | `{ page }` | none |
| TC-TS-PAGE-05 | Empty last page after deleting its only row | Pagination | P2 | On the last page with 1 record | Delete that record | Pagination recalculates, no dangling empty-page reference | @regression | — | — | `{ page }` | none |

## 6. Add Time Sheet — Filter Bar & Generate (`describe('Add Time Sheet')`)

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-ADD-01 | Add page loads with Company defaulted from logged-in user | Page Load | P0 | `canAdd` | Navigate via Add button | Company pre-filled from `user.company_id`; no grid yet | @smoke | — | — | `{ page }` | none |
| TC-TS-ADD-02 | Date Range defaults to yesterday, no future dates selectable | Date Range | P0 | On Add page | Open the date picker | Both From/To default to yesterday; dates after today are disabled (`maxDate`) | @smoke @regression | — | — | `{ page }` | none |
| TC-TS-ADD-03 | Department filter is multi-select | Filter Bar | P1 | On Add page | Select 2+ departments | Both persist as selected chips | @regression | — | — | `{ page }` | none |
| TC-TS-ADD-04 | "Generate" is the only primary action before any grid data exists | UI | P1 | On Add page, no grid yet | Observe footer buttons | Only "Generate" renders; no Save as Draft/Submit yet (`hasDaysData` false) | @smoke @regression | — | — | `{ page }` | none |
| TC-TS-ADD-05 | Clicking Generate calls the real generate API and renders the grid | Functional | P0 | Filters set | Click Generate | `POST /v1/timesheets/generate` fires; grid renders with Work/OT/Total rows | @smoke | `POST /v1/timesheets/generate` | valid filters | `{ page }` | none |
| TC-TS-ADD-06 | Generate without a Date Range is blocked | Validation | P0 | Date Range cleared | Click Generate | Blocked — `filters.start_date`/`end_date` are required by the backend validator | @validation @smoke | `POST /v1/timesheets/generate` | — | `{ page }` | none |
| TC-TS-ADD-07 | Generate with an empty employee grid still allowed (employees added AFTER generate) | Functional | P1 | Filters set, no employees added yet | Click Generate | Grid renders with zero employee rows — employees are added via the modal afterward, not required to Generate | @regression | `POST /v1/timesheets/generate` | — | `{ page }` | none |
| TC-TS-ADD-08 | After Generate, "Actions" dropdown with "Regenerate" appears | UI | P1 | Grid data exists | Observe footer/header buttons | "Actions" button renders; its only menu item is "Regenerate" | @regression | — | — | `{ page }` | none |
| TC-TS-ADD-09 | "Generate" API failure shows an error, no partial/broken grid | Negative | P1 | Mocked 500 | Click Generate | Error toast shown; no grid rendered in a broken state | @negative | `POST /v1/timesheets/generate` | — | `{ page }` | `page.route` 500 on `**/v1/timesheets/generate` |
| TC-TS-ADD-10 | Duplicate-existing-timesheet detection — unconfirmed, likely absent | Negative | P2 | An overlapping timesheet already exists for the same Company/Department/Date Range | Generate again with the same filters | Verify live whether a duplicate warning appears — no such check was found in `generate.timesheet.js`/the Add page; expect none | @negative | `POST /v1/timesheets/generate` | — | `{ page }` | none |

## 7. Add Employee Modal (`describe('Add Employee Modal')`)

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-EMP-01 | "Add Employee" modal opens from the grid toolbar | UI | P0 | Grid data exists | Click Add Employee | Modal opens with a multi-select employee field | @smoke | — | — | `{ page }` | none |
| TC-TS-EMP-02 | Employee options are scoped to the selected Company | Dependency | P1 | Company selected | Open the employee multi-select | Only that Company's employees appear | @regression | — | — | `{ page }` | none |
| TC-TS-EMP-03 | Only active, non-draft employees are selectable | Data scoping | P1 | Mixed active/inactive/draft employees exist | Open the employee multi-select | Only `is_active=1`/`is_draft=0` employees listed (confirmed filter) | @regression | — | — | `{ page }` | none |
| TC-TS-EMP-04 | Selecting multiple employees adds multiple rows to the grid | Functional | P0 | Modal open | Select 3 employees, confirm | 3 employee rows appear in the grid | @smoke @regression | — | — | `{ page }` | none |
| TC-TS-EMP-05 | Adding an already-added employee is not duplicated | Negative | P2 | Employee already in grid | Reopen modal, select same employee again | No duplicate row created | @negative | — | — | `{ page }` | none |
| TC-TS-EMP-06 | Removing an employee row removes it from the grid | Functional | P1 | Employee row exists | Remove that row | Row disappears; totals recompute without it | @regression | — | — | `{ page }` | none |

## 8. Duration Grid — Work/OT/Total Rows (`describe('Time Sheet Grid')`)

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-GRID-01 | Each employee renders exactly 3 rows: Work Hours, OT Hours, Total Hours | UI | P0 | Employees added | Inspect grid | 3 labeled rows per employee, confirmed real row set (no Present/Absent/etc.) | @smoke | — | — | `{ page }` | none |
| TC-TS-GRID-02 | Date columns match the selected Date Range exactly | UI | P0 | Date Range set, generated | Count date columns | One column per day in range, correct sequence | @smoke @regression | — | — | `{ page }` | none |
| TC-TS-GRID-03 | Total Hours row is always read-only | UI | P1 | Grid rendered | Attempt to click/edit a Total Hours cell | Not editable, regardless of override flags | @regression | — | — | `{ page }` | none |
| TC-TS-GRID-04 | A non-overridden day's Work/OT cell is read-only | Editability | P0 | Day NOT flagged `_is_overridden` | Attempt to edit that cell | Cell remains read-only/non-editable | @smoke @regression | — | — | day without override flag | `{ page }` | none |
| TC-TS-GRID-05 | An overridden day's cell IS editable | Editability | P0 | Day flagged `_is_overridden: true` | Click the cell, enter a new value | Cell enters edit mode via `MaterialEditableTable` row-edit mode | @smoke @regression | — | day with override flag | `{ page }` | none |
| TC-TS-GRID-06 | Leave badge renders instead of hours when on_leave with no actual hours | Leave overlay | P1 | Day has `on_leave: true`, zero hours | Inspect that cell | `LeaveBadge` renders leave-category initials, not a duration | @regression | — | — | `{ page }` | none |
| TC-TS-GRID-07 | Leave badge shows a warning icon when the underlying leave isn't Approved | Leave overlay | P1 | Leave request status ≠ Approved | Inspect the leave badge | Orange warning triangle rendered, plus tooltip with full leave category | @regression | — | — | pending/rejected leave record | `{ page }` | none |
| TC-TS-GRID-08 | Leave badge tooltip shows the full leave category name | UI | P2 | Leave badge present | Hover the badge | Tooltip text = full category, not just initials | @regression | — | — | — | `{ page }` | none |
| TC-TS-GRID-09 | Per-employee totals (Work/OT/Sum) recompute live on edit | Calculation | P0 | Editable cell edited | Change an overridden cell's value | `total_work`/`total_ot`/`total_sum` update immediately, client-side | @smoke @regression | — | — | `{ page }` | none |
| TC-TS-GRID-10 | Daily cap: Work+OT cannot exceed 1440 minutes | Validation/Boundary | P0 | Editable cell | Enter a value that pushes the day's Work+OT past 24h | `TOTAL_HOURS_LIMIT_EXCEEDED` snackbar fires; the row visually resets | @validation @boundary @smoke | — | 1441 minutes total | `{ page }` | none |
| TC-TS-GRID-11 | Exactly 1440 minutes is accepted (inclusive boundary) | Boundary | P1 | Editable cell | Enter exactly 1440 total minutes | Accepted, no error | @boundary @regression | — | 1440 minutes | `{ page }` | none |
| TC-TS-GRID-12 | No weekend/holiday shading found — confirm live | UI | P3 | Grid spans a weekend | Inspect weekend date columns | Verify whether any visual distinction exists — none confirmed in source, expect none | @regression | — | — | `{ page }` | none |
| TC-TS-GRID-13 | Horizontal scroll works for a wide (31-day) grid | UI/Responsive | P2 | 31-day range generated | Scroll grid horizontally | All date columns reachable, header stays aligned | @regression | — | 31-day range | `{ page }` | none |
| TC-TS-GRID-14 | Vertical scroll works with many employee rows | UI/Responsive | P2 | 50+ employees added | Scroll grid vertically | All employee rows reachable | @regression | — | 50+ employees | `{ page }` | none |
| TC-TS-GRID-15 | Employee column stickiness while horizontal-scrolling | UI | P2 | Wide grid | Scroll horizontally | Employee name column remains visible/pinned — confirm live, sticky behavior not explicitly verified in the component read | @regression | — | — | `{ page }` | none |

## 9. Regenerate (`describe('Regenerate')`)

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-REGEN-01 | Regenerate calls the SAME generate endpoint, not a distinct one | API | P1 | Grid data exists | Click Actions → Regenerate, intercept the request | Request goes to `POST /v1/timesheets/generate`, identical to Generate | @api @regression | `POST /v1/timesheets/generate` | — | `{ page }` | `page.waitForRequest` |
| TC-TS-REGEN-02 | Regenerate refreshes attendance/time-card data from current filters | Functional | P0 | Grid data exists, underlying attendance changed since Generate | Click Regenerate | Grid reflects the latest data, not stale cached values | @smoke | `POST /v1/timesheets/generate` | — | `{ page }` | none |
| TC-TS-REGEN-03 | Regenerate does not create duplicate employee rows | Negative | P1 | Employees already in grid | Click Regenerate | Same employee count/rows, not doubled | @negative @regression | — | — | `{ page }` | none |
| TC-TS-REGEN-04 | Unsaved-changes warning before Regenerate — unconfirmed | Negative | P2 | Unsaved edits present in the grid | Click Regenerate | Verify live whether a confirmation/warning dialog appears — not confirmed from source, no dedicated dialog found | @negative | — | — | `{ page }` | none |
| TC-TS-REGEN-05 | Regenerate failure shows an error, doesn't wipe existing grid data | Negative | P1 | Mocked 500 | Click Regenerate | Error toast shown; previously loaded grid data remains visible | @negative | `POST /v1/timesheets/generate` | — | `{ page }` | `page.route` 500 |

## 10. Save as Draft (`describe('Save as Draft')`)

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-DRAFT-01 | "Save as Draft" renders only after Generate, gated by permission | UI | P1 | Grid data exists, `canSaveAsDraft` | Observe footer | "Save as Draft" button visible | @smoke @regression | — | — | `{ page }` | none |
| TC-TS-DRAFT-02 | Saving as Draft persists with status Draft | Functional | P0 | Grid data + ≥1 employee | Click Save as Draft | Record created; list status chip shows "Draft" | @smoke | `POST /v1/timesheets/save-as-draft` | — | `{ page }` | none |
| TC-TS-DRAFT-03 | Draft is visible in the list immediately after save | Functional | P0 | Just saved a Draft | Return to list, search for it | Row appears with Draft status | @smoke | `GET /v1/timesheets` | — | `{ page }` | none |
| TC-TS-DRAFT-04 | Reopening a Draft via Edit preloads all previously entered data | Functional | P0 | Draft exists | Open Edit on the Draft | Company/Department/Date Range/employees/grid values all preload | @smoke @regression | `GET /v1/timesheets/:id`, `PATCH /:id/save-as-draft` | — | `{ page }` | none |
| TC-TS-DRAFT-05 | Editing a Draft and Save-as-Draft again persists the update | Functional | P1 | Draft exists | Edit a value, Save as Draft again | Update persists; still Draft | @regression | `PATCH /:id/save-as-draft` | — | `{ page }` | none |
| TC-TS-DRAFT-06 | Multiple independent Drafts can coexist | Functional | P2 | — | Create 2 separate Drafts | Both appear independently in the list | @regression | — | — | `{ page }` | none |
| TC-TS-DRAFT-07 | Draft persists correctly across a full page reload | Functional | P1 | Draft saved | Reload the Edit page | Data still present after reload (re-fetched from backend, not just client state) | @regression | `GET /v1/timesheets/:id` | — | `{ page }` | none |
| TC-TS-DRAFT-08 | Draft-only "Save as Draft" button hides once a record is no longer Draft | UI | P1 | Draft converted to Submitted | Open Edit on the now-Submitted record | "Save as Draft" no longer renders (`isDraftStatus` false) | @regression | — | — | `{ page }` | none |
| TC-TS-DRAFT-09 | Save as Draft failure shows an error, no false success navigation | Negative | P1 | Mocked 500 | Click Save as Draft | Error toast; stays on the Add/Edit page | @negative | `POST /v1/timesheets/save-as-draft` | — | `{ page }` | `page.route` 500 |

## 11. Submit (`describe('Submit')`)

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-SUB-01 | Submit is disabled with zero employees in the grid | Validation | P0 | Grid generated, no employees added | Observe Submit button | Disabled (`!timeSheetItems?.length`) | @smoke @validation | — | — | `{ page }` | none |
| TC-TS-SUB-02 | Submit enables once ≥1 employee is present | Validation | P0 | ≥1 employee added | Observe Submit button | Enabled | @smoke | — | — | `{ page }` | none |
| TC-TS-SUB-03 | Successful Submit creates/updates the record and redirects to list | Functional | P0 | Valid grid data | Click Submit | Record persists; redirected to list; success message shown | @smoke | `POST /v1/timesheets` or `PUT /v1/timesheets/:id` | — | `{ page }` | none |
| TC-TS-SUB-04 | Status becomes Pending/Submitted after Submit | Functional | P0 | Just submitted | Check list status chip | Status reflects the real post-submit value — confirm live which of `Pending`/`Submitted` this app actually sets on this action, both exist in the enum | @smoke | — | — | `{ page }` | none |
| TC-TS-SUB-05 | Data is locked (read-only) after Submit | Functional | P0 | Submitted record | Open it | List/View hide the Edit affordance (status no longer Draft); confirm grid renders read-only | @smoke @regression | — | — | `{ page }` | none |
| TC-TS-SUB-06 | Duplicate-submit prevention (rapid double-click) | Negative | P1 | Valid grid data | Double-click Submit quickly | Exactly one record created, not two | @negative | — | — | `{ page }` | none |
| TC-TS-SUB-07 | Submit failure (mocked 500) shows an error, no false success | Negative | P1 | Mocked 500 | Click Submit | Error toast; stays on the page; no record falsely shown as submitted | @negative | `POST /v1/timesheets` | — | `{ page }` | `page.route` 500 |
| TC-TS-SUB-08 | Submitting directly from Edit on an existing Draft | Functional | P1 | Draft exists | Open Edit, click Submit | Status transitions from Draft to Pending/Submitted | @regression | `PUT /v1/timesheets/:id`, `PATCH /:id/status` | — | `{ page }` | none |

## 12. Edit Time Sheet (`describe('Edit Time Sheet')`)

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-EDIT-01 | Edit is reachable from the list only for Draft records | RBAC/status | P0 | Draft record | Open row menu, click Edit | Navigates to Edit; preloads correctly | @smoke | `GET /v1/timesheets/:id` | — | `{ page }` | none |
| TC-TS-EDIT-02 | Edit navigation guard is permission-based, not status-based | Confirmed gap | P1 | User lacking `canEdit` | Navigate directly to any record's Edit URL | Redirected to the list (`if (!canEdit) navigate(TIME_SHEET)`) regardless of status | @regression | — | — | `{ page }` | none |
| TC-TS-EDIT-03 | Confirmed edge case: direct-URL Edit on a non-Draft record is NOT status-blocked | Negative/gap | P1 | User HAS `canEdit`, record is Approved | Navigate directly to that record's Edit URL (bypassing the list/View's hidden Edit link) | Page renders (no status-based route guard found in `edit-time-sheet.hrms.tsx`) — document actual behavior live rather than assuming a block exists | @negative | `GET /v1/timesheets/:id` | Approved record's id | `{ page }` | none |
| TC-TS-EDIT-04 | Changing a Department/Date Range value and saving persists the change | Functional | P1 | Draft exists | Edit a filter value, save | Update persists on reload | @regression | `PUT /v1/timesheets/:id` | — | `{ page }` | none |
| TC-TS-EDIT-05 | Discard/cancel on Edit leaves the original record untouched | Functional | P0 | Draft exists, field changed | Change a value, navigate away without saving | Reopening shows the original, unchanged value | @regression | — | — | `{ page }` | none |
| TC-TS-EDIT-06 | Print/PDF button gated by `Timesheets.actions.pdf` permission | RBAC | P2 | User lacking that permission | Open Edit | Print/PDF control not rendered | @regression | — | — | `{ page }` | none |

## 13. View Time Sheet (`describe('View Time Sheet')`)

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-VIEW-01 | View URL and core data render correctly | Page Load | P0 | Record exists | Open View from list | Correct URL; Company/Department/Date Range/employee grid all shown | @smoke | `GET /v1/timesheets/:id` | — | `{ page }` | none |
| TC-TS-VIEW-02 | Grid renders fully read-only on View | Functional | P0 | Record exists | Attempt to click/edit any grid cell | No effect — all handlers are no-ops on View | @smoke @regression | — | — | `{ page }` | none |
| TC-TS-VIEW-03 | "Approval History" button opens the real approval history dropdown | Functional | P0 | Record has approval activity | Click "Approval History" | Dropdown populated from `GET /:id/approval-history`, not a generic activity feed | @smoke | `GET /v1/timesheets/:id/approval-history` | — | `{ page }` | none |
| TC-TS-VIEW-04 | Approve/Reject buttons render only when `canProceedRequest` is true | RBAC | P0 | User in the approval chain for this record | Open View | Approve/Reject visible; hidden for other users | @smoke @regression | — | — | `{ page }` | none |
| TC-TS-VIEW-05 | Approve transitions status and calls the status-update endpoint | Functional | P0 | Pending/Submitted record, approver user | Click Approve | `PATCH /:id/status {status:'Approved'}` fires; status updates | @smoke | `PATCH /v1/timesheets/:id/status` | — | `{ page }` | none |
| TC-TS-VIEW-06 | Reject transitions status and calls the status-update endpoint | Functional | P0 | Pending/Submitted record, approver user | Click Reject | `PATCH /:id/status {status:'Rejected'}` fires; status updates | @smoke | `PATCH /v1/timesheets/:id/status` | — | `{ page }` | none |
| TC-TS-VIEW-07 | Rejection reason capture — unconfirmed | Negative/gap | P2 | Reject flow | Click Reject | Verify live whether a reason/comment is required or captured anywhere — not confirmed from the explored source | @regression | — | — | `{ page }` | none |
| TC-TS-VIEW-08 | Edit menu item visible only when `canEditTimesheet` (Draft + canEdit) | RBAC/status | P0 | Draft and non-Draft records | Open Actions menu on each | Edit shown only for the Draft record | @smoke @regression | — | — | `{ page }` | none |
| TC-TS-VIEW-09 | Delete menu item visible only for Draft/Pending | RBAC/status | P0 | Draft, Pending, Approved records | Open Actions menu on each | Delete shown for Draft/Pending only | @smoke @regression | — | — | `{ page }` | none |
| TC-TS-VIEW-10 | Print/PDF triggers the paginated 15-day PDF endpoint | Functional | P2 | User has `actions.pdf` permission | Click Print | `GET /:id/pdf` called; a PDF response/download initiates | @regression | `GET /v1/timesheets/:id/pdf` | — | `{ page }` | none |
| TC-TS-VIEW-11 | `activity_logs` field is fetched but not confirmed rendered anywhere | Confirmed gap | P3 | Record with activity | Open View, inspect the whole page | Verify live whether this data is surfaced anywhere in the UI — not found in the component read | @regression | `GET /v1/timesheets/:id` | — | `{ page }` | none |

## 14. Approval Workflow (`describe('Approval Workflow')`)

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-APR-01 | Full lifecycle: Draft → Submit → Pending/Submitted → Approve → Approved | Functional | P0 | — | Create Draft, Submit, then Approve as the approver | Status transitions correctly at each step, confirmed against the real 5-value enum | @smoke | multiple | — | `{ page }` | none |
| TC-TS-APR-02 | Full lifecycle: Submit → Reject → Rejected | Functional | P0 | Submitted record | Reject as the approver | Status becomes Rejected | @smoke | `PATCH /:id/status` | — | `{ page }` | none |
| TC-TS-APR-03 | No Resubmit action exists after Rejected — confirmed absent | Confirmed gap | P1 | Rejected record | Open it, inspect all available actions | No "Resubmit" action anywhere — confirm this holds live too, not just in source | @regression | — | — | `{ page }` | none |
| TC-TS-APR-04 | No Cancel action exists on a timesheet — confirmed absent | Confirmed gap | P2 | Any status | Inspect all available actions | No "Cancel" status-changing action found for timesheets specifically | @regression | — | — | `{ page }` | none |
| TC-TS-APR-05 | Approval History reflects the Approve action after it happens | Functional | P1 | Just approved | Open Approval History | New entry reflects the Approve action, actor, timestamp | @regression | `GET /:id/approval-history` | — | `{ page }` | none |
| TC-TS-APR-06 | A non-approver cannot approve/reject via direct API call | Security/RBAC | P0 | Non-approver user, valid session | Call `PATCH /:id/status` directly | Rejected server-side (403) despite a valid session | @negative @regression | `PATCH /:id/status` | — | `{ page }` | none |

## 15. Validation (`describe('Validation')`)

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-VAL-01 | Start/End date required to Generate | Validation | P0 | Date Range cleared | Click Generate | Blocked (backend `required` on `filters.start_date`/`end_date`) | @validation @smoke | `POST /v1/timesheets/generate` | — | `{ page }` | none |
| TC-TS-VAL-02 | `employee_ids` requires at least 1 on Create | Validation | P0 | Direct API call, empty array | `POST /v1/timesheets` with `employee_ids: []` | Rejected (`minItems:1`) | @validation @api | `POST /v1/timesheets` | `employee_ids: []` | `{ page }` | none |
| TC-TS-VAL-03 | Future dates are blocked in the date picker UI | Validation | P0 | On Add page | Attempt to pick a date after today | Disabled in the picker (`maxDate = yesterday`) | @validation @smoke | — | — | `{ page }` | none |
| TC-TS-VAL-04 | Future dates forced via direct API — verify server-side enforcement | Validation/Negative | P1 | Direct API call | `POST /v1/timesheets/generate` with a future `end_date` | Verify live whether the backend also rejects this, or only the FE picker blocks it | @negative @api | `POST /v1/timesheets/generate` | future date | `{ page }` | none |
| TC-TS-VAL-05 | Invalid date range (`end_date` before `start_date`) | Validation | P1 | Direct API call or forced UI state | Submit with `end_date < start_date` | Verify live whether this is rejected — no explicit cross-field range check was found in the validator read | @negative | `POST /v1/timesheets/generate` | inverted range | `{ page }` | none |
| TC-TS-VAL-06 | Daily 1440-minute cap blocks Save/Submit with an over-limit day | Validation/Boundary | P0 | Overridden cell edited past 1440 min | Attempt Save as Draft/Submit | Blocked by the same `TOTAL_HOURS_LIMIT_EXCEEDED` check | @validation @boundary @smoke | — | 1441+ minutes | `{ page }` | none |
| TC-TS-VAL-07 | Non-numeric input into an editable duration cell | Validation | P2 | Overridden cell | Type letters into the cell | Rejected or coerced — confirm live exact behavior | @negative | — | `"abc"` | `{ page }` | none |
| TC-TS-VAL-08 | Negative duration value into an editable cell | Validation | P2 | Overridden cell | Enter a negative number | Verify live whether a floor/min(0) rule exists — not confirmed from source | @negative | — | `-30` | `{ page }` | none |

## 16. Negative / API Failure (`describe('Negative Scenarios')`)

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-NEG-01 | List API 500 shows an error state, not a crash | Negative | P1 | Mocked 500 | Load list | Error state renders | @negative | `GET /v1/timesheets` | — | `{ page }` | `page.route` 500 |
| TC-TS-NEG-02 | List API hangs — timeout/loading feedback, not an infinite silent wait | Negative | P2 | Mocked unresolved promise | Load list | Timeout/error state eventually appears | @negative | `GET /v1/timesheets` | — | `{ page }` | `page.route` never resolves |
| TC-TS-NEG-03 | 401 mid-session surfaces as an auth failure (existing BasePage convention) | Negative | P1 | Mocked 401 on any timesheets call | Trigger the call | `BasePage`'s 401/403 fast-fail throws with a clear auth-failure message | @negative | any | — | `{ page }` | `page.route` 401 |
| TC-TS-NEG-04 | 403 on a permission-scoped action | Negative | P1 | Mocked 403 on Approve | Attempt Approve | Same 401/403 fast-fail path applies | @negative | `PATCH /:id/status` | — | `{ page }` | `page.route` 403 |
| TC-TS-NEG-05 | 404 opening View/Edit for a deleted record's id | Negative | P1 | Deleted record's id | Navigate to its View/Edit URL | 404/not-found state, not a blank crash | @negative | `GET /v1/timesheets/:id` | deleted id | `{ page }` | none |
| TC-TS-NEG-06 | Network disconnect mid-Submit | Negative | P2 | Simulated offline | Fill grid, go offline, Submit | Network-error toast/state, no silent data loss | @negative | — | — | `{ page }` | `context.setOffline(true)` |
| TC-TS-NEG-07 | Session expiry mid-Generate | Negative | P2 | Mocked expired token | Click Generate | Auth-failure surfaces cleanly | @negative | `POST /v1/timesheets/generate` | — | `{ page }` | `page.route` 401 |
| TC-TS-NEG-08 | Concurrent edits to the same Draft from two sessions | Negative | P2 | Same Draft open in two contexts | Edit + save from both nearly simultaneously | Verify live whether the second write silently overwrites the first — no optimistic-locking field confirmed in migrations | @negative | `PUT /v1/timesheets/:id` | — | `{ page }` | none |
| TC-TS-NEG-09 | Very large employee list (100+) doesn't break Generate/Add | Negative/Performance | P2 | 100+ eligible employees | Select all in the Add Employee modal | Grid renders without freezing or truncating rows | @negative @performance | — | 100+ employees | `{ page }` | none |
| TC-TS-NEG-10 | Very large date range (31+ days) doesn't break Generate | Negative/Performance | P2 | 31+ day range | Generate | Grid renders all columns without freezing | @negative @performance | `POST /v1/timesheets/generate` | 31-day range | `{ page }` | none |

## 17. Permissions (`describe('Permissions')`)

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-RBAC-01 | `canAdd` gates the Add button and Add route | RBAC | P0 | User lacking `canAdd` | Load list, then try direct Add URL | Button hidden; route blocked | @smoke @regression | — | — | `{ page }` | none |
| TC-TS-RBAC-02 | `canView`/`canViewById` gates List/View routes | RBAC | P0 | User lacking either | Navigate to list / a View URL | Both blocked by `ProtectedRoute` | @smoke @regression | — | — | `{ page }` | none |
| TC-TS-RBAC-03 | `canEdit` gates the Edit route (permission-based, confirmed not status-based) | RBAC | P0 | User lacking `canEdit` | Navigate directly to any Edit URL | Redirected to list regardless of the record's status | @smoke @regression | — | — | `{ page }` | none |
| TC-TS-RBAC-04 | `canDelete` gates the Delete action, further restricted to Draft/Pending by status | RBAC | P0 | User has `canDelete`, records in all 5 statuses | Attempt delete on each | Only Draft/Pending succeed/enable | @smoke @regression | — | — | `{ page }` | none |
| TC-TS-RBAC-05 | `Timesheets.generate` sub-permission gates the Generate action | RBAC | P1 | User lacking this nested permission | Reach the Add page | Verify live exact effect (hidden vs disabled Generate) | @regression | — | — | `{ page }` | none |
| TC-TS-RBAC-06 | `Timesheets.saveasdraft` sub-permission gates Save as Draft | RBAC | P1 | User lacking this nested permission | Reach a generated grid | "Save as Draft" not rendered | @regression | — | — | `{ page }` | none |
| TC-TS-RBAC-07 | `Timesheets.actions.pdf` sub-permission gates Print/PDF | RBAC | P2 | User lacking this nested permission | Open Edit/View | Print/PDF control absent | @regression | — | — | `{ page }` | none |
| TC-TS-RBAC-08 | `canProceedRequest` gates Approve/Reject independent of `canEdit`/`canDelete` | RBAC | P0 | User with edit rights but not approval rights | Open View on a Pending record | Approve/Reject absent despite having Edit rights elsewhere | @regression | — | — | `{ page }` | none |
| TC-TS-RBAC-09 | Server-side enforcement, not just hidden UI, for every gated action | RBAC | P0 | User lacking each permission in turn | Call the underlying API for Add/Edit/Delete/Approve directly | Backend rejects each (`isRbacResource`-style enforcement, consistent with other HRMS modules in this suite) | @regression | multiple | — | `{ page }` | none |

## 18. Security (`describe('Security')`)

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-SEC-01 | Direct URL access without login redirects to auth | Security | P0 | No session | Navigate to the list URL directly | Redirected to login, not a blank/broken page | @security @smoke | — | — | `{ page }` | none |
| TC-TS-SEC-02 | API calls without a valid token return 401 | Security | P0 | No token | Call any `/v1/timesheets*` route | 401 | @security @smoke | any | — | `{ page }` | none |
| TC-TS-SEC-03 | Role validation on Approve/Reject (see TC-TS-APR-06/RBAC-08) | Security | P0 | Non-approver | Call `PATCH /:id/status` directly | Rejected server-side | @security | `PATCH /:id/status` | — | `{ page }` | none |
| TC-TS-SEC-04 | XSS-like input in the only realistic free-text surface: search | Security | P2 | — | Search `<script>alert(1)</script>` | Rendered inert, not executed — note this module has very little free-text surface (mostly dropdowns/dates/numbers) | @security | `GET /v1/timesheets?search=...` | — | `{ page }` | none |
| TC-TS-SEC-05 | SQL-injection-style search input | Security | P2 | — | Search `' OR '1'='1` | Neutralized, no raw SQL execution, no 500 | @security | `GET /v1/timesheets?search=...` | — | `{ page }` | none |
| TC-TS-SEC-06 | Mass assignment: injecting an unexpected field into Create/Generate payload | Security | P2 | Direct API call | POST with an extra `status: 'Approved'` field on Create | Verify live whether it's ignored, given no `additionalProperties:false` confirmed in the validators read | @security | `POST /v1/timesheets` | — | `{ page }` | none |
| TC-TS-SEC-07 | Sensitive data exposure in list/by-id responses | Security | P2 | — | Inspect the raw API payloads | No unintended cross-company data or internal-only fields exposed | @security | `GET /v1/timesheets`, `GET /v1/timesheets/:id` | — | `{ page }` | none |
| TC-TS-SEC-08 | Session timeout mid-edit surfaces cleanly (see NEG-03) | Security | P1 | Mocked expired token | Edit a Draft, attempt Save | Auth-failure surfaces, no silent data loss | @security @negative | — | — | `{ page }` | `page.route` 401 |

## 19. Accessibility (`describe('Accessibility')`)

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-A11Y-01 | Full Add form is keyboard-navigable in logical order | Accessibility | P2 | On Add page | Tab through Company/Department/Date Range/Generate | Logical, visible focus order | @accessibility | — | — | `{ page }` | none |
| TC-TS-A11Y-02 | Grid cells reachable and editable via keyboard (overridden cells only) | Accessibility | P2 | Overridden cell exists | Tab to it, edit via keyboard | Editable without a mouse | @accessibility | — | — | `{ page }` | none |
| TC-TS-A11Y-03 | Approve/Reject/Submit buttons have proper accessible names | Accessibility | P2 | Buttons visible | Inspect accessible name via role query | Matches visible text, not icon-only | @accessibility | — | — | `{ page }` | none |
| TC-TS-A11Y-04 | Status chip color contrast meets WCAG AA | Accessibility | P3 | List loaded | Run a contrast check per status variant | Meets AA against its background | @accessibility | — | — | `{ page }` | none |
| TC-TS-A11Y-05 | Validation errors (e.g. 1440-min cap) are announced, not just visual | Accessibility | P2 | Trigger the cap | Observe with a screen reader active | Snackbar/error is announced | @accessibility | — | — | `{ page }` | none |

## 20. Performance (`describe('Performance')`)

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-PERF-01 | Generate with 100 employees completes within an acceptable threshold | Performance | P2 | 100 eligible employees | Select all, Generate | Completes without freezing/timeout | @performance | `POST /v1/timesheets/generate` | 100 employees | `{ page }` | none |
| TC-TS-PERF-02 | Generate with 500 employees | Performance | P3 | 500 eligible employees | Select all, Generate | Completes, degrades gracefully if slow — log actual timing | @performance | `POST /v1/timesheets/generate` | 500 employees | `{ page }` | none |
| TC-TS-PERF-03 | 31-day grid renders without excessive layout jank | Performance | P2 | 31-day range | Generate, scroll | Smooth scroll, acceptable render time | @performance | — | 31 days | `{ page }` | none |
| TC-TS-PERF-04 | List search/filter response time on a large dataset | Performance | P2 | 1000+ records seeded | Search/filter | Remains responsive | @performance | `GET /v1/timesheets?...` | — | `{ page }` | none |
| TC-TS-PERF-05 | Submit response time under normal load | Performance | P3 | Valid grid | Time the Submit call | Within an acceptable threshold | @performance | `POST /v1/timesheets` | — | `{ page }` | none |

## 21. API Contract Testing (`describe('API Contract')`)

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-API-01 | `GET /v1/timesheets` response is keyed `data.timesheets` | API | P1 | Authenticated | Call the list endpoint | Confirmed key present, matching FE reducer expectations | @api | `GET /v1/timesheets` | — | `{ page }` | none |
| TC-TS-API-02 | `GET /v1/timesheets/:id` response is keyed `data.timesheet` + `activity_logs` | API | P1 | Authenticated, record exists | Call the by-id endpoint | Both keys present | @api | `GET /v1/timesheets/:id` | — | `{ page }` | none |
| TC-TS-API-03 | `POST /v1/timesheets` requires `filters.start_date`/`end_date` and `employee_ids[minItems:1]` | API | P0 | Authenticated | POST with each field omitted in turn | Each omission rejected | @api @validation | `POST /v1/timesheets` | — | `{ page }` | none |
| TC-TS-API-04 | `PATCH /:id/status` only accepts the 5 real enum values | API | P0 | Authenticated | PATCH with `status: 'Cancelled'` (not a real timesheet status) | Rejected — confirms "Cancelled" is not valid here despite existing in the generic approvals enum | @api @negative | `PATCH /:id/status` | `status: 'Cancelled'` | `{ page }` | none |
| TC-TS-API-05 | `POST /v1/timesheets/save-as-draft` and `PATCH /:id/save-as-draft` both work despite the draft validator being unwired from the route schema | API | P1 | Authenticated | POST/PATCH with a deliberately malformed payload | Verify live actual behavior — draft validators exist in code but are commented out of the route schema (confirmed gap, same class of issue as Loan Configuration's `/draft` route) | @api @negative | `POST /v1/timesheets/save-as-draft`, `PATCH /:id/save-as-draft` | malformed payload | `{ page }` | none |
| TC-TS-API-06 | `GET /:id/approval-history` returns entries matching the UI dropdown | API | P1 | Record with approval activity | Call the endpoint directly | Response shape matches what `ApprovalHistoryDropdown` renders | @api | `GET /v1/timesheets/:id/approval-history` | — | `{ page }` | none |
| TC-TS-API-07 | `GET /:id/pdf` returns a paginated 15-day PDF | API | P2 | Record spans >15 days | Call the endpoint | Confirms pagination behavior for long ranges | @api | `GET /v1/timesheets/:id/pdf` | >15-day record | `{ page }` | none |
| TC-TS-API-08 | `POST /v1/timesheets/generate` response time | API/Performance | P2 | Authenticated | Time the call under normal load | Within an acceptable threshold | @api @performance | `POST /v1/timesheets/generate` | — | `{ page }` | none |
| TC-TS-API-09 | No DB-level FK constraint confirmed on `timesheet_employees`/override tables — verify app-level integrity | API/DB | P2 | Direct API call | POST with a nonexistent `employee_id` | Verify live whether this is rejected at the application layer, since no FK was confirmed in the migrations read | @api @negative | `POST /v1/timesheets` | nonexistent employee id | `{ page }` | none |

## 22. Cross-Browser & Responsive (`describe('Cross-Browser / Responsive')`)

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-XB-01 | Full Generate→Add Employees→Submit flow works in Chrome | Cross-Browser | P1 | Chrome | Run the full flow | Works correctly | @regression | multiple | — | `{ page }` | none |
| TC-TS-XB-02 | Same flow in Firefox | Cross-Browser | P2 | Firefox | Run the full flow | Works correctly | @regression | multiple | — | `{ page }` | none |
| TC-TS-XB-03 | Same flow in Edge/Safari | Cross-Browser | P2 | Edge/Safari | Run the full flow | Works correctly | @regression | multiple | — | `{ page }` | none |
| TC-TS-RESP-01 | List table remains usable at tablet width | Responsive | P2 | List loaded | Resize to tablet width | Horizontal scroll/column prioritization, no breakage | @regression | — | — | `{ page }` | none |
| TC-TS-RESP-02 | Grid remains usable at mobile width (given it's inherently wide) | Responsive | P2 | Grid generated | Resize to mobile width | Horizontal scroll works; header/employee column behavior confirmed live | @regression | — | — | `{ page }` | none |
| TC-TS-RESP-03 | Landscape vs portrait doesn't break the grid layout on tablet | Responsive | P3 | Tablet, grid generated | Rotate orientation | Layout remains intact | @regression | — | — | `{ page }` | none |

## 23. Live-Verified Findings (`describe('Live-Verified Findings')`)

Every row below is grounded in an actual screenshot of the running app (Company `erp-force`,
Date Range 1–10 Jul 2026, 17 employees on the Add page; the List page's real Table View data),
not source-code inference — see "Live-screenshot corrections" above for the reasoning behind each.

| Test ID | Test Title | Feature | Priority | Preconditions | Test Steps | Expected Result | Tags | API Dependencies | Test Data | Fixtures | Mocks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-TS-LIVE-01 | Day cells reflect real per-employee attendance, not a uniform Leave badge for everyone | Confirmed bug candidate | P0 | Generate a sheet for a Company/Date Range with real, varied attendance data (not all-leave) | Generate, inspect every employee's every day cell | At least some cells show actual Work/OT duration values, not "UL" (Unpaid Leave badge) on 100% of cells for 100% of employees — a live-observed sheet showed every single cell as "UL," which is either a real data gap or a rendering defect and must not be treated as expected | @negative @smoke | `POST /v1/timesheets/generate` | company/date range with confirmed real attendance | `{ page }` | none |
| TC-TS-LIVE-02 | Same employee cannot appear twice in one generated sheet's employee list | Confirmed bug candidate | P0 | Generate a sheet, add an employee via the Add Employee modal | Generate for a Company/Department where the same employee could be pulled in both by default generation and by manual add; inspect the employee column for repeats | Each employee's name appears exactly once in the grid — a live-observed sheet showed "Raj Nimaje" twice (once mid-list, once as the last row), contradicting the intended dedup behavior (TC-TS-EMP-05) | @negative @smoke | `POST /v1/timesheets/generate` | — | `{ page }` | none |
| TC-TS-LIVE-03 | Department chips on the List page don't render an identical label twice in one row | UI/Data | P1 | A record whose Department column shows a repeated chip live (e.g. "Purchase, Purchase") | Load the list, inspect that row's Department cell | Either the two chips are confirmed to be genuinely distinct department records (acceptable) or, if the same department id/name repeats, the UI dedupes it before rendering | @regression | `GET /v1/timesheets` | record with a repeated department chip | `{ page }` | none |
| TC-TS-LIVE-04 | Employee rows are collapsed to one summary row by default; expanding reveals Work/OT/Total | UI | P1 | Grid generated | Click the expand chevron next to an employee's name | Row expands to reveal the 3 sub-rows (Work Hours/OT Hours/Total Hours); collapsing hides them again | @smoke @regression | — | — | `{ page }` | none |
| TC-TS-LIVE-05 | Collapsed summary row shows a meaningful aggregate, not a raw badge, when data is missing | UI | P2 | Employee with no real attendance for the range | Inspect the collapsed row before expanding | Confirm live what actually renders in the collapsed state when every day is a Leave badge (does the summary also show "UL," a blank, or a real total) | @regression | — | — | `{ page }` | none |
| TC-TS-LIVE-06 | Blank Department renders as "-" on the list | UI | P2 | Record saved/generated with no Department | Load the list | Cell shows "-" placeholder, confirmed matching every other master-data list in this suite | @regression | `GET /v1/timesheets` | record with blank department | `{ page }` | none |
| TC-TS-LIVE-07 | Saved-view/template selector: switching between named views (e.g. "Default"/"Test") changes visible columns/filters | UI | P1 | ≥2 saved views exist (Default + a custom one) | Click the "Test" view pill | List re-renders per that view's saved column/filter configuration; the active pill highlights | @regression | — | — | `{ page }` | none |
| TC-TS-LIVE-08 | Creating a new saved view via "+" | Functional | P1 | On the list page | Click "+", name a new view, adjust columns/filters, Save | New view pill appears and persists across a reload | @regression | — | — | `{ page }` | none |
| TC-TS-LIVE-09 | "Save" in the view-template bar is disabled until there's an unsaved change | UI | P2 | On a saved view with no pending edits | Observe the Save button | Disabled/greyed out (as seen live); becomes enabled after changing a column/filter | @regression | — | — | `{ page }` | none |
| TC-TS-LIVE-10 | The Add page's own grid has an independent Search box from the List page's search | Search | P1 | Grid generated with multiple employees | Type an employee name into the Add page's Search box | Grid filters to matching employee row(s) only, without affecting the List page's own search state | @regression | — | — | `{ page }` | none |
| TC-TS-LIVE-11 | Add page's Department filter shows an "N Item(s) Selected" summary, not named chips | UI | P3 | ≥2 departments selected in the Add page's filter bar | Inspect that filter chip | Renders as "N Item(s) Selected" (confirmed live), distinct from the List page's own per-name Department chips | @regression | — | — | `{ page }` | none |
| TC-TS-LIVE-12 | Past dates far outside the current year are accepted in Date Range | Boundary | P2 | — | Set a Date Range from several years in the past (e.g. 2022) | Accepted — a live record (`TS-2026-000026`) has a 2022 date range, confirming no minimum-past-date restriction exists, only the `maxDate = yesterday` future-date cap | @boundary @regression | — | 2022 date range | `{ page }` | none |

---

## Coverage Summary

| Section | Scenario Count |
|---|---|
| 1. List Page | 14 |
| 2. Search | 10 |
| 3. Filters | 9 |
| 4. Sorting | 6 |
| 5. Pagination | 5 |
| 6. Add Time Sheet — Filter Bar & Generate | 10 |
| 7. Add Employee Modal | 6 |
| 8. Duration Grid | 15 |
| 9. Regenerate | 5 |
| 10. Save as Draft | 9 |
| 11. Submit | 8 |
| 12. Edit Time Sheet | 6 |
| 13. View Time Sheet | 11 |
| 14. Approval Workflow | 6 |
| 15. Validation | 8 |
| 16. Negative / API Failure | 10 |
| 17. Permissions | 9 |
| 18. Security | 8 |
| 19. Accessibility | 5 |
| 20. Performance | 5 |
| 21. API Contract | 9 |
| 22. Cross-Browser & Responsive | 6 |
| 23. Live-Verified Findings | 12 |
| **Total** | **192** |

## Suggested Suites (for `npm run test:*`-style filtering by tag, matching this repo's existing `@smoke` convention)

- **Smoke** (`@smoke`): TC-TS-LIST-01/02/09/10, SRCH-01, FILT-03, ADD-01/02/04/05/06, EMP-01/04, GRID-01/02/04/05/09/10, REGEN-02, DRAFT-01/02/03/04, SUB-01/02/03/04/05, EDIT-01, VIEW-01/02/03/04/05/06, APR-01/02, VAL-01/03/06, RBAC-01/02/03/04/08, SEC-01/02, LIVE-01/02/04.
- **Sanity** (a small subset of Smoke, run on every deploy): TC-TS-LIST-01, ADD-05, DRAFT-02, SUB-03, VIEW-05/06 — one representative case per lifecycle stage (Generate → Draft → Submit → Approve).
- **Regression** (`@regression`): everything not tagged `@smoke`/`@negative`/`@performance`/`@accessibility`/`@security` — the bulk of Sections 1–14, 17, 22, 23.
- **API** (`@api`): all of Section 21, plus REGEN-01, FILT-09, VAL-02/04.
- **Negative** (`@negative`): all of Section 16, plus ADD-09/10, REGEN-03/04/05, DRAFT-09, SUB-06/07, VAL-04/05/07/08, LIVE-01/02.
- **Security** (`@security`): all of Section 18.
- **Performance** (`@performance`): all of Section 20, plus NEG-09/10.
- **Accessibility** (`@accessibility`): all of Section 19.
- **Edge cases folded into the sections above rather than a separate suite** (per the corrected scope): the 1440-minute cap (GRID-10/11, VAL-06), the direct-URL non-Draft Edit gap (EDIT-03), the unwired draft-route validator (API-05), and the missing duplicate-detection/duplicate-submit checks (ADD-10, SUB-06) are this module's real edge cases — the originally-requested "31-day/28-day/leap-year/mid-month-joiner/night-shift-crossing-midnight" edge cases do not apply here since there is no shift/night-shift cell model to begin with (see Corrections).
- **Run these first, before writing any Playwright code from this doc**: TC-TS-LIVE-01 and
  TC-TS-LIVE-02 are the two highest-priority items in the whole document — if the "every cell is
  UL" and "duplicate employee row" observations turn out to be real, reproducible bugs (not a
  one-off artifact of stale/incomplete test data in this particular company), they should be
  reported to the dev team before any further Time Sheet automation is built on top of Generate,
  since almost every other scenario in Sections 6–11 assumes Generate produces one correct row per
  employee with real, distinct attendance data.
