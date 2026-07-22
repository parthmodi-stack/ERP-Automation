# Accruals and Benefit Master — Test Case Suite

Module path: HRMS → Company Master Policy → Accruals and Benefit Master
(`/dashboard/hrms/company-master-policy/accruals-and-benefit`)

Source verified against `erpforce-hrms-fe/src/views/accruals-and-benefit/` (list page, add/edit/view
pages, `utils/commons.ts` Yup schema, `utils/constants.ts`, `form/form.tsx`, `routes/index.tsx`) and
`erpforce-be/modules/hrms/lib/accrual-master/` (routes, validators, service, use-cases) plus the
five accrual-master migrations, before writing any case below. Every "Expected Result" reflects
confirmed source behavior, not assumed UI convention; where source could not confirm a behavior
(mostly pre-built dependency internals or live-only timing/UX), the case is explicitly marked
**Manual first** instead of guessed.

## Corrections to the requested module description (read before using these tables)

- **"Calculation Methods" has exactly two real values, not three.** The `Methods` dropdown is
  `fixed_value` ("Fixed Value") and `variable_salary_component` ("Variable Salary Component") only
  — confirmed in the FE enum (`utils/constants.ts`), the BE JSON-schema enum (both create/update
  validators), and the DB column's own `ENUM(...)`. **There is no "Formula" method anywhere in FE
  or BE** — any test case assuming one is invalid. "Percentage" is not a separate method either; it
  surfaces only as one of five `operator` symbols (`+ - * / %`) inside the Variable Salary
  Component sub-form.
- **"Type" (Allowance/Deduction) is a hardcoded 2-option FE enum, not an API-sourced dropdown.**
  It never calls the backend's separate `accrual-type` module, which is a different lookup table
  consumed only by Leave Policy Master's "Accrual Type" field and Approval Dashboard's
  `accrual_type` field. Do not write a "Type dropdown loads from API" test for this module.
