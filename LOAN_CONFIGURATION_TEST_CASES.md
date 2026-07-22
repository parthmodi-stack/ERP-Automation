# Loan Configuration — Test Case Suite

Module path: HRMS → Company Master Policy → Loan Configuration (`/dashboard/hrms/loan-configuration`)

Source verified against `erpforce-hrms-fe/src/views/loan-configuration/` (list, add, edit, view,
`form/form.tsx`, `utils/validator.tsx`, `utils/default-data.tsx`, `routes/routes.tsx`) and
`erpforce-be/modules/hrms/lib/loan-master/` (routes, validators, service, migrations) before
writing any case below. Backend module name is `loan-master`; frontend calls it "Loan
Configuration" — both refer to the same feature. Every "Expected Result" reflects confirmed
source behavior, not assumed UI conventions; where source could not confirm a behavior, the case
is explicitly marked **Manual first** rather than silently guessed.

## Corrections to the requested module description (read before using these tables)

- **List column is "Loan Type," not "Category."** It maps to `loan_category` and its dropdown
  options are a static frontend enum (Personal/Home/Car/Education/Business) — not API-fetched
  like Location/Departments/Grades.
- **Interest Type has zero validation anywhere** — no Yup rule on the frontend, and the field
  isn't even present in any backend validator schema. It can be left blank and the record still
  saves.
- **Only four fields are truly required end-to-end on Create**: Company (frontend only — backend
  makes it optional), Loan Name, Loan Category, and whichever Max Loan Amount sub-field is active.
  Max Tenure, Interest Rate, Min Service Duration, Min CTC Required, and Max Active Loans Allowed
  all carry `min(0)` only, never `.required()`, on the frontend; the backend doesn't bound most of
  them at all.
- **Confirmed cross-stack bug**: the frontend's Yup conditional-required rule for the Late Payment
  Penalty "Flat Amount" value checks a field key, `late_payment_penalty_value`, that does not
  exist anywhere in the form's actual field set — the real field is `late_penalty_value`
  (`form.tsx:313` vs `validator.tsx:38`). This means the "required when Flat Amount selected"
  validation never fires. The backend's own `late_penalty_value` has no bound either, so a blank
  penalty amount can be saved end-to-end with no validation at any layer.
