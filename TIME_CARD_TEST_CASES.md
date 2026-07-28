# Time Card — Test Case Suite

Module path: HRMS → Time Tracking → Time Card (`/dashboard/hrms/time-tracking/time-card`)

Source verified against `erpforce-hrms-fe/src/views/time-tracking/time-card/` (list page, `add-time-card.tsx`,
`edit-time-card.hrms.tsx`, `edit-time-card-entry.hrms.tsx`, `view-time-card.hrms.tsx`, `form/form.tsx`,
`form/form-entry.tsx`, `utils/validator.tsx`, `utils/constants.ts`, `utils/common.ts`, `utils/default-data.ts`,
`redux/actionCreator.ts`) and `erpforce-be/modules/hrms/lib/time-cards/` (routes, all 4 validators, service,
all use-cases, `helpers/calendar.helper.js`) plus `erpforce-be/modules/hrms/lib/attendance/service/attendance.service.js`
(the attendance→time-card cron's real logic) and the `time-card-entries` migrations, before writing any
case below. Every "Expected Result" reflects confirmed source behavior; where source could not confirm a
behavior (mostly live-only timing/UX or values that depend on this account's seeded calendar/master data),
the case is explicitly marked **Manual first** instead of guessed.

## Corrections to the requested module description (read before using these tables)

- **Add is a genuine 2-ROUTE wizard, not an in-page stepper, and Add/Edit behave asymmetrically at the
  step transition.** Step 1 ("Next") in **Add** mode makes **no API call at all** — the whole Basic
  Details payload is passed to Step 2 purely via React Router `location.state`. Step 1 ("Next") in
  **Edit** mode **does** call a real `PUT /:id` before navigating to Step 2. A browser refresh/crash
  right after "Next" therefore loses everything in Add mode but not in Edit mode — this asymmetry is a
  first-class test scenario, not a footnote.
- **"Save To Draft" on Step 1 of Add bypasses Step 2 entirely** — it calls a direct create-draft API and
  returns to the list. A Time Card drafted this way has **zero entries** (no employees, no hours) until
  someone opens Edit and adds them.
- **The entry grid's Project/Task/Cost Code/Cost Element are never actually required, in any
  `assign_in_table` state.** The FE's conditional-required Yup rules for these fields are commented out
  entirely (`utils/validator.tsx`). A Time Card can be saved with none of them set, even when "Assign in
  Table" is unchecked (i.e., even in "one value for the whole card" mode).
- **The FE Yup schema only truly enforces 3 fields: Company, Department (≥1), Resource Type.** Date has
  **no** Yup rule on the frontend, despite being `required` in the backend's own create-schema — a
  confirmed FE/BE mismatch. The entry grid's per-cell rules (Employee required, duration format, the 24h
  cap) live only in plain JS (`form-entry.tsx`/`utils/default-data.ts`), not in the Yup schema at all.
- **Cross-midnight (overnight) shifts are a confirmed, real defect, not an edge case to assume works.**
  `calculateWorkDuration` (backend) and its FE equivalent both compute In→Out time on the **same** date
  with no midnight rollover; if Out Time is numerically earlier than In Time, the diff goes negative and
  is clamped/nulled to 0 — an overnight shift's Working Hours and Total Hours silently compute as 0 or
  never populate. The **separate** `calculateDurationFromTimeRange` helper (used only for Night Shift and
  Weekend/Holiday OT "From"/"To" ranges) correctly rolls over past midnight — this inconsistency between
  the two calculation paths is the single highest-value defect in this module.
- **Total Hours is `MAX(Working Hours + OT + Night Shift, Weekend/Holiday OT)`, not a plain sum of every
  column** (frontend, `form-entry.tsx`). The backend's own `calculateTotalDuration` is a simple sum of
  whichever buckets are non-null, but `processEntryWithCalendar` **forces the other three buckets to
  null** whenever a day is a weekend/holiday — so in practice both formulas agree in production, but a
  direct API test sending both Working Hours AND Weekend/Holiday OT on a normal (non-holiday) day will
  reveal the FE's `MAX(...)` and the BE's `SUM(...)` disagreeing.
- **Weekend/holiday status forcibly overrides manually-entered Working Hours/OT/Night Shift.** If the
  backend's calendar lookup determines a date is a weekend or holiday, `work_duration`, `ot_duration`, and
  `night_shift_duration` are **forced to `null`** server-side regardless of what the client sent, and the
  full duration is folded into `ot_weekend_holiday_duration` instead. This is confirmed intended behavior,
  not a bug — but it means "manually enter 8 hours of Working Hours on a Saturday" is a case that must
  assert the override, not the raw input.
- **OT-Weekend/Holiday's mutual-exclusion gating is asymmetric and includes a field the user can't
  directly clear.** The FE disables the OT-Weekend/Holiday input if Working Hours (auto-calculated,
  read-only) already has a value — but Working Hours can only be cleared by clearing In/Out Time, which
  most users won't think to do, effectively locking out OT-Weekend/Holiday entry for any row where In/Out
  Time was ever populated.
- **A confirmed silent side effect**: editing In/Out Time on a row whose OT-Weekend/Holiday field already
  holds a value writes the recomputed duration **into OT-Weekend/Holiday, not into Working Hours** — an
  easy way to silently corrupt a previously-entered Weekend/Holiday OT value via an unrelated edit.
- **Row delete in the entry grid has no confirmation dialog** (immediate removal + a hardcoded,
  non-translated snackbar), while the Time-Card-level delete (from List/View) **does** show a confirm
  dialog — a real UX/safety inconsistency between the two delete affordances in the same module.
- **"Draft" does not bypass business-rule validation, only the 4 core required Basic Details fields** —
  and even that exemption applies only via the dedicated `POST /save-as-draft`/`PATCH /:id/save-as-draft`
  routes, whose body-schema validation is commented out entirely (also missing RBAC gating). Timesheet
  submission conflicts, employee leave conflicts (**Approved or Pending** leave both block), and the
  24-hour-per-employee-per-day cap are enforced identically for Draft and Posted saves through the plain
  `POST /`/`PUT /:id` routes.
- **A Posted Time Card is fully immutable at the service layer** (`updateTimeCard`/`deleteTimeCard` both
  throw if the existing record's status is `'Posted'`), and the View page's entire Actions button
  (containing both Edit and Delete) is **not rendered at all** once Posted — regardless of the viewing
  user's permissions. There is no correction/reversal flow visible in this module's own code.
- **`PUT /:id` (Update) can never actually post a Time Card**, even if the client explicitly sends
  `status: "Posted"` — the update use-case unconditionally overwrites `status` to `'Draft'` before calling
  the service, with no error surfaced to say so. Only `POST /:id/post` correctly persists `'Posted'`.
- **A Time Card can be created already-Posted via the plain create route**, skipping the dedicated Post
  route's one meaningful extra rule (`entries` must have at least 1 item) — `POST /` with
  `status: "Posted"` and an empty `entries` array succeeds.
- **Duplicate employee rows are only partially prevented, and the current DB constraint has a confirmed
  gap.** A 2026-03-03 migration intentionally changed the unique key from `(time_card_id, employee_id)` to
  `(time_card_id, employee_id, project_id, task_id)` specifically to *allow* duplicate employees
  differentiated by project/task — but MySQL/InnoDB treats `NULL` as distinct from `NULL` in unique
  indexes, so when `project_id`/`task_id` are both null (the common case whenever "Assign in Table" is
  off), **the unique constraint enforces nothing at all**, and unlimited duplicate rows for the same
  employee can be inserted. The FE's manual "add row" flow has no duplicate-employee check either (only
  the separate "Auto Fill Employee" bulk-fill path dedupes).
- **The attendance→Time-Card nightly cron has a confirmed broken duplicate-prevention check** (wrong
  query-filter operator plus reading a response shape the query builder doesn't return), meaning its
  "skip employees who already have an entry" logic always evaluates to "no existing employees" — re-running
  the cron for an already-processed date (manual retrigger, retry after partial failure) can duplicate
  hours for the same employee/date. **Cron-generated entries also completely bypass every business
  validation** (leave conflicts, the 24-hour cap, timesheet conflicts) that manual/API paths enforce.
- **Weekend/holiday determination depends on a calendar lookup with a real gap**: if no `company_calendar`
  is configured at all for a Company/Department/Location combination, the fallback logic can only ever
  detect Saturday/Sunday — **it has no fallback for holidays** in that case. Separately, the day-of-week
  lookup does an exact string match against `moment(date).format('dddd')` (e.g. `"Monday"`) — any
  casing/format mismatch in seeded calendar data silently defaults to "not a week-off" with no error.
- **6 of this module's 14 backend routes are confirmed missing `isRbacResource: true`**: both save-as-draft
  routes, and all 4 of the `.../employees`/`.../employee/:id` lookup routes used to populate/prefill the
  entry grid.
- **"Post" button's translation key (`common.post`) has no entry anywhere in the shared translations
  file** — the primary Step-2 submit-and-post button likely renders a raw i18n key or blank text; verify
  live.
- **The View page's "Summary" component is imported but never actually rendered** in the current source —
  if a "Summary" tab/panel is expected on View, it is not reachable in this build.
- Every duration field (Break, Working Hours, OT, Night Shift, Weekend/Holiday OT) shares a **hard 24-hour
  cap enforced in plain JS on the frontend** ("`{Label}` cannot exceed 24 hours") independently of the
  backend's own 24-hour-per-employee-per-day cap (which additionally re-adds Break time when checking the
  ceiling and sums across **all** of an employee's Time Cards for that date, not just the current one).

---

## 1. List Page

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-LIST-01 | Time Card | Page Load | List loads at the correct URL | Logged in, `canView` | Navigate to the module URL | — | URL matches; table renders | P0 | High | Functional |
| TC-TC-LIST-02 | Time Card | Columns | Confirmed column set renders in order | List loaded | Inspect header row | — | ID, Company, Department, Uploaded By, Date, Resource Type, Status (Project/Task exist but are hidden by default) | P0 | Medium | UI |
| TC-TC-LIST-03 | Time Card | Column visibility | Hidden Project/Task columns can be toggled on | List loaded | Open column-visibility control, enable Project/Task | — | Both columns render with correct data | P2 | Low | UI |
| TC-TC-LIST-04 | Time Card | Loading state | Loading indicator shows during fetch | Throttled network | Load list page | — | Loader visible until data resolves | P2 | Low | UI |
| TC-TC-LIST-05 | Time Card | Empty state | Zero records shows the shared empty state | No records exist | Load list page | — | "No Data" component renders, not a blank table | P1 | Medium | UI |
| TC-TC-LIST-06 | Time Card | Status chip | Draft/Posted chips render distinctly | Mixed-status records exist | Load list page | — | Distinct chip styling per status; falsy status falls back to "Inactive" label | P1 | Medium | UI |
| TC-TC-LIST-07 | Time Card | Department column | Multi-department Time Cards render comma-joined names | Record covering 2+ departments | Load list page | — | All department names shown, comma-separated | P1 | Medium | Functional |
| TC-TC-LIST-08 | Time Card | Row navigation | Clicking a row / row menu opens View | Record exists | Open row action menu, click View | — | Navigates to the View page for that record | P0 | High | Functional |
| TC-TC-LIST-09 | Time Card | Row menu — Edit gating | Edit is disabled for Posted records | Posted record exists | Open row action menu | — | Edit menu item shown `disabled` when `status === 'Posted'` | P0 | High | Functional |
| TC-TC-LIST-10 | Time Card | Row menu — Delete gating | Delete is disabled for Posted records | Posted record exists | Open row action menu | — | Delete disabled when `status === 'Posted'` (independent of permission) | P0 | High | Functional |
| TC-TC-LIST-11 | Time Card | Add button | Visible only when `canAdd` is true | User without `canAdd` | Load list page | — | Add button not rendered | P0 | High | Security |
| TC-TC-LIST-12 | Time Card | View toggle | Only Table/Grid views available | List loaded | Open view switcher | — | Kanban/Calendar/Gantt absent (`disabledViews` confirmed) | P2 | Low | UI |
| TC-TC-LIST-13 | Time Card | Grid view | Grid card view shows the same record set as Table | Records exist | Switch Table → Grid | — | Same records, consistent field values in both views | P1 | Medium | Functional |
| TC-TC-LIST-14 | Time Card | Excel export | Export button visible only with `generateexcel.canView` | User without that permission | Load list page | — | Export/Generate-Excel control not rendered | P2 | Medium | Security |
| TC-TC-LIST-15 | Time Card | Import | Import button visible only with `import.canAdd` | User without that permission | Load list page | — | Import control not rendered | P2 | Medium | Security |
| TC-TC-LIST-16 | Time Card | Delete wiring | Row-menu "Delete" click actually deletes via the shared Listing component | Existing record | Delete via row menu | — | Verify live: the row menu's own `handleAction` is a stub `console.log` — confirm the shared `deleteApi` wiring is what performs the real deletion | P2 | Medium | Functional |
| TC-TC-LIST-17 | Time Card | Pagination resource key | List pagination count stays correct despite a `paginationResource`/response-key naming mismatch (`time_card` vs `time_cards`) | 25+ records | Paginate through several pages | — | Verify live the page count/"Page X of Y" stays accurate — not fully confirmed from source alone | P2 | Medium | Manual first |
| TC-TC-LIST-18 | Time Card | Refresh | List reflects a just-completed Add/Edit/Delete without manual reload | Just completed an Add | Return to list | — | New/updated/removed row reflects | P0 | High | Functional |
| TC-TC-LIST-19 | Time Card | API failure | List load failure handled gracefully | Mocked 500 on GET list | Load list page | — | Error state shown, not an infinite loader | P1 | High | Negative |
| TC-TC-LIST-20 | Time Card | Large dataset | List remains responsive with 500+ records | 500+ records seeded | Load list page | — | Loads within acceptable time; pagination/search still functional | P2 | Medium | Performance |

## 2. Add — Basic Details (Step 1)

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-FLD-01 | Time Card | Company | Required on Add (FE Yup + BE create schema) | On Add page | Leave Company empty, click Next | — | Inline "Company is required" error; blocked | P0 | High | Validation |
| TC-TC-FLD-02 | Time Card | Company | Omitted on Update accepted (BE gap) | Existing record, direct API | PUT without `company_id` | — | Accepted — confirmed BE update schema has no `required` array at all | P1 | Medium | Negative |
| TC-TC-FLD-03 | Time Card | Department | Required, multi-select, min 1 | On Add page | Leave Department empty, click Next | — | Inline "Department is required" error; blocked | P0 | High | Validation |
| TC-TC-FLD-04 | Time Card | Department | Company-scoped dropdown | Company selected | Open Department dropdown | — | Options filtered to the selected Company only (`filterFields=company_id`) | P0 | High | Dependency |
| TC-TC-FLD-05 | Time Card | Department | Changing Company after Department is selected resets it | Company A + Department selected | Change Company to B | — | Department resets to empty | P1 | High | Dependency |
| TC-TC-FLD-06 | Time Card | Department | Multiple departments selectable and persisted | On Add page | Select 3+ departments, complete Add | — | All persist; List's Department column shows all, comma-joined | P1 | Medium | Functional |
| TC-TC-FLD-07 | Time Card | Department | Search filters a large company-scoped list | Company with 50+ departments | Type a partial name | — | Matching options filtered within that Company's set | P2 | Low | Functional |
| TC-TC-FLD-08 | Time Card | Department | Omitted entirely on Update accepted if key absent | Existing record, direct API | PUT without `department_ids` key at all | — | Accepted; only an explicit `department_ids: []` is rejected (`minItems:1`), omission is not | P1 | Medium | Negative |
| TC-TC-FLD-09 | Time Card | Date | No FE Yup rule — blank blocked only by BE schema | On Add page | Leave Date blank (if the picker allows it), Next | — | Verify live whether the FE lets a blank Date through to the API, where the BE's own `required` rule then rejects it — a real FE/BE mismatch worth confirming end-to-end | P1 | High | Negative |
| TC-TC-FLD-10 | Time Card | Date | Future dates are blocked client-side | On Add page | Open date picker | — | Dates after today are disabled (`max_date={dayjs()}`) | P0 | High | Validation |
| TC-TC-FLD-11 | Time Card | Date | Defaults to today on Add | On Add page | Observe Date field on load | — | Pre-filled with today's date | P2 | Low | Functional |
| TC-TC-FLD-12 | Time Card | Date | Past dates are freely selectable | On Add page | Pick a date from last year | — | Accepted — no minimum-date restriction found in source | P2 | Low | Boundary |
| TC-TC-FLD-13 | Time Card | Date | Direct API bypass of the max-date restriction | Direct API call | POST with a future `date` | Tomorrow's date | Verify live whether the backend independently rejects future dates — not confirmed from source (FE-only restriction as far as found) | P1 | Medium | Negative |
| TC-TC-FLD-14 | Time Card | Resource Type | Required, hardcoded 4-option dropdown (not API-sourced) | On Add page | Open Resource Type dropdown | — | Exactly "Hired Employees"/"Assets"/"Hired Services"/"Employees" render | P0 | High | Functional |
| TC-TC-FLD-15 | Time Card | Resource Type | Defaults to "Employees" on Add | On Add page | Observe Resource Type on load | — | Pre-selected to `id:4` "Employees" | P2 | Low | Functional |
| TC-TC-FLD-16 | Time Card | Resource Type | Blank blocks Next | On Add page | Clear Resource Type, click Next | — | Inline "Resource Type is required" error; blocked | P0 | High | Validation |
| TC-TC-FLD-17 | Time Card | Resource Type | Invalid numeric value via direct API | Direct API call | POST `resource_type_id: 999` | `999` | Verify live whether any enum/FK check rejects an out-of-range id — not confirmed from source | P2 | Medium | Negative |
| TC-TC-FLD-18 | Time Card | ID | Read-only, auto-generated (`series_number`) | On Add page | Inspect ID field | — | Disabled input; server-generated | P1 | Low | UI |
| TC-TC-FLD-19 | Time Card | Assign in Table | Optional; defaults unchecked | On Add page | Observe checkbox on load | — | Unchecked by default | P1 | Low | Functional |
| TC-TC-FLD-20 | Time Card | Assign in Table | Checking it disables the single Project/Task/Cost Code/Cost Element fields | On Add page | Check "Assign in Table" | — | All 4 fields become disabled/grayed on Step 1 (values, if any, are retained not cleared) | P1 | Medium | Functional |
| TC-TC-FLD-21 | Time Card | Project/Task/Cost Code/Cost Element | Never actually required in any state (confirmed bug) | On Add page, "Assign in Table" unchecked | Leave all 4 blank, click Next | — | Confirmed: no blocking error — the conditional-required Yup rules are commented out entirely | P1 | High | Negative |
| TC-TC-FLD-22 | Time Card | Task | Filtered by the selected Project | Project selected | Open Task dropdown | — | Only Tasks belonging to that Project render (`&project_id.eq` filter) | P1 | Medium | Dependency |
| TC-TC-FLD-23 | Time Card | Task | Changing Project after Task is selected | Project A + Task selected | Change Project to B | — | Verify live whether Task resets — not confirmed from source (no explicit reset-on-change wiring found for this pair, unlike Department↔Company) | P2 | Medium | Manual first |
| TC-TC-FLD-24 | Time Card | Next button | Blocked entirely if any of the 3 truly-required fields is missing, even if others are filled | On Add page | Fill Department+Resource Type only, click Next | — | Blocked with only the Company error shown; other valid fields retain their values | P1 | Medium | Validation |

## 3. Add → Edit-Time-Card-Entry Step Transition

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-FLD-25 | Time Card | Add "Next" | No API call fires on Add's Step 1 → Step 2 transition | On Add page, valid Basic Details | Click Next | — | Confirmed: navigation to the entry-grid route happens via router state only; no network POST/PUT observed | P1 | High | Functional |
| TC-TC-FLD-26 | Time Card | Add "Next" | Refreshing the browser on Step 2 (Add mode) loses all Basic Details | On Step 2 of Add (just arrived via Next) | Refresh the browser | — | Confirmed data-loss risk: `location.state` is gone after a hard refresh, since nothing was persisted yet | P1 | High | Negative |
| TC-TC-FLD-27 | Time Card | Edit "Next" | A real PUT fires on Edit's Step 1 → Step 2 transition | On Edit page, existing record | Click Next | — | Confirmed: `updateTimeCard` (PUT `/:id`) is called before navigating to Step 2 with the real id | P1 | High | Functional |
| TC-TC-FLD-28 | Time Card | Edit "Next" | Refreshing the browser on Step 2 (Edit mode) does NOT lose Basic Details | On Step 2 of Edit (just arrived via Next) | Refresh the browser | — | Basic Details reload correctly from the server since they were already persisted | P1 | Medium | Functional |
| TC-TC-FLD-29 | Time Card | Add "Save To Draft" | Skips Step 2 entirely, creates a Draft with zero entries | On Add Step 1, valid Basic Details | Click "Save To Draft" | — | Direct create-draft API call; navigates straight to the list; reopening this Draft's entry grid shows no employee rows | P0 | High | Functional |
| TC-TC-FLD-30 | Time Card | Route permission | `ADD_TIME_CARD_ENTRY` route requires `canEdit`, not `canAdd` | User with only `canAdd` (no `canEdit`) | Complete Step 1's Next | — | Confirmed likely bug: verify live whether this user is unexpectedly blocked from reaching Step 2 of a brand-new Add | P1 | High | Security |

## 4. Entry Grid — Employee & Time Fields (Step 2)

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-GRID-01 | Time Card | Header echo | Date/Day/Company/Department/Resource Type/Project/Task/Cost Code/Cost Element from Step 1 render read-only above the grid | Arrived at Step 2 | Inspect the header block | — | All values match what was entered on Step 1 | P1 | Medium | Functional |
| TC-TC-GRID-02 | Time Card | Auto Fill Employee | Checkbox defaults checked (true) on Add | On Step 2, Add mode | Observe the checkbox | — | Checked by default | P2 | Low | Functional |
| TC-TC-GRID-03 | Time Card | Auto Fill Employee | Bulk-fills employees for the selected Company/Department | Auto Fill checked | Trigger the auto-fill fetch | — | Employee rows populate for that scope | P1 | Medium | Functional |
| TC-TC-GRID-04 | Time Card | Auto Fill Employee | Dedupes against already-manually-added rows | 1 employee already added manually | Trigger Auto Fill | — | That employee is not duplicated; only new employees are appended (`employee_data.id` dedupe confirmed) | P1 | High | Functional |
| TC-TC-GRID-05 | Time Card | Employee Name | Required per row | Row added | Leave Employee blank, attempt to save the row | — | "Employee is required" blocks that row | P0 | High | Validation |
| TC-TC-GRID-06 | Time Card | Employee Name | Dropdown scoped to the Time Card's Company/Department | Row added | Open Employee dropdown | — | Only employees in the selected Company/Department render | P1 | High | Dependency |
| TC-TC-GRID-07 | Time Card | Employee Name | Selecting an employee prefills In/Out/Break/Work/Total for that employee+date | Employee not previously in this grid | Select an employee | — | Prefilled fields populate from that employee's existing time-entry data for the date (if any) | P1 | Medium | Functional |
| TC-TC-GRID-08 | Time Card | Employee Name | An employee on leave is flagged but not blocked | Employee has an approved/pending leave for this date | Select that employee | — | Name renders in red with a `(!)` marker and "Employee is on leave" tooltip; row can still be added | P1 | Medium | Functional |
| TC-TC-GRID-09 | Time Card | Employee Name | Inactive employee selectable via dropdown | Inactive employee exists | Open Employee dropdown | — | Verify live whether inactive employees are filtered out or still selectable — not confirmed from source | P1 | High | Manual first |
| TC-TC-GRID-10 | Time Card | Duplicate employee | Manually adding the same employee twice in two rows is NOT blocked (confirmed gap) | 1 row already has Employee A | Add a second row, select Employee A again | Employee A twice | Confirmed: no client-side duplicate check on the manual add path; both rows save | P1 | High | Negative |
| TC-TC-GRID-11 | Time Card | Duplicate employee | Duplicate rows tolerate unless their combined total exceeds 24h | 2 rows, same employee, combined total ≤ 24h | Save | — | Accepted server-side — duplicates are summed for the 24h check, not rejected outright | P1 | High | Negative |
| TC-TC-GRID-12 | Time Card | Duplicate employee | Combined duplicate-row total over 24h is rejected | 2 rows, same employee, combined total > 24h | Save | — | Rejected by `validateTimeCardEntries`'s 24h cap | P1 | High | Negative |
| TC-TC-GRID-13 | Time Card | In Time / Out Time | Both accept a standard time picker value | Row added | Set In Time 09:00, Out Time 18:00 | — | Both accepted, Working Hours auto-calculates | P0 | High | Functional |
| TC-TC-GRID-14 | Time Card | In Time / Out Time | Same In and Out Time | Row added | Set In Time = Out Time = 09:00 | — | Working Hours computes as 0 (diff of 0 minus break clamps to 0) | P2 | Medium | Boundary |
| TC-TC-GRID-15 | Time Card | In Time / Out Time | Out Time earlier than In Time (confirmed overnight-shift bug) | Row added | Set In Time 22:00, Out Time 06:00 | — | Confirmed defect: Working Hours computes as 0 / never populates, instead of correctly rolling over to 8 hours | P0 | Critical | Negative |
| TC-TC-GRID-16 | Time Card | In Time / Out Time | Midnight-crossing via Night Shift From/To range | Row added, Night Shift From 22:00 / To 06:00 | Set the range | — | Correctly rolls over past midnight (`calculateDurationFromTimeRange`), yielding 8 hours — contrast case vs GRID-15 | P1 | High | Functional |
| TC-TC-GRID-17 | Time Card | In Time / Out Time | Invalid/empty time format via direct API | Direct API call | POST `in_time: "25:99:00"` | `"25:99:00"` | Rejected — BE regex caps hour at 23, minute/second at 59 | P1 | Medium | Negative |
| TC-TC-GRID-18 | Time Card | In Time / Out Time | Maximum single-shift duration (24h boundary) | Row added | Set a 24h span via In/Out Time | — | Verify live — the 24h JS cap check should trigger ("cannot exceed 24 hours") | P1 | Medium | Boundary |
| TC-TC-GRID-19 | Time Card | Comments | Optional free text, no validation | Row added | Enter arbitrary long text | — | Accepted, no length limit found in source | P2 | Low | Validation |
| TC-TC-GRID-20 | Time Card | Comments | HTML/script-like content rendered inert | Row added | Enter `<script>alert(1)</script>` in Comments | — | Stored and rendered as plain text, not executed | P0 | Critical | Security |
| TC-TC-GRID-21 | Time Card | Delete row | Row delete has no confirmation dialog | Row exists | Click delete on a row | — | Confirmed: immediate removal + a hardcoded (non-translated) success snackbar, no confirm prompt | P1 | High | Negative |
| TC-TC-GRID-22 | Time Card | Delete row | Deleting a persisted row (Edit mode) removes it server-side on save | Existing row with a real `id`, Edit mode | Delete it, save the Time Card | — | Row is gone on reload; confirmed hard-delete (no soft-delete concept for entry rows) | P1 | High | Functional |
| TC-TC-GRID-23 | Time Card | Add row | New blank row can be added via the grid's own inline add affordance | On Step 2 | Trigger the grid's add-row action | — | New empty row appears, ready for Employee selection | P1 | Medium | Functional |
| TC-TC-GRID-24 | Time Card | Add row | A completely blank row (no employee) cannot be persisted | Blank row added | Attempt to save without selecting an Employee | — | Blocked by the "Employee is required" rule | P1 | High | Negative |
| TC-TC-GRID-25 | Time Card | Multiple blank rows | Several blank rows added at once | Add 3 blank rows | Attempt to save | — | Each blocked individually by the Employee-required rule | P2 | Medium | Negative |
| TC-TC-GRID-26 | Time Card | Grid scale | Large number of rows (100+) remains usable | 100+ rows in one Time Card | Scroll/edit the grid | — | Grid remains responsive, no freeze | P2 | Low | Performance |
| TC-TC-GRID-27 | Time Card | Row scope | Employee dropdown excludes employees outside the Time Card's Department scope | Multi-department Time Card | Open Employee dropdown | — | Only employees in the selected Department(s) render | P1 | Medium | Dependency |
| TC-TC-GRID-28 | Time Card | Assign in Table = true | Project/Task/Cost Code/Cost Element render as PER-ROW columns | "Assign in Table" checked on Step 1 | View the entry grid | — | All 4 columns appear in the grid | P0 | High | Functional |
| TC-TC-GRID-29 | Time Card | Assign in Table = false | Project/Task/Cost Code/Cost Element columns are hidden from the grid entirely | "Assign in Table" unchecked | View the entry grid | — | None of the 4 columns render — the single Step-1 value applies to the whole card | P0 | High | Functional |
| TC-TC-GRID-30 | Time Card | Row-level Task filter | Row's Task dropdown filters by that same row's chosen Project | "Assign in Table" true, row Project set | Open that row's Task dropdown | — | Only Tasks for that row's Project render | P1 | Medium | Dependency |

## 5. Entry Grid — Break / OT / Night Shift / Weekend-Holiday OT / Total Hours (Calculations)

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-CALC-01 | Time Card | Break | Blank Break is valid | Row with In/Out Time set | Leave Break blank | — | Accepted; Working Hours computed with 0 break | P2 | Low | Validation |
| TC-TC-CALC-02 | Time Card | Break | Accepts `HH:MM` format | Row with In/Out Time set | Enter Break `01:00` | — | Accepted; deducted from Working Hours | P1 | Medium | Functional |
| TC-TC-CALC-03 | Time Card | Break | Accepts `"1h 30m"`-style free text | Row added | Enter `1h 30m` | — | Normalized to `01:30` internally | P2 | Low | Functional |
| TC-TC-CALC-04 | Time Card | Break | Negative value rejected | Row added | Enter a negative number | — | Rejected by the field's own regex (digits/HH:MM/Nh Nm only, no minus sign) | P1 | Medium | Negative |
| TC-TC-CALC-05 | Time Card | Break | Greater than the shift's total span | In 09:00, Out 12:00, Break 04:00 | Save the row | — | `breakMinutes <= 0` after subtraction → Working Hours computes as 0/`null` (same clamp as an overnight shift) | P1 | High | Boundary |
| TC-TC-CALC-06 | Time Card | Break | Decimal-looking value (e.g. `1.5`) | Row added | Enter `1.5` | — | Verify live whether the regex accepts or rejects a bare decimal (regex confirmed to accept plain digits, `HH:MM`, and `Nh Nm` forms — a bare decimal is not explicitly one of those) | P2 | Low | Manual first |
| TC-TC-CALC-07 | Time Card | Break | Exceeds 24 hours | Row added | Enter a break over 24h | — | Blocked by the JS 24h cap: "Break cannot exceed 24 hours" | P1 | Medium | Boundary |
| TC-TC-CALC-08 | Time Card | Working Hours | Read-only, auto-calculated only | Row added | Attempt to type directly into Working Hours | — | Field is not editable (`enableEditing:false`); value only changes via In/Out/Break | P0 | High | UI |
| TC-TC-CALC-09 | Time Card | Working Hours | Standard 9-hour shift with 1h break computes 8h | In 09:00, Out 18:00, Break 01:00 | Save | — | Working Hours = 08:00 | P0 | High | Functional |
| TC-TC-CALC-10 | Time Card | Working Hours | Forced to `null` on a weekend/holiday even if In/Out Time were entered | Employee's date falls on a confirmed weekend/holiday | Enter In/Out Time, save | — | Confirmed intended override: `work_duration` is forced null server-side; the full span lands in Weekend/Holiday OT instead | P1 | High | Functional |
| TC-TC-CALC-11 | Time Card | OT | Manual entry accepted independently of In/Out Time | Row added, normal (non-weekend/holiday) day | Enter OT directly without touching In/Out Time | `01:30` | Accepted — OT is never auto-derived from In/Out Time on a normal day, only entered directly | P1 | Medium | Functional |
| TC-TC-CALC-12 | Time Card | OT | Disabled once OT-Weekend/Holiday has a value | OT-Weekend/Holiday already filled | Attempt to edit OT | — | OT input becomes disabled (mutual exclusion, `default-data.ts:154`) | P1 | Medium | UI |
| TC-TC-CALC-13 | Time Card | OT | Forced to `null` on a weekend/holiday | Confirmed weekend/holiday date | Enter OT, save | — | Server-side forced to null; folded into Weekend/Holiday OT instead | P1 | High | Functional |
| TC-TC-CALC-14 | Time Card | OT | Exceeds 24 hours | Row added | Enter OT over 24h | — | Blocked: "Overtime (OT) cannot exceed 24 hours" | P1 | Medium | Boundary |
| TC-TC-CALC-15 | Time Card | Night Shift | Manual entry via a direct duration value | Row added | Enter Night Shift duration directly | `02:00` | Accepted on a normal day | P1 | Medium | Functional |
| TC-TC-CALC-16 | Time Card | Night Shift | Auto-calculated from From/To range, with correct midnight rollover | Night Shift From 22:00, To 06:00 | Save | — | 08:00 computed (`calculateDurationFromTimeRange` rolls over) — contrast with GRID-15's broken In/Out-Time path | P0 | High | Functional |
| TC-TC-CALC-17 | Time Card | Night Shift | Disabled once OT-Weekend/Holiday has a value | OT-Weekend/Holiday already filled | Attempt to edit Night Shift | — | Disabled (same mutual-exclusion rule as OT) | P1 | Medium | UI |
| TC-TC-CALC-18 | Time Card | Night Shift | Never populated by the attendance cron | Cron-generated entry | Inspect a cron-created row | — | Confirmed: `night_shift_duration` is always 0 for cron-derived entries — only manual/API entries can carry night-shift hours | P2 | Medium | Functional |
| TC-TC-CALC-19 | Time Card | Weekend/Holiday OT | Disabled once Working Hours, OT, or Night Shift has a value | Any one of the other 3 already has a value | Attempt to edit Weekend/Holiday OT | — | Confirmed asymmetric gap: Working Hours can only be cleared by clearing In/Out Time — most users can't discover this to unlock the field | P1 | High | Negative |
| TC-TC-CALC-20 | Time Card | Weekend/Holiday OT | Auto-populated with the whole day's span when the date is a confirmed weekend/holiday | Weekend/holiday date, In/Out Time entered | Save | — | Full span lands in `ot_weekend_holiday_duration`; Working Hours/OT/Night Shift forced null | P0 | High | Functional |
| TC-TC-CALC-21 | Time Card | Weekend/Holiday OT | Explicit From/To range takes priority over the raw In/Out-derived span | Weekend/holiday date, both an explicit Weekend-OT From/To AND In/Out Time set | Save | — | The explicit From/To range value is used, not the In/Out-derived one | P2 | Medium | Functional |
| TC-TC-CALC-22 | Time Card | Weekend/Holiday OT | Silent side-effect: editing In/Out Time overwrites an existing Weekend/Holiday OT value | Row already has Weekend/Holiday OT populated | Edit In or Out Time on that same row | — | Confirmed bug: the newly computed duration is written into `ot_weekend_holiday_duration`, silently replacing the prior value, instead of into Working Hours | P1 | High | Negative |
| TC-TC-CALC-23 | Time Card | Total Hours | Read-only, auto-calculated only | Row added | Attempt to type directly into Total Hours | — | Not editable (`enableEditing:false`) | P0 | High | UI |
| TC-TC-CALC-24 | Time Card | Total Hours | Formula is MAX, not SUM, of the two calculation paths | Working Hours=8h, OT=1h, Night Shift=0h, Weekend/Holiday OT=2h (all non-zero on a normal day, via direct API) | Inspect Total Hours | — | Confirmed FE formula: `MAX(WO+OT+NightShift, WeekendHolidayOT)` = 9h, not 11h — verify the backend's plain `SUM` (`calculateTotalDuration`) doesn't disagree when both buckets are non-null (only possible via direct API since the UI enforces mutual exclusion) | P1 | High | Negative |
| TC-TC-CALC-25 | Time Card | Total Hours | Correctly reflects a forced weekend/holiday override | Weekend/holiday date | Save with In/Out Time only | — | Total Hours = the Weekend/Holiday OT value alone (other buckets nulled) | P1 | Medium | Functional |
| TC-TC-CALC-26 | Time Card | 24-hour cap | Combined Working Hours+OT+Night Shift+Weekend/Holiday OT+Break over 24h is rejected server-side | Values summing over 1440 minutes including break | Save | — | Rejected by `validateTimeCardEntries`'s ceiling check (break is re-added for this specific check) | P0 | High | Boundary |
| TC-TC-CALC-27 | Time Card | 24-hour cap | Cap is checked across ALL of an employee's Time Cards for that date, not just the current one | Employee already has 20h logged on another Time Card for the same date | Add a new entry with 6h for the same employee/date | — | Rejected — the combined cross-Time-Card total (26h) exceeds 24h | P1 | High | Boundary |
| TC-TC-CALC-28 | Time Card | Duration field format | Every duration field accepts the same regex superset (digits/HH:MM/Nh-Nm forms) consistently | Any duration field | Enter each accepted format variant | `2`, `02:30`, `2h 30m` | All normalize correctly and consistently across Break/OT/Night Shift/Weekend-Holiday OT | P2 | Low | Validation |
| TC-TC-CALC-29 | Time Card | Payload double-suffix | Editing a previously-saved record whose duration already includes seconds | Existing record with `break_duration` like `"01:00:00"` | Open Edit, resave without changing Break | — | Verify live whether the payload mapper's unconditional `:00` append produces an invalid `"HH:MM:SS:00"` string — confirmed risk from source, not yet live-verified | P1 | High | Manual first |
| TC-TC-CALC-30 | Time Card | Dual field-name payload mapping | Night Shift has no `_hours`-suffixed fallback unlike the other 3 duration fields | Direct API / legacy data using `night_shift_hours` instead of `night_shift_duration` | Inspect payload mapping behavior | — | Confirmed gap: only `night_shift_duration` is read; a `night_shift_hours` value would be silently dropped | P2 | Medium | Negative |

## 6. Add Row / Grid Interaction (continued from §4/§5, workflow-focused)

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-ROW-01 | Time Card | Save (Step 2, Add) | Successful save with 1+ valid rows creates the record and redirects | Step 2, 1+ valid rows | Click the primary submit action | — | Record created with entries; redirected to list | P0 | High | Functional |
| TC-TC-ROW-02 | Time Card | Save (Step 2, Add) | Zero rows submitted | Step 2, no rows added | Click submit | — | Verify live whether an empty `entries` array is accepted on plain create (confirmed: only the dedicated `/:id/post` route requires `entries.length >= 1`, not plain create) | P1 | High | Negative |
| TC-TC-ROW-03 | Time Card | Post | "Post" button is gated by a distinct `actions.post` permission | User lacking `canPost` | Reach Step 2 in Edit mode | — | Post button disabled/hidden per that permission, independent of `canEdit` | P1 | High | Security |
| TC-TC-ROW-04 | Time Card | Post | "Post" button label may render a raw/missing translation | Step 2, Edit mode | Inspect the Post button's visible text | — | Verify live — `common.post` has no confirmed entry in the shared translations file | P2 | Low | UI |
| TC-TC-ROW-05 | Time Card | Post | Posting requires at least 1 entry | Step 2, Edit mode, 0 entries | Click Post | — | Rejected — `post.time-card.js`'s own schema requires `entries.length >= 1` | P1 | High | Validation |
| TC-TC-ROW-06 | Time Card | Post | Posting an already-Posted card is rejected | Already-Posted record | Attempt to Post it again (e.g. via direct API) | — | Rejected: "Time card is already posted" | P1 | Medium | Negative |
| TC-TC-ROW-07 | Time Card | Save vs Post | Full Save (PUT) can never transition a card to Posted | Existing Draft, direct API | PUT with `status: "Posted"` | — | Confirmed: silently overwritten to `"Draft"` server-side, no error surfaced | P1 | High | Negative |
| TC-TC-ROW-08 | Time Card | Create-as-Posted | Plain create can be sent already-Posted, bypassing Post's entries-required rule | Direct API call | `POST /` with `status:"Posted"`, `entries: []` | — | Confirmed accepted — a real gap vs. the dedicated Post route's stricter rule | P1 | High | Negative |
| TC-TC-ROW-09 | Time Card | Timesheet conflict | Saving is blocked if the date+company+department overlaps an already-Submitted/Pending/Approved Timesheet | A Timesheet already covers this date/company/department | Attempt to save a Time Card for the same scope | — | Rejected by `validateTimesheetSubmissionStatus` | P1 | High | Negative |
| TC-TC-ROW-10 | Time Card | Leave conflict | Saving is blocked if any entry's employee has an Approved OR Pending leave overlapping the date | Employee has a Pending (not yet Approved) leave request for this date | Add that employee, attempt to save | — | Rejected — confirmed even a merely-Pending leave blocks the save, not only Approved | P1 | High | Negative |
| TC-TC-ROW-11 | Time Card | Draft exemption scope | Draft only exempts the 4 core Basic Details fields, not the business rules above | Save-as-Draft path, a genuine leave/timesheet conflict exists | Attempt Save To Draft | — | Confirmed: leave/timesheet/24h checks still apply to Draft saves through the plain routes | P1 | High | Negative |
| TC-TC-ROW-12 | Time Card | Draft routes' schema gap | The dedicated `/save-as-draft` routes accept a malformed payload with zero schema validation | Direct API call | `POST /save-as-draft` with a deliberately malformed body | — | Confirmed: body schema is commented out entirely on both save-as-draft routes | P1 | High | Negative |
| TC-TC-ROW-13 | Time Card | Save race | Double-clicking the primary Save/Post button doesn't create duplicates | Step 2, valid data | Double-click Save quickly | — | Exactly one record/post action results | P1 | High | Negative |
| TC-TC-ROW-14 | Time Card | Concurrent edit | Two sessions editing the same Draft simultaneously | Same Draft opened in two tabs | Save conflicting changes from both | — | Verify live actual behavior (last-write-wins vs conflict error) — not confirmed from source | P2 | Medium | Manual first |

## 7. View Time Card

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-VIEW-01 | Time Card | Basic Details | Date/Company/Department/Resource Type/Project/Task/Cost Code/Cost Element render correctly | Existing record | Open View | — | All fields match saved values | P0 | High | Functional |
| TC-TC-VIEW-02 | Time Card | Entry table | Full entry grid renders read-only with all saved rows | Record with multiple entries | Open View | — | Every saved row/column value displays correctly | P0 | High | Functional |
| TC-TC-VIEW-03 | Time Card | Column hiding inconsistency | Cost Code/Cost Element columns render even when "Assign in Table" is off | Record with `assign_in_table=false` | Open View | — | Confirmed bug: View only hides Project/Task, unlike the entry grid which also hides Cost Code/Cost Element | P2 | Medium | UI |
| TC-TC-VIEW-04 | Time Card | Actions menu — Draft | Edit and Delete both available for a Draft record | Draft record, `canEdit`/`canDelete` true | Open Actions | — | Both options present and enabled | P1 | Medium | Functional |
| TC-TC-VIEW-05 | Time Card | Actions menu — Posted | Actions button is entirely absent for a Posted record | Posted record, even with full permissions | Open View | — | Confirmed: the whole Actions button is not rendered, not merely disabled | P0 | High | Functional |
| TC-TC-VIEW-06 | Time Card | Delete confirmation | View-page delete shows a confirm dialog (contrast with row-level grid delete) | Draft record | Click Delete from Actions | — | Confirm dialog shown before removal — unlike the entry grid's own row delete | P1 | Medium | Functional |
| TC-TC-VIEW-07 | Time Card | Summary panel | Not reachable — dead/unrendered component | Any record | Look for a "Summary" tab/panel | — | Confirmed: the `Summary` component is imported but never mounted in the current source | P2 | Low | UI |
| TC-TC-VIEW-08 | Time Card | Placeholder | Blank optional fields render "-" | Record with blank Project/Task | Open View | — | "-" shown, not empty/undefined text | P2 | Low | UI |
| TC-TC-VIEW-09 | Time Card | Read-only | No field on View accepts focus/typing | Existing record | Attempt to click/type into any field | — | No effect; all fields non-interactive | P0 | Medium | UI |
| TC-TC-VIEW-10 | Time Card | Status display | Status shown matches List's own chip logic | Record in each status | Open View | — | Draft/Posted rendered consistently with the List page | P1 | Low | Functional |
| TC-TC-VIEW-11 | Time Card | Duplicate-employee rows | Both duplicate rows render distinctly if present | Record with a duplicate-employee row pair (from GRID-11) | Open View | — | Both rows visible with their own individual values | P2 | Low | Functional |
| TC-TC-VIEW-12 | Time Card | Direct URL access | Blocked without `canViewById` | User lacking `canViewById` | Navigate directly to a View URL | — | `ProtectedRoute` blocks access | P0 | High | Security |
| TC-TC-VIEW-13 | Time Card | Soft-deleted record | Opening View for a soft-deleted id | Soft-deleted record's id | Navigate directly to its View URL | — | 404/blocked — confirmed the parent `time_cards` lookup is consistently filtered by `is_deleted` at the framework level | P1 | Medium | Negative |
| TC-TC-VIEW-14 | Time Card | Orphaned entries | Entries of a soft-deleted parent don't leak via any other View path | Soft-deleted Time Card with entries | Attempt to reach those entries any other way | — | Confirmed: unreachable via the normal by-id path (parent 404s first); only a concern for raw/reporting queries that bypass the parent lookup | P3 | Low | Manual first |
| TC-TC-VIEW-15 | Time Card | Large grid | View renders a 100+-row entry table without breaking | Record with 100+ entries | Open View | — | Renders correctly, scrollable, no layout break | P2 | Low | Performance |
| TC-TC-VIEW-16 | Time Card | Weekend/holiday display | A weekend/holiday-forced row correctly shows nulled Working Hours/OT/Night Shift and populated Weekend/Holiday OT | Record with a weekend/holiday-date entry | Open View | — | Matches the server-side override, not raw client input | P1 | Medium | Functional |

## 8. Edit Time Card

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-EDIT-01 | Time Card | Preload | Basic Details preload from the saved record | Existing Draft | Open Edit | — | Company/Department/Date/Resource Type/Assign-in-Table all show saved values | P0 | High | Functional |
| TC-TC-EDIT-02 | Time Card | Preload | Entry grid preloads all saved rows with correct values | Existing record with entries | Open Edit Step 2 | — | Every row/column matches the saved data | P0 | High | Functional |
| TC-TC-EDIT-03 | Time Card | Save To Draft visibility | Only shown when the record's own status is Draft | Existing Draft | Open Edit | — | "Save To Draft" button visible | P1 | Medium | Functional |
| TC-TC-EDIT-04 | Time Card | Save To Draft visibility | Hidden entirely for a Posted record | Posted record | Attempt to open Edit | — | Route itself may be reachable but "Save To Draft" is not shown; List/View already block reaching Edit for Posted anyway | P1 | Medium | Functional |
| TC-TC-EDIT-05 | Time Card | Update Basic Details | Changing Department triggers Location/Employee-scope refresh downstream | Existing record, Department changed | Save | — | Entry grid's Employee filtering reflects the new Department scope | P1 | Medium | Functional |
| TC-TC-EDIT-06 | Time Card | Posted immutability | Attempting to update a Posted record via direct API is rejected | Posted record, direct API | PUT `/:id` | — | Rejected: "Cannot update a posted time card" | P0 | High | Negative |
| TC-TC-EDIT-07 | Time Card | Posted immutability | UI-level Edit route is unreachable for a Posted record via List/View | Posted record | Attempt to open Edit from List/View | — | Blocked at the UI (menu item disabled / Actions button absent) — confirmed to also be blocked server-side as a defense-in-depth measure | P0 | High | Security |
| TC-TC-EDIT-08 | Time Card | Smart-diff entries | Removing a row during Edit hard-deletes it server-side | Existing row removed in Edit, then saved | Save | — | Row is gone from the record on reload (hard delete confirmed — no soft-delete concept for entries) | P1 | Medium | Functional |
| TC-TC-EDIT-09 | Time Card | Smart-diff entries | Adding a new row during Edit inserts it correctly alongside existing rows | Existing record, new row added in Edit | Save | — | New row persists with a real id; existing rows unaffected | P1 | Medium | Functional |
| TC-TC-EDIT-10 | Time Card | Renaming/changing a single field | Editing only one entry's Break value updates only that field | Existing record | Change Break on one row, save | — | Only that row's Break (and its downstream Working Hours/Total) changes; other rows untouched | P1 | Medium | Functional |
| TC-TC-EDIT-11 | Time Card | Discard | Discard on Edit leaves the original record untouched | Field changed on Edit, not saved | Click Discard | — | Reopening Edit shows the original, unchanged values | P0 | High | Functional |
| TC-TC-EDIT-12 | Time Card | Update omitting core fields | `PUT` without `company_id`/`date`/`resource_type_id`/`department_ids` succeeds | Existing record, direct API | PUT with only `entries` | — | Accepted — confirmed the update schema has no top-level required fields at all | P1 | High | Negative |
| TC-TC-EDIT-13 | Time Card | Deleted record | Opening Edit for a soft-deleted id via direct URL | Soft-deleted record's id | Navigate directly to its Edit URL | — | Blocked — parent lookup is `is_deleted`-filtered consistently | P1 | Medium | Negative |
| TC-TC-EDIT-14 | Time Card | Duplicate-employee edit | Adding a duplicate employee row during Edit behaves the same as on Add | Existing record, Edit mode | Add a row with an employee already present | — | Same confirmed gap as GRID-10 — no client-side block | P1 | Medium | Negative |
| TC-TC-EDIT-15 | Time Card | Weekend/holiday recompute | Changing an entry's Date-adjacent context doesn't apply here (Date is Time-Card-level, not per-row) — instead verify changing In/Out Time on a weekend-date row still forces the override | Existing weekend-date entry | Edit its In/Out Time, save | — | Confirmed override still applies on Edit, matching Create's behavior | P1 | Medium | Functional |
| TC-TC-EDIT-16 | Time Card | Route permission | Edit route blocked without `canEdit` | User lacking `canEdit` | Navigate directly to an Edit URL | — | `ProtectedRoute` blocks access | P0 | High | Security |
| TC-TC-EDIT-17 | Time Card | Server-side enforcement | Direct API bypass of the UI's Edit-blocking-for-Posted still rejected | Posted record, user with `canEdit`, direct API call | PUT `/:id` | — | Rejected regardless of permission, since the block is status-based in the service layer, not permission-based | P0 | High | Security |
| TC-TC-EDIT-18 | Time Card | Update timesheet/leave conflict | Editing to overlap a Submitted Timesheet or a Pending/Approved leave is blocked the same as Create | Existing record, edited into a conflicting scope | Save | — | Rejected, same validators as Create | P1 | High | Negative |

## 9. Delete Time Card

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-DEL-01 | Time Card | Confirmation | Delete opens a confirmation dialog (List and View both) | Draft record | Trigger Delete | — | Confirmation dialog shown before removal | P0 | High | Functional |
| TC-TC-DEL-02 | Time Card | Cancel | Cancelling leaves the record untouched | Confirmation dialog open | Click Cancel | — | Record remains in the list, unchanged | P1 | Medium | Functional |
| TC-TC-DEL-03 | Time Card | Confirm — Draft | Confirming removes a Draft record from the list | Draft record | Confirm Delete | — | Record no longer in list; soft-deleted at backend | P0 | High | Functional |
| TC-TC-DEL-04 | Time Card | Confirm — Posted | Deleting a Posted record is blocked | Posted record | Attempt Delete (List/View disable it; also try direct API) | — | UI disables the control; direct API `DELETE /:id` also rejected: "Cannot update a posted time card"-style guard (confirmed in `deleteTimeCard`) | P0 | High | Negative |
| TC-TC-DEL-05 | Time Card | Permission | Delete disabled without `canDelete` | User without `canDelete` | Open row/Actions menu | — | Delete option disabled | P0 | High | Security |
| TC-TC-DEL-06 | Time Card | Orphaned children | Deleting the parent leaves entry/department rows physically present but unreachable | Record with entries, deleted | Delete it, then inspect via any raw/reporting path | — | Confirmed: `deleteTimeCard` only soft-deletes the parent; child tables have no `is_deleted` concept at all — rows are orphaned, not cleaned up | P2 | Medium | DB |
| TC-TC-DEL-07 | Time Card | Repeat delete | Deleting an already-deleted record | Already soft-deleted record's id | `DELETE` again via direct API | — | Verify live: idempotent success, 404, or error — not confirmed from source | P2 | Low | Manual first |
| TC-TC-DEL-08 | Time Card | Post-delete visibility | Deleted record excluded from List/Search/Filter | Just deleted a record | Search/filter for it | — | Not found in any of the three | P1 | Medium | Functional |
| TC-TC-DEL-09 | Time Card | Delete failure | Server error during delete handled gracefully | Mocked 500 on DELETE | Confirm Delete | — | Error toast shown; record remains listed, no optimistic removal | P1 | Medium | Negative |
| TC-TC-DEL-10 | Time Card | Pagination after delete | Deleting the last row on a page updates pagination correctly | On the last page with 1 record | Delete that record | — | Page count/navigation adjusts, no dangling empty page | P2 | Low | Functional |
| TC-TC-DEL-11 | Time Card | Row-level vs record-level delete UX | Row delete inside the entry grid has no confirmation, unlike the record-level delete | Entry grid, existing row | Delete a single row | — | Confirmed inconsistency — immediate removal with only a snackbar | P1 | Medium | Negative |
| TC-TC-DEL-12 | Time Card | Master-data integrity | Deleting a Time Card doesn't affect the Employee/Project/Task/Cost Code/Cost Element master records it referenced | Time Card deleted | Reopen those master records elsewhere | — | Unaffected, still usable in a new Time Card | P2 | Low | Regression |

## 10. Draft and Posted Workflow

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-WF-01 | Time Card | Draft | Save To Draft from Step 1 creates a Draft with no entries | On Add Step 1 | Fill Basic Details, click Save To Draft | — | Record created, status Draft, entries empty | P0 | High | Functional |
| TC-TC-WF-02 | Time Card | Draft | Save To Draft from Step 2 (Add) creates a Draft WITH entries | On Add Step 2, rows added | Click Save To Draft | — | Record created, status Draft, entries persisted | P0 | High | Functional |
| TC-TC-WF-03 | Time Card | Draft | Re-saving an existing Draft as Draft again updates it | Existing Draft | Open Edit, change a field, Save To Draft | — | Update persists; record remains Draft | P1 | Medium | Functional |
| TC-TC-WF-04 | Time Card | Draft → Posted | Posting an existing Draft transitions its status | Existing Draft with 1+ entries | Open Edit Step 2, click Post | — | Status becomes Posted; List/View reflect it | P0 | High | Functional |
| TC-TC-WF-05 | Time Card | Draft → Posted | Posting requires `canPost` permission | User lacking `canPost` | Reach Step 2 | — | Post control disabled | P0 | High | Security |
| TC-TC-WF-06 | Time Card | Posted | Once Posted, Edit is blocked everywhere (List, View, direct API) | Posted record | Attempt Edit via all 3 paths | — | Blocked consistently at every layer | P0 | High | Security |
| TC-TC-WF-07 | Time Card | Posted | Once Posted, Delete is blocked everywhere (List, View, direct API) | Posted record | Attempt Delete via all 3 paths | — | Blocked consistently at every layer | P0 | High | Security |
| TC-TC-WF-08 | Time Card | Posted | Re-posting an already-Posted record is rejected | Posted record, direct API | `POST /:id/post` again | — | Rejected: "Time card is already posted" | P1 | Medium | Negative |
| TC-TC-WF-09 | Time Card | Status via Update | `PUT /:id` can never move a record to Posted, even if instructed | Existing Draft, direct API | PUT with `status:"Posted"` | — | Silently forced back to `"Draft"` — confirmed gap, no error surfaced | P1 | High | Negative |
| TC-TC-WF-10 | Time Card | Status via Create | A brand-new record can be created directly as Posted, bypassing the Post route's entries-required check | Direct API | `POST /` with `status:"Posted"`, empty entries | — | Confirmed accepted — inconsistent with `/:id/post`'s stricter rule | P0 | Critical | Negative |
| TC-TC-WF-11 | Time Card | Status enum edge | Sending `status: null` on create/update | Direct API | POST/PUT with `status: null` | `null` | Accepted at the schema level (nullable per `transformValidator`); falls back to `'Draft'` in the create use-case | P2 | Low | Boundary |
| TC-TC-WF-12 | Time Card | Draft business-rule scope | Draft still enforces timesheet/leave/24h checks via the plain routes | Draft save with a genuine conflict | Save To Draft (via `POST /` with `status:"Draft"`, not the dedicated draft route) | — | Rejected — confirmed Draft isn't a blanket bypass through these routes | P1 | High | Negative |
| TC-TC-WF-13 | Time Card | Draft route bypass | The dedicated `/save-as-draft` routes skip essentially everything | Direct API | `POST /save-as-draft` with a near-empty body | — | Confirmed accepted — no schema validation on that route at all | P1 | Critical | Negative |
| TC-TC-WF-14 | Time Card | RBAC — draft routes | Both save-as-draft routes are missing `isRbacResource` | User with zero Time-Cards permissions | Call `POST /save-as-draft` / `PATCH /:id/save-as-draft` directly | — | Verify live whether these wrongly succeed for an unpermissioned (but authenticated) user | P0 | Critical | Security |
| TC-TC-WF-15 | Time Card | RBAC — post route | `POST /:id/post` correctly has RBAC gating | User lacking `canPost`, direct API | Call the route directly | — | Confirmed `isRbacResource:true` present — verify it's actually enforced live | P1 | High | Security |
| TC-TC-WF-16 | Time Card | Activity log | Posting logs `old_status`/`new_status` metadata | Draft posted | Inspect the activity log entry | — | Confirmed always logs `old_status:'Draft'` regardless of the card's actual prior status — a minor logging inaccuracy if ever reachable from a non-Draft state | P3 | Low | DB |
| TC-TC-WF-17 | Time Card | List status filter | Filtering by Status=Draft/Posted returns the correct subset | Mixed-status records exist | Filter by each status | — | Only matching records shown | P1 | Medium | Functional |
| TC-TC-WF-18 | Time Card | Draft editable, Posted locked (list menu) | Row menu accurately reflects both states side by side | List with both Draft and Posted rows | Open each row's menu | — | Draft: Edit/Delete enabled (permission-gated); Posted: both disabled | P0 | High | Functional |
| TC-TC-WF-19 | Time Card | Attendance-cron drafts | Cron-generated records are created as Draft | A processed attendance date | Inspect the cron-generated record | — | Confirmed `status:'Draft'` always for cron output | P1 | Medium | Functional |
| TC-TC-WF-20 | Time Card | Manual Post of a cron-generated Draft | A cron-created Draft can be manually reviewed and Posted like any other | Cron-generated Draft exists | Open Edit, review entries, click Post | — | Posts normally; becomes immutable afterward like any other Posted record | P1 | Medium | Functional |

## 11. Business Rule Testing (Calendar, Calculation, Integration)

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-BIZ-01 | Time Card | Calendar priority | Company+Department+Location calendar takes priority over broader calendars | All 4 calendar levels configured differently for the same date | Save a Time Card for that scope | — | The most specific (Company+Department+Location) calendar's rule applies | P1 | High | Functional |
| TC-TC-BIZ-02 | Time Card | Calendar priority | Falls back to Company+Department when no Location-specific calendar exists | Only Company+Department calendar configured | Save for that scope | — | That calendar's rule applies | P1 | Medium | Functional |
| TC-TC-BIZ-03 | Time Card | Calendar priority | Falls back to Company-only when neither Department nor Location calendars exist | Only a Company-wide calendar configured | Save | — | That calendar's rule applies | P1 | Medium | Functional |
| TC-TC-BIZ-04 | Time Card | Calendar fallback | No calendar configured at all falls back to hardcoded Sat/Sun weekend detection only | No `company_calendar` row exists for this scope | Save entries on a Saturday and on a known public holiday | — | Saturday correctly detected as weekend; confirmed gap: the holiday is NOT detected (no calendar = no holiday awareness) | P1 | High | Negative |
| TC-TC-BIZ-05 | Time Card | Day-of-week matching | Casing/format mismatch in seeded calendar data silently fails weekend detection | Calendar data seeded with a non-`dddd`-matching day-name format | Save an entry on that day | — | Verify live whether it silently falls through to "not a week-off" — confirmed fragile string-match logic in source | P2 | Medium | Manual first |
| TC-TC-BIZ-05b | Time Card | Working-hours prefill vs weekend flag | Week-off day's employee prefill still shows default 9-5 hours despite being flagged weekend | Employee selected on a confirmed week-off day | Observe the prefilled In/Out Time | — | Confirmed inconsistency: prefill defaults to hardcoded 09:00/18:00 even though `isWeekendOrHoliday` correctly flags the date as a week-off | P2 | Medium | Negative |
| TC-TC-BIZ-06 | Time Card | Holiday detection | A date within a configured holiday's start/end range is correctly detected | Holiday range configured covering the test date | Save an entry for that date | — | Detected as holiday; Weekend/Holiday OT bucket used | P1 | Medium | Functional |
| TC-TC-BIZ-07 | Time Card | Holiday boundary | Exact start-date and end-date of a holiday range are both inclusive | Holiday `start_date`=`end_date`=test date (or a multi-day range) | Save at each boundary date | — | Both boundary dates correctly detected as holiday | P1 | Medium | Boundary |
| TC-TC-BIZ-08 | Time Card | Weekend override | Manually entering Working Hours on a weekend date is overridden | Confirmed weekend date, In/Out Time entered | Save | — | Server forces Working Hours/OT/Night Shift to null; full span goes to Weekend/Holiday OT | P0 | High | Functional |
| TC-TC-BIZ-09 | Time Card | Timesheet integration | A Time Card cannot be saved once its scope is covered by a Submitted Timesheet | Timesheet Submitted for this date/company/department | Attempt to save a Time Card in that scope | — | Rejected by `validateTimesheetSubmissionStatus` | P1 | High | Integration |
| TC-TC-BIZ-10 | Time Card | Timesheet integration | Same block applies for Pending and Approved Timesheet states, not just Submitted | Timesheet in each of those states | Attempt to save | — | Rejected in all 3 states | P1 | High | Integration |
| TC-TC-BIZ-11 | Time Card | Timesheet integration | A Rejected/Draft Timesheet does NOT block a Time Card | Timesheet in Rejected or Draft state | Attempt to save | — | Verify live — only Submitted/Pending/Approved are confirmed blocking states from source | P2 | Medium | Manual first |
| TC-TC-BIZ-12 | Time Card | Leave integration | Approved leave for an entry's employee/date blocks the save | Employee has Approved leave that date | Add that employee, save | — | Rejected by `validateEmployeeLeaveStatus` | P1 | High | Integration |
| TC-TC-BIZ-13 | Time Card | Leave integration | Pending (not yet approved) leave also blocks the save | Employee has Pending leave that date | Add that employee, save | — | Confirmed also rejected — not just Approved | P1 | High | Integration |
| TC-TC-BIZ-14 | Time Card | Leave integration | Rejected/Cancelled leave does NOT block the save | Employee has a Rejected leave request that date | Add that employee, save | — | Accepted — only Approved/Pending block | P2 | Medium | Integration |
| TC-TC-BIZ-15 | Time Card | Attendance cron | Nightly cron creates Draft Time Cards from prior day's Checked-Out attendance | Attendance records exist for yesterday with status Checked Out/Auto Checked Out | Run/wait for the cron | — | Draft Time Card(s) created, one per Company+Department group | P1 | High | Integration |
| TC-TC-BIZ-16 | Time Card | Attendance cron | Multi-department attendance on the same day produces multiple separate Time Cards | Attendance spans 2 departments same company/date | Run the cron | — | 2 separate Time Cards created, one per department | P1 | Medium | Integration |
| TC-TC-BIZ-17 | Time Card | Attendance cron | Re-running the cron for an already-processed date duplicates entries (confirmed bug) | Cron already ran for a date | Manually re-trigger the cron for that same date | — | Confirmed: broken duplicate-check means employee hours get duplicated, not skipped | P0 | Critical | Negative |
| TC-TC-BIZ-18 | Time Card | Attendance cron | Cron-generated entries bypass leave-conflict validation | Employee on Approved leave has attendance data for that date | Run the cron | — | Confirmed: entry is still created despite the leave — no leave-check runs for cron paths | P1 | High | Negative |
| TC-TC-BIZ-19 | Time Card | Attendance cron | Cron-generated entries bypass the 24h cap check | Employee's cron hours plus a separate manual entry exceed 24h for that date | Run the cron, then inspect | — | Confirmed: the cron's own insert is never checked against the cap (only later manual/API touches would be) | P1 | High | Negative |
| TC-TC-BIZ-20 | Time Card | Attendance cron | Overtime beyond the calendar's standard work minutes is correctly bucketed | Attendance total exceeds the standard day length | Run the cron | — | Excess correctly lands in `ot_duration`; base portion in `work_duration` | P2 | Medium | Functional |

## 12. Negative Testing

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-NEG-01 | Time Card | Save without mandatory fields | Company/Department/Resource Type all blank | On Add page | Click Next with all 3 blank | — | All 3 inline errors shown; blocked | P0 | High | Negative |
| TC-TC-NEG-02 | Time Card | Invalid date | Malformed date string via direct API | Direct API | POST `date: "not-a-date"` | — | Rejected — BE schema enforces `format: date` | P1 | Medium | Negative |
| TC-TC-NEG-03 | Time Card | Invalid employee | Non-existent `employee_id` in an entry | Direct API | POST an entry with a fabricated `employee_id` | — | Verify live whether an FK/existence check rejects it | P1 | High | Manual first |
| TC-TC-NEG-04 | Time Card | Cross-company employee | Employee belonging to a different company than the Time Card | Direct API | Add an entry whose employee's `company_id` differs | — | Rejected — confirmed explicit cross-check exists (though its error message has a typo, see BIZ note below) | P1 | High | Negative |
| TC-TC-NEG-05 | Time Card | Error message typo | Cross-company employee rejection shows a blank last name | Same setup as NEG-04 | Trigger the rejection, read the error message | — | Confirmed: `emp.last_anme` typo means the employee's last name never actually appears in the message | P3 | Low | UI |
| TC-TC-NEG-06 | Time Card | Duplicate employee | Same employee twice in one payload | Direct API | POST with `entries` containing the same `employee_id` twice | — | Accepted unless combined total exceeds 24h (confirmed tolerant, not rejecting) | P1 | Medium | Negative |
| TC-TC-NEG-07 | Time Card | Invalid time | Time value outside 00:00:00–23:59:59 | Direct API | POST `in_time: "24:00:00"` | — | Rejected by the BE regex (hour capped at 23) | P1 | Medium | Negative |
| TC-TC-NEG-08 | Time Card | Huge break duration | Break far exceeding the shift span | Row added | Enter Break `12:00` on a 4h shift | — | Working Hours clamps to 0 (negative-minutes clamp), no explicit "break exceeds shift" error surfaced | P1 | Medium | Negative |
| TC-TC-NEG-09 | Time Card | Empty grid | Save with zero entry rows | Step 2, no rows | Click Save (not Post) | — | Verify live — confirmed only `/:id/post` requires ≥1 entry, plain create/update may accept zero | P1 | High | Negative |
| TC-TC-NEG-10 | Time Card | Blank employee row | A row with no Employee selected | Row added, Employee left blank | Attempt to save | — | Blocked: "Employee is required" | P0 | High | Negative |
| TC-TC-NEG-11 | Time Card | Multiple blank rows | 3 rows added, none with an Employee | Add 3 blank rows | Attempt to save | — | All 3 blocked individually | P2 | Medium | Negative |
| TC-TC-NEG-12 | Time Card | Invalid project mapping | Project id that doesn't exist | Direct API | POST `project_id: 999999999` | — | Verify live whether any FK check rejects it — not confirmed from source | P2 | Medium | Manual first |
| TC-TC-NEG-13 | Time Card | Invalid task mapping | Task belonging to a different project than the row's own Project | Direct API | POST a `task_id` from another project | — | Verify live whether cross-project task assignment is blocked — not confirmed from source | P2 | Medium | Manual first |
| TC-TC-NEG-14 | Time Card | Invalid cost code | Non-existent `cost_code_id` | Direct API | POST a fabricated `cost_code_id` | — | Verify live — not confirmed from source | P2 | Low | Manual first |
| TC-TC-NEG-15 | Time Card | Invalid cost element | Non-existent `cost_element_id` | Direct API | POST a fabricated `cost_element_id` | — | Verify live — not confirmed from source | P2 | Low | Manual first |
| TC-TC-NEG-16 | Time Card | Browser refresh during Add Step 2 | Refresh mid-entry, before saving | Rows partially entered, unsaved | Refresh the browser | — | Confirmed: all unsaved Step-2 work is lost (no persistence until Save/Draft/Post is clicked) | P1 | High | Negative |
| TC-TC-NEG-17 | Time Card | Browser refresh during Edit Step 2 | Refresh mid-entry, before saving | Existing record, rows edited but not saved | Refresh the browser | — | Reverts to the last-saved server state (Basic Details were already persisted via the Edit-mode Next call) | P1 | Medium | Negative |
| TC-TC-NEG-18 | Time Card | Double-click Save | Rapid double-click on the primary save action | Step 2, valid data | Double-click quickly | — | Exactly one record created, no duplicate | P1 | High | Negative |
| TC-TC-NEG-19 | Time Card | Double-click Post | Rapid double-click on Post | Step 2, Edit mode, valid data | Double-click Post quickly | — | Exactly one Post action executes, status ends as Posted (not double-processed) | P1 | High | Negative |
| TC-TC-NEG-20 | Time Card | Delete already-deleted | Deleting a record twice in quick succession (e.g. two tabs) | Existing Draft, two tabs both showing Delete available | Confirm delete in both | — | Second attempt fails gracefully (404/already-deleted error), no crash | P2 | Medium | Negative |
| TC-TC-NEG-21 | Time Card | SQL injection | Injection payload in Comments/search | Authenticated | Enter `' OR '1'='1` | — | Neutralized, not executed as raw SQL | P0 | Critical | Security |
| TC-TC-NEG-22 | Time Card | Empty date range attendance | Cron runs for a date with zero attendance records | No attendance data for the target date | Run the cron for that date | — | No Time Card created; no error | P2 | Low | Negative |

## 13. UI Testing

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-UI-01 | Time Card | Required marks | Required fields (Company/Department/Resource Type) show an asterisk | Add page loaded | Inspect labels | — | Asterisk present on all 3 | P2 | Low | UI |
| TC-TC-UI-02 | Time Card | Placeholder text | Placeholders match the confirmed translation values | Add page loaded | Inspect each field's placeholder | — | "Select Company"/"Select Resource Type"/etc. render exactly | P2 | Low | UI |
| TC-TC-UI-03 | Time Card | Disabled controls | Project/Task/Cost Code/Cost Element visually gray out when "Assign in Table" is checked | Checkbox checked | Inspect those 4 fields | — | Clearly disabled styling | P2 | Low | UI |
| TC-TC-UI-04 | Time Card | Read-only fields | Working Hours/Total Hours render as clearly non-editable | Any row | Inspect those 2 cells | — | Visually distinct from editable cells (no input cursor on click) | P2 | Low | UI |
| TC-TC-UI-05 | Time Card | Button states | Save/Post buttons show a loading state while in-flight | Click Save | Observe button | — | Disabled/spinner shown until response | P2 | Medium | UI |
| TC-TC-UI-06 | Time Card | Table alignment | Numeric duration columns are right/consistently aligned | Grid with data | Inspect column alignment | — | Consistent alignment across all duration columns | P3 | Low | UI |
| TC-TC-UI-07 | Time Card | Horizontal scrolling | Entry grid scrolls horizontally when all optional columns are visible | Assign in Table on, all columns shown | Resize to a narrower viewport | — | Horizontal scroll appears, no column overlap | P2 | Medium | Responsive |
| TC-TC-UI-08 | Time Card | Sticky header | Grid header stays visible while scrolling many rows | 50+ rows | Scroll down within the grid | — | Header row remains pinned/visible | P2 | Low | UI |
| TC-TC-UI-09 | Time Card | Pagination layout | List pagination controls render correctly at various widths | Resize browser | Inspect pagination bar | — | No overlap/clipping at any tested width | P2 | Low | Responsive |
| TC-TC-UI-10 | Time Card | Labels | Every field's label text matches the confirmed translation strings | Add/Edit/View pages | Inspect all labels | — | Exact match, no missing/raw i18n keys (except the confirmed `common.post` gap) | P2 | Low | UI |
| TC-TC-UI-11 | Time Card | Status chip color | Draft vs Posted use visually distinct chip colors | Mixed-status list | Inspect chips | — | Clearly distinguishable at a glance | P2 | Low | UI |
| TC-TC-UI-12 | Time Card | Responsive — mobile | Add/Edit forms remain usable on a narrow viewport | Resize to mobile width | Fill Basic Details | — | Fields stack to single column, remain operable | P2 | Medium | Responsive |

## 14. Search Testing

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-SRCH-01 | Time Card | Search by ID | Full `series_number` match | Record `TC-000123` exists | Search "TC-000123" | — | Matching record returned | P0 | Medium | Functional |
| TC-TC-SRCH-02 | Time Card | Search by Company | Partial company name | — | Search a partial company name | — | Matching record(s) returned | P1 | Low | Functional |
| TC-TC-SRCH-03 | Time Card | Search by Department | Partial department name | — | Search a partial department name | — | Matching record(s) returned | P1 | Low | Functional |
| TC-TC-SRCH-04 | Time Card | Search by Uploaded By | Partial creator name | — | Search a partial "Uploaded By" name | — | Matching record(s) returned | P1 | Low | Functional |
| TC-TC-SRCH-05 | Time Card | Search by Date | Exact date search | Record on a known date | Search that date | — | Matching record(s) returned | P1 | Medium | Functional |
| TC-TC-SRCH-06 | Time Card | Search by Status | Search "Draft"/"Posted" as free text | Mixed-status records | Search "Draft" | — | Verify live whether status is included in the free-text search index or only reachable via Filter | P2 | Low | Manual first |
| TC-TC-SRCH-07 | Time Card | Case-insensitive | Uppercase search matches lowercase data | — | Search in uppercase | — | Matching record(s) returned regardless of case | P1 | Low | Functional |
| TC-TC-SRCH-08 | Time Card | No matches | Nonsense search string | — | Search a nonsense string | — | Shared empty/no-data state renders | P1 | Low | UI |
| TC-TC-SRCH-09 | Time Card | Special characters | `%`, `_`, `'` in search | — | Search each character | — | No 500 error; literal match or no-results | P2 | Medium | Negative |
| TC-TC-SRCH-10 | Time Card | Empty search | Clearing the search box restores the full list | Search active | Clear search box | — | Full unfiltered list returns | P1 | Low | Functional |

## 15. Filter Testing

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-FILT-01 | Time Card | Company filter | Narrows to matching Company | Multiple companies | Filter by Company A | — | Only Company A records shown | P1 | Medium | Functional |
| TC-TC-FILT-02 | Time Card | Department filter | Narrows to matching Department | Multiple departments | Filter by one Department | — | Only matching records shown | P1 | Medium | Functional |
| TC-TC-FILT-03 | Time Card | Date filter | Narrows to matching Date (or range) | Records across dates | Filter by a specific date | — | Only that date's records shown | P1 | Medium | Functional |
| TC-TC-FILT-04 | Time Card | Resource Type filter | Narrows by Resource Type | Mixed resource types | Filter by "Employees" | — | Only matching records shown | P1 | Medium | Functional |
| TC-TC-FILT-05 | Time Card | Status filter | Narrows by Draft/Posted | Mixed-status records | Filter by Posted | — | Only Posted records shown | P1 | Medium | Functional |
| TC-TC-FILT-06 | Time Card | Multiple filters | Company + Status combine with AND logic | — | Apply both filters | — | Verify live — AND vs OR combination not confirmed from source | P2 | Medium | Manual first |
| TC-TC-FILT-07 | Time Card | Reset | Clearing filters restores the full list | Filters applied | Click Reset/Clear | — | Full list returns | P2 | Low | Functional |
| TC-TC-FILT-08 | Time Card | Combined with Search | Filter + Search narrow simultaneously | — | Apply a filter, then search | — | Result set narrowed by both conditions | P2 | Low | Functional |
| TC-TC-FILT-09 | Time Card | Filter persistence | Filters survive a page refresh | Filter applied | Refresh browser | — | Verify live whether filters persist or reset | P3 | Low | Manual first |
| TC-TC-FILT-10 | Time Card | Filter + pagination | Applying a filter resets to page 1 | On page 2+ | Apply a new filter | — | Results reset to page 1, not stuck on a stale later page | P2 | Medium | Functional |

## 16. Sorting Testing

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-SORT-01 | Time Card | ID column | Sorts ascending/descending | Multiple records | Click ID header twice | — | Order toggles correctly both directions | P1 | Low | Functional |
| TC-TC-SORT-02 | Time Card | Company column | Sorts alphabetically both directions | Multiple companies | Click Company header | — | Correct alphabetical order | P1 | Low | Functional |
| TC-TC-SORT-03 | Time Card | Department column | Sorts correctly despite multi-value cells | Records with multiple departments | Click Department header | — | Verify live how multi-value cells sort (e.g. by first department alphabetically) — not confirmed from source | P2 | Medium | Manual first |
| TC-TC-SORT-04 | Time Card | Date column | Sorts chronologically, not lexically | Dates spanning multiple months | Click Date header | — | True chronological order, not string order | P1 | Medium | Functional |
| TC-TC-SORT-05 | Time Card | Uploaded By column | Sorts alphabetically both directions | Multiple creators | Click Uploaded By header | — | Correct alphabetical order | P2 | Low | Functional |
| TC-TC-SORT-06 | Time Card | Status column | Groups Draft/Posted consistently | Mixed-status records | Click Status header | — | Consistent grouping both directions | P2 | Low | Functional |
| TC-TC-SORT-07 | Time Card | Default sorting | List has a sensible default order on first load | Fresh list load, no sort applied | Load list page | — | Verify live default order (likely newest-first by date/id) — not confirmed from source | P2 | Low | Manual first |
| TC-TC-SORT-08 | Time Card | Blank values | Records with a blank/system Uploaded By sort predictably | Cron-generated records (`created_by:0`) present | Sort by Uploaded By | — | Cron records (blank/"System" creator) land consistently at one end | P2 | Medium | Boundary |

## 17. Pagination Testing

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-PAGE-01 | Time Card | Page size | Changing items-per-page reloads with the new size | 60+ records | Change 20 → 50 | — | List reloads showing up to 50 rows | P1 | Medium | Functional |
| TC-TC-PAGE-02 | Time Card | Next/Previous | Move one page at a time, disable at bounds | Multiple pages | Click Next repeatedly to the last page | — | Next disables at last page; Previous disables at first page | P1 | Medium | Functional |
| TC-TC-PAGE-03 | Time Card | First/Last | Jump directly to first/last page | Multiple pages | Click First, then Last | — | Navigates correctly to each | P2 | Low | Functional |
| TC-TC-PAGE-04 | Time Card | Record count | "Page X of Y" reflects the true total record count | Known total record count | Inspect the pagination label | — | Matches actual count, accounting for the `time_card`/`time_cards` key-naming note (TC-TC-LIST-17) | P1 | Medium | Functional |
| TC-TC-PAGE-05 | Time Card | Page retention after search | Searching resets to page 1, not a stale page | On page 3+ | Enter a search term | — | Results reset to page 1 | P2 | Medium | Functional |
| TC-TC-PAGE-06 | Time Card | Page count after Add/Delete | Updates correctly after adding or deleting a record | On the last page | Add or delete a record | — | "Page X of Y" recalculates correctly | P2 | Low | Functional |
| TC-TC-PAGE-07 | Time Card | Refresh | Page number behavior on browser refresh | On page 3 | Refresh browser | — | Verify live whether page 3 or page 1 loads | P3 | Low | Manual first |
| TC-TC-PAGE-08 | Time Card | Grid view pagination | Paginates independently and consistently in Grid view | 60+ records, Grid view | Switch pages in Grid view | — | Behaves consistently with Table view pagination | P2 | Low | Functional |

## 18. Security / RBAC Testing

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-RBAC-01 | Time Card | Add button | Hidden without `canAdd` | User lacking `canAdd` | Load list page | — | Add button not rendered | P0 | High | Security |
| TC-TC-RBAC-02 | Time Card | Edit action | Disabled without `canEdit` | User lacking `canEdit` | Open row/Actions menu | — | Edit disabled | P0 | High | Security |
| TC-TC-RBAC-03 | Time Card | Delete action | Disabled without `canDelete` | User lacking `canDelete` | Open row/Actions menu | — | Delete disabled | P0 | High | Security |
| TC-TC-RBAC-04 | Time Card | View route | Blocked without `canViewById` | User lacking `canViewById` | Navigate directly to a View URL | — | `ProtectedRoute` blocks access | P0 | High | Security |
| TC-TC-RBAC-05 | Time Card | List route | Blocked without `canView` | User lacking `canView` | Navigate directly to the list URL | — | Access blocked | P0 | High | Security |
| TC-TC-RBAC-06 | Time Card | Post action | Post disabled without the `actions.post` permission | User lacking `canPost` | Reach Step 2 in Edit | — | Post control disabled/hidden | P0 | High | Security |
| TC-TC-RBAC-07 | Time Card | Server-side enforcement | Direct API bypass still blocked for Create/List/Get/Update/Delete/Post/Export/Import | User lacking permission | Directly call each of these 8 routes | — | Rejected — confirmed `isRbacResource:true` present on all 8 | P0 | High | Security |
| TC-TC-RBAC-08 | Time Card | Draft-route gap | `POST /save-as-draft` missing RBAC check | User with zero Time-Cards permissions | Call the route directly | — | Confirmed missing `isRbacResource:true` — verify live whether this wrongly succeeds | P0 | Critical | Security |
| TC-TC-RBAC-09 | Time Card | Draft-update-route gap | `PATCH /:id/save-as-draft` missing RBAC check | User with zero Time-Cards permissions | Call the route directly | — | Confirmed missing — verify live | P0 | Critical | Security |
| TC-TC-RBAC-10 | Time Card | Employee-lookup route gaps | `GET /:id/employees`, `POST /employees`, `GET /:id/employee/:employeeId`, `POST /employee/:employeeId` all missing RBAC | User with zero Time-Cards permissions | Call each of these 4 routes directly | — | Confirmed missing `isRbacResource:true` on all 4 — verify live whether employee data is exposed to an unpermissioned user | P1 | High | Security |
| TC-TC-RBAC-11 | Time Card | Cross-company access | User scoped to Company A viewing/editing a Company B record | Company B record's id | Attempt View/Edit via direct URL/API as a Company-A-scoped user | — | Verify live enforcement — no explicit company-ownership check confirmed in the service code reviewed | P1 | High | Manual first |
| TC-TC-RBAC-12 | Time Card | Parameter tampering | Changing the `:id` in a URL to an unauthorized record | Two records, restricted access to one | Change the URL's id | — | Server-side authorization should block it, not just client routing | P1 | High | Security |
| TC-TC-RBAC-13 | Time Card | XSS | Script payload in any free-text field rendered inert everywhere | Authenticated | Save `<script>alert(1)</script>` in Comments | — | Rendered as text on Grid/View, never executed | P0 | Critical | Security |
| TC-TC-RBAC-14 | Time Card | CSRF | State-changing calls require a valid session | Authenticated | Attempt Create/Update/Delete/Post without a valid session token | — | Rejected per the app's existing auth pattern | P1 | High | Security |
| TC-TC-RBAC-15 | Time Card | Session timeout | Expired token mid-form-fill | Mocked expired token | Fill form, attempt Save | — | 401 fast-fail behavior, not silent data loss | P1 | Medium | Security |
| TC-TC-RBAC-16 | Time Card | Role bypass | A Read-Only role attempts write via direct API | Read-Only user | Call Create/Update/Delete/Post directly | — | Rejected server-side | P0 | High | Security |

## 19. API Testing

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-API-01 | Time Card | Create | Valid complete payload creates a record with entries | Authenticated | `POST /` | Valid payload with 2+ entries | 2xx; record retrievable with all entries | P0 | High | Functional |
| TC-TC-API-02 | Time Card | Create | Missing `company_id`/`date`/`resource_type_id`/`department_ids` individually rejected | Authenticated | POST omitting each field in turn | — | 4xx for each | P0 | High | Negative |
| TC-TC-API-03 | Time Card | Create | Entry missing `employee_id` rejected | Authenticated | POST with an entry lacking `employee_id` | — | 4xx | P1 | High | Negative |
| TC-TC-API-04 | Time Card | Create | `status:"Posted"` with empty `entries` succeeds (confirmed gap) | Authenticated | POST with `status:"Posted"`, `entries:[]` | — | Accepted — inconsistent with `/:id/post`'s own `minItems:1` rule | P0 | Critical | Negative |
| TC-TC-API-05 | Time Card | Update | Fully-optional schema accepts a genuinely partial payload | Existing record | PUT with only `entries` | — | Accepted — confirmed no top-level `required` array on update | P1 | High | API |
| TC-TC-API-06 | Time Card | Update | `status` sent in the payload is always overwritten to Draft | Existing record, direct API | PUT with `status:"Posted"` | — | Response/reload shows `Draft`, not `Posted` | P1 | High | Negative |
| TC-TC-API-07 | Time Card | Update | Updating a Posted record is rejected | Posted record | PUT `/:id` | — | Rejected: "Cannot update a posted time card" | P0 | High | Negative |
| TC-TC-API-08 | Time Card | Draft create | `/save-as-draft` accepts a near-empty body | Authenticated | `POST /save-as-draft` `{}` | `{}` | Accepted — confirmed no schema on this route | P1 | Critical | Negative |
| TC-TC-API-09 | Time Card | Draft update | `/:id/save-as-draft` (PATCH) accepts malformed types | Existing draft | PATCH with a wrong-typed field | — | Verify live actual persisted behavior — no schema on this route | P1 | High | Manual first |
| TC-TC-API-10 | Time Card | Post | Posting requires `entries.length >= 1` | Direct API | `POST /:id/post` with empty entries | — | Rejected | P1 | High | API |
| TC-TC-API-11 | Time Card | Post | Posting an already-Posted record | Posted record | `POST /:id/post` | — | Rejected: "already posted" | P1 | Medium | API |
| TC-TC-API-12 | Time Card | Delete | Soft delete confirmed, subsequent list excludes it | Existing record | `DELETE /:id`, then `GET` list | — | Record absent from list response | P1 | Medium | API |
| TC-TC-API-13 | Time Card | Delete | Deleting a Posted record rejected | Posted record | `DELETE /:id` | — | Rejected | P0 | High | API |
| TC-TC-API-14 | Time Card | Get by id | Non-existent id returns 404 | Authenticated | `GET /:id` with a fabricated id | — | 404, not 500/empty 200 | P1 | Medium | API |
| TC-TC-API-15 | Time Card | Get by id | Soft-deleted id correctly excluded (framework-level filter) | Just soft-deleted a record | `GET /:id` | — | 404 — confirmed the framework auto-filters `is_deleted`/`deleted_at` on this entity | P1 | Medium | API |
| TC-TC-API-16 | Time Card | List | Response shape matches rendered columns; key is `time_cards` (plural) | Authenticated | `GET /` | — | Fields match `series_number`/`company_data`/`department_data`/`created_by_data`/`date`/`resource_type_data`/`status`; response key confirmed `time_cards` | P1 | Medium | API |
| TC-TC-API-17 | Time Card | Get by id | Response key is `time_card` (singular), different from list's plural key | Existing record | `GET /:id` | — | Response body's data key is `time_card`, not `time_cards` | P2 | Low | API |
| TC-TC-API-18 | Time Card | Employee lookup | `GET /:id/employees` returns the scoped employee list for prefill | Existing time card | Call the route | — | Employees scoped to the card's Company/Department | P2 | Medium | API |
| TC-TC-API-19 | Time Card | Duplicate-employee DB constraint | Two entries with the same employee + non-null project/task both set are rejected | Direct API | POST 2 entries: same employee, same non-null project_id/task_id | — | Rejected by the unique key `(time_card_id, employee_id, project_id, task_id)` | P1 | High | DB |
| TC-TC-API-20 | Time Card | Duplicate-employee DB gap | Two entries with the same employee, both project_id/task_id null, are NOT rejected (confirmed gap) | Direct API | POST 2 entries: same employee, both project_id/task_id null | — | Confirmed accepted — MySQL NULL-distinctness defeats the unique constraint in this case | P0 | Critical | Negative |

## 20. Database Validation

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-DB-01 | Time Card | ID generation | `series_number` is unique and sequential | Multiple creates | Create several records | — | Each gets a unique series number | P1 | Medium | DB |
| TC-TC-DB-02 | Time Card | Audit fields | `created_by`/`updated_by` populate with the acting user | Authenticated create/update | Create then update a record | — | Both fields reflect the correct user id | P1 | Medium | DB |
| TC-TC-DB-03 | Time Card | Cron audit fields | Cron-created records show `created_by: 0` with no guaranteed matching user row | Cron-generated record | Inspect `created_by_data` | — | Confirmed: resolves to null/absent user fields cosmetically, no FK enforced, no insert failure | P2 | Medium | DB |
| TC-TC-DB-04 | Time Card | Soft delete — parent | `is_deleted`/`deleted_by`/`deleted_at` set correctly on the `time_cards` row | Existing record | Delete it | — | All 3 columns populated | P1 | Medium | DB |
| TC-TC-DB-05 | Time Card | Soft delete — children | Entry/department child rows have no soft-delete columns at all | Record with entries, deleted | Inspect `time_card_entries`/`time_card_departments` rows | — | Confirmed: no `is_deleted` column exists on either child table; rows are orphaned, not soft-deleted | P2 | Medium | DB |
| TC-TC-DB-06 | Time Card | Duration storage | All duration fields are stored as integer minutes | Record with various durations set | Inspect the raw DB row | — | Confirmed `INT` (minutes) columns, converted to/from `HH:MM` only at the API boundary | P2 | Low | DB |
| TC-TC-DB-07 | Time Card | Unique constraint (positive) | Non-null project/task differentiates duplicate-employee rows correctly | Two entries, same employee, different non-null project_id | Insert both | — | Both accepted — differentiated by project_id per the current unique key | P2 | Medium | DB |
| TC-TC-DB-08 | Time Card | Unique constraint (gap) | Null project/task allows unlimited duplicate-employee rows | Two+ entries, same employee, both project_id/task_id null | Insert repeatedly | — | Confirmed accepted every time — no uniqueness enforced in this case | P0 | Critical | DB |
| TC-TC-DB-09 | Time Card | Department join table | `time_card_departments` correctly links one time card to its department(s) | Multi-department record | Inspect the join table | — | One row per department, correct FK to the parent time card | P2 | Low | DB |
| TC-TC-DB-10 | Time Card | Migration history | Confirm the 2026-03-03 migration's stated intent (allow duplicate employees differentiated by project/task) against actual live behavior | Any environment with this migration applied | Compare migration comment vs DB-01/DB-08 above | — | Confirms the gap: the migration's goal is only partially achieved | P2 | Medium | Regression |

## 21. Attendance Cron Integration

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-CRON-01 | Time Card | Schedule | Cron runs at its configured time and processes yesterday's data by default | Attendance data exists for yesterday | Let the cron run naturally / trigger manually with no date arg | — | Processes yesterday's Checked-Out/Auto-Checked-Out attendance | P1 | Medium | Integration |
| TC-TC-CRON-02 | Time Card | Grouping | Attendance grouped by Company+Department (not Company alone) | Multi-department attendance same day | Run the cron | — | One Time Card per Company+Department group | P1 | Medium | Integration |
| TC-TC-CRON-03 | Time Card | Existing-card reuse | Re-running the cron for a date already covered by an existing Time Card of the same company+department reuses it, rather than creating a duplicate Time Card | A Time Card already exists for company/department/date | Run the cron again for that date | — | The existing Time Card is reused (department already attached), not duplicated at the Time-Card level | P1 | Medium | Integration |
| TC-TC-CRON-04 | Time Card | Entry duplication (confirmed bug) | Re-running the cron duplicates ENTRY rows for employees already processed | Cron already processed this date once | Re-run the cron for the same date | — | Confirmed bug: broken existing-entry check means every employee is treated as new — duplicate entries/hours result | P0 | Critical | Negative |
| TC-TC-CRON-05 | Time Card | Weekend/holiday bucketing | Cron correctly buckets a weekend/holiday day's full hours into Weekend/Holiday OT | Attendance on a confirmed weekend/holiday date | Run the cron | — | `ot_weekend_holiday_duration` = full worked minutes; `work_duration`/`ot_duration` = 0 | P1 | High | Integration |
| TC-TC-CRON-06 | Time Card | Standard-day OT split | Cron correctly splits a normal day's hours at the calendar's standard work-minutes threshold | Attendance total exceeds the standard day length on a normal day | Run the cron | — | `work_duration = min(total, standard)`; excess → `ot_duration` | P1 | Medium | Integration |
| TC-TC-CRON-07 | Time Card | Night shift | Cron never populates Night Shift | Any cron-generated entry | Inspect the row | — | Confirmed always 0 | P2 | Medium | Integration |
| TC-TC-CRON-08 | Time Card | Leave bypass (confirmed gap) | An employee on Approved leave still gets a cron-generated entry | Employee on Approved leave, has attendance data that date | Run the cron | — | Confirmed: entry created regardless — no leave-check in the cron path | P1 | High | Negative |
| TC-TC-CRON-09 | Time Card | 24h-cap bypass (confirmed gap) | Cron-generated hours are never checked against the 24h cap at insert time | Employee's cron hours alone (or combined with a pre-existing manual entry) exceed 24h | Run the cron | — | Confirmed: no cap enforcement at cron-insert time | P1 | High | Negative |
| TC-TC-CRON-10 | Time Card | Comments auto-tag | Cron-generated entries carry an identifying comment | Any cron-generated entry | Inspect Comments | — | `"Auto-generated from attendance on {date}"` | P2 | Low | Functional |
| TC-TC-CRON-11 | Time Card | Manual date argument | Cron accepts an explicit date argument, not just "yesterday" | Manually invoke with a specific past date | Run with that date argument | — | Processes that date's attendance instead of yesterday's | P2 | Low | Functional |
| TC-TC-CRON-12 | Time Card | Downstream editability | A cron-generated Draft can be freely edited like any manually-created Draft | Cron-generated Draft | Open Edit, modify entries, save | — | Edits persist normally | P1 | Medium | Regression |

## 22. Performance Testing

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-PERF-01 | Time Card | List load | Load time with 1000+ records | 1000+ records seeded | Load list page, measure time | — | Within acceptable threshold | P2 | Medium | Performance |
| TC-TC-PERF-02 | Time Card | Search/Filter | Response time on a large dataset | 1000+ records | Search/filter, measure time | — | Remains responsive | P2 | Medium | Performance |
| TC-TC-PERF-03 | Time Card | Large employee list | Employee dropdown with hundreds of options in a large Department | Department with 300+ employees | Open the Employee dropdown | — | Remains responsive, no freeze | P2 | Medium | Performance |
| TC-TC-PERF-04 | Time Card | Large Time Card | Save performance with a 200+-row entry grid | 200+ rows entered | Save | — | Completes within acceptable time, no timeout | P2 | Medium | Performance |
| TC-TC-PERF-05 | Time Card | Attendance cron scale | Cron performance processing thousands of attendance records | 5000+ attendance rows for one date | Run the cron | — | Completes within an acceptable window, no timeout/crash | P2 | Medium | Performance |
| TC-TC-PERF-06 | Time Card | Calendar lookup | Weekend/holiday determination performs acceptably even with the up-to-4-query fallback chain | No specific-level calendar configured (worst case) | Save many entries across different scopes | — | No excessive latency despite the sequential fallback queries | P2 | Low | Performance |
| TC-TC-PERF-07 | Time Card | Form load | Add form's initial load time | Authenticated | Navigate to Add page, measure time | — | Within acceptable threshold | P3 | Low | Performance |
| TC-TC-PERF-08 | Time Card | Excel export | Export performance with a large filtered result set | 1000+ matching records | Trigger Excel export | — | Completes without timing out | P2 | Low | Performance |

## 23. Edge Cases

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-EDGE-01 | Time Card | 24-hour shift | A shift spanning exactly 24 hours | In 00:00, Out 23:59 (or equivalent) | Save | — | Verify live against the 24h JS cap and the BE's time-of-day regex (which technically caps at 23:59:59) | P1 | Medium | Boundary |
| TC-TC-EDGE-02 | Time Card | Overnight shift | Confirmed defect — see also GRID-15 | In 22:00, Out 06:00 | Save | — | Working Hours incorrectly computes 0 instead of 8h | P0 | Critical | Negative |
| TC-TC-EDGE-03 | Time Card | Leap year | Feb 29 on a leap year | Date = a leap-year Feb 29 | Save an entry for that date | — | Accepted, weekend/holiday determination works normally | P2 | Low | Boundary |
| TC-TC-EDGE-04 | Time Card | Month end | Last day of a month, entries spanning into the next month via Night Shift | Night Shift From 23:00 (last day) To 07:00 (1st of next month) | Save | — | Correctly rolls over via `calculateDurationFromTimeRange`; verify the entry's Date field itself (Time-Card-level, not per-entry) is handled sensibly for month-end | P2 | Medium | Boundary |
| TC-TC-EDGE-05 | Time Card | Year end | Dec 31 → Jan 1 night shift | Night Shift From 23:00 Dec 31, To 07:00 Jan 1 | Save | — | Correctly rolls over the day boundary via the From/To helper | P2 | Medium | Boundary |
| TC-TC-EDGE-06 | Time Card | Daylight Saving | A date/time affected by a DST transition (if the deployment's timezone observes DST) | DST transition date | Save an entry spanning the transition hour | — | Verify live — no DST-specific handling found in source; likely relies on plain `moment` arithmetic | P3 | Low | Manual first |
| TC-TC-EDGE-07 | Time Card | Holiday overlap | A date that is both a Saturday AND a configured holiday | Such a date exists in the seeded calendar | Save an entry | — | Verify live which takes precedence in the calendar lookup (weekend check runs first per source order) — same bucket either way (`ot_weekend_holiday_duration`), so no functional difference, but confirm no double-counting | P2 | Low | Manual first |
| TC-TC-EDGE-08 | Time Card | Weekend overlap | Two different calendar levels disagree on whether a date is a week-off | Company-level calendar says week-off, Department-level calendar says not | Save an entry for that date/department | — | The most specific applicable calendar wins per the confirmed priority chain | P1 | Medium | Functional |
| TC-TC-EDGE-09 | Time Card | Duplicate submission | The exact same Add payload submitted twice in rapid succession | Valid Add payload | Submit twice quickly (e.g. via network retry) | — | Verify live whether this creates 2 records or is otherwise deduped | P1 | High | Negative |
| TC-TC-EDGE-10 | Time Card | Browser refresh (Add Step 2) | Confirmed data-loss case, cross-referenced from §3 | Mid-entry on Add Step 2 | Refresh | — | All entry-grid work is lost | P1 | High | Negative |
| TC-TC-EDGE-11 | Time Card | Network interruption | Network drops mid-Save | Simulated offline | Fill form, go offline, Save | — | Network-error state shown, no silent data loss | P2 | Medium | Negative |
| TC-TC-EDGE-12 | Time Card | Session expiry | Session expires mid-form-fill | Mocked expired token | Fill form, attempt Save | — | 401 fast-fail behavior | P1 | Medium | Security |
| TC-TC-EDGE-13 | Time Card | Multiple users editing the same record | Two users open Edit on the same Draft simultaneously | Same record, two sessions | Both save conflicting changes | — | Verify live actual behavior — not confirmed from source (no optimistic-locking/version field found) | P2 | Medium | Manual first |
| TC-TC-EDGE-14 | Time Card | Employee terminated mid-period | An employee is deactivated after already having Time Card entries | Employee deactivated, prior entries exist | View those entries | — | Verify live whether historical entries remain visible/intact after employee deactivation | P2 | Medium | Manual first |
| TC-TC-EDGE-15 | Time Card | Zero-duration everything | Every duration field left at 0/blank for a row with only an Employee selected | Row with Employee only, all durations blank | Save | — | Accepted (no minimum-hours rule found); Total Hours = 0 | P2 | Low | Boundary |
| TC-TC-EDGE-16 | Time Card | Maximum working hours boundary | Working Hours exactly at the 24h JS cap boundary (1440 minutes) vs. 1 minute over | Row added | Enter durations totaling exactly 1440 vs 1441 minutes | `24:00` vs `24:01`-equivalent | 1440 accepted (if reachable at all given the BE's 23:59:59-capped regex); 1441-equivalent rejected | P1 | High | Boundary |

## 24. Accessibility Testing

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-A11Y-01 | Time Card | Keyboard navigation | Full Basic Details form navigable via Tab/Shift+Tab | On Add page | Tab through the form | — | Logical order matching visual layout | P2 | Medium | Accessibility |
| TC-TC-A11Y-02 | Time Card | Keyboard navigation | Entry grid rows/cells navigable via keyboard | On Step 2 | Tab/arrow through grid cells | — | Focus moves predictably cell-to-cell | P2 | Medium | Accessibility |
| TC-TC-A11Y-03 | Time Card | Labels | All inputs have proper accessible names | Add/Edit pages | Inspect each input's accessible name | — | Labels correctly associated, not just visually adjacent | P2 | Medium | Accessibility |
| TC-TC-A11Y-04 | Time Card | Focus indicator | Every interactive element shows a visible focus outline | Add/Edit/entry grid | Tab through all controls | — | No invisible-focus traps | P2 | Medium | Accessibility |
| TC-TC-A11Y-05 | Time Card | Screen reader — required fields | Required-field asterisks are announced, not just visual | Add page | Use a screen reader on Company/Department/Resource Type | — | Announced as required | P2 | Medium | Accessibility |
| TC-TC-A11Y-06 | Time Card | Error announcement | Validation errors are announced to screen readers | Trigger a required-field error | Screen reader active | — | Error announced, not just visually shown | P2 | Medium | Accessibility |
| TC-TC-A11Y-07 | Time Card | Color contrast | Draft/Posted status chips meet WCAG AA contrast | List loaded | Run a contrast check on each chip variant | — | Meets AA against its background | P3 | Low | Accessibility |
| TC-TC-A11Y-08 | Time Card | Disabled-field semantics | Project/Task/Cost Code/Cost Element's disabled state (when Assign-in-Table is checked) is exposed via ARIA | Assign in Table checked | Inspect those 4 fields | — | `aria-disabled`/`disabled` present, not purely visual | P2 | Medium | Accessibility |

## 25. Regression Testing

| Test Case ID | Module | Feature | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Severity | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TC-REG-01 | Time Card | Overnight-shift fix | If the cross-midnight Working Hours bug is fixed, existing (buggy) records with 0-hour overnight entries aren't silently altered on unrelated re-saves | Existing record with a known-0 overnight entry, pre-fix | Open Edit post-fix without touching that row, save | — | That row's stored value is not unexpectedly recalculated/changed by the fix alone | P1 | High | Regression |
| TC-TC-REG-02 | Time Card | Duplicate-employee DB fix | If the null-project/task unique-key gap is closed, legitimate duplicate-employee-differentiated-by-project rows still work | Existing valid duplicate-by-project data | Re-save those records post-fix | — | No regression for the intended (non-null) differentiation case | P1 | High | Regression |
| TC-TC-REG-03 | Time Card | Attendance-cron fix | If the duplicate-entry check is fixed, the cron still correctly creates entries for genuinely new employees | Cron fix applied | Run the cron for a new date with new employees | — | New entries still created correctly, not accidentally suppressed by an overzealous fix | P1 | High | Regression |
| TC-TC-REG-04 | Time Card | RBAC fix | Adding `isRbacResource` to the 6 gapped routes doesn't break existing legitimate calls | Routes patched | Call each as a properly-permissioned user | — | Still succeeds normally; only unpermissioned calls now get blocked | P1 | High | Regression |
| TC-TC-REG-05 | Time Card | Search | Continues to work after a record is edited | Record edited | Search the updated field's new value | — | Updated value is searchable | P1 | Medium | Regression |
| TC-TC-REG-06 | Time Card | Filters | Continue to return correct results after new records are added | New records added | Apply an existing filter | — | Correct, up-to-date results | P2 | Low | Regression |
| TC-TC-REG-07 | Time Card | Permissions | Remain correctly enforced after a role assignment changes | Role reassigned | Attempt a previously-blocked action | — | Still enforced consistently | P1 | Medium | Regression |
| TC-TC-REG-08 | Time Card | Delete | Continues to soft-delete the parent only, not hard-delete | Any future service-layer change | Delete a record post-change | — | Still recoverable via `deleted_at`, not physically removed | P1 | High | Regression |
| TC-TC-REG-09 | Time Card | Sorting/Pagination | Both continue to work together after a page-size/column change | Shared infra changed | Sort then paginate | — | Correct combined behavior | P2 | Low | Regression |
| TC-TC-REG-10 | Time Card | List/Grid consistency | Both views render consistent data after shared infra changes | Shared column-transform logic changed | Compare Table vs Grid View | — | Same records, same values in both | P2 | Low | Regression |

---

## Coverage Summary

| Section | Test Case Count |
|---|---|
| 1. List Page | 20 |
| 2. Add — Basic Details (Step 1) | 24 |
| 3. Add → Entry Step Transition | 6 |
| 4. Entry Grid — Employee & Time Fields | 30 |
| 5. Entry Grid — Calculations (Break/OT/Night Shift/Weekend-Holiday/Total) | 30 |
| 6. Add Row / Grid Interaction (Save/Post/Draft-scope workflow) | 14 |
| 7. View Time Card | 16 |
| 8. Edit Time Card | 18 |
| 9. Delete Time Card | 12 |
| 10. Draft and Posted Workflow | 20 |
| 11. Business Rule Testing | 21 |
| 12. Negative Testing | 22 |
| 13. UI Testing | 12 |
| 14. Search Testing | 10 |
| 15. Filter Testing | 10 |
| 16. Sorting Testing | 8 |
| 17. Pagination Testing | 8 |
| 18. Security / RBAC Testing | 16 |
| 19. API Testing | 20 |
| 20. Database Validation | 10 |
| 21. Attendance Cron Integration | 12 |
| 22. Performance Testing | 8 |
| 23. Edge Cases | 16 |
| 24. Accessibility Testing | 8 |
| 25. Regression Testing | 10 |
| **Total** | **363** |

**Threshold check against the request:** 363 test cases, well over the 250+ target, spanning Functional,
Validation, UI, Negative, Integration, Security, Performance, Boundary, DB, and Regression types as
requested, plus exploratory ("Manual first") scenarios explicitly flagged wherever source alone couldn't
confirm live behavior.

**Confirmed-bug density**: this module has an unusually high concentration of real, source-confirmed
defects for its size — the cross-midnight Working Hours calculation (Critical), the attendance-cron
duplicate-entry check (Critical), the null-project/task duplicate-employee DB gap (Critical), the 6 RBAC
gaps including both draft routes, and the Update-can-never-Post / Create-can-skip-Post's-entries-rule
inconsistency are all strong candidates for immediate developer attention ahead of broader regression
coverage.

**"Manual first" cases** are concentrated where the answer depends on this account's actual seeded
calendar/master data (day-of-week casing, FK-existence checks on Project/Task/Cost Code/Cost Element,
concurrent-edit behavior, DST handling) rather than on anything resolvable from source code alone — these
must be confirmed live once before being automated, so a guess doesn't get baked into a suite.