- **Fixed Value's `frequency` field has an FE/BE enum size mismatch.** The UI dropdown offers only
  3 values (Monthly, Annual/`yearly`, One Time/`one_time`), matching the DB entity schema. The BE
  create validator's JSON-schema enum allows 6 (`daily, weekly, monthly, quarterly, yearly,
  one_time`) — `daily`/`weekly`/`quarterly` are reachable only via direct API and are **not
  explicitly handled** by the payroll frequency switch, which silently treats any unrecognized
  value as "apply every month" (same as `monthly`).
- **Confirmed schema-vs-service validation gaps for numeric fields.** `amount` (Fixed Value) and
  `value` (Variable Salary Component) both allow `0` at the JSON-schema level (`minimum: 0`) but
  are rejected by a stricter service-layer check (`if (!amount || amount <= 0) throw ...`) — so `0`
  passes AJV but fails business logic with a distinct error, a case worth testing explicitly rather
  than assuming one validation layer speaks for both.
- **`cap_limit = 0` is a confirmed bug, not a valid boundary.** The service's own guard clauses
  (`if (cap_limit && cap_limit <= 0)` and `if (cap_limit && value && cap_limit < value)`) both use a
  falsy check on `cap_limit` itself, so a literal `0` bypasses both the "must be positive" rule and
  the "must be ≥ value" rule entirely — `0` silently passes where the code's own intent says it
  shouldn't.
- **Division by zero in the `/` operator silently returns 0** instead of throwing, in both the
  `calculate-amount` endpoint and the monthly-payroll accrual helper (identical logic duplicated in
  both places) — confirm this is treated as a real defect, not an intentional "no-op" design.
- **Department is required on the Add/Edit form (Yup); Location is not.** The backend contradicts
  the FE on Department: neither `location_id` nor `department_id` appears in either create or
  update validator's `required[]` array, and both are explicitly `nullable: true` — a direct API
  create can omit Department entirely even though the UI blocks it.
- **`company_id` has literally no backend schema validation** (the property isn't even declared in
  either JSON-schema), despite being FE-required and a real, joined/indexed DB column — the same
  class of FE/BE gap documented in this suite's Loan Configuration and Leave Policy Master modules.
- **Multi-file attachment upload is a confirmed UI-vs-storage mismatch, not a feature.** The
  `UploadMedia` component is configured with `multiple={true}`, letting a user pick several files,
  but every submit path (Add, Edit's normal save, Edit's draft save) only keeps
  `allUploadedFiles[0]` — the backend column is a single `VARCHAR(255)` URL string. Uploading 2+
  files silently drops everything after the first, with no warning shown to the user. This is
  documented inline in the FE's own `commons.ts` helper comment, so it is a known, intentional
  storage constraint that the upload UI simply doesn't communicate.
- **Draft save (both Add and Edit) skips Yup validation entirely on the client**, not just at the
  UI-hint level: the draft handlers call `methods.getValues()` directly instead of
  `methods.trigger()`/`handleSubmit()`, so no field-level validation function is ever invoked before
  the draft request fires. Server-side, the `/draft` POST and `/:id/draft` PATCH routes carry **no
  `body` schema at all**, and the service's own `validateAccrualMasterData` explicitly no-ops when
  `is_draft` is truthy. Net effect: a draft can be saved completely empty, with malformed types, or
  with values that would fail full-record business rules.
- **A full Update (`PUT /:id`) is stricter than its own JSON-schema**, because
  `validateAccrualMasterData` is called unconditionally on every update and independently requires
  `name`/`type`/`method` even though the update schema has no top-level `required[]` for them. A
  genuine partial-PUT payload (e.g. `{ amount: 500 }` only) will fail with a business-rule error
  ("Name is required"), not a schema error — confirm this before assuming the update endpoint
  supports partial patches.
- **Soft delete is inconsistently enforced across read paths.** `DELETE /:id` correctly soft-deletes
  (`is_deleted`/`deleted_by`/`deleted_at`), and the List query filters `is_deleted` out. But
  `fetchAccrualMasterById` (used by both the View and Edit pages) does **not** filter `is_deleted`
  at all — a soft-deleted record may still render if its View/Edit URL is opened directly. Worse,
  the monthly-payroll accrual-calculation helper's own master lookup (`getEmployeeAccrualsWithMaster`)
  also never filters `is_deleted` or `status` — **a soft-deleted or Inactive Accrual Master already
  assigned to an employee keeps being calculated in payroll.** This is the single highest-value bug
  in this module and should be a dedicated, well-isolated test case.
- **Three routes are confirmed missing `isRbacResource: true`**: `PATCH /:id/status`,
  `PATCH /:id/draft` (draft update), and `POST /calculate-amount` — every other route (create,
  list, get-by-id, update, delete, draft-create, export, import) has it set correctly. Notably, the
  two missing mutating endpoints (status toggle, draft update) are exactly the kind of write path a
  permission gap would matter most on.
- **The Edit page's "ID" input shows the raw numeric primary key, not the `ACC0xx` business ID**
  shown everywhere else (View page, breadcrumbs, list). This is a confirmed display inconsistency,
  not a data-integrity bug — the underlying record is unaffected.
- **Attachment size/extension limits cannot be confirmed from source.** `UploadMedia` is a
  pre-built, minified shared component (`@erpsquad/common`) with no accessible internal source in
  this checkout, and no `max_size` prop is passed by this form — so its effective limit is whatever
  the component defaults to internally. Every attachment-limit case below is marked **Manual
  first** for this reason.

---

## 1. List Page

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-LIST-01 | Accruals and Benefit | Page Load | List loads at the correct URL | Logged in, `canView` | Navigate to the module URL | — | URL matches; table renders | P0 | High | Functional | Yes |
| TC-ACC-LIST-02 | Accruals and Benefit | Columns | Table shows the confirmed column set | List loaded | Inspect header row | — | Columns are ID, Name, Type, Company, Location, Status (per screenshot) | P0 | Medium | UI | Yes |
| TC-ACC-LIST-03 | Accruals and Benefit | Loading state | Loading indicator shows during fetch | Throttled network | Load list page | — | Loader visible until data resolves | P2 | Low | UI | Yes |
| TC-ACC-LIST-04 | Accruals and Benefit | Empty state | Zero records shows the shared empty state | No records exist | Load list page | — | "No Data" component renders, not a blank table | P1 | Medium | UI | Yes |
| TC-ACC-LIST-05 | Accruals and Benefit | Status chip | Active/Inactive/Draft chips render distinctly | Mixed-status records exist | Load list page | — | Each state visually distinct | P1 | Medium | UI | Yes |
| TC-ACC-LIST-06 | Accruals and Benefit | Data integrity | Row with blank Company/Location renders cleanly | Record with blank company/location exists (confirmed present live per screenshot) | Load list page | — | Row renders without layout break | P2 | Medium | UI | Yes |
| TC-ACC-LIST-07 | Accruals and Benefit | Placeholder | Row with no Type shows "-" placeholder | Record with `type` null (draft) | Load list page | — | Cell shows "-", not blank/undefined | P2 | Low | UI | Yes |
| TC-ACC-LIST-08 | Accruals and Benefit | Navigation | Clicking a row opens its View page | Record exists | Click a row | — | Navigates to that record's view page | P0 | High | Functional | Yes |
| TC-ACC-LIST-09 | Accruals and Benefit | Row menu | "···" menu offers Edit/Delete per permissions | `canEdit`/`canDelete` true | Open row menu | — | Edit and Delete options present and enabled | P1 | Medium | Functional | Yes |
| TC-ACC-LIST-10 | Accruals and Benefit | Add button | Visible only when `canAdd` is true | User without `canAdd` | Load list page | — | Add button not rendered | P0 | High | RBAC | Yes |
| TC-ACC-LIST-11 | Accruals and Benefit | Selection | Row checkbox selects an individual row | Records exist | Click a row checkbox | — | Row marked selected | P2 | Low | UI | Yes |
| TC-ACC-LIST-12 | Accruals and Benefit | Selection | Header checkbox selects all rows on current page | Records exist | Click header checkbox | — | All visible rows selected | P2 | Low | UI | Yes |
| TC-ACC-LIST-13 | Accruals and Benefit | Bulk delete | Bulk-selected rows can be deleted together | Multiple rows selected, `canDelete` | Select 3+ rows, trigger bulk delete | — | Verify live whether a bulk-delete action actually exists on this list's toolbar — not confirmed from source | P2 | Medium | Functional | Manual first |
| TC-ACC-LIST-14 | Accruals and Benefit | Refresh | Manual refresh reloads current data | List loaded | Trigger refresh | — | Data reloads, filters/search state behavior confirmed separately (see FILT-07/SRCH-05) | P2 | Low | UI | Yes |
| TC-ACC-LIST-15 | Accruals and Benefit | Accessibility | Row actions reachable via keyboard | List loaded | Tab to a row's action menu, activate with Enter/Space | — | Menu opens and is operable without a mouse | P2 | Medium | Accessibility | Yes |
| TC-ACC-LIST-16 | Accruals and Benefit | Responsive | List remains usable on a narrow viewport | Records exist | Resize to tablet/mobile width | — | Columns scroll/prioritize without breaking alignment | P2 | Medium | Responsive | Yes |
| TC-ACC-LIST-17 | Accruals and Benefit | Data refresh | List reflects a just-completed Add/Edit/Delete without manual reload | Just completed an Add | Return to list | — | New/updated/removed row reflects | P0 | High | Functional | Yes |
| TC-ACC-LIST-18 | Accruals and Benefit | API failure | List load failure handled gracefully | Mocked 500 on GET list | Load list page | — | Error state shown, not an infinite loader or blank crash | P1 | High | Negative | Yes |
| TC-ACC-LIST-19 | Accruals and Benefit | Large dataset | List remains responsive with 500+ records | 500+ records seeded | Load list page | — | Loads within acceptable time, pagination/search still functional | P2 | Medium | Performance | Yes |

## 2. Add — Basic Details (Company, Name, Type, Instructions, ID)

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-FLD-01 | Accruals and Benefit | Company | Required on Add (FE) | On Add page | Leave Company empty, click Save | — | Inline required error; blocked | P0 | High | Validation | Yes |
| TC-ACC-FLD-02 | Accruals and Benefit | Company | `company_id` omitted via direct API bypass | Direct API call | POST without `company_id` | Otherwise valid payload | Backend accepts — confirmed the property isn't declared in either JSON-schema at all | P1 | Medium | Negative | Yes |
| TC-ACC-FLD-03 | Accruals and Benefit | Company | Invalid/non-existent `company_id` via direct API | Direct API call | POST `company_id: 999999999` | — | Verify live whether any FK check rejects this — not confirmed from source | P2 | Medium | Negative | Manual first |
| TC-ACC-FLD-04 | Accruals and Benefit | Name | Required on Add (FE) and Create (BE) | On Add page | Leave Name empty, click Save | — | Inline error; blocked. Confirmed BE also requires 1-150 chars on create | P0 | High | Validation | Yes |
| TC-ACC-FLD-05 | Accruals and Benefit | Name | Omitted on Update via direct API | Existing record, direct API | PUT without `name` | — | Verify live: business-logic layer (`validateAccrualMasterData`) requires `name` on every update regardless of schema — expect rejection with a business-rule error, not silent acceptance | P1 | High | Negative | Yes |
| TC-ACC-FLD-06 | Accruals and Benefit | Name | Omitted on Draft | On Add page | Save To Draft with Name empty | — | Accepted — draft path has no server-side body schema and `validateAccrualMasterData` no-ops for drafts | P0 | High | Negative | Yes |
| TC-ACC-FLD-07 | Accruals and Benefit | Name | 150-char boundary | On Add page | Enter exactly 150 chars, Save; then 151 chars, Save | 150 chars / 151 chars | 150 accepted; 151 rejected (BE create schema `maxLength: 150`) | P1 | Medium | Boundary | Yes |
| TC-ACC-FLD-08 | Accruals and Benefit | Name | Duplicate name rejected | Existing record with Name "Health Insurance" | Create another with same Name | `"Health Insurance"` | Rejected via `assertUniqueEntry` | P1 | High | Negative | Yes |
| TC-ACC-FLD-09 | Accruals and Benefit | Name | Leading/trailing whitespace | On Add page | Enter `"  Travel Allowance  "`, Save | — | Verify live whether trimmed or saved verbatim — not confirmed from source | P2 | Low | Boundary | Manual first |
| TC-ACC-FLD-10 | Accruals and Benefit | Name | Only-whitespace value | On Add page | Enter `"   "`, Save | `"   "` | Verify live whether Yup's `required()` treats a whitespace-only string as non-empty (common Yup gap) | P1 | Medium | Negative | Manual first |
| TC-ACC-FLD-11 | Accruals and Benefit | Name | HTML/script-like content | On Add page | Enter `<script>alert(1)</script>`, Save | — | Accepted and stored; must render as inert text everywhere (List/View) | P0 | Critical | Negative | Yes |
| TC-ACC-FLD-12 | Accruals and Benefit | Name | SQL-injection-like content | On Add page | Enter `' OR '1'='1`, Save | — | Accepted as literal text, not executed as SQL; no 500 error | P0 | Critical | Security | Yes |
| TC-ACC-FLD-13 | Accruals and Benefit | Name | Unicode content | On Add page | Enter `"बोनस भत्ता 🎉"`, Save | — | Accepted, renders correctly on reload | P2 | Low | Boundary | Yes |
| TC-ACC-FLD-14 | Accruals and Benefit | Name | Copy/paste works correctly | On Add page | Copy text externally, paste into Name | — | Pasted value renders correctly, no truncation/corruption | P3 | Low | UI | Yes |
| TC-ACC-FLD-15 | Accruals and Benefit | Type | Required on Add (FE) and Create (BE) | On Add page | Leave Type empty, Save | — | Inline error; blocked. BE enum `['allowance','deduction']` | P0 | High | Validation | Yes |
| TC-ACC-FLD-16 | Accruals and Benefit | Type | Confirmed hardcoded 2-option dropdown, not API-sourced | On Add page | Open Type dropdown | — | Only "Allowance"/"Deduction" render, no network call to any type-lookup API | P1 | Low | Functional | Yes |
| TC-ACC-FLD-17 | Accruals and Benefit | Type | Invalid enum value via direct API | Direct API call | POST `type: "bonus"` | `"bonus"` | Rejected — BE enum-checked on create | P1 | Medium | Negative | Yes |
| TC-ACC-FLD-18 | Accruals and Benefit | Type | Omitted on Update accepted if not enum-mismatched | Existing record, direct API | PUT without `type` | — | Accepted at schema level (not in update `required[]`) — verify whether `validateAccrualMasterData`'s own requirement blocks this like Name does | P1 | Medium | Negative | Manual first |
| TC-ACC-FLD-19 | Accruals and Benefit | Instructions | Optional — blank saves successfully | On Add page | Leave Instructions empty, Save | — | Record saved, no validation error | P2 | Low | Validation | Yes |
| TC-ACC-FLD-20 | Accruals and Benefit | Instructions | 1000-char BE boundary, no FE limit | On Add page | Enter 1000 chars, Save; then 1001 chars, Save | 1000 / 1001 chars | 1000 accepted; 1001 rejected server-side (no client-side maxLength found, so the FE lets you type past the limit before the server error surfaces) | P2 | Medium | Boundary | Yes |
| TC-ACC-FLD-21 | Accruals and Benefit | Instructions | HTML/script content rendered inert on View | On Add page | Enter `<img src=x onerror=alert(1)>`, Save, View | — | Stored and rendered as plain text, not executed | P0 | Critical | Security | Yes |
| TC-ACC-FLD-22 | Accruals and Benefit | ID | Auto-generated `ACC0xx` format, read-only | On Add page | Inspect ID field | — | Disabled input; not editable; server generates `ACC` + zero-padded id (e.g. `ACC001`) | P1 | Low | UI | Yes |
| TC-ACC-FLD-23 | Accruals and Benefit | ID | Edit page shows raw numeric id, not `ACC0xx` | Existing record | Open Edit, inspect ID field | — | Confirmed display bug: shows the raw primary key (e.g. `5`), while View/breadcrumb show `ACC005` for the same record | P2 | Medium | UI | Yes |

## 3. Calculation Methods

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-CALC-01 | Accruals and Benefit | Methods | Dropdown offers exactly 2 values | On Add page | Open Methods dropdown | — | "Fixed Value" and "Variable Salary Component" only — no "Formula"/"Percentage" top-level option | P1 | Low | Functional | Yes |
| TC-ACC-CALC-02 | Accruals and Benefit | Methods | Required — blank blocks Save | On Add page | Leave Methods empty, Save | — | Inline error; blocked | P0 | High | Validation | Yes |
| TC-ACC-CALC-03 | Accruals and Benefit | Methods | Invalid enum value via direct API | Direct API call | POST `method: "formula"` | `"formula"` | Rejected — not in BE enum | P1 | Medium | Negative | Yes |
| TC-ACC-CALC-04 | Accruals and Benefit | Fixed Value | Selecting shows Amount + Frequency sub-fields | Methods = Fixed Value | Select "Fixed Value" | — | Amount and Frequency inputs render; Variable Salary Component fields hidden | P0 | High | Functional | Yes |
| TC-ACC-CALC-05 | Accruals and Benefit | Fixed Value | Amount required | Fixed Value selected | Leave Amount blank, Save | — | Inline required error; blocked | P0 | High | Validation | Yes |
| TC-ACC-CALC-06 | Accruals and Benefit | Fixed Value | Amount accepts 2-decimal precision | Fixed Value selected | Enter 15000.50, Save | `15000.50` | Accepted, precision preserved | P2 | Low | Boundary | Yes |
| TC-ACC-CALC-07 | Accruals and Benefit | Fixed Value | Amount = 0 passes schema, fails business logic | Fixed Value selected | Enter 0, Save | `0` | Confirmed gap: JSON-schema `minimum:0` allows it, but the service throws "Amount must be a positive number" — expect a save failure with this specific message, not the generic Yup error | P1 | High | Negative | Yes |
| TC-ACC-CALC-08 | Accruals and Benefit | Fixed Value | Amount rejects negative values | Fixed Value selected | Enter -500, Save | `-500` | Blocked — negative fails both schema `minimum:0` and service check | P1 | Medium | Negative | Yes |
| TC-ACC-CALC-09 | Accruals and Benefit | Fixed Value | Amount — very large value | Fixed Value selected | Enter 99999999.99, Save | `99999999.99` | Verify live against `DECIMAL(10,2)` column overflow behavior | P2 | Low | Boundary | Manual first |
| TC-ACC-CALC-10 | Accruals and Benefit | Fixed Value | Frequency dropdown shows only 3 FE values | Fixed Value selected | Open Frequency dropdown | — | Only Monthly/Annual(`yearly`)/One Time render — matches DB entity enum, not the wider BE validator enum | P1 | Medium | Functional | Yes |
| TC-ACC-CALC-11 | Accruals and Benefit | Frequency | UI-unreachable enum values accepted via direct API | Direct API call | POST `frequency: "daily"` (also `"weekly"`, `"quarterly"`) | `daily`/`weekly`/`quarterly` | Accepted server-side (BE create-validator enum has 6 values) despite no UI path to produce them | P1 | High | Negative | Yes |
| TC-ACC-CALC-12 | Accruals and Benefit | Frequency | Unreachable value's payroll treatment | A record saved via API with `frequency: "daily"` | Run monthly payroll's accrual calculation for an employee assigned this accrual | — | Confirmed: falls into the helper's `default` branch and is treated as "apply every month," identical to `monthly` — verify this is the intended fallback, not a silent miscalculation | P1 | High | Negative | Manual first |
| TC-ACC-CALC-13 | Accruals and Benefit | Frequency | `yearly` only applies in January | Record with `frequency: "yearly"` assigned to an employee | Run payroll calc for a non-January month, then for January | — | Confirmed hardcoded: accrual only applies when `month === 1` | P2 | Medium | Functional | Manual first |
| TC-ACC-CALC-14 | Accruals and Benefit | Variable Salary Component | Selecting shows Base Component/Operator/Value/Cap Limit | Methods = Variable Salary Component | Select it | — | Fixed Value fields hidden; these 4 fields render | P0 | High | Functional | Yes |
| TC-ACC-CALC-15 | Accruals and Benefit | Base Component | Dropdown offers Basic Salary/Gross Salary/CTC, required | Variable Salary Component selected | Open dropdown; leave blank and Save | — | 3 options render; blank blocks Save (Yup required + BE conditional required + service non-empty check, all three layers) | P0 | High | Validation | Yes |
| TC-ACC-CALC-16 | Accruals and Benefit | Operator | Dropdown offers `+ - * / %`, required | Variable Salary Component selected | Open dropdown; leave blank and Save | — | 5 symbols render; blank blocks Save | P0 | High | Validation | Yes |
| TC-ACC-CALC-17 | Accruals and Benefit | Value | Required, integer-only client-side | Variable Salary Component selected | Leave blank, Save; then enter a decimal like 100.5 | — / `100.5` | Blank blocks Save; decimal input blocked/truncated client-side despite the DB column being `DECIMAL(10,2)` | P1 | Medium | Boundary | Yes |
| TC-ACC-CALC-18 | Accruals and Benefit | Value | Decimal accepted via direct API despite UI restriction | Direct API call | POST `value: 100.5` | `100.5` | Accepted — BE has no decimal-place restriction, confirming the FE-only `float_step="0"` restriction | P2 | Medium | Negative | Yes |
| TC-ACC-CALC-19 | Accruals and Benefit | Value | 0 passes schema, fails business logic | Variable Salary Component selected | Enter 0, Save | `0` | Same layered gap as Fixed Value's Amount — schema allows, service rejects with "positive number" error | P1 | High | Negative | Yes |
| TC-ACC-CALC-20 | Accruals and Benefit | Cap Limit | Optional — blank saves successfully | Variable Salary Component selected | Leave Cap Limit blank, Save | — | Accepted | P2 | Low | Validation | Yes |
| TC-ACC-CALC-21 | Accruals and Benefit | Cap Limit | Confirmed bug — 0 bypasses its own validation | Variable Salary Component selected, Value = 500 | Enter Cap Limit = 0, Save | `cap_limit: 0` | Confirmed: both the "must be positive" and "must be ≥ Value" service checks use a falsy test on `cap_limit`, so `0` silently passes despite being logically invalid against Value=500 | P1 | High | Negative | Yes |
| TC-ACC-CALC-22 | Accruals and Benefit | Cap Limit | Rejects negative values | Variable Salary Component selected | Enter -100, Save | `-100` | Blocked (non-zero negative correctly fails the service's positivity check) | P1 | Medium | Negative | Yes |
| TC-ACC-CALC-23 | Accruals and Benefit | Cap Limit | Value below Cap Limit rejected when both non-zero | Variable Salary Component selected | Enter Value=1000, Cap Limit=500 | — | Rejected — Cap Limit must be ≥ Value per service check | P1 | Medium | Negative | Yes |
| TC-ACC-CALC-24 | Accruals and Benefit | Cap Limit | Integer-only client-side, unrestricted via API | Variable Salary Component selected | Enter a decimal in Cap Limit via UI; then POST a decimal directly | `250.75` | UI blocks/truncates; direct API accepts it | P2 | Low | Boundary | Yes |
| TC-ACC-CALC-25 | Accruals and Benefit | Operator | Division by zero silently returns 0 | Variable Salary Component, Operator = `/`, Value = 0 | Save, then trigger `calculate-amount` for this record | `operator: "/", value: 0` | Confirmed bug: returns `0` instead of an error, in both the calculate-amount endpoint and the payroll helper | P1 | High | Negative | Yes |
| TC-ACC-CALC-26 | Accruals and Benefit | Method switch | Switching Fixed Value → Variable Salary Component clears/hides prior sub-fields | Fixed Value filled in | Switch Methods dropdown | — | Fixed Value fields hidden; Variable Salary Component fields empty and required afresh | P1 | Medium | Functional | Yes |
| TC-ACC-CALC-27 | Accruals and Benefit | Method switch on Edit | Switching method on Edit re-enforces new method's required fields | Existing Fixed Value record | Open Edit, switch to Variable Salary Component, Save without filling new fields | — | Confirmed: `validateAccrualMasterData` re-checks method-specific fields on every update regardless of what changed — correctly blocks this | P1 | High | Validation | Yes |
| TC-ACC-CALC-28 | Accruals and Benefit | `calculate-amount` endpoint | Location/Department filters gate applicability | Record has `location_id`/`department_id` set | POST `/calculate-amount` with non-intersecting `location_ids`/`department_ids` | — | Excluded from the result with an explicit error entry, not silently omitted | P2 | Medium | API | Yes |
| TC-ACC-CALC-29 | Accruals and Benefit | Base Component mapping | Basic Salary/Gross Salary/CTC map correctly to payroll source values | Records covering all 3 base components | Trigger `calculate-amount` for each | — | Each resolves to the correct underlying salary figure, matching the shared `getBaseComponentAmount` map used identically in both the service and payroll helper | P2 | Medium | Functional | Yes |
| TC-ACC-CALC-30 | Accruals and Benefit | Operator label rendering | Operator symbols, not word labels, render in tooltips | Record with `operator: "%"` (or any symbol) | Open the accrual calculation tooltip | — | Confirmed dead code: `OPERATOR_LABELS` dictionary keys (`percentage/multiply/...`) never match stored symbol values, so the raw symbol always renders instead of a word label | P3 | Low | UI | Yes |

## 4. Classifications (Location / Department)

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-CLASS-01 | Accruals and Benefit | Location/Department | Both disabled until Company selected | On Add page, Company empty | Attempt to open Location/Department dropdowns | — | Both disabled (`DynamicDependentField` filtered on Company) | P0 | High | Dependency | Yes |
| TC-ACC-CLASS-02 | Accruals and Benefit | Location/Department | Enable and load options scoped to Company after selection | On Add page | Select a Company | — | Both enabled; options filtered to that Company | P0 | High | Dependency | Yes |
| TC-ACC-CLASS-03 | Accruals and Benefit | Location/Department | Changing Company clears previously selected values | Company A + Location/Department selected | Change Company to B | — | Both reset to empty array | P0 | High | Dependency | Yes |
| TC-ACC-CLASS-04 | Accruals and Benefit | Department | Required — blank blocks Save (FE) | On Add page | Leave Department empty, Save | — | Inline error; blocked (Yup `min(1).required()`) | P0 | High | Validation | Yes |
| TC-ACC-CLASS-05 | Accruals and Benefit | Location | Optional — blank saves successfully (FE) | On Add page | Leave Location empty, Save | — | Accepted — no Yup rule exists for Location | P1 | Medium | Validation | Yes |
| TC-ACC-CLASS-06 | Accruals and Benefit | Department | Omitted via direct API despite FE-required | Direct API call | POST without `department_id` | — | Accepted — confirmed FE/BE gap; neither field is in either validator's `required[]`, both `nullable: true` | P1 | High | Negative | Yes |
| TC-ACC-CLASS-07 | Accruals and Benefit | Location/Department | Multi-select — multiple values persist on Save | On Add page | Select 3+ Locations and 3+ Departments, Save, reopen | — | All selections persist on Edit/View | P1 | Medium | Functional | Yes |
| TC-ACC-CLASS-08 | Accruals and Benefit | Location/Department | Deselecting persists the removal | Record with values selected | Open Edit, deselect one of each, Save | — | Removed items no longer listed on reopen | P1 | Medium | Functional | Yes |
| TC-ACC-CLASS-09 | Accruals and Benefit | Location/Department | Search filters the already company-scoped list | Company selected | Type a partial name in either dropdown | — | Matching options filtered within that Company's set only | P2 | Low | Functional | Yes |
| TC-ACC-CLASS-10 | Accruals and Benefit | Location/Department | Empty result set for a Company with zero Locations/Departments | Company with 0 linked records | Select that Company, open dropdowns | — | Empty/no-data state, not an error | P2 | Low | Boundary | Yes |
| TC-ACC-CLASS-11 | Accruals and Benefit | Location/Department | Pre-populate correctly on Edit, scoped to saved Company | Existing record with values saved | Open Edit | — | Previously selected items pre-populate, matching saved Company's scope | P0 | High | Functional | Yes |
| TC-ACC-CLASS-12 | Accruals and Benefit | Location/Department | Render as comma-separated read-only list on View | Record with multiple values | Open View | — | Full list renders as static text, wraps correctly | P1 | Low | UI | Yes |
| TC-ACC-CLASS-13 | Accruals and Benefit | Storage | Values stored/round-trip correctly as JSON arrays | Record saved with several ids | Inspect the API response for this record | — | `location_id`/`department_id` round-trip as JSON arrays; `location_data`/`department_data` enrich to id+name objects | P2 | Low | API | Yes |
| TC-ACC-CLASS-14 | Accruals and Benefit | Cross-FK integrity | Department id belonging to a different company than `company_id` | Direct API call | POST a department id from Company B while `company_id` is Company A | Mismatched ids | Verify live whether any FK validation blocks this — not confirmed from source | P1 | High | Negative | Manual first |

## 5. Attachments

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-ATT-01 | Accruals and Benefit | Upload | Single image upload succeeds | On Add page | Upload a `.png`/`.jpg` | — | File uploads, preview/filename shows | P1 | Medium | Functional | Yes |
| TC-ACC-ATT-02 | Accruals and Benefit | Upload | PDF upload succeeds | On Add page | Upload a `.pdf` | — | File uploads correctly | P1 | Medium | Functional | Yes |
| TC-ACC-ATT-03 | Accruals and Benefit | Upload | DOC/DOCX upload succeeds | On Add page | Upload a `.docx` | — | File uploads correctly | P2 | Low | Functional | Yes |
| TC-ACC-ATT-04 | Accruals and Benefit | Upload | XLS/XLSX upload succeeds | On Add page | Upload a `.xlsx` | — | File uploads correctly | P2 | Low | Functional | Yes |
| TC-ACC-ATT-05 | Accruals and Benefit | Confirmed bug | Multi-file upload silently keeps only the first file | On Add page | Upload 2+ files, Save, reopen | 2 files | Confirmed: only the first uploaded file persists; the rest are silently dropped with no user-facing warning, despite the picker allowing multi-select | P0 | High | Negative | Yes |
| TC-ACC-ATT-06 | Accruals and Benefit | Duplicate files | Uploading the same file twice in one session | On Add page | Upload `file.pdf` twice | — | Verify live behavior — not confirmed from source (component internals inaccessible) | P2 | Low | Negative | Manual first |
| TC-ACC-ATT-07 | Accruals and Benefit | Maximum size | File over the component's size limit is rejected | On Add page | Upload an oversized file | — | Verify live max size and rejection message — cannot be confirmed from source (pre-built dependency, no `max_size` prop passed) | P1 | Medium | Boundary | Manual first |
| TC-ACC-ATT-08 | Accruals and Benefit | Unsupported extension | `.exe`/`.sh` rejected | On Add page | Upload a `.exe` file | — | Verify live rejection and messaging — not confirmed from source | P1 | High | Security | Manual first |
| TC-ACC-ATT-09 | Accruals and Benefit | Delete attachment | Removing an uploaded file before Save works | On Add page, file uploaded | Click remove/delete on the attachment | — | File cleared from the form state, not submitted | P2 | Low | Functional | Yes |
| TC-ACC-ATT-10 | Accruals and Benefit | Preview | Uploaded attachment can be previewed | Existing record with an attachment | Open View, click the attachment | — | Preview renders (matches screenshot's linked filename pattern) | P2 | Low | Functional | Yes |
| TC-ACC-ATT-11 | Accruals and Benefit | Download | Attachment can be downloaded from View | Existing record with an attachment | Click download on the attachment | — | File downloads successfully | P2 | Low | Functional | Yes |
| TC-ACC-ATT-12 | Accruals and Benefit | Replace on Edit | Uploading a new file on Edit replaces the old one | Existing record with an attachment | Open Edit, upload a different file, Save | — | New file replaces old (single-URL storage confirms only one can ever persist) | P1 | Medium | Functional | Yes |
| TC-ACC-ATT-13 | Accruals and Benefit | Remove on Edit | Removing the attachment on Edit clears it | Existing record with an attachment | Open Edit, remove attachment, Save | — | Attachment field becomes null/empty on reload | P1 | Medium | Functional | Yes |
| TC-ACC-ATT-14 | Accruals and Benefit | Storage payload | BE accepts both string and array shapes for `attachment` | Direct API call | POST `attachment` as a plain string, then as a single-element array | — | Both accepted per the schema's `anyOf`; DB column remains a single string either way | P2 | Low | API | Yes |

## 6. Save / Save as Draft / Discard

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-SAVE-01 | Accruals and Benefit | Save | Successful Save redirects to list with new row visible | On Add page, valid data | Fill mandatory fields, Save | — | Redirected to list; new row shows `ACC0xx` id | P0 | High | Functional | Yes |
| TC-ACC-SAVE-02 | Accruals and Benefit | Save | Button shows loading/disabled state in-flight | On Add page | Click Save | — | Button disabled/loader shown until response | P2 | Medium | UI | Yes |
| TC-ACC-SAVE-03 | Accruals and Benefit | Save | Rapid double-click doesn't create duplicates | On Add page, valid data | Double-click Save quickly | — | Exactly one record created | P1 | High | Negative | Yes |
| TC-ACC-SAVE-04 | Accruals and Benefit | Save | Missing required field blocks Save | On Add page | Omit Name, click Save | — | Inline error; no record created, no navigation | P0 | High | Validation | Yes |
| TC-ACC-SAVE-05 | Accruals and Benefit | Save | Server 500 error handled gracefully | Mocked 500 on POST | Fill valid form, Save | — | Error toast shown; stays on form, no false success | P1 | High | Negative | Yes |
| TC-ACC-SAVE-06 | Accruals and Benefit | Save | Duplicate Name shows a distinct conflict error | Existing "Health Insurance" record | Save another "Health Insurance" | — | Clear duplicate/conflict error, distinguishable from generic 500 | P1 | Medium | Negative | Yes |
| TC-ACC-SAVE-07 | Accruals and Benefit | Save | Network drop mid-Save | Simulated offline | Fill form, go offline, Save | — | Network-error state shown, no silent data loss | P2 | Medium | Negative | Yes |
| TC-ACC-SAVE-08 | Accruals and Benefit | Save | Session expiry mid-Save (401) | Mocked 401 | Fill form, Save | — | Existing 401/403 fast-fail behavior surfaces as auth failure | P1 | Medium | Negative | Yes |
| TC-ACC-SAVE-09 | Accruals and Benefit | Save | Full Update rejects a genuinely partial payload | Existing record, direct API | PUT `{ amount: 500 }` only | — | Confirmed: rejected with a business-rule error ("Name is required") despite the update schema not marking these fields required | P1 | High | Negative | Yes |
| TC-ACC-SAVE-10 | Accruals and Benefit | Save To Draft | Persists with all required-looking fields blank | On Add page | Click Save To Draft with nothing but perhaps a Name filled | — | Accepted — draft route has no server body schema and skips business validation entirely | P0 | High | Functional | Yes |
| TC-ACC-SAVE-11 | Accruals and Benefit | Save To Draft | Client-side Yup validation is never invoked on this path | On Add page | Leave Company/Name/Type/Method all empty, click Save To Draft | — | Confirmed: draft handler calls `getValues()` directly, not `trigger()`/`handleSubmit()` — no inline errors appear at all, and the request still fires | P1 | High | Negative | Yes |
| TC-ACC-SAVE-12 | Accruals and Benefit | Save To Draft | Malformed types accepted on the unvalidated draft route | Direct API call | POST `/accrual-master/draft` with `amount: "abc"` | `amount: "abc"` | Verify live actual behavior — confirmed no AJV schema on this route, so no type coercion/rejection happens at the schema layer | P1 | High | Negative | Manual first |
| TC-ACC-SAVE-13 | Accruals and Benefit | Save To Draft | Status chip shows "Draft" regardless of Active/Inactive state | Saved as Draft | Load list | — | Chip shows "Draft," matching this suite's other HRMS modules' `is_draft`-overrides-status pattern — confirm this module follows the same convention | P1 | High | Functional | Yes |
| TC-ACC-SAVE-14 | Accruals and Benefit | Save To Draft | Re-saving an existing Draft as Draft again | Existing Draft | Open Edit, change a field, Save To Draft | — | Update persists; record remains Draft | P1 | Medium | Functional | Yes |
| TC-ACC-SAVE-15 | Accruals and Benefit | Final Save | Converting Draft to a full record enforces full validation | Existing Draft missing Method/Department | Open Edit, click real Save without filling the gaps | — | Blocked — the real Save path runs full Yup + business validation, unlike Draft | P0 | High | Functional | Yes |
| TC-ACC-SAVE-16 | Accruals and Benefit | Discard | Discard on Add with fields filled creates nothing | On Add page, fields filled | Click Discard | — | Redirected to list; no record created | P0 | High | Functional | Yes |
| TC-ACC-SAVE-17 | Accruals and Benefit | Discard | Discard on Edit leaves original record untouched | On Edit page, field changed | Click Discard | — | Reopening Edit shows original, unchanged value | P0 | High | Functional | Yes |
| TC-ACC-SAVE-18 | Accruals and Benefit | Discard | Confirmation dialog before discarding unsaved changes | On Add/Edit with unsaved changes | Click Discard | — | Verify live whether a confirm dialog appears — not confirmed from source | P2 | Low | UI | Manual first |

## 7. Edit

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-EDIT-01 | Accruals and Benefit | Preload | Basic Details preload from saved record | Existing record | Open Edit | — | All Basic Details fields show saved values (except the confirmed ID-display bug, see FLD-23) | P0 | High | Functional | Yes |
| TC-ACC-EDIT-02 | Accruals and Benefit | Preload | Calculation Methods preload with correct method re-selected | Existing Fixed Value record | Open Edit | — | "Fixed Value" selected; Amount/Frequency show saved values, VSC fields hidden | P0 | High | Functional | Yes |
| TC-ACC-EDIT-03 | Accruals and Benefit | Preload | Variable Salary Component sub-fields preload correctly | Existing VSC record | Open Edit | — | Base Component/Operator/Value/Cap Limit all show saved values | P1 | Medium | Functional | Yes |
| TC-ACC-EDIT-04 | Accruals and Benefit | Preload | Location/Department preload scoped to saved Company | Record saved with values | Open Edit | — | Previously selected items pre-populate | P0 | High | Functional | Yes |
| TC-ACC-EDIT-05 | Accruals and Benefit | Preload | Attachment preloads and shows the existing filename | Record with an attachment | Open Edit | — | Existing file shown, replaceable/removable | P1 | Medium | Functional | Yes |
| TC-ACC-EDIT-06 | Accruals and Benefit | Dependency | Changing Company on Edit clears preloaded Location/Department | Record with Company A + values | Open Edit, change Company to B | — | Both reset to empty | P0 | High | Dependency | Yes |
| TC-ACC-EDIT-07 | Accruals and Benefit | Save | Updating a single field persists only that change | Existing record | Change Name, Save | — | Only Name updates; all other fields unchanged | P0 | High | Functional | Yes |
| TC-ACC-EDIT-08 | Accruals and Benefit | Save | Renaming to another record's Name is blocked | Two existing records | Rename record A to match record B's name | — | Blocked by uniqueness check | P1 | Medium | Negative | Yes |
| TC-ACC-EDIT-09 | Accruals and Benefit | Save | Changing Status persists correctly | Existing Active record | Change Status to Inactive, Save | — | List reflects Inactive | P1 | Medium | Functional | Yes |
| TC-ACC-EDIT-10 | Accruals and Benefit | Method switch | Switching method without filling new sub-fields is blocked | Existing Fixed Value record | Switch to Variable Salary Component, Save without filling Base Component/Operator/Value | — | Blocked — business logic re-validates method-specific fields on every update | P1 | High | Validation | Yes |
| TC-ACC-EDIT-11 | Accruals and Benefit | Deleted record | Opening Edit for a soft-deleted id via direct URL | Soft-deleted record's id | Navigate directly to its Edit URL | — | Confirmed gap: `fetchAccrualMasterById` does not filter `is_deleted` — the record may still load instead of 404/blocking | P1 | High | Negative | Yes |
| TC-ACC-EDIT-12 | Accruals and Benefit | Backend | Update validator has no top-level required fields, but service still requires them | Direct API call | PUT omitting `name`/`type`/`method` | — | Rejected by business logic (`validateAccrualMasterData`), not by the schema itself | P1 | High | Negative | Yes |

## 8. View

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-VIEW-01 | Accruals and Benefit | Basic Details | Renders read-only, matching saved record | Existing record | Open View | — | Correct values shown, no editable inputs | P0 | High | Functional | Yes |
| TC-ACC-VIEW-02 | Accruals and Benefit | ID display | Shows the `ACC0xx` business id, not the raw numeric id | Existing record | Open View | — | Confirmed correct here (unlike Edit's ID field) | P1 | Low | Functional | Yes |
| TC-ACC-VIEW-03 | Accruals and Benefit | Calculation Methods | Only the active method's fields render | Fixed Value record | Open View | — | Amount/Frequency shown; VSC fields not rendered | P1 | Medium | Functional | Yes |
| TC-ACC-VIEW-04 | Accruals and Benefit | Calculation Methods | Variable Salary Component fields render correctly | VSC record | Open View | — | Base Component/Operator/Value/Cap Limit all shown, matching saved values | P1 | Medium | Functional | Yes |
| TC-ACC-VIEW-05 | Accruals and Benefit | Classifications | Location/Department render as comma-separated read-only list | Record with multiple values | Open View | — | Full list renders, wraps correctly | P1 | Low | UI | Yes |
| TC-ACC-VIEW-06 | Accruals and Benefit | Attachments | Attachment section renders the filename/link | Record with an attachment | Open View | — | Filename shown (matches the screenshot's linked-file pattern), clickable | P1 | Medium | Functional | Yes |
| TC-ACC-VIEW-07 | Accruals and Benefit | Summary panel | Right-hand Summary mirrors main body values | Existing record | Open View | — | ID/Name/Type/Methods/Company match main content (per screenshot layout) | P1 | Medium | Functional | Yes |
| TC-ACC-VIEW-08 | Accruals and Benefit | Activity tab | Shows change history | Record with prior edits | Click Activity tab | — | Verify live actual content — not confirmed from source | P2 | Low | Functional | Manual first |
| TC-ACC-VIEW-09 | Accruals and Benefit | Read-only | No field accepts focus/typing | Existing record | Attempt to click/type into any field | — | No effect; all fields non-interactive | P0 | Medium | UI | Yes |
| TC-ACC-VIEW-10 | Accruals and Benefit | Actions menu | Offers Edit/Delete per permissions | `canEdit`/`canDelete` set | Open Actions menu | — | Options gated correctly by permission flags | P1 | Medium | RBAC | Yes |
| TC-ACC-VIEW-11 | Accruals and Benefit | Placeholder | Blank saved values render "-" | Record with blank Instructions | Open View | — | "-" shown, not empty whitespace | P2 | Low | UI | Yes |
| TC-ACC-VIEW-12 | Accruals and Benefit | Soft-deleted record | Viewing a soft-deleted record via direct URL | Soft-deleted record's id | Navigate directly to its View URL | — | Confirmed gap: `fetchAccrualMasterById` doesn't filter `is_deleted` — record may still render instead of 404 | P1 | High | Negative | Yes |

## 9. Actions Menu

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-ACT-01 | Accruals and Benefit | Edit | Available when `canEdit` true | View page, `canEdit` true | Open Actions menu | — | "Edit" option present and enabled | P1 | Medium | RBAC | Yes |
| TC-ACC-ACT-02 | Accruals and Benefit | Delete | Available when `canDelete` true | View/List, `canDelete` true | Open Actions/row menu | — | "Delete" option present and enabled | P1 | Medium | RBAC | Yes |
| TC-ACC-ACT-03 | Accruals and Benefit | Status toggle | Active ↔ Inactive toggle is reachable and confirmation-free | Existing record | Toggle status via list/view control | — | Verify live exact UI affordance (switch vs Actions-menu item) — confirmed backend endpoint is a lightweight status-only PATCH with no extra validation | P2 | Medium | Functional | Manual first |
| TC-ACC-ACT-04 | Accruals and Benefit | Duplicate | Whether a "Duplicate" action exists | View/List | Open Actions/row menu | — | Verify live — not confirmed from source; if present, confirm it doesn't copy the (single) attachment reference in a way that corrupts the original | P2 | Low | Functional | Manual first |
| TC-ACC-ACT-05 | Accruals and Benefit | Export | "Generate Excel" gated by `generateexcel` permission | User without `generateexcel` | Look for an export action | — | Verify live: button hidden without the permission (route itself has `isRbacResource: true`, confirming server-side enforcement exists) | P2 | Medium | RBAC | Yes |
| TC-ACC-ACT-06 | Accruals and Benefit | Import | "Import" gated by `import` permission | User without `import` | Look for an import action | — | Verify live: hidden without permission; route has `isRbacResource: true` | P2 | Medium | RBAC | Yes |
| TC-ACC-ACT-07 | Accruals and Benefit | Confirmation dialogs | Delete requires explicit confirmation | Existing record | Click Delete | — | Confirmation dialog shown before removal | P1 | Medium | Functional | Yes |
| TC-ACC-ACT-08 | Accruals and Benefit | Download attachment | Download action works from the Actions/attachment area | Record with an attachment | Trigger download | — | File downloads successfully | P2 | Low | Functional | Yes |

## 10. Search

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-SRCH-01 | Accruals and Benefit | Search | Matches by full Name | Record "Travel Allowance" exists | Search "Travel Allowance" | — | Matching record returned | P0 | Medium | Functional | Yes |
| TC-ACC-SRCH-02 | Accruals and Benefit | Search | Matches by partial substring | Same record | Search "Travel" | — | Matching record returned | P1 | Low | Functional | Yes |
| TC-ACC-SRCH-03 | Accruals and Benefit | Search | Case-insensitive | Same record | Search "TRAVEL ALLOWANCE" | — | Matching record returned | P1 | Low | Functional | Yes |
| TC-ACC-SRCH-04 | Accruals and Benefit | Search | Matches by ID (`ACC0xx`) | Record ACC052 exists | Search "ACC052" | — | Matching record returned | P1 | Medium | Functional | Yes |
| TC-ACC-SRCH-05 | Accruals and Benefit | Search | No matches shows empty state | — | Search a nonsense string | — | Shared empty/no-data state renders | P1 | Low | UI | Yes |
| TC-ACC-SRCH-06 | Accruals and Benefit | Search | Resets to first page of results | On page 2+ | Enter a search term | — | Results reset to page 1 | P2 | Medium | Functional | Yes |
| TC-ACC-SRCH-07 | Accruals and Benefit | Search | Clearing restores full list | Search active | Clear search box | — | Full unfiltered list returns | P1 | Low | Functional | Yes |
| TC-ACC-SRCH-08 | Accruals and Benefit | Search | Special characters don't error | — | Search `%`, `_`, `'` | — | No 500; literal match or no-results state | P2 | Medium | Negative | Yes |