- **There is no `max_loan_amount_percentage` field in the backend** — only `max_loan_amount_value`,
  reused for both the Fixed and Percentage types — but this is confirmed NOT a data-loss bug: the
  frontend's own payload mapper (`utils/default-data.tsx:199`, `loanConfigurationPayload`)
  explicitly sends `max_loan_amount_type==='fixed' ? max_loan_amount_value : max_loan_amount_percentage`
  under that one shared key, and the read-back side (`edit-loan-configuration.tsx`'s "MAX LOAN
  AMOUNT FIX"/"LATE PAYMENT PENALTY FIX" transforms) correctly re-splits it back into the two FE
  fields based on the saved `*_type`. The same mapping applies to Late Payment Penalty. Only the
  Flat-Amount **required-validation** bug above is real; the value round-trip itself is not buggy.
- **`company_id` is optional in every backend validator** (create/update/draft), despite the
  frontend always marking Company as required with an asterisk — same class of frontend/backend
  gap seen in the Leave Policy Master module.
- **Loan Name uniqueness is enforced globally, not per company** (`assertUniqueEntry` has no
  `company_id` filter) — two different companies cannot both have a Loan Configuration named
  "Home Loan."
- **`loan_category` is required only on Create**, not Update or Draft, and a 2026-05-11 migration
  made the DB column nullable — so an existing record's Loan Category can be nulled out via Update
  even though the Add form always shows it as required.
- **Status vs Draft are two independent flags.** `status` is a plain Active(1)/Inactive(0)
  boolean; `is_draft` is a separate boolean that, when true, overrides the list's status chip to
  show "Draft" regardless of the underlying `status` value. There is no "Published" state and no
  approval workflow anywhere in this module.
- **Delete is a soft delete** with no referential check against existing `loan_requests` rows —
  deleting a Loan Configuration does not block or cascade to Loan Requests already built on it,
  and those requests' join does not filter on `is_deleted`, so they keep surfacing the deleted
  configuration's data.
- **The list row Delete-disable condition checks `status === 'Completed'`**, a string value the
  numeric `status` field can never hold in this module — very likely dead/copy-pasted logic from
  a different module.
- **`PATCH /:id/status` is the only Loan Master route missing `isRbacResource: true`** — every
  other route (Create/List/Get/Update/Delete) has it set.
- **The `/draft` POST route's validator is imported but never wired to the route's body schema** —
  that endpoint accepts payloads with no schema-level validation at all.
- **The list's `enablePages={false}` is a non-issue, not a discrepancy**: it's the shared
  `ListingComponent`'s own default (`components/listing/listing.tsx:42`) — Leave Policy Master
  doesn't even pass it explicitly and its pagination bar works fine, so the prop controls
  something unrelated to row pagination (likely a dynamic-page-template feature).
- **A confirmed rendering bug independent of the above**: `view-loan-configuration.tsx:409`
  reads `data?.[LOCATION_DATA].name` with NO optional-chaining before `.name`, unlike every other
  field on that page — viewing any record saved with Location left blank should throw and crash
  the View page's render. This is now covered by an automated regression case (see the Playwright
  suite's `TC-LOAN-VIEW-BUG-01`).
- **Eligible Departments/Grades have no confirmed company-scoping filter** in the frontend module
  (unlike Location, which explicitly filters on `company_id`) — whether selecting a Company
  restricts which Departments/Grades are selectable is unconfirmed and must be checked live.

---

## 1. List Page

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-LIST-01 | Loan Configuration | Page Load | List loads at the correct URL | Logged in, `canView` | Navigate to `/dashboard/hrms/loan-configuration` | — | URL matches; table renders | P0 | High | Functional | Yes |
| TC-LOAN-LIST-02 | Loan Configuration | Columns | Table shows the confirmed column set | List loaded | Inspect header row | — | Columns are ID, Loan Name, Loan Type, Tenure, Company, Status | P0 | Medium | UI | Yes |
| TC-LOAN-LIST-03 | Loan Configuration | Loading state | Loading indicator shows during fetch | Throttled network | Load list page | — | Loader visible until data resolves | P2 | Low | UI | Yes |
| TC-LOAN-LIST-04 | Loan Configuration | Empty state | Zero records shows the shared empty state | No records exist | Load list page | — | "No Data" component renders, not a blank table | P1 | Medium | UI | Yes |
| TC-LOAN-LIST-05 | Loan Configuration | Status chip | Active/Inactive/Draft chips render distinctly | Mixed-status records exist | Load list page | — | Each state has visually distinct chip styling | P1 | Medium | UI | Yes |
| TC-LOAN-LIST-06 | Loan Configuration | Data integrity | Row with blank Loan Name/Company renders without breaking layout | Record with blank name/company exists (confirmed present live) | Load list page | — | Row renders cleanly, no layout break | P2 | Medium | UI | Yes |
| TC-LOAN-LIST-07 | Loan Configuration | Placeholder | Row with no Loan Type shows "-" placeholder | Record with no `loan_category` exists | Load list page | — | Cell shows "-", not blank/undefined | P2 | Low | UI | Yes |
| TC-LOAN-LIST-08 | Loan Configuration | Navigation | Clicking a row opens its View page | Record exists | Click a row | — | Navigates to `/:id/view-loan-configuration` | P0 | High | Functional | Yes |
| TC-LOAN-LIST-09 | Loan Configuration | Row menu | "···" menu offers Edit/Delete per permissions | `canEdit`/`canDelete` true | Open row menu | — | Edit and Delete options present and enabled | P1 | Medium | Functional | Yes |
| TC-LOAN-LIST-10 | Loan Configuration | Add button | Add button visible only when `canAdd` is true | User without `canAdd` | Load list page | — | Add button not rendered (`showAddButton={canAdd}`) | P0 | High | RBAC | Yes |
| TC-LOAN-LIST-11 | Loan Configuration | Selection | Row checkbox selects an individual row | Records exist | Click a row checkbox | — | Row marked selected | P2 | Low | UI | Yes |
| TC-LOAN-LIST-12 | Loan Configuration | Selection | Header checkbox selects all rows on current page | Records exist | Click header checkbox | — | All visible rows selected | P2 | Low | UI | Yes |
| TC-LOAN-LIST-13 | Loan Configuration | View toggle | Table View and Grid View show the same record set | Records exist | Switch Table → Grid | — | Same records, consistent field values in both views | P1 | Medium | Functional | Yes |
| TC-LOAN-LIST-14 | Loan Configuration | View toggle | Kanban/Calendar/Gantt views are absent | List loaded | Open view switcher | — | Only Table/Grid options present (`disabledViews` confirmed) | P2 | Low | UI | Yes |
| TC-LOAN-LIST-15 | Loan Configuration | Refresh | View mode persistence across refresh | On Grid View | Refresh browser | — | Verify live whether Grid or default Table View reloads | P3 | Low | UI | Manual first |
| TC-LOAN-LIST-16 | Loan Configuration | Accessibility | Row actions reachable via keyboard | List loaded | Tab to a row's action menu, activate with Enter/Space | — | Menu opens and is operable without a mouse | P2 | Medium | Accessibility | Yes |
| TC-LOAN-LIST-17 | Loan Configuration | Responsive | List remains usable on a narrow viewport | Records exist | Resize to tablet/mobile width | — | Columns scroll/prioritize without breaking alignment | P2 | Medium | Responsive | Yes |
| TC-LOAN-LIST-18 | Loan Configuration | Data refresh | List auto-refreshes after Add/Edit/Delete | Just completed an Add | Return to list | — | New/updated/removed row reflects without manual refresh | P0 | High | Functional | Yes |

## 2. Basic Details — Field Validation

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-FLD-01 | Loan Configuration | Company | Company required on Add | On Add page | Leave Company empty, click Save | — | Inline required error; blocked | P0 | High | Validation | Yes |
| TC-LOAN-FLD-02 | Loan Configuration | Company | `company_id` omitted via direct API bypass | Direct API call | POST without `company_id` | Otherwise valid payload | Backend accepts (confirmed optional in all validators) — real FE/BE gap | P1 | Medium | Negative | Yes |
| TC-LOAN-FLD-03 | Loan Configuration | Loan Name | Loan Name required on Add | On Add page | Leave Loan Name empty, click Save | — | Inline required error; blocked | P0 | High | Validation | Yes |
| TC-LOAN-FLD-04 | Loan Configuration | Loan Name | Duplicate name across two different companies rejected | Company A has "Home Loan" | Create Company B "Home Loan" | `loan_name: "Home Loan"` | Rejected — uniqueness is global, not per-company | P1 | High | Negative | Yes |
| TC-LOAN-FLD-05 | Loan Configuration | Loan Name | Duplicate name within same company rejected | Company A has "Home Loan" | Create another Company A "Home Loan" | `loan_name: "Home Loan"` | Rejected | P1 | High | Negative | Yes |
| TC-LOAN-FLD-06 | Loan Configuration | Loan Name | Leading/trailing whitespace | On Add page | Enter `"  Home Loan  "`, Save | — | No `.trim()` confirmed — verify live whether it's trimmed or saved verbatim | P2 | Low | Boundary | Manual first |
| TC-LOAN-FLD-07 | Loan Configuration | Loan Name | Maximum length | On Add page | Enter a 500+ char name, Save | — | No length bound found in FE/BE source — verify live | P3 | Low | Boundary | Manual first |
| TC-LOAN-FLD-08 | Loan Configuration | Loan Name | HTML/script-like content | On Add page | Enter `<script>alert(1)</script>`, Save | — | Accepted and stored; must render as inert text everywhere (List/View) | P1 | High | Negative | Yes |
| TC-LOAN-FLD-09 | Loan Configuration | Loan Category | Required on Create (FE + BE) | On Add page | Leave Loan Type empty, Save | — | Inline error; blocked (confirmed `required: ['loan_category']` on create) | P0 | High | Validation | Yes |
| TC-LOAN-FLD-10 | Loan Configuration | Loan Category | Omitted on Update via direct API | Existing record, direct API | PUT without `loan_category` | — | Accepted (update validator has no inner required fields) — confirmed gap | P1 | Medium | Negative | Yes |
| TC-LOAN-FLD-11 | Loan Configuration | Loan Category | Omitted on Draft | On Add page | Save To Draft with Loan Type empty | — | Accepted (draft validator has zero required fields) | P1 | Medium | Negative | Yes |
| TC-LOAN-FLD-12 | Loan Configuration | Loan Category | Set to null via direct Update API | Existing record, direct API | PUT `loan_category: null` | — | Accepted — DB column is nullable and update validator doesn't require it | P1 | Medium | Negative | Yes |
| TC-LOAN-FLD-13 | Loan Configuration | Loan Category | Value outside the 5 static FE options via direct API | Direct API call | POST `loan_category: "NotARealCategory"` | — | Backend field is a plain string with no enum — accepted; verify live | P2 | Medium | Negative | Manual first |
| TC-LOAN-FLD-14 | Loan Configuration | Status | Defaults to Active on new Add page | On Add page | Observe Status toggle on load | — | Toggle shows Active by default | P1 | Low | Functional | Yes |
| TC-LOAN-FLD-15 | Loan Configuration | Status | Toggling to Inactive persists | On Add page | Toggle Status off, Save | — | Record saved with Inactive status | P0 | Medium | Functional | Yes |
| TC-LOAN-FLD-16 | Loan Configuration | Description | Optional — blank saves successfully | On Add page | Leave Description empty, Save | — | Record saved, no validation error | P2 | Low | Validation | Yes |
| TC-LOAN-FLD-17 | Loan Configuration | Description | Multi-line text preserved on reload | On Add page | Enter multi-line text, Save, reopen | Multi-line string | Line breaks preserved | P2 | Low | Functional | Yes |
| TC-LOAN-FLD-18 | Loan Configuration | Description | Very long text | On Add page | Enter 2000+ char description, Save | — | No bound found — verify live | P3 | Low | Boundary | Manual first |
| TC-LOAN-FLD-19 | Loan Configuration | ID | Read-only, auto-generated | On Add/Edit page | Inspect ID field | — | Disabled input; not editable; backend generates the series number | P1 | Low | UI | Yes |
| TC-LOAN-FLD-20 | Loan Configuration | Loan Name | Copy/paste works correctly | On Add page | Copy text externally, paste into Loan Name | — | Pasted value renders correctly, no truncation/corruption | P3 | Low | UI | Yes |

## 3. Loan Limits

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-LIM-01 | Loan Configuration | Max Loan Amount | Defaults to "Fixed Amount" on Add | On Add page | Observe radio on load | — | "Fixed Amount" selected by default | P1 | Low | Functional | Yes |
| TC-LOAN-LIM-02 | Loan Configuration | Max Loan Amount | Selecting "% of CTC" enables Percentage, disables Fixed | On Add page | Click "% of CTC" | — | Percentage input enabled; Fixed Amount input disabled | P1 | Medium | Functional | Yes |
| TC-LOAN-LIM-03 | Loan Configuration | Max Loan Amount | Fixed Amount required when Fixed selected | Fixed type selected | Leave value blank, Save | — | Inline required error; blocked | P0 | High | Validation | Yes |
| TC-LOAN-LIM-04 | Loan Configuration | Max Loan Amount | Percentage required when % of CTC selected | Percentage type selected | Leave value blank, Save | — | Inline required error; blocked | P0 | High | Validation | Yes |
| TC-LOAN-LIM-05 | Loan Configuration | Max Loan Amount | Percentage accepts 0 (min boundary) | Percentage type selected | Enter 0, Save | `0` | Accepted | P2 | Low | Boundary | Yes |
| TC-LOAN-LIM-06 | Loan Configuration | Max Loan Amount | Percentage max boundary 100 vs 100.01 | Percentage type selected | Enter 100, Save; then enter 100.01 | `100`, `100.01` | 100 accepted; 100.01 rejected (Yup `max(100)`) | P1 | Medium | Boundary | Yes |
| TC-LOAN-LIM-07 | Loan Configuration | Max Loan Amount | Fixed Amount accepts decimal currency values | Fixed type selected | Enter 15000.50, Save | `15000.50` | Accepted, precision preserved | P2 | Low | Boundary | Yes |
| TC-LOAN-LIM-08 | Loan Configuration | Max Loan Amount | Fixed Amount rejects negative values | Fixed type selected | Enter -100, Save | `-100` | Blocked by `min(0)` | P1 | Medium | Negative | Yes |
| TC-LOAN-LIM-09 | Loan Configuration | Max Loan Amount | Switching Fixed↔Percentage value retention | Fixed value entered | Switch to Percentage, switch back | — | Verify live whether Fixed value is retained or cleared — not confirmed from source | P2 | Low | Functional | Manual first |
| TC-LOAN-LIM-10 | Loan Configuration | Max Loan Amount | Percentage payload mapping to backend | Percentage type + value set | Save, inspect network payload | — | RESOLVED from source (`utils/default-data.tsx:199`, `loanConfigurationPayload`): the FE payload mapper explicitly sends `max_loan_amount_type==='fixed' ? max_loan_amount_value : max_loan_amount_percentage` into the backend's sole `max_loan_amount_value` key — no data loss, confirmed not a gap | P2 | Low | Functional | Yes |
| TC-LOAN-LIM-11 | Loan Configuration | Max Loan Amount | DB default `'Fixed'` (capitalized) vs enum `'fixed'`/`'percentage'` | Any record relying on column default | Inspect a record never given an explicit `max_loan_amount_type` | — | Verify whether this path is ever reachable; if so, a later Update could fail its own enum check | P2 | Medium | DB | Manual first |
| TC-LOAN-LIM-12 | Loan Configuration | Max Tenure | No required rule — blank accepted | On Add page | Leave Max Tenure blank, Save | — | Record saves successfully | P2 | Low | Validation | Yes |
| TC-LOAN-LIM-13 | Loan Configuration | Max Tenure | Rejects negative values | On Add page | Enter -5, Save | `-5` | Blocked by `min(0)` | P1 | Medium | Negative | Yes |
| TC-LOAN-LIM-14 | Loan Configuration | Max Tenure | Accepts 0 | On Add page | Enter 0, Save | `0` | Accepted | P2 | Low | Boundary | Yes |
| TC-LOAN-LIM-15 | Loan Configuration | Max Tenure | Decimal value (e.g. 12.5 months) | On Add page | Enter 12.5, Save | `12.5` | No integer-only rule confirmed — verify live truncation/rejection | P2 | Low | Boundary | Manual first |
| TC-LOAN-LIM-16 | Loan Configuration | Interest Type | Can be left unselected and form still saves | On Add page | Leave Interest Type blank, Save | — | No Yup rule exists — record saves | P2 | Low | Validation | Yes |
| TC-LOAN-LIM-17 | Loan Configuration | Interest Type | Not present in any backend schema | Direct API inspection | Omit `interest_type`, Save | — | Verify live whether it's silently dropped, null, or errors downstream (Loan Requests joins read `interest_rate`/category) | P2 | Medium | Negative | Manual first |
| TC-LOAN-LIM-18 | Loan Configuration | Interest Rate | Boundary — 0 accepted (inclusive) | On Add page | Enter 0, Save | `0` | Accepted | P2 | Low | Boundary | Yes |
| TC-LOAN-LIM-19 | Loan Configuration | Interest Rate | Boundary — 100 accepted, 100.01 rejected | On Add page | Enter 100, then 100.01 | `100`, `100.01` | 100 accepted at FE/DB; 100.01 rejected by Yup `max(100)` and DB `CHECK` | P1 | High | Boundary | Yes |
| TC-LOAN-LIM-20 | Loan Configuration | Interest Rate | Rejects negative values | On Add page | Enter -1, Save | `-1` | Blocked by `min(0)` | P1 | Medium | Negative | Yes |
| TC-LOAN-LIM-21 | Loan Configuration | Interest Rate | Precision beyond DECIMAL(5,2) | On Add page | Enter 10.555, Save | `10.555` | Verify live rounding/truncation behavior against DB column type | P3 | Low | Boundary | Manual first |
| TC-LOAN-LIM-22 | Loan Configuration | Late Payment Penalty | Defaults to "Flat Amount" on Add | On Add page | Observe radio on load | — | "Flat Amount" selected by default | P1 | Low | Functional | Yes |
| TC-LOAN-LIM-23 | Loan Configuration | Late Payment Penalty | Confirmed bug — required rule never fires for Flat Amount | Flat Amount selected | Leave value blank, click Save | — | No inline error appears (Yup checks non-existent key `late_payment_penalty_value`); Save proceeds despite the field appearing required | P0 | Critical | Negative | Yes |
| TC-LOAN-LIM-24 | Loan Configuration | Late Payment Penalty | End-to-end blank penalty saves successfully | Flat Amount selected, value blank | Save | — | Confirmed: backend `late_penalty_value` has no bound either — record persists with a blank/undefined penalty | P1 | High | Negative | Yes |
| TC-LOAN-LIM-25 | Loan Configuration | Late Payment Penalty | Percentage sub-field max boundary | "In %" selected | Enter 100, then 100.01 | `100`, `100.01` | 100 accepted; 100.01 rejected by Yup `max(100)` | P2 | Medium | Boundary | Yes |
| TC-LOAN-LIM-26 | Loan Configuration | Late Payment Penalty | Backend enum allows `'none'`, unreachable via UI | Direct API call | POST `late_penalty_type: 'none'` | `none` | Accepted server-side despite no UI control producing this value — verify what Edit/View render for such a record | P2 | Medium | Negative | Manual first |

## 4. Repayment Configuration

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-REPAY-01 | Loan Configuration | Auto Deduct EMIs | Default state on Add | On Add page | Observe toggle on load | — | Verify live default (on/off) — not confirmed from source | P2 | Low | Functional | Manual first |
| TC-LOAN-REPAY-02 | Loan Configuration | Auto Deduct EMIs | Enabling persists on Save | On Add page | Enable toggle, Save, reopen | — | Toggle remains enabled after reload | P1 | Medium | Functional | Yes |
| TC-LOAN-REPAY-03 | Loan Configuration | Allow Pre-Closure | Disabling after enabled persists on Edit | Toggle enabled on an existing record | Open Edit, disable, Save | — | Toggle remains disabled after reload | P1 | Medium | Functional | Yes |
| TC-LOAN-REPAY-04 | Loan Configuration | Both toggles | No validation exists — any combination saves | On Add page | Set both true, both false, and mixed; Save each | — | All combinations save successfully (no Yup rule found) | P2 | Low | Validation | Yes |
| TC-LOAN-REPAY-05 | Loan Configuration | Both toggles | Independent — toggling one doesn't affect the other | On Add page | Enable Auto Deduct EMIs only | — | Allow Pre-Closure remains unaffected (no dependency wiring found) | P2 | Low | Functional | Yes |
| TC-LOAN-REPAY-06 | Loan Configuration | View mode | Renders as static "Enabled"/"Disabled" labels | Existing record | Open View | — | Read-only labels shown, matching saved boolean state, no interactive toggle | P1 | Medium | UI | Yes |
| TC-LOAN-REPAY-07 | Loan Configuration | Backend | Both booleans accepted via API with no schema constraint | Direct API call | POST/PUT with both fields set | `true`/`false` | Verify live — not explicitly confirmed in backend validator review | P3 | Low | API | Manual first |
| TC-LOAN-REPAY-08 | Loan Configuration | UI robustness | Rapid double-click doesn't leave a stuck visual state | On Add page | Double-click a toggle rapidly | — | Toggle settles into one consistent, correct state | P3 | Low | UI | Yes |

## 5. Eligibility Criteria

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-ELIG-01 | Loan Configuration | Limited toggle | Default state on Add | On Add page | Observe toggle on load | — | Verify live default — not confirmed from source | P2 | Low | Functional | Manual first |
| TC-LOAN-ELIG-02 | Loan Configuration | Limited toggle | Whether it gates the Departments/Grades fields | On Add page | Toggle "Limited" on/off, observe Departments/Grades | — | Verify live whether these fields are actually conditionally gated — no wiring confirmed from source | P2 | Medium | Dependency | Manual first |
| TC-LOAN-ELIG-03 | Loan Configuration | Limited toggle | No validation rule — either state saves | On Add page | Save with toggle on, then off | — | Both save successfully | P2 | Low | Validation | Yes |
| TC-LOAN-ELIG-04 | Loan Configuration | Limited toggle | Disabled only in View mode | Existing record | Open Edit vs View | — | Interactive in Edit, disabled in View | P2 | Low | UI | Yes |
| TC-LOAN-ELIG-05 | Loan Configuration | Min Service Duration | Accepts 0 | On Add page | Enter 0, Save | `0` | Accepted | P2 | Low | Boundary | Yes |
| TC-LOAN-ELIG-06 | Loan Configuration | Min Service Duration | Rejects negative values | On Add page | Enter -3, Save | `-3` | Blocked by `min(0)` | P1 | Medium | Negative | Yes |
| TC-LOAN-ELIG-07 | Loan Configuration | Min Service Duration | No required rule — blank saves | On Add page | Leave blank, Save | — | Accepted | P2 | Low | Validation | Yes |
| TC-LOAN-ELIG-08 | Loan Configuration | Min Service Duration | Hint text renders without overlap | On Add page | Resize to narrow viewport | — | "In Months since DOJ" hint doesn't clip/overlap the field | P3 | Low | Responsive | Yes |
| TC-LOAN-ELIG-09 | Loan Configuration | Eligible Departments | Loads real department master data | On Add page | Open Departments dropdown | — | Options populated from `departmentsData` API prop | P1 | Medium | Functional | Yes |
| TC-LOAN-ELIG-10 | Loan Configuration | Eligible Departments | Company-scoping unconfirmed | Company selected | Select a Company, open Departments dropdown | — | Verify live whether options are restricted to that Company or show all companies' departments — no `filterFields` wiring confirmed | P1 | High | Dependency | Manual first |
| TC-LOAN-ELIG-11 | Loan Configuration | Eligible Grades | Company-scoping unconfirmed | Company selected | Select a Company, open Grades dropdown | — | Same open question as ELIG-10 | P1 | High | Dependency | Manual first |
| TC-LOAN-ELIG-12 | Loan Configuration | Eligible Departments | Multiple selections persist on Save | On Add page | Select 3+ departments, Save, reopen | — | All selected departments persist | P1 | Medium | Functional | Yes |
| TC-LOAN-ELIG-13 | Loan Configuration | Eligible Departments | Deselecting persists the removal | Record with departments selected | Open Edit, deselect one, Save | — | Removed department no longer listed on reopen | P1 | Medium | Functional | Yes |
| TC-LOAN-ELIG-14 | Loan Configuration | Departments/Grades | No required rule on either layer | On Add page | Leave both empty, Save | — | Record saves successfully | P2 | Low | Validation | Yes |
| TC-LOAN-ELIG-15 | Loan Configuration | Departments/Grades | Cross-company FK not validated by backend | Direct API call | POST a department/grade id belonging to a different company than `company_id` | Mismatched ids | Accepted — confirmed no FK validation in service.js; real data-integrity gap | P1 | High | Negative | Yes |
| TC-LOAN-ELIG-16 | Loan Configuration | Min CTC Required | Accepts 0 | On Add page | Enter 0, Save | `0` | Accepted | P2 | Low | Boundary | Yes |
| TC-LOAN-ELIG-17 | Loan Configuration | Min CTC Required | Rejects negative on FE; backend unbounded | On Add page + direct API | Enter -1000 in UI; also POST -1000 directly | `-1000` | FE blocks via `min(0)`; verify live whether direct API bypass is accepted server-side | P1 | Medium | Negative | Manual first |
| TC-LOAN-ELIG-18 | Loan Configuration | Min CTC Required | No required rule on either layer | On Add page | Leave blank, Save | — | Accepted | P2 | Low | Validation | Yes |
| TC-LOAN-ELIG-19 | Loan Configuration | Max Active Loans Allowed | Accepts 0 | On Add page | Enter 0, Save | `0` | Accepted — verify this is an intended business value, not just a passing form value | P2 | Medium | Boundary | Yes |
| TC-LOAN-ELIG-20 | Loan Configuration | Max Active Loans Allowed | Rejects negative values | On Add page | Enter -2, Save | `-2` | Blocked by `min(0)` | P1 | Medium | Negative | Yes |
| TC-LOAN-ELIG-21 | Loan Configuration | Max Active Loans Allowed | Decimal value (e.g. 2.5) | On Add page | Enter 2.5, Save | `2.5` | No integer-only rule confirmed — verify live | P3 | Low | Boundary | Manual first |
| TC-LOAN-ELIG-22 | Loan Configuration | Remarks | Optional, preserves multi-line/long text | On Add page | Enter multi-line remark, Save, reopen | — | Line breaks and full text preserved | P2 | Low | Functional | Yes |
| TC-LOAN-ELIG-23 | Loan Configuration | Remarks | HTML/script-like input rendered as plain text | On Add page | Enter `<img src=x onerror=alert(1)>`, Save, View | — | Stored and rendered inert on View, not executed | P1 | High | Negative | Yes |

## 6. Classification (Location)

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-CLASS-01 | Loan Configuration | Location dropdown | Disabled until Company selected | On Add page, Company empty | Attempt to open Location dropdown | — | Disabled (`DynamicDependentField` pattern, same as Leave Policy Master) | P0 | High | Dependency | Yes |
| TC-LOAN-CLASS-02 | Loan Configuration | Location dropdown | Enables and loads options scoped to Company | On Add page | Select Company A | — | Location enabled; options filtered to Company A | P0 | High | Dependency | Yes |
| TC-LOAN-CLASS-03 | Loan Configuration | Location dropdown | Changing Company clears previously selected Location | Company A + Location A1 selected | Change Company to B | — | Location resets to empty | P0 | High | Dependency | Yes |
| TC-LOAN-CLASS-04 | Loan Configuration | Location | No required rule — blank saves | On Add page | Leave Location blank, Save | — | Accepted | P1 | Low | Validation | Yes |
| TC-LOAN-CLASS-05 | Loan Configuration | Location dropdown | Empty result set for a Company with zero Locations | Company with 0 Locations | Select that Company, open Location dropdown | — | Empty/no-data state, not an error | P2 | Low | Boundary | Yes |
| TC-LOAN-CLASS-06 | Loan Configuration | Location dropdown | Search filters the already company-scoped list | Company selected | Type a partial location name | — | Matching options filtered within that Company's set only | P2 | Low | Functional | Yes |
| TC-LOAN-CLASS-07 | Loan Configuration | Location | Pre-populates correctly on Edit | Record saved with Location A1 | Open Edit | — | Location A1 pre-selected, scoped to saved Company | P0 | High | Functional | Yes |
| TC-LOAN-CLASS-08 | Loan Configuration | Location | Renders as plain read-only value on View | Existing record | Open View | — | Location name shown as static text | P1 | Medium | UI | Yes |

## 7. Save / Save as Draft / Discard

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-SAVE-01 | Loan Configuration | Save | Successful Save redirects to list with new row visible | On Add page, valid data | Fill mandatory fields, Save | — | Redirected to list; new row shows generated ID | P0 | High | Functional | Yes |
| TC-LOAN-SAVE-02 | Loan Configuration | Save | Button shows loading/disabled state in-flight | On Add page | Click Save | — | Button disabled/loader shown until response | P2 | Medium | UI | Yes |
| TC-LOAN-SAVE-03 | Loan Configuration | Save | Rapid double-click doesn't create duplicates | On Add page, valid data | Double-click Save quickly | — | Exactly one record created | P1 | High | Negative | Yes |
| TC-LOAN-SAVE-04 | Loan Configuration | Save | Missing required field blocks Save | On Add page | Omit Loan Name, click Save | — | Inline error; no record created, no navigation | P0 | High | Validation | Yes |
| TC-LOAN-SAVE-05 | Loan Configuration | Save | Server 500 error handled gracefully | Mocked 500 on POST | Fill valid form, Save | — | Error toast shown; stays on form, no false success | P1 | High | Negative | Yes |
| TC-LOAN-SAVE-06 | Loan Configuration | Save | Duplicate Loan Name shows a distinct conflict error | Existing "Home Loan" record | Save another "Home Loan" | — | Clear duplicate/conflict error, distinguishable from generic 500 | P1 | Medium | Negative | Yes |
| TC-LOAN-SAVE-07 | Loan Configuration | Save | Network drop mid-Save | Simulated offline | Fill form, go offline, Save | — | Network-error state shown, no silent data loss | P2 | Medium | Negative | Yes |
| TC-LOAN-SAVE-08 | Loan Configuration | Save | Session expiry mid-Save (401) | Mocked 401 | Fill form, Save | — | Existing 401/403 fast-fail behavior surfaces as auth failure | P1 | Medium | Negative | Yes |
| TC-LOAN-SAVE-09 | Loan Configuration | Save To Draft | Persists with required-looking fields blank | On Add page | Fill only Loan Name, click Save To Draft | — | Accepted — draft validator has zero required fields | P0 | High | Functional | Yes |
| TC-LOAN-SAVE-10 | Loan Configuration | Save To Draft | Status chip shows "Draft" regardless of Active/Inactive toggle | Saved as Draft with Status=Active | Load list | — | Chip shows "Draft," not "Active" (confirmed `is_draft` overrides) | P0 | High | Functional | Yes |
| TC-LOAN-SAVE-11 | Loan Configuration | Save To Draft | Re-saving an existing Draft as Draft again | Existing Draft | Open Edit, change a field, Save To Draft | — | Update persists; record remains Draft | P1 | Medium | Functional | Yes |
| TC-LOAN-SAVE-12 | Loan Configuration | Final Save | Converting Draft to full record | Existing Draft | Open Edit, click real Save | — | `is_draft` becomes false; chip shows Active/Inactive instead of Draft | P0 | High | Functional | Yes |
| TC-LOAN-SAVE-13 | Loan Configuration | Draft path | Loan Category omitted accepted despite Add's required asterisk | On Add page | Save To Draft without Loan Type | — | Accepted — confirmed cross-path inconsistency | P1 | Medium | Negative | Yes |
| TC-LOAN-SAVE-14 | Loan Configuration | Discard | Discard on Add with fields filled creates nothing | On Add page, fields filled | Click Discard | — | Redirected to list; no record created | P0 | High | Functional | Yes |
| TC-LOAN-SAVE-15 | Loan Configuration | Discard | Discard on Edit leaves original record untouched | On Edit page, field changed | Click Discard | — | Reopening Edit shows original, unchanged value | P0 | High | Functional | Yes |
| TC-LOAN-SAVE-16 | Loan Configuration | Discard | Confirmation dialog before discarding unsaved changes | On Add/Edit with unsaved changes | Click Discard | — | Verify live whether a confirm dialog appears — not confirmed from source | P2 | Low | UI | Manual first |
| TC-LOAN-SAVE-17 | Loan Configuration | Draft API | Unvalidated `/draft` route accepts malformed types | Direct API call | POST `interest_rate` as a string to `/v1/loan-master/draft` | `interest_rate: "abc"` | Confirm live behavior — validator not wired to this route's schema | P1 | High | Negative | Manual first |
| TC-LOAN-SAVE-18 | Loan Configuration | Save | Succeeds with Interest Type unselected | On Add page | Leave Interest Type blank, Save | — | Accepted (no validation rule on either layer) | P2 | Low | Functional | Yes |

## 8. Edit

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-EDIT-01 | Loan Configuration | Preload | Basic Details preload from saved record | Existing record | Open Edit | — | All Basic Details fields show saved values | P0 | High | Functional | Yes |
| TC-LOAN-EDIT-02 | Loan Configuration | Preload | Loan Limits preload with correct Fixed/% type reselected | Existing Fixed-type record | Open Edit | — | Correct radio selected; matching value shown in the right sub-field | P0 | High | Functional | Yes |
| TC-LOAN-EDIT-03 | Loan Configuration | Preload | Late Payment Penalty value re-populates correctly | Record saved with a Flat penalty value | Open Edit | — | RESOLVED from source (`edit-loan-configuration.tsx`'s own "LATE PAYMENT PENALTY FIX" transform): read-back correctly re-splits the backend's single `late_penalty_value` into the FE's flat/percentage sub-fields based on the saved `late_penalty_type` — the LIM-23 bug is write-side (validation) only, read-back is confirmed correct | P1 | Medium | Functional | Yes |
| TC-LOAN-EDIT-04 | Loan Configuration | Preload | Repayment Configuration toggles preload | Existing record with both toggles set | Open Edit | — | Toggles match saved boolean state | P1 | Medium | Functional | Yes |
| TC-LOAN-EDIT-05 | Loan Configuration | Preload | Eligibility Criteria (Departments/Grades) preload | Record with departments/grades selected | Open Edit | — | Previously selected items pre-populate | P1 | Medium | Functional | Yes |
| TC-LOAN-EDIT-06 | Loan Configuration | Preload | Location preloads scoped to saved Company | Record saved with Location A1 | Open Edit | — | Location A1 pre-selected | P0 | High | Functional | Yes |
| TC-LOAN-EDIT-07 | Loan Configuration | Dependency | Changing Company on Edit clears preloaded Location | Record with Company A + Location A1 | Open Edit, change Company to B | — | Location resets to empty | P0 | High | Dependency | Yes |
| TC-LOAN-EDIT-08 | Loan Configuration | Save | Updating a single field persists only that change | Existing record | Change Loan Name, Save | — | Only Loan Name updates; all other fields unchanged | P0 | High | Functional | Yes |
| TC-LOAN-EDIT-09 | Loan Configuration | Save | Renaming to another record's Loan Name is blocked | Two existing records | Rename record A to match record B's name | — | Blocked by global uniqueness check | P1 | Medium | Negative | Yes |
| TC-LOAN-EDIT-10 | Loan Configuration | Save | Changing Status persists correctly | Existing Active record | Change Status to Inactive, Save | — | List reflects Inactive | P1 | Medium | Functional | Yes |
| TC-LOAN-EDIT-11 | Loan Configuration | Backend | Update validator has no inner required fields | Direct API call | PUT omitting `loan_name`/`loan_category` | — | Verify live whether this is a partial merge or a full replace — risk differs significantly | P1 | High | Negative | Manual first |
| TC-LOAN-EDIT-12 | Loan Configuration | Deleted record | Opening Edit for a soft-deleted id via direct URL | Soft-deleted record's id | Navigate directly to its Edit URL | — | Verify live actual behavior (404 vs stale/blank form) — not confirmed from source | P2 | Medium | Negative | Manual first |

## 9. View

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-VIEW-01 | Loan Configuration | Basic Details | Renders read-only, matching saved record | Existing record | Open View | — | Correct values shown, no editable inputs | P0 | High | Functional | Yes |
| TC-LOAN-VIEW-02 | Loan Configuration | Loan Limits | Only the active Max Loan Amount type's value renders | Fixed-type record | Open View | — | Fixed value shown; Percentage value not rendered | P1 | Medium | Functional | Yes |
| TC-LOAN-VIEW-03 | Loan Configuration | Late Payment Penalty | Renders correctly | Record with a saved penalty value | Open View | — | Renders directly from the stored `late_penalty_value`/`late_penalty_type` (`view-loan-configuration.tsx`), same fields the read-back fix in EDIT-03 relies on — confirmed correct, not affected by the write-side LIM-23 gap | P2 | Low | Functional | Yes |
| TC-LOAN-VIEW-04 | Loan Configuration | Repayment Configuration | Renders "Enabled"/"Disabled" static labels | Existing record | Open View | — | Read-only labels, not interactive toggles | P1 | Low | UI | Yes |
| TC-LOAN-VIEW-05 | Loan Configuration | Eligibility Criteria | Departments/Grades render as comma-separated read-only list | Record with multiple departments/grades | Open View | — | Full list renders, wraps correctly | P1 | Low | UI | Yes |
| TC-LOAN-VIEW-06 | Loan Configuration | Classification | Location renders as plain read-only value | Record with Location saved | Open View | — | Static text shown | P1 | Low | UI | Yes |
| TC-LOAN-VIEW-07 | Loan Configuration | Summary panel | Right-hand Summary mirrors main body values | Existing record | Open View | — | ID/Loan Name/Category/Company match main content | P1 | Medium | Functional | Yes |
| TC-LOAN-VIEW-08 | Loan Configuration | Activity tab | Shows change history | Record with prior edits | Click Activity tab | — | Verify live actual content — not confirmed from source | P2 | Low | Functional | Manual first |
| TC-LOAN-VIEW-09 | Loan Configuration | Read-only | No field accepts focus/typing | Existing record | Attempt to click/type into any field | — | No effect; all fields non-interactive | P0 | Medium | UI | Yes |
| TC-LOAN-VIEW-10 | Loan Configuration | Actions menu | Offers Edit/Delete per permissions | `canEdit`/`canDelete` set | Open Actions menu | — | Options gated correctly by permission flags | P1 | Medium | RBAC | Yes |
| TC-LOAN-VIEW-11 | Loan Configuration | Placeholder | Blank saved values render "-" | Record with blank Description | Open View | — | "-" shown, not empty whitespace, consistent with List's own placeholder | P2 | Low | UI | Yes |
| TC-LOAN-VIEW-12 | Loan Configuration | Currency formatting | All currency fields format consistently | Record with Max Loan Amount, Penalty, Min CTC set | Open View | — | Consistent currency prefix/decimal formatting across all three | P2 | Medium | UI | Yes |

## 10. Delete

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-DEL-01 | Loan Configuration | Confirmation | Delete opens a confirmation dialog | Existing record | Click Delete | — | Confirmation dialog shown before removal | P1 | Medium | Functional | Yes |
| TC-LOAN-DEL-02 | Loan Configuration | Cancel | Cancelling leaves the record untouched | Confirmation dialog open | Click Cancel | — | Record remains in list unchanged | P1 | Medium | Functional | Yes |
| TC-LOAN-DEL-03 | Loan Configuration | Confirm | Confirming removes the record from the list | Existing record | Confirm Delete | — | Record no longer in list (soft delete confirmed at backend) | P0 | High | Functional | Yes |
| TC-LOAN-DEL-04 | Loan Configuration | Cascade | Child department/grade rows also soft-delete | Record with departments/grades linked | Delete the record | — | Child rows soft-deleted in the same transaction, none orphaned | P1 | Medium | DB | Yes |
| TC-LOAN-DEL-05 | Loan Configuration | Permission | Delete disabled without `canDelete` | User without `canDelete` | Open row menu | — | Delete option disabled | P0 | High | RBAC | Yes |
| TC-LOAN-DEL-06 | Loan Configuration | Dead code | Row Delete-disable checks a `status==='Completed'` value that can't occur | Any record (status is numeric) | Inspect Delete enable/disable across all statuses | — | Verify live whether Delete is ever actually blocked by status — code suggests it currently isn't | P2 | Medium | Negative | Manual first |
| TC-LOAN-DEL-07 | Loan Configuration | Referential integrity | Deleting a configuration referenced by existing Loan Requests is not blocked | Loan Request exists referencing this configuration | Delete the Loan Configuration | — | Delete proceeds unblocked (no FK/referential check); verify what the existing Loan Request now displays | P1 | High | Negative | Yes |
| TC-LOAN-DEL-08 | Loan Configuration | Pagination | Deleting the last row on a page updates pagination correctly | On the last page with 1 record | Delete that record | — | Page count/navigation adjusts, no dangling empty page reference | P2 | Low | Functional | Yes |
| TC-LOAN-DEL-09 | Loan Configuration | Failure | Delete failure shows error, no optimistic removal | Mocked 500 on DELETE | Confirm Delete | — | Error toast shown; record remains listed | P1 | Medium | Negative | Yes |
| TC-LOAN-DEL-10 | Loan Configuration | Post-delete visibility | Soft-deleted record excluded from List/Search/Filter | Just deleted a record | Search/filter for it | — | Not found in any of the three | P1 | Medium | Functional | Yes |

## 11. Search

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-SRCH-01 | Loan Configuration | Search | Matches by full Loan Name | Record "Home Loan for Staff" exists | Search "Home Loan for Staff" | — | Matching record returned | P0 | Medium | Functional | Yes |
| TC-LOAN-SRCH-02 | Loan Configuration | Search | Matches by partial substring | Same record | Search "Loan for" | — | Matching record returned | P1 | Low | Functional | Yes |
| TC-LOAN-SRCH-03 | Loan Configuration | Search | Case-insensitive | Same record | Search "HOME LOAN" | — | Matching record returned | P1 | Low | Functional | Yes |
| TC-LOAN-SRCH-04 | Loan Configuration | Search | No matches shows empty state | — | Search a nonsense string | — | Shared empty/no-data state renders | P1 | Low | UI | Yes |
| TC-LOAN-SRCH-05 | Loan Configuration | Search | Resets to first page of results | On page 2+ | Enter a search term | — | Results reset to page 1, not stuck on a stale later page | P2 | Medium | Functional | Yes |
| TC-LOAN-SRCH-06 | Loan Configuration | Search | Clearing restores full list | Search active | Clear search box | — | Full unfiltered list returns | P1 | Low | Functional | Yes |
| TC-LOAN-SRCH-07 | Loan Configuration | Search | Special characters don't error | — | Search `%`, `_`, `'` | — | No 500; either literal match or no-results state | P2 | Medium | Negative | Yes |
| TC-LOAN-SRCH-08 | Loan Configuration | Search | Company-scoped result leakage | User scoped to Company A | Search a Company B-only record | — | Verify live no cross-company data leaks — not confirmed from explored source | P1 | High | Negative | Manual first |

## 12. Filters

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-FILT-01 | Loan Configuration | Filter panel | Opens from the Filter button | List loaded | Click Filter | — | Filter panel/menu opens | P2 | Low | UI | Yes |
| TC-LOAN-FILT-02 | Loan Configuration | Company filter | Narrows list to matching Company | Records across multiple companies | Filter by Company A | — | Verify which fields are actually filterable for this module — not fully confirmed from source | P1 | Medium | Functional | Manual first |
| TC-LOAN-FILT-03 | Loan Configuration | Status filter | Narrows by Active/Inactive/Draft | Mixed-status records | Filter by Draft | — | Only Draft records shown | P1 | Medium | Functional | Yes |
| TC-LOAN-FILT-04 | Loan Configuration | Loan Type filter | Narrows by category | Mixed-category records | Filter by "Home Loan" type | — | Only matching-type records shown | P2 | Low | Functional | Yes |
| TC-LOAN-FILT-05 | Loan Configuration | Multiple filters | Combine with AND logic | — | Apply Company + Status filters together | — | Verify live — AND vs OR combination not confirmed | P2 | Medium | Functional | Manual first |
| TC-LOAN-FILT-06 | Loan Configuration | Reset | Clear filters restores full list | Filters applied | Click Reset/Clear | — | Full list returns | P2 | Low | Functional | Yes |
| TC-LOAN-FILT-07 | Loan Configuration | Persistence | Filters survive a page refresh | Filter applied | Refresh browser | — | Verify live whether filters persist or reset | P3 | Low | Functional | Manual first |
| TC-LOAN-FILT-08 | Loan Configuration | Combined | Filter + Search narrow simultaneously | — | Apply a filter, then search | — | Result set narrowed by both conditions together | P2 | Low | Functional | Yes |

## 13. Sorting

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-SORT-01 | Loan Configuration | ID column | Sorts ascending/descending | Multiple records | Click ID header twice | — | Order toggles correctly both directions | P1 | Low | Functional | Yes |
| TC-LOAN-SORT-02 | Loan Configuration | Loan Name column | Sorts alphabetically both directions | Multiple records | Click Loan Name header | — | Alphabetical ascending/descending order | P1 | Low | Functional | Yes |
| TC-LOAN-SORT-03 | Loan Configuration | Tenure column | Sorts numerically, not lexically | Tenure values incl. 9 and 30 | Sort by Tenure | — | 9 sorts before 30 (true numeric sort, not string sort) | P1 | Medium | Negative | Yes |
| TC-LOAN-SORT-04 | Loan Configuration | Company column | Sorts correctly | Multiple companies | Click Company header | — | Correct alphabetical order | P2 | Low | Functional | Yes |
| TC-LOAN-SORT-05 | Loan Configuration | Status column | Groups Active/Inactive/Draft consistently | Mixed-status records | Click Status header | — | Consistent grouping both directions | P2 | Low | Functional | Yes |
| TC-LOAN-SORT-06 | Loan Configuration | Blank values | Records with blank Loan Name/Company sort predictably | Records with blanks present | Sort by that column | — | Blanks consistently land at one end, not scattered | P2 | Medium | Boundary | Yes |

## 14. Pagination

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-PAGE-01 | Loan Configuration | Discrepancy | `enablePages={false}` in source vs live pagination bar shown | List loaded | Compare source flag against live UI | — | RESOLVED: `enablePages={false}` is the shared `ListingComponent`'s own DEFAULT value (`components/listing/listing.tsx:42`) — Leave Policy Master doesn't even pass it explicitly and its pagination bar works fine (confirmed via its own TC-LPM-L03 passing), so this prop is unrelated to row pagination; no real discrepancy | P3 | Low | Functional | Yes |
| TC-LOAN-PAGE-02 | Loan Configuration | Page size | Changing items-per-page reloads with new size | 60+ records exist | Change 20 → 50 | — | List reloads showing up to 50 rows | P1 | Medium | Functional | Yes |
| TC-LOAN-PAGE-03 | Loan Configuration | Go To | Jump to a specific page number | 4+ pages exist | Enter page 3, submit | — | Navigates directly to page 3 | P1 | Medium | Functional | Yes |
| TC-LOAN-PAGE-04 | Loan Configuration | Next/Previous | Move one page at a time, disable at bounds | Multiple pages | Click Next repeatedly to last page | — | Next disables at last page; Previous disables at first page | P1 | Medium | Functional | Yes |
| TC-LOAN-PAGE-05 | Loan Configuration | Page count | Updates after Add/Delete | On last page | Add or delete a record | — | "Page X of Y" recalculates correctly | P2 | Low | Functional | Yes |
| TC-LOAN-PAGE-06 | Loan Configuration | State retention | Pagination behavior after Search/Filter | On page 2+ | Apply Search or Filter | — | Verify live whether page resets to 1 or is retained | P2 | Low | Functional | Manual first |
| TC-LOAN-PAGE-07 | Loan Configuration | Refresh | Page number on browser refresh | On page 3 | Refresh browser | — | Verify live whether page 3 or page 1 loads | P3 | Low | Functional | Manual first |
| TC-LOAN-PAGE-08 | Loan Configuration | Grid View | Paginates independently and consistently | 60+ records, Grid View | Switch pages in Grid View | — | Behaves consistently with Table View pagination | P2 | Low | Functional | Yes |

## 15. Permissions (RBAC)

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-RBAC-01 | Loan Configuration | Add button | Hidden without `canAdd` | User lacking `canAdd` | Load list page | — | Add button not rendered | P0 | High | RBAC | Yes |
| TC-LOAN-RBAC-02 | Loan Configuration | Edit action | Disabled without `canEdit` | User lacking `canEdit` | Open row menu | — | Edit disabled | P0 | High | RBAC | Yes |
| TC-LOAN-RBAC-03 | Loan Configuration | Delete action | Disabled without `canDelete` | User lacking `canDelete` | Open row menu | — | Delete disabled | P0 | High | RBAC | Yes |
| TC-LOAN-RBAC-04 | Loan Configuration | View route | Blocked without `canViewById` | User lacking `canViewById` | Navigate directly to a View URL | — | `ProtectedRoute` blocks access | P0 | High | RBAC | Yes |
| TC-LOAN-RBAC-05 | Loan Configuration | List route | Blocked without `canView` | User lacking `canView` | Navigate directly to list URL | — | Access blocked | P0 | High | RBAC | Yes |
| TC-LOAN-RBAC-06 | Loan Configuration | Server-side enforcement | Direct URL bypass still blocked server-side | User lacking permission | Directly call the underlying API for Add/Edit/View | — | Backend rejects, not just the UI hiding the button (`isRbacResource: true` confirmed on these routes) | P0 | High | RBAC | Yes |
| TC-LOAN-RBAC-07 | Loan Configuration | Status toggle route | Missing RBAC check on `PATCH /:id/status` | User with zero Loan Master permissions | Call `PATCH /:id/status` directly | — | Verify live whether this succeeds when it should be denied — confirmed missing `isRbacResource` | P0 | Critical | Negative | Yes |
| TC-LOAN-RBAC-08 | Loan Configuration | Partial permission | `canAdd` without `canEdit` | User with only `canAdd` | Create a record, then attempt to edit it | — | Create succeeds; Edit remains blocked | P1 | Medium | RBAC | Yes |
| TC-LOAN-RBAC-09 | Loan Configuration | Permission propagation | Changes take effect without re-login | Permission just revoked | Attempt the now-forbidden action in the same session | — | Verify live whether re-login is required | P2 | Low | RBAC | Manual first |
| TC-LOAN-RBAC-10 | Loan Configuration | API enforcement | Forbidden action via API returns proper 403 | User lacking permission | Call a forbidden endpoint directly | — | 403 response, matching this suite's 401/403 fast-fail convention | P1 | Medium | RBAC | Yes |

## 16. API Testing

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-API-01 | Loan Configuration | Create | Valid complete payload creates a record | Authenticated | `POST /v1/loan-master` | Valid full payload | 2xx; record retrievable by returned id | P0 | High | API | Yes |
| TC-LOAN-API-02 | Loan Configuration | Create | Missing `loan_name`/`loan_category` rejected | Authenticated | `POST` omitting either field | — | 4xx validation error (confirmed inner `required`) | P0 | High | API | Yes |
| TC-LOAN-API-03 | Loan Configuration | Create | `company_id` omitted accepted | Authenticated | `POST` without `company_id` | — | Accepted — confirmed optional at backend, contrary to FE | P1 | Medium | API | Yes |
| TC-LOAN-API-04 | Loan Configuration | Create | Duplicate `loan_name` across companies rejected | Company A record exists | `POST` same name under Company B | — | Rejected — global uniqueness confirmed | P1 | High | API | Yes |
| TC-LOAN-API-05 | Loan Configuration | Update | Partial-merge vs full-replace behavior | Existing record | `PUT` with a single field | — | Verify live which semantics apply — validator allows this | P1 | High | API | Manual first |
| TC-LOAN-API-06 | Loan Configuration | Update | `loan_category: null` accepted | Existing record | `PUT` with null category | — | Accepted (DB nullable, validator has no required rule) | P1 | Medium | API | Yes |
| TC-LOAN-API-07 | Loan Configuration | Draft | Malformed payload to unvalidated `/draft` route | Authenticated | `POST /v1/loan-master/draft` with wrong types | `interest_rate: "abc"` | Verify live actual behavior — schema not wired to this route | P1 | High | API | Manual first |
| TC-LOAN-API-08 | Loan Configuration | Status | Toggle status for another company's record | Cross-company record exists | `PATCH /:id/status` on it | — | Verify live whether blocked — no RBAC resource check on this route | P0 | Critical | Security | Manual first |
| TC-LOAN-API-09 | Loan Configuration | List | Response shape matches rendered columns | Authenticated | `GET /v1/loan-master` | — | Fields match `series_number`/`loan_name`/`loan_category`/`max_tenure_months`/`company_data.name`/`status` | P1 | Medium | API | Yes |
| TC-LOAN-API-10 | Loan Configuration | Get by id | Non-existent id returns 404 | Authenticated | `GET /v1/loan-master/999999999` | — | 404, not 500/empty 200 | P1 | Medium | API | Yes |
| TC-LOAN-API-11 | Loan Configuration | Get by id | Soft-deleted id behavior | Just soft-deleted a record | `GET /v1/loan-master/:id` | — | Verify live 404 vs still-returned data | P1 | High | API | Manual first |
| TC-LOAN-API-12 | Loan Configuration | Delete | Soft delete confirmed, subsequent list excludes it | Existing record | `DELETE /v1/loan-master/:id`, then `GET` list | — | Record absent from list response | P1 | Medium | API | Yes |
| TC-LOAN-API-13 | Loan Configuration | Delete | Repeat delete on already-deleted id | Already-deleted id | `DELETE` again | — | Verify live: idempotent success, 404, or 500 | P2 | Low | API | Manual first |
| TC-LOAN-API-14 | Loan Configuration | Percentage mapping | Percentage-type record round-trips correctly end-to-end | Authenticated | Save with `max_loan_amount_type: 'percentage'` via the UI, then GET the record | — | RESOLVED (see LIM-10): the FE mapper sends the percentage value under the backend's `max_loan_amount_value` key — confirm this via a direct API-level assertion as a regression guard, not as an open question | P2 | Low | API | Yes |
| TC-LOAN-API-15 | Loan Configuration | Penalty enum | `late_penalty_type: 'none'` accepted | Authenticated | `POST` with `late_penalty_type: 'none'` | — | Accepted server-side despite no UI path to this value | P2 | Medium | API | Manual first |
| TC-LOAN-API-16 | Loan Configuration | Interest Rate bound | 100 accepted, 100.01 rejected | Authenticated | `POST` with each value | `100`, `100.01` | 100 accepted; 100.01 rejected by schema `maximum:100` | P1 | Medium | API | Yes |
| TC-LOAN-API-17 | Loan Configuration | Concurrency | Two concurrent updates to the same record | Existing record | Fire two `PUT` requests near-simultaneously | — | Verify live whether the second silently overwrites the first — no version/optimistic-lock field found | P2 | High | API | Manual first |
| TC-LOAN-API-18 | Loan Configuration | Large payload | Hundreds of department/grade ids | Authenticated | `POST` with a large array | 300+ ids | No timeout, no unhelpful error | P2 | Low | Performance | Yes |
| TC-LOAN-API-19 | Loan Configuration | Auth | Any route without a valid token returns 401 | No token | Call any `/v1/loan-master` route | — | 401 (all routes require `fastify.authenticate`, confirmed) | P0 | High | Security | Yes |
| TC-LOAN-API-20 | Loan Configuration | Mass assignment | Unexpected extra field is ignored | Authenticated | `POST` with `is_admin: true` added | — | Verify live it's ignored, not mass-assigned (no `additionalProperties:false` found in validators) | P1 | High | Security | Manual first |
| TC-LOAN-API-21 | Loan Configuration | Performance | Response time under normal load | Authenticated | Time Create/Update/List calls | — | Within acceptable threshold, baseline for Performance section | P2 | Low | Performance | Yes |
| TC-LOAN-API-22 | Loan Configuration | Query params | List route's actual supported filter/sort params | Authenticated | Inspect network calls from real Filter/Sort UI actions | — | Confirm live against network tab; not fully explored from source | P2 | Low | API | Manual first |

## 17. Database Validation

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-DB-01 | Loan Configuration | ID generation | Series number is unique per record | Multiple creates | Create several records | — | Each gets a unique, sequential id | P1 | Medium | DB | Yes |
| TC-LOAN-DB-02 | Loan Configuration | Audit fields | `created_by`/`updated_by` populate with acting user | Authenticated create/update | Create then update a record | — | Both fields reflect the correct user id | P1 | Medium | DB | Yes |
| TC-LOAN-DB-03 | Loan Configuration | Draft default | `is_draft` value on a normal (non-draft) Save | Normal Save via Add form | Create via the real Save action | — | Confirm it's explicitly false, not defaulted `TRUE` per migration default | P1 | High | DB | Manual first |
| TC-LOAN-DB-04 | Loan Configuration | Status default | New record without explicit status matches `TRUE`/Active default | Create via minimal payload | Inspect stored `status` | — | Defaults to Active per migration | P2 | Low | DB | Yes |
| TC-LOAN-DB-05 | Loan Configuration | Soft delete cascade | Parent + child rows deleted atomically | Record with department/grade children | Delete the record | — | All rows within one transaction get `deleted_at`/`deleted_by` set; no partial state | P1 | Medium | DB | Yes |
| TC-LOAN-DB-06 | Loan Configuration | FK constraints | No DB-level FK on department/grade/loan_master_id columns | Schema inspection | Insert a row referencing a nonexistent id directly | — | Not rejected at DB layer — confirmed no FK constraints exist | P1 | High | DB | Manual first |
| TC-LOAN-DB-07 | Loan Configuration | CHECK constraint | `interest_rate` DB CHECK (0-100) as last line of defense | Direct DB insert bypassing API | Insert `interest_rate: 150` | `150` | Rejected at the DB layer by the CHECK constraint | P2 | Medium | DB | Manual first |
| TC-LOAN-DB-08 | Loan Configuration | Nullable category | `loan_category` can only become NULL via Update/Draft, never Create | Existing record | Attempt each write path with a null category | — | Confirm Create always rejects null; Update/Draft don't | P2 | Medium | DB | Manual first |
| TC-LOAN-DB-09 | Loan Configuration | Type default mismatch | `max_loan_amount_type` DB default `'Fixed'` never matches lowercase enum | Any code path relying on the column default | Inspect whether any write path omits this field | — | Confirm this default is genuinely unreachable in practice | P2 | Medium | DB | Manual first |
| TC-LOAN-DB-10 | Loan Configuration | Uniqueness enforcement | `loan_name` uniqueness is app-level only, no DB unique index | Concurrent creates with the same name | Fire two near-simultaneous creates with identical names | — | Verify live whether a race condition can slip past the app-level check | P2 | Medium | DB | Manual first |

## 18. Security Testing

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-SEC-01 | Loan Configuration | SQL Injection | Injection payloads in Loan Name/Search/Remarks | Authenticated | Enter `' OR '1'='1` in each field | — | Neutralized, not executed as raw SQL | P0 | Critical | Security | Yes |
| TC-LOAN-SEC-02 | Loan Configuration | Stored XSS | Script payload rendered inert everywhere | Authenticated | Save `<script>alert(1)</script>` in Loan Name/Description/Remarks | — | Rendered as text on List/View/Summary, never executed | P0 | Critical | Security | Yes |
| TC-LOAN-SEC-03 | Loan Configuration | CSRF | State-changing calls require valid session | Authenticated | Attempt Create/Update/Delete/status-toggle without a valid session token | — | Rejected per app's existing auth pattern | P1 | High | Security | Yes |
| TC-LOAN-SEC-04 | Loan Configuration | RBAC gap | Status route missing RBAC check | User with zero Loan Master permissions | `PATCH /:id/status` | — | Verify live whether it's wrongly permitted — confirmed missing `isRbacResource` | P0 | Critical | Security | Yes |
| TC-LOAN-SEC-05 | Loan Configuration | Authorization | Cross-company record access | User scoped to Company A | Attempt View/Edit/Delete on a Company B record | — | Verify live enforcement — no explicit company-ownership check found in service code | P1 | High | Security | Manual first |
| TC-LOAN-SEC-06 | Loan Configuration | Parameter tampering | Modified `:id` in URL to an unauthorized record | Two records, restricted access to one | Change the URL's id to the restricted one | — | Server-side authorization blocks it, not just client routing | P1 | High | Security | Manual first |
| TC-LOAN-SEC-07 | Loan Configuration | Mass assignment | Privileged field injected into payload | Authenticated | `POST`/`PUT` with `created_by` or `is_deleted:false` added | — | Ignored, not honored (no `additionalProperties:false` found) | P1 | High | Security | Yes |
| TC-LOAN-SEC-08 | Loan Configuration | Data exposure | Response doesn't leak sensitive fields | Authenticated | Inspect List/Get-by-id response payload | — | No unintended cross-company ids or internal audit details exposed | P1 | Medium | Security | Yes |
| TC-LOAN-SEC-09 | Loan Configuration | Session timeout | Expired token mid-form-fill | Mocked expired token | Fill form, attempt Save | — | 401 fast-fail behavior, not silent failure/data loss | P1 | Medium | Security | Yes |
| TC-LOAN-SEC-10 | Loan Configuration | Direct access | Add/Edit route blocked for unauthorized role | Unauthorized role | Navigate directly to Add/Edit URL | — | Route-level protection blocks access, not just hides the link | P1 | High | Security | Yes |
| TC-LOAN-SEC-11 | Loan Configuration | Input validation gap | Draft route accepts malformed nested payloads | Authenticated | `POST` deeply malformed JSON to `/draft` | — | No 500/stack-trace leakage in the response | P1 | Medium | Security | Manual first |
| TC-LOAN-SEC-12 | Loan Configuration | Rate limiting | Repeated rapid Create requests | Authenticated | Fire many Create requests in quick succession | — | Sane limit enforced, or at least no crash/resource exhaustion | P2 | Medium | Security | Manual first |
| TC-LOAN-SEC-13 | Loan Configuration | Transport security | Sensitive values over HTTPS only | Live/staging environment | Inspect network traffic for Interest Rate/CTC fields | — | TLS enforced, no plaintext transmission | P2 | Medium | Security | Yes |
| TC-LOAN-SEC-14 | Loan Configuration | Role bypass | Read Only role attempts write via direct API | Read Only user | Call Create/Update/Delete directly | — | Rejected server-side | P0 | High | Security | Yes |

## 19. Performance Testing

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-PERF-01 | Loan Configuration | List load | Load time with 1000+ records | 1000+ records seeded | Load list page, measure time | — | Within acceptable threshold | P2 | Medium | Performance | Yes |
| TC-LOAN-PERF-02 | Loan Configuration | Search/Filter | Response time on large dataset | 1000+ records | Search/filter, measure time | — | Remains responsive | P2 | Medium | Performance | Yes |
| TC-LOAN-PERF-03 | Loan Configuration | Save | Create response time under normal load | Authenticated | Time a standard Create call | — | Within acceptable threshold | P2 | Low | Performance | Yes |
| TC-LOAN-PERF-04 | Loan Configuration | Multiselect | Departments/Grades dropdown with hundreds of options | Large master-data set | Open the dropdown, measure responsiveness | — | Remains responsive, no UI freeze | P2 | Low | Performance | Yes |
| TC-LOAN-PERF-05 | Loan Configuration | Concurrency | Multiple simultaneous users editing | Multiple sessions | Concurrent Create/Edit calls | — | Response times don't degrade unacceptably | P3 | Low | Performance | Yes |
| TC-LOAN-PERF-06 | Loan Configuration | Memory | Repeated Add→Save→List cycles | Long-running session | Repeat the cycle 20+ times | — | Browser memory stays stable, no obvious leak | P3 | Low | Performance | Manual first |
| TC-LOAN-PERF-07 | Loan Configuration | Grid View | Rendering performance with large record set | 1000+ records, Grid View | Load Grid View, measure time | — | Comparable to Table View, no excessive slowdown | P3 | Low | Performance | Yes |
| TC-LOAN-PERF-08 | Loan Configuration | Form load | Add form's initial load time | Authenticated | Navigate to Add page, measure time | — | Within acceptable threshold given the form's size | P3 | Low | Performance | Yes |

## 20. Accessibility Testing

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-A11Y-01 | Loan Configuration | Keyboard navigation | Full form navigable via Tab/Shift+Tab | On Add page | Tab through the entire form | — | Logical order matching visual layout | P2 | Medium | Accessibility | Yes |
| TC-LOAN-A11Y-02 | Loan Configuration | Labels | All inputs have proper accessible names | On Add page | Inspect each input's accessible name | — | Labels correctly associated, not just visually adjacent | P2 | Medium | Accessibility | Yes |
| TC-LOAN-A11Y-03 | Loan Configuration | Radio groups | Max Loan Amount/Late Penalty type use proper ARIA radio groups | On Add page | Inspect radio group markup | — | Proper `role="radiogroup"`/`radio`, not styled divs | P2 | Medium | Accessibility | Yes |
| TC-LOAN-A11Y-04 | Loan Configuration | Toggles | Toggle state exposed via ARIA | On Add page | Inspect toggle attributes | — | `aria-checked` or equivalent present, not just a color change | P2 | Medium | Accessibility | Yes |
| TC-LOAN-A11Y-05 | Loan Configuration | Focus visibility | Every interactive element shows visible focus | On Add page | Tab through all controls | — | No invisible-focus traps | P2 | Medium | Accessibility | Yes |
| TC-LOAN-A11Y-06 | Loan Configuration | Error announcements | Validation errors announced to screen readers | On Add page | Trigger a validation error with a screen reader active | — | Error is announced, not just visually shown | P2 | Medium | Accessibility | Yes |
| TC-LOAN-A11Y-07 | Loan Configuration | Color contrast | Status chips meet WCAG AA contrast | List loaded | Run a contrast check on each chip variant | — | Meets AA against its background | P3 | Low | Accessibility | Yes |
| TC-LOAN-A11Y-08 | Loan Configuration | Disabled state | Location's disabled-until-Company state exposed via ARIA | On Add page, Company empty | Inspect Location field before Company selection | — | `aria-disabled`/`disabled` present, not purely visual | P2 | Medium | Accessibility | Yes |

## 21. Cross-Browser Testing

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-XB-01 | Loan Configuration | Chrome | Full Add→Save→View flow | Chrome browser | Run the full flow | — | Works correctly | P1 | Medium | Cross-Browser | Yes |
| TC-LOAN-XB-02 | Loan Configuration | Firefox | Full Add→Save→View flow | Firefox browser | Run the full flow | — | Works correctly | P2 | Medium | Cross-Browser | Yes |
| TC-LOAN-XB-03 | Loan Configuration | Edge | Full Add→Save→View flow | Edge browser | Run the full flow | — | Works correctly | P2 | Low | Cross-Browser | Yes |
| TC-LOAN-XB-04 | Loan Configuration | Safari | Full Add→Save→View flow | Safari browser | Run the full flow | — | Works correctly | P2 | Low | Cross-Browser | Yes |
| TC-LOAN-XB-05 | Loan Configuration | Mobile browsers | List/Add usable on iOS Safari/Chrome Android | Mobile browser | Load List and Add pages | — | Usable, not just present | P2 | Low | Cross-Browser | Manual first |

## 22. Responsive Testing

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-RESP-01 | Loan Configuration | List | Table remains usable at tablet width | List loaded | Resize to tablet width | — | Horizontal scroll or column prioritization, no breakage | P2 | Medium | Responsive | Yes |
| TC-LOAN-RESP-02 | Loan Configuration | List | Table degrades gracefully at mobile width | List loaded | Resize to mobile width | — | Columns degrade gracefully, still usable | P2 | Medium | Responsive | Yes |
| TC-LOAN-RESP-03 | Loan Configuration | Form layout | Two-column form collapses to single column | Add/Edit form | Resize to narrow viewport | — | Single-column layout, no overlap | P2 | Medium | Responsive | Yes |
| TC-LOAN-RESP-04 | Loan Configuration | View page | Summary panel behavior on narrow viewports | View page | Resize to narrow viewport | — | Stacks or collapses sensibly, no overlap with main content | P2 | Low | Responsive | Yes |
| TC-LOAN-RESP-05 | Loan Configuration | Orientation | Landscape vs portrait doesn't break layout | Tablet/phone | Rotate device orientation | — | Layout remains intact in both orientations | P3 | Low | Responsive | Yes |
| TC-LOAN-RESP-06 | Loan Configuration | Long values | Long comma-separated lists wrap correctly | Record with many departments | View at narrow width | — | Wraps correctly, no overflow/clipping | P2 | Low | Responsive | Yes |

## 23. Regression Testing

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LOAN-REG-01 | Loan Configuration | Late penalty fix | Existing records display/edit correctly after the field-name mismatch (LIM-23) is fixed | Records created pre-fix | Open Edit/View post-fix | — | No regression in previously-saved penalty values | P1 | High | Regression | Yes |
| TC-LOAN-REG-02 | Loan Configuration | Draft state | Existing Drafts remain editable after any status/is_draft change | Existing Draft records | Open and edit them post-change | — | Still Draft, still editable | P1 | Medium | Regression | Yes |
| TC-LOAN-REG-03 | Loan Configuration | Search | Continues to work after a record is edited | Record edited (name changed) | Search the updated name | — | Updated name is searchable | P1 | Medium | Regression | Yes |
| TC-LOAN-REG-04 | Loan Configuration | Filters | Continue to return correct results after new records added | New records added | Apply an existing filter | — | Correct, up-to-date results | P2 | Low | Regression | Yes |
| TC-LOAN-REG-05 | Loan Configuration | Permissions | Remain correctly enforced after a role assignment changes | Role reassigned | Attempt previously-blocked action | — | Still enforced consistently | P1 | Medium | Regression | Yes |
| TC-LOAN-REG-06 | Loan Configuration | Delete | Continues to soft-delete, not hard-delete | Any future service-layer change | Delete a record post-change | — | Still recoverable via `deleted_at`, not physically removed | P1 | High | Regression | Yes |
| TC-LOAN-REG-07 | Loan Configuration | Shared component | Company→Location dependency intact after shared component changes | `DynamicDependentField` changed (shared with Leave Policy Master) | Test the Company→Location flow | — | Behavior unchanged; a regression here risks breaking both modules | P1 | High | Regression | Yes |
| TC-LOAN-REG-08 | Loan Configuration | Sorting/Pagination | Both continue to work together after a page-size/column change | Shared infra changed | Sort then paginate | — | Correct combined behavior | P2 | Low | Regression | Yes |
| TC-LOAN-REG-09 | Loan Configuration | List/Grid consistency | Both views render consistent data after shared infra changes | `transformTableColumns` changed | Compare Table vs Grid View | — | Same records, same values in both | P2 | Low | Regression | Yes |
| TC-LOAN-REG-10 | Loan Configuration | Draft route lockdown | Existing lenient-schema records still load if `/draft` is later validated properly | Records created via the currently-unvalidated route | Load/edit them after validator is added | — | No breakage for pre-existing lenient data | P2 | Medium | Regression | Yes |

---

## Coverage Summary

| Section | Test Case Count |
|---|---|
| 1. List Page | 18 |
| 2. Basic Details — Field Validation | 20 |
| 3. Loan Limits | 26 |
| 4. Repayment Configuration | 8 |
| 5. Eligibility Criteria | 23 |
| 6. Classification (Location) | 8 |
| 7. Save / Draft / Discard | 18 |
| 8. Edit | 12 |
| 9. View | 12 |
| 10. Delete | 10 |
| 11. Search | 8 |
| 12. Filters | 8 |
| 13. Sorting | 6 |
| 14. Pagination | 8 |
| 15. Permissions (RBAC) | 10 |
| 16. API Testing | 22 |
| 17. Database Validation | 10 |
| 18. Security Testing | 14 |
| 19. Performance Testing | 8 |
| 20. Accessibility Testing | 8 |
| 21. Cross-Browser Testing | 5 |
| 22. Responsive Testing | 6 |
| 23. Regression Testing | 10 |
| **Total** | **278** |

**Automation readiness**: cases marked **Yes** reflect behavior confirmed directly from
`erpforce-hrms-fe`/`erpforce-be` source (Yup schemas, JSON-schema validators, service/migration
code) and can be automated with confidence. Cases marked **Manual first** could not be resolved
from source alone — mostly backend behaviors around the confirmed Percentage-amount field gap,
the Late Payment Penalty field-name mismatch's live impact, cross-company scoping on
Departments/Grades, and the pagination/`enablePages` discrepancy — these must be confirmed against
the live app once before writing an automated assertion, so a wrong guess doesn't get baked into
the suite.