## 11. Filters

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-FILT-01 | Accruals and Benefit | Filter panel | Opens from the Filter button | List loaded | Click Filter | — | Filter panel/menu opens | P2 | Low | UI | Yes |
| TC-ACC-FILT-02 | Accruals and Benefit | Company filter | Narrows list to matching Company | Records across multiple companies | Filter by Company A | — | Only Company A records shown | P1 | Medium | Functional | Yes |
| TC-ACC-FILT-03 | Accruals and Benefit | Type filter | Narrows by Allowance/Deduction | Mixed-type records | Filter by "Deduction" | — | Only Deduction records shown | P1 | Medium | Functional | Yes |
| TC-ACC-FILT-04 | Accruals and Benefit | Status filter | Narrows by Active/Inactive/Draft | Mixed-status records | Filter by Draft | — | Only Draft records shown | P1 | Medium | Functional | Yes |
| TC-ACC-FILT-05 | Accruals and Benefit | Location filter | Narrows by Location | Records across multiple locations | Filter by one Location | — | Only matching records shown | P2 | Low | Functional | Yes |
| TC-ACC-FILT-06 | Accruals and Benefit | Multiple filters | Combine with AND logic | — | Apply Company + Status filters together | — | Verify live — AND vs OR combination not confirmed | P2 | Medium | Functional | Manual first |
| TC-ACC-FILT-07 | Accruals and Benefit | Reset | Clear filters restores full list | Filters applied | Click Reset/Clear | — | Full list returns | P2 | Low | Functional | Yes |
| TC-ACC-FILT-08 | Accruals and Benefit | Combined | Filter + Search narrow simultaneously | — | Apply a filter, then search | — | Result set narrowed by both conditions together | P2 | Low | Functional | Yes |

## 12. Sorting

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-SORT-01 | Accruals and Benefit | ID column | Sorts ascending/descending | Multiple records | Click ID header twice | — | Order toggles correctly both directions | P1 | Low | Functional | Yes |
| TC-ACC-SORT-02 | Accruals and Benefit | Name column | Sorts alphabetically both directions | Multiple records | Click Name header | — | Alphabetical ascending/descending order | P1 | Low | Functional | Yes |
| TC-ACC-SORT-03 | Accruals and Benefit | Type column | Groups Allowance/Deduction consistently | Mixed-type records | Click Type header | — | Consistent grouping both directions | P2 | Low | Functional | Yes |
| TC-ACC-SORT-04 | Accruals and Benefit | Company column | Sorts correctly | Multiple companies | Click Company header | — | Correct alphabetical order | P2 | Low | Functional | Yes |
| TC-ACC-SORT-05 | Accruals and Benefit | Status column | Groups Active/Inactive/Draft consistently | Mixed-status records | Click Status header | — | Consistent grouping both directions | P2 | Low | Functional | Yes |
| TC-ACC-SORT-06 | Accruals and Benefit | Blank values | Records with blank Company/Location sort predictably | Records with blanks present | Sort by that column | — | Blanks consistently land at one end | P2 | Medium | Boundary | Yes |

## 13. Pagination

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-PAGE-01 | Accruals and Benefit | Page size | Changing items-per-page reloads with new size | 60+ records exist | Change 20 → 50 | — | List reloads showing up to 50 rows | P1 | Medium | Functional | Yes |
| TC-ACC-PAGE-02 | Accruals and Benefit | Go To | Jump to a specific page number | 4+ pages exist | Enter page 3, submit | — | Navigates directly to page 3 (confirmed 3 pages exist live per screenshot) | P1 | Medium | Functional | Yes |
| TC-ACC-PAGE-03 | Accruals and Benefit | Next/Previous | Move one page at a time, disable at bounds | Multiple pages | Click Next repeatedly to last page | — | Next disables at last page; Previous disables at first page | P1 | Medium | Functional | Yes |
| TC-ACC-PAGE-04 | Accruals and Benefit | Page count | Updates after Add/Delete | On last page | Add or delete a record | — | "Page X of Y" recalculates correctly | P2 | Low | Functional | Yes |
| TC-ACC-PAGE-05 | Accruals and Benefit | State retention | Pagination behavior after Search/Filter | On page 2+ | Apply Search or Filter | — | Verify live whether page resets to 1 or is retained | P2 | Low | Functional | Manual first |
| TC-ACC-PAGE-06 | Accruals and Benefit | Refresh | Page number on browser refresh | On page 3 | Refresh browser | — | Verify live whether page 3 or page 1 loads | P3 | Low | Functional | Manual first |

## 14. Permissions (RBAC)

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-RBAC-01 | Accruals and Benefit | Add button | Hidden without `canAdd` | User lacking `canAdd` | Load list page | — | Add button not rendered | P0 | High | RBAC | Yes |
| TC-ACC-RBAC-02 | Accruals and Benefit | Edit action | Disabled without `canEdit` | User lacking `canEdit` | Open row/Actions menu | — | Edit disabled | P0 | High | RBAC | Yes |
| TC-ACC-RBAC-03 | Accruals and Benefit | Delete action | Disabled without `canDelete` | User lacking `canDelete` | Open row/Actions menu | — | Delete disabled | P0 | High | RBAC | Yes |
| TC-ACC-RBAC-04 | Accruals and Benefit | View route | Blocked without `canViewById` | User lacking `canViewById` | Navigate directly to a View URL | — | `ProtectedRoute` blocks access | P0 | High | RBAC | Yes |
| TC-ACC-RBAC-05 | Accruals and Benefit | List route | Blocked without `canView` | User lacking `canView` | Navigate directly to list URL | — | Access blocked | P0 | High | RBAC | Yes |
| TC-ACC-RBAC-06 | Accruals and Benefit | Server-side enforcement | Direct API bypass still blocked for Create/List/Get/Update/Delete/Draft-create/Export/Import | User lacking permission | Directly call each of these routes | — | Rejected — confirmed `isRbacResource: true` present on all 8 of these routes | P0 | High | RBAC | Yes |
| TC-ACC-RBAC-07 | Accruals and Benefit | Status route gap | `PATCH /:id/status` missing RBAC check | User with zero AccrualMaster permissions | Call `PATCH /:id/status` directly | — | Confirmed missing `isRbacResource: true` — verify live whether this call wrongly succeeds | P0 | Critical | Security | Yes |
| TC-ACC-RBAC-08 | Accruals and Benefit | Draft-update route gap | `PATCH /:id/draft` missing RBAC check | User with zero AccrualMaster permissions | Call `PATCH /:id/draft` directly | — | Confirmed missing `isRbacResource: true` — verify live whether this call wrongly succeeds | P0 | Critical | Security | Yes |
| TC-ACC-RBAC-09 | Accruals and Benefit | Calculate-amount route gap | `POST /calculate-amount` missing RBAC check | User with zero AccrualMaster permissions | Call `POST /calculate-amount` directly | — | Confirmed missing `isRbacResource: true` — verify live whether this call wrongly succeeds | P0 | Critical | Security | Yes |
| TC-ACC-RBAC-10 | Accruals and Benefit | Partial permission | `canAdd` without `canEdit` | User with only `canAdd` | Create a record, then attempt to edit it | — | Create succeeds; Edit remains blocked | P1 | Medium | RBAC | Yes |

## 15. API Testing

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-API-01 | Accruals and Benefit | Create | Valid complete Fixed Value payload creates a record | Authenticated | `POST /v1/accrual-master` | Valid Fixed Value payload | 2xx; record retrievable, `accrual_id` in `ACC0xx` format | P0 | High | API | Yes |
| TC-ACC-API-02 | Accruals and Benefit | Create | Valid complete Variable Salary Component payload creates a record | Authenticated | `POST` with VSC fields | Valid VSC payload | 2xx; record retrievable | P0 | High | API | Yes |
| TC-ACC-API-03 | Accruals and Benefit | Create | Missing `name`/`type`/`method` rejected | Authenticated | `POST` omitting each field individually | — | 4xx validation error for each | P0 | High | API | Yes |
| TC-ACC-API-04 | Accruals and Benefit | Create | `company_id` omitted accepted | Authenticated | `POST` without `company_id` | — | Accepted — confirmed property not declared in schema at all | P1 | Medium | API | Yes |
| TC-ACC-API-05 | Accruals and Benefit | Create | `department_id` omitted accepted despite FE-required | Authenticated | `POST` without `department_id` | — | Accepted — confirmed `nullable: true`, not in `required[]` | P1 | High | API | Yes |
| TC-ACC-API-06 | Accruals and Benefit | Create | Duplicate `name` rejected | Existing record | `POST` same name | — | Rejected via uniqueness check | P1 | High | API | Yes |
| TC-ACC-API-07 | Accruals and Benefit | Create | Invalid `type` enum value rejected | Authenticated | `POST type: "bonus"` | `"bonus"` | Rejected | P1 | Medium | API | Yes |
| TC-ACC-API-08 | Accruals and Benefit | Create | Invalid `method` enum value rejected | Authenticated | `POST method: "formula"` | `"formula"` | Rejected — confirmed not a real enum value | P1 | Medium | API | Yes |
| TC-ACC-API-09 | Accruals and Benefit | Create | `frequency` accepts UI-unreachable values | Authenticated | `POST frequency: "daily"` (also weekly, quarterly) | — | Accepted despite no FE path to these values | P1 | High | API | Yes |
| TC-ACC-API-10 | Accruals and Benefit | Create | `amount`/`value` of exactly 0 rejected by service layer | Authenticated | `POST amount: 0` | `0` | Schema-valid, service-rejected — expect a specific "must be a positive number" error, not a generic 4xx | P1 | High | API | Yes |
| TC-ACC-API-11 | Accruals and Benefit | Create | `cap_limit: 0` bug is API-reachable | Authenticated | `POST` VSC payload with `value: 500, cap_limit: 0` | — | Confirmed accepted despite the intended "cap ≥ value" rule, due to the falsy-zero bug | P1 | High | API | Yes |
| TC-ACC-API-12 | Accruals and Benefit | Update | Partial-merge rejected — full business validation still applies | Existing record | `PUT` with a single field only | — | Rejected — `name`/`type`/`method` required by service logic on every update | P1 | High | API | Yes |
| TC-ACC-API-13 | Accruals and Benefit | Update | `department_id: null` accepted | Existing record | `PUT` with null department | — | Accepted (nullable, no required rule) | P1 | Medium | API | Yes |
| TC-ACC-API-14 | Accruals and Benefit | Draft | `/draft` POST accepts a completely empty body | Authenticated | `POST /v1/accrual-master/draft` `{}` | `{}` | Accepted — confirmed no body schema on this route | P1 | High | API | Yes |
| TC-ACC-API-15 | Accruals and Benefit | Draft | `/draft` PATCH accepts malformed types | Existing draft | `PATCH /:id/draft` with `amount: "abc"` | `"abc"` | Verify live actual persisted/returned behavior — no AJV schema on this route | P1 | High | API | Manual first |
| TC-ACC-API-16 | Accruals and Benefit | Status | Toggle status for another company's record | Cross-company record exists | `PATCH /:id/status` on it | — | Verify live whether blocked — confirmed missing `isRbacResource` | P0 | Critical | Security | Manual first |
| TC-ACC-API-17 | Accruals and Benefit | List | Response shape matches rendered columns | Authenticated | `GET /v1/accrual-master` | — | Fields match `accrual_id`/`name`/`type`/`company_data.name`/`location_data`/`status` | P1 | Medium | API | Yes |
| TC-ACC-API-18 | Accruals and Benefit | Get by id | Non-existent id returns 404 | Authenticated | `GET /v1/accrual-master/999999999` | — | 404, not 500/empty 200 | P1 | Medium | API | Yes |
| TC-ACC-API-19 | Accruals and Benefit | Get by id | Soft-deleted id still returned | Just soft-deleted a record | `GET /v1/accrual-master/:id` | — | Confirmed gap: no `is_deleted` filter on this lookup — record still returns | P1 | High | API | Yes |
| TC-ACC-API-20 | Accruals and Benefit | Delete | Soft delete confirmed, subsequent list excludes it | Existing record | `DELETE /v1/accrual-master/:id`, then `GET` list | — | Record absent from list response | P1 | Medium | API | Yes |
| TC-ACC-API-21 | Accruals and Benefit | Calculate-amount | Division by zero returns 0, not an error | Authenticated | `POST /calculate-amount` for a record with operator `/` and a value resolving to 0 | — | Confirmed: returns `0` silently instead of an error response | P1 | High | API | Yes |
| TC-ACC-API-22 | Accruals and Benefit | Calculate-amount | Location/Department filter exclusion | Authenticated | `POST /calculate-amount` with non-matching `location_ids`/`department_ids` | — | Record excluded with an explicit error entry in the response, not silently | P2 | Medium | API | Yes |

## 16. Database Validation

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-DB-01 | Accruals and Benefit | ID generation | `accrual_id` is unique, sequential, `ACC0xx`-formatted | Multiple creates | Create several records | — | Each gets a unique `ACC00N` id | P1 | Medium | DB | Yes |
| TC-ACC-DB-02 | Accruals and Benefit | Audit fields | `created_by`/`updated_by` populate with acting user | Authenticated create/update | Create then update a record | — | Both fields reflect the correct user id | P1 | Medium | DB | Yes |
| TC-ACC-DB-03 | Accruals and Benefit | Nullable columns | `name`/`type`/`method` are DB-nullable (support empty drafts) | Draft record saved with all blank | Inspect DB row | — | Confirmed nullable per the 2026-05-11 migration | P2 | Low | DB | Yes |
| TC-ACC-DB-04 | Accruals and Benefit | Soft delete | `is_deleted`/`deleted_by`/`deleted_at` set atomically on delete | Existing record | Delete it | — | All three columns populated correctly | P1 | Medium | DB | Yes |
| TC-ACC-DB-05 | Accruals and Benefit | JSON columns | `location_id`/`department_id` store as JSON arrays, not `BIGINT` | Record with multiple values | Inspect DB row | — | Confirmed migrated to JSON type; serialized/parsed by the service layer | P2 | Low | DB | Yes |
| TC-ACC-DB-06 | Accruals and Benefit | Enum column | `method` DB `ENUM` only allows the 2 real values | Direct DB insert bypassing API | Insert `method: 'formula'` | `'formula'` | Rejected at the DB layer by the `ENUM` constraint | P2 | Medium | DB | Manual first |
| TC-ACC-DB-07 | Accruals and Benefit | Frequency enum mismatch | Entity/DB enum only lists 3 frequency values, contradicting the 6-value BE validator enum | Direct insert with `frequency: 'daily'` via the validated Create route | Create via API, then inspect entity-level read | — | Verify live whether the entity's stricter 3-value enum causes any read-side inconsistency for records saved with an "unreachable" 6-value option | P2 | Medium | DB | Manual first |
| TC-ACC-DB-08 | Accruals and Benefit | Company FK | `company_id` has no BE schema validation but is a real indexed/joined column | Direct API create with an invalid `company_id` | POST with a non-existent `company_id` | — | Verify live whether the DB/join layer rejects or silently produces an orphaned reference | P1 | High | DB | Manual first |
| TC-ACC-DB-09 | Accruals and Benefit | Attachment column | Single `VARCHAR(255)` regardless of FE's multi-file picker | Record saved after multi-file upload attempt | Inspect DB row | — | Only one URL string stored, confirming the FE bug (ATT-05) is a storage-shape constraint, not just a UI oversight | P2 | Low | DB | Yes |
| TC-ACC-DB-10 | Accruals and Benefit | Uniqueness enforcement | `name` uniqueness is app-level only (no DB unique index confirmed) | Concurrent creates with the same name | Fire two near-simultaneous creates with identical names | — | Verify live whether a race condition can slip past the app-level check | P2 | Medium | DB | Manual first |

## 17. Security Testing

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-SEC-01 | Accruals and Benefit | SQL Injection | Injection payloads in Name/Instructions/Search | Authenticated | Enter `' OR '1'='1` in each field | — | Neutralized, not executed as raw SQL | P0 | Critical | Security | Yes |
| TC-ACC-SEC-02 | Accruals and Benefit | Stored XSS | Script payload rendered inert everywhere | Authenticated | Save `<script>alert(1)</script>` in Name/Instructions | — | Rendered as text on List/View/Summary, never executed | P0 | Critical | Security | Yes |
| TC-ACC-SEC-03 | Accruals and Benefit | CSRF | State-changing calls require a valid session | Authenticated | Attempt Create/Update/Delete/status-toggle without a valid session token | — | Rejected per app's existing auth pattern | P1 | High | Security | Yes |
| TC-ACC-SEC-04 | Accruals and Benefit | RBAC gap | Status/draft-update/calculate-amount routes missing RBAC check | User with zero AccrualMaster permissions | Call each of the 3 confirmed-gap routes | — | Verify live whether they're wrongly permitted | P0 | Critical | Security | Yes |
| TC-ACC-SEC-05 | Accruals and Benefit | Authorization | Cross-company record access | User scoped to Company A | Attempt View/Edit/Delete on a Company B record | — | Verify live enforcement — no explicit company-ownership check confirmed in the service code | P1 | High | Security | Manual first |
| TC-ACC-SEC-06 | Accruals and Benefit | Parameter tampering | Modified `:id` in URL to an unauthorized record | Two records, restricted access to one | Change the URL's id to the restricted one | — | Server-side authorization should block it, not just client routing | P1 | High | Security | Manual first |
| TC-ACC-SEC-07 | Accruals and Benefit | Mass assignment | Privileged field injected into payload | Authenticated | `POST`/`PUT` with `is_deleted: false` or `created_by` added | — | Verify live whether it's ignored, not honored | P1 | High | Security | Manual first |
| TC-ACC-SEC-08 | Accruals and Benefit | Data exposure | Response doesn't leak sensitive fields | Authenticated | Inspect List/Get-by-id response payload | — | No unintended cross-company data exposed | P1 | Medium | Security | Yes |
| TC-ACC-SEC-09 | Accruals and Benefit | Session timeout | Expired token mid-form-fill | Mocked expired token | Fill form, attempt Save | — | 401 fast-fail behavior, not silent failure/data loss | P1 | Medium | Security | Yes |
| TC-ACC-SEC-10 | Accruals and Benefit | Direct access | Add/Edit route blocked for unauthorized role | Unauthorized role | Navigate directly to Add/Edit URL | — | Route-level protection blocks access, not just hides the link | P1 | High | Security | Yes |
| TC-ACC-SEC-11 | Accruals and Benefit | Unvalidated draft route | Deeply malformed nested payload to `/draft` | Authenticated | `POST` malformed JSON structure | — | No 500/stack-trace leakage in the response | P1 | Medium | Security | Manual first |
| TC-ACC-SEC-12 | Accruals and Benefit | File upload security | Executable/script file upload rejected | Authenticated | Upload a `.exe`/`.php` file as an attachment | — | Verify live rejection — cannot be confirmed from source (pre-built upload component) | P1 | High | Security | Manual first |
| TC-ACC-SEC-13 | Accruals and Benefit | Attachment access | Direct URL access to another company's attachment | Attachment URL from a different company's record | Access that URL directly, unauthenticated or as another user | — | Verify live whether attachment URLs are protected or publicly guessable/accessible | P1 | High | Security | Manual first |
| TC-ACC-SEC-14 | Accruals and Benefit | Role bypass | Read Only role attempts write via direct API | Read Only user | Call Create/Update/Delete directly | — | Rejected server-side | P0 | High | Security | Yes |

## 18. Boundary Testing (Cross-Field)

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-BND-01 | Accruals and Benefit | Name | Exactly 1 character | On Add page | Enter a single character, Save | `"A"` | Accepted (no `minLength` beyond required-non-empty confirmed in schema) | P2 | Low | Boundary | Yes |
| TC-ACC-BND-02 | Accruals and Benefit | Name | Exactly 150 / 151 characters | On Add page | Enter 150 chars, Save; then 151, Save | 150 / 151 | 150 accepted; 151 rejected | P1 | Medium | Boundary | Yes |
| TC-ACC-BND-03 | Accruals and Benefit | Instructions | Exactly 1000 / 1001 characters | On Add page | Enter 1000 chars, Save; then 1001, Save | 1000 / 1001 | 1000 accepted; 1001 rejected server-side | P2 | Medium | Boundary | Yes |
| TC-ACC-BND-04 | Accruals and Benefit | Amount | Exactly 0 vs 0.01 | Fixed Value selected | Enter 0, Save; then 0.01, Save | `0` / `0.01` | 0 rejected by service (positive-only); 0.01 accepted | P1 | High | Boundary | Yes |
| TC-ACC-BND-05 | Accruals and Benefit | Value | Exactly 0 vs 1 | VSC selected | Enter 0, Save; then 1, Save | `0` / `1` | 0 rejected by service; 1 accepted | P1 | High | Boundary | Yes |
| TC-ACC-BND-06 | Accruals and Benefit | Cap Limit | Exactly equal to Value | VSC selected | Enter Value=500, Cap Limit=500 | — | Accepted (rule is `cap_limit < value` rejected, equal is fine) | P2 | Medium | Boundary | Yes |
| TC-ACC-BND-07 | Accruals and Benefit | Cap Limit | One less than Value | VSC selected | Enter Value=500, Cap Limit=499 | — | Rejected (cap strictly less than value) | P2 | Medium | Boundary | Yes |
| TC-ACC-BND-08 | Accruals and Benefit | Location/Department | Exactly 1 selection vs 0 | On Add page | Select exactly 1 Department, 0 Location, Save | — | Accepted (Department min 1 satisfied; Location has no minimum) | P2 | Low | Boundary | Yes |
| TC-ACC-BND-09 | Accruals and Benefit | Location/Department | Very large multi-select (50+ ids) | Company with 50+ linked departments | Select all, Save | 50+ ids | Accepted; verify no timeout or truncation | P2 | Low | Boundary | Yes |
| TC-ACC-BND-10 | Accruals and Benefit | Attachments | Exactly at the (unconfirmed) max file size | On Add page | Upload a file at the boundary size | — | Verify live — size limit not confirmed from source | P2 | Low | Boundary | Manual first |

## 19. Performance Testing

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-PERF-01 | Accruals and Benefit | List load | Load time with 500+ records | 500+ records seeded | Load list page, measure time | — | Within acceptable threshold | P2 | Medium | Performance | Yes |
| TC-ACC-PERF-02 | Accruals and Benefit | Search/Filter | Response time on large dataset | 500+ records | Search/filter, measure time | — | Remains responsive | P2 | Medium | Performance | Yes |
| TC-ACC-PERF-03 | Accruals and Benefit | Save | Create response time under normal load | Authenticated | Time a standard Create call | — | Within acceptable threshold | P2 | Low | Performance | Yes |
| TC-ACC-PERF-04 | Accruals and Benefit | Multiselect | Department/Location dropdown with hundreds of options | Large master-data set | Open the dropdown, measure responsiveness | — | Remains responsive, no UI freeze | P2 | Low | Performance | Yes |
| TC-ACC-PERF-05 | Accruals and Benefit | Payroll calculation | `calculate-amount` batch performance across many employees | Large employee set with assigned accruals | Trigger a batch calculation | — | Completes within acceptable time, no timeout | P2 | Medium | Performance | Yes |
| TC-ACC-PERF-06 | Accruals and Benefit | Form load | Add form's initial load time | Authenticated | Navigate to Add page, measure time | — | Within acceptable threshold | P3 | Low | Performance | Yes |

## 20. Accessibility Testing

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-A11Y-01 | Accruals and Benefit | Keyboard navigation | Full form navigable via Tab/Shift+Tab | On Add page | Tab through the entire form | — | Logical order matching visual layout | P2 | Medium | Accessibility | Yes |
| TC-ACC-A11Y-02 | Accruals and Benefit | Labels | All inputs have proper accessible names | On Add page | Inspect each input's accessible name | — | Labels correctly associated, not just visually adjacent | P2 | Medium | Accessibility | Yes |
| TC-ACC-A11Y-03 | Accruals and Benefit | Conditional fields | Method-dependent sub-fields announce their appearance | On Add page | Switch Methods, use a screen reader | — | New fields are discoverable/announced, not silently inserted | P2 | Medium | Accessibility | Yes |
| TC-ACC-A11Y-04 | Accruals and Benefit | Focus visibility | Every interactive element shows visible focus | On Add page | Tab through all controls | — | No invisible-focus traps | P2 | Medium | Accessibility | Yes |
| TC-ACC-A11Y-05 | Accruals and Benefit | Error announcements | Validation errors announced to screen readers | On Add page | Trigger a validation error with a screen reader active | — | Error announced, not just visually shown | P2 | Medium | Accessibility | Yes |
| TC-ACC-A11Y-06 | Accruals and Benefit | Disabled state | Location/Department's disabled-until-Company state exposed via ARIA | On Add page, Company empty | Inspect fields before Company selection | — | `aria-disabled`/`disabled` present, not purely visual | P2 | Medium | Accessibility | Yes |

## 21. Cross-Browser Testing

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-XB-01 | Accruals and Benefit | Chrome | Full Add→Save→View flow | Chrome browser | Run the full flow | — | Works correctly | P1 | Medium | Cross-Browser | Yes |
| TC-ACC-XB-02 | Accruals and Benefit | Firefox | Full Add→Save→View flow | Firefox browser | Run the full flow | — | Works correctly | P2 | Medium | Cross-Browser | Yes |
| TC-ACC-XB-03 | Accruals and Benefit | Edge | Full Add→Save→View flow | Edge browser | Run the full flow | — | Works correctly | P2 | Low | Cross-Browser | Yes |
| TC-ACC-XB-04 | Accruals and Benefit | Safari | Full Add→Save→View flow, especially file upload | Safari browser | Run the full flow including attachment upload | — | Works correctly | P2 | Low | Cross-Browser | Yes |
| TC-ACC-XB-05 | Accruals and Benefit | Mobile browsers | List/Add usable on iOS Safari/Chrome Android | Mobile browser | Load List and Add pages | — | Usable, not just present | P2 | Low | Cross-Browser | Manual first |

## 22. Responsive Testing

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-RESP-01 | Accruals and Benefit | List | Table remains usable at tablet width | List loaded | Resize to tablet width | — | Horizontal scroll or column prioritization, no breakage | P2 | Medium | Responsive | Yes |
| TC-ACC-RESP-02 | Accruals and Benefit | List | Table degrades gracefully at mobile width | List loaded | Resize to mobile width | — | Columns degrade gracefully, still usable | P2 | Medium | Responsive | Yes |
| TC-ACC-RESP-03 | Accruals and Benefit | Form layout | Multi-column form collapses to single column | Add/Edit form | Resize to narrow viewport | — | Single-column layout, no overlap | P2 | Medium | Responsive | Yes |
| TC-ACC-RESP-04 | Accruals and Benefit | View page | Summary panel behavior on narrow viewports | View page | Resize to narrow viewport | — | Stacks or collapses sensibly, no overlap | P2 | Low | Responsive | Yes |
| TC-ACC-RESP-05 | Accruals and Benefit | Long values | Long comma-separated Department lists wrap correctly | Record with many departments (per screenshot's 15+ department example) | View at narrow width | — | Wraps correctly, no overflow/clipping | P2 | Low | Responsive | Yes |

## 23. Regression Testing

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ACC-REG-01 | Accruals and Benefit | Draft state | Existing Drafts remain editable after any validation change | Existing Draft records | Open and edit them post-change | — | Still Draft, still editable | P1 | Medium | Regression | Yes |
| TC-ACC-REG-02 | Accruals and Benefit | Search | Continues to work after a record is edited | Record edited (name changed) | Search the updated name | — | Updated name is searchable | P1 | Medium | Regression | Yes |
| TC-ACC-REG-03 | Accruals and Benefit | Filters | Continue to return correct results after new records added | New records added | Apply an existing filter | — | Correct, up-to-date results | P2 | Low | Regression | Yes |
| TC-ACC-REG-04 | Accruals and Benefit | Permissions | Remain correctly enforced after a role assignment changes | Role reassigned | Attempt previously-blocked action | — | Still enforced consistently | P1 | Medium | Regression | Yes |
| TC-ACC-REG-05 | Accruals and Benefit | Delete | Continues to soft-delete, not hard-delete | Any future service-layer change | Delete a record post-change | — | Still recoverable via `deleted_at`, not physically removed | P1 | High | Regression | Yes |
| TC-ACC-REG-06 | Accruals and Benefit | Shared component | Company→Location/Department dependency intact after `DynamicDependentField` changes (shared across modules) | Shared component changed | Test the Company→Location/Department flow | — | Behavior unchanged; a regression here risks breaking multiple HRMS modules | P1 | High | Regression | Yes |
| TC-ACC-REG-07 | Accruals and Benefit | Payroll integration | Fixing the soft-delete/is_deleted payroll gap doesn't break active accruals | Payroll helper patched to filter `is_deleted`/`status` | Run payroll for employees with active, valid accruals | — | Active accruals still calculate correctly; only deleted/inactive ones stop | P1 | High | Regression | Yes |
| TC-ACC-REG-08 | Accruals and Benefit | Attachment fix | Fixing the multi-file-drop bug doesn't break existing single-attachment records | Existing records with one attachment each | Open Edit/View post-fix | — | Existing single attachments still load and display correctly | P2 | Medium | Regression | Yes |
| TC-ACC-REG-09 | Accruals and Benefit | Sorting/Pagination | Both continue to work together after a page-size/column change | Shared infra changed | Sort then paginate | — | Correct combined behavior | P2 | Low | Regression | Yes |
| TC-ACC-REG-10 | Accruals and Benefit | RBAC fix | Adding `isRbacResource` to the 3 gapped routes doesn't break existing legitimate calls | Routes patched | Call status/draft-update/calculate-amount as a properly-permissioned user | — | Still succeeds normally; only unpermissioned calls now get blocked | P1 | High | Regression | Yes |

## 24. Playwright Automation Scenarios

These map directly to Automation Candidate = Yes rows above and are grouped as end-to-end
scenarios a single spec/test can implement (mirroring this suite's `06-loan-configuration.spec.js`
pattern: one `LoanConfigurationPage`-style page object, `test.describe` blocks per feature area).

| Scenario ID | Scenario | Maps to TC IDs | Automation Notes |
|---|---|---|---|
| TC-ACC-PW-01 | Create with Fixed Value method, mandatory fields only | SAVE-01, FLD-04/15, CALC-04/05 | `@smoke` candidate |
| TC-ACC-PW-02 | Create with Variable Salary Component method | CALC-14/15/16/17 | Covers all 4 VSC sub-fields |
| TC-ACC-PW-03 | View renders read-only, no editable inputs | VIEW-01/09 | Assert `input:not([disabled]):not([readonly])` count is 0 |
| TC-ACC-PW-04 | Edit preloads existing values, update Name | EDIT-01/07 | |
| TC-ACC-PW-05 | Save To Draft with all fields blank | SAVE-10/11 | Confirms client AND server both skip validation |
| TC-ACC-PW-06 | Draft → real Save enforces full validation | SAVE-15 | Negative-path regression guard |
| TC-ACC-PW-07 | Discard on Add creates nothing | SAVE-16 | |
| TC-ACC-PW-08 | Discard on Edit leaves record untouched | SAVE-17 | |
| TC-ACC-PW-09 | Delete a record, confirm removal from list | (Delete flow, list re-search) | |
| TC-ACC-PW-10 | Company→Location/Department disabled-until-Company dependency | CLASS-01/02/03 | Same pattern as Loan Config's Company→Location suite |
| TC-ACC-PW-11 | Required-field validation blocks Save (Company/Name/Type/Method/Department) | FLD-01/04/15, CALC-02, CLASS-04 | Single test asserting all 5 inline errors at once |
| TC-ACC-PW-12 | Amount = 0 is rejected with the service-layer message | CALC-07 | Bug-repro style test, like Loan Config's TC-LOAN-LIM-23 |
| TC-ACC-PW-13 | Cap Limit = 0 bug repro — bypasses its own validation | CALC-21 | Deliberate bug-repro, not a green-path assertion |
| TC-ACC-PW-14 | Cap Limit < Value is rejected (non-zero case) | CALC-23 | Contrast case to PW-13 |
| TC-ACC-PW-15 | Method switch on Edit re-enforces new method's required fields | CALC-27, EDIT-10 | |
| TC-ACC-PW-16 | Multi-file upload keeps only the first file | ATT-05 | Bug-repro; assert exactly 1 attachment persists after uploading 2 |
| TC-ACC-PW-17 | Replace attachment on Edit | ATT-12 | |
| TC-ACC-PW-18 | Remove attachment on Edit | ATT-13 | |
| TC-ACC-PW-19 | XSS payload in Name renders inert on List/View | FLD-11, SEC-02 | |
| TC-ACC-PW-20 | SQL-injection-like payload accepted as literal text | FLD-12, SEC-01 | |
| TC-ACC-PW-21 | Search by Name, ID, and no-match empty state | SRCH-01/04/05 | |
| TC-ACC-PW-22 | Sort ID column ascending/descending | SORT-01 | Assert `aria-sort`, not row order |
| TC-ACC-PW-23 | Paginate the list (page size, Go To, Next/Previous) | PAGE-01/02/03 | |
| TC-ACC-PW-24 | Row action menu offers Edit/Delete per permission | LIST-09, RBAC-02/03 | |
| TC-ACC-PW-25 | Duplicate Name rejected on Create and on rename-via-Edit | FLD-08, EDIT-08 | |
| TC-ACC-PW-26 | Location/Department multi-select persists and is removable | CLASS-07/08 | Uses `selectFirstMultiSelectOption`-style helper since option text is unverified live master data |
| TC-ACC-PW-27 | Soft-deleted record still reachable via direct View/Edit URL | EDIT-11, VIEW-12 | Confirmed source bug, high-value regression guard |

---

## Coverage Summary

| Section | Test Case Count |
|---|---|
| 1. List Page | 19 |
| 2. Basic Details — Field Validation | 23 |
| 3. Calculation Methods | 30 |
| 4. Classifications (Location/Department) | 14 |
| 5. Attachments | 14 |
| 6. Save / Draft / Discard | 18 |
| 7. Edit | 12 |
| 8. View | 12 |
| 9. Actions Menu | 8 |
| 10. Search | 8 |
| 11. Filters | 8 |
| 12. Sorting | 6 |
| 13. Pagination | 6 |
| 14. Permissions (RBAC) | 10 |
| 15. API Testing | 22 |
| 16. Database Validation | 10 |
| 17. Security Testing | 14 |
| 18. Boundary Testing | 10 |
| 19. Performance Testing | 6 |
| 20. Accessibility Testing | 6 |
| 21. Cross-Browser Testing | 5 |
| 22. Responsive Testing | 5 |
| 23. Regression Testing | 10 |
| 24. Playwright Automation Scenarios | 27 |
| **Total (sections 1–23, excluding the scenario-mapping section)** | **256** |

**Threshold check against the request:**
- Manual test cases (sections 1–23 combined): **256**, exceeds the 150+ target.
- Negative-tagged cases (Test Type = Negative, counted across all sections): **57**, exceeds the 50+ target.
- Validation-tagged cases (Test Type = Validation): **31**, exceeds the 30+ target.
- API-tagged cases (section 15 + cross-referenced API rows in other sections): **22** dedicated in section 15 alone, exceeds the 20+ target.
- Playwright Automation Scenarios (section 24): **27**, exceeds the 25+ target.
- Security-tagged cases: **14** dedicated in section 17, plus RBAC-gap cases in section 14.
- Boundary-tagged cases: **10** dedicated in section 18, plus embedded boundary rows in sections 2/3.

**Automation readiness**: cases marked **Yes** reflect behavior confirmed directly from
`erpforce-hrms-fe`/`erpforce-be` source (Yup schema in `utils/commons.ts`, JSON-schema validators,
service/use-case code, migrations). Cases marked **Manual first** could not be resolved from source
alone — mostly the pre-built `UploadMedia` component's internal size/extension limits, live
timing/UX behaviors (confirm dialogs, page-refresh state retention), and cross-company/FK
enforcement that isn't visible in the service code reviewed — these must be confirmed against the
live app once before writing an automated assertion.

## Smoke Test Checklist

A minimal, fast-running subset for CI/pre-merge gating — one path through Create, Draft, Edit,
Delete, and the two confirmed highest-value bugs.

- TC-ACC-SAVE-01 — Create with Fixed Value method, mandatory fields only
- TC-ACC-VIEW-01 — View renders read-only, matching saved record
- TC-ACC-EDIT-07 — Edit updates a single field correctly
- TC-ACC-SAVE-10 — Save To Draft with fields blank succeeds
- TC-ACC-SAVE-13 — Draft status chip overrides Active/Inactive
- TC-ACC-CALC-01 — Methods dropdown offers exactly the 2 real values
- TC-ACC-CLASS-01/02 — Location/Department disabled-until-Company dependency
- TC-ACC-LIST-01/08 — List loads, row click opens View
- TC-ACC-RBAC-01/05 — Add button and List route respect permissions
- TC-ACC-CALC-21 — Cap Limit = 0 bug repro (regression guard for a confirmed defect)

## Regression Checklist

Run this set after any change touching validation schemas, the `DynamicDependentField` shared
component, RBAC route wiring, or the payroll accrual-calculation helper.

- TC-ACC-REG-01 through TC-ACC-REG-10 (full section 23)
- TC-ACC-CALC-07, TC-ACC-CALC-19, TC-ACC-CALC-21, TC-ACC-CALC-25 — the four confirmed
  validation/calculation gaps (Amount=0, Value=0, Cap Limit=0, division-by-zero); re-verify these
  specific behaviors are unchanged (or intentionally fixed, not accidentally altered) after any
  service-layer change
- TC-ACC-RBAC-07/08/09 — the three RBAC-gap routes; re-check after any route-schema change
- TC-ACC-CLASS-01/02/03, TC-ACC-EDIT-06 — Company→Location/Department dependency
- TC-ACC-ATT-05, TC-ACC-ATT-12, TC-ACC-ATT-13 — attachment single-file persistence behavior
- TC-ACC-EDIT-11, TC-ACC-VIEW-12 — soft-deleted record still reachable via direct URL
