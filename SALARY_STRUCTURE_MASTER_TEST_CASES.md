# Salary Structure Master — Test Case Suite

Module path: HRMS → Company Master Policy → Salary Structure Master
Route: `/dashboard/hrms/company-master-policy/salary-structure-master`

Source verified against `erpforce-hrms-fe/src/views/salary-structure-master/` (form, add/edit/view,
redux, utils/validation.ts, utils/constants.ts, utils/default-data.ts) and the rendered English
labels/messages in `erpforce-be/translations/{hrms,common}.json` before writing any case below.
Every "Expected Result" reflects confirmed source behavior, not assumed UI conventions. Corrections
to the original ask are called out explicitly rather than silently matched.

Automated subset lives in `tests/hrms/05-salary-structure-master.spec.js` with the page object
`pages/SalaryStructureMasterPage.js` and fixtures under `config/testData.js` → `salaryStructureMaster`.
Cases whose TC ID is referenced there are marked **Automation: Yes (done)**.

## Corrections to the requested module description (read before using these tables)

- **Language: the suite is JavaScript, not TypeScript.** The prompt asked for TypeScript + POM; this
  repo is entirely JavaScript Playwright (`.spec.js` + `pages/*.js`). The deliverable follows the
  repo convention, not the prompt's language line.
- **No approval workflow exists.** Status is **Draft** vs **Active/Inactive** only. There is no
  Submit/Accept/Reject/Publish action anywhere in the module. "Publishing" a draft = opening Edit
  and clicking **Save** (which writes `is_draft: false`). Every "Approval"-style case from the
  generic template is intentionally omitted.
- **Single scrolling form, not a tab wizard.** Add/Edit render four always-expanded accordions in
  one page — Basic Details / Components / Overtime / Classification (`form/form.tsx`). There is no
  Next/Back stepper; the only footer actions are **Discard**, **Save To Draft** (perm-gated), and
  **Save**.
- **The Components grid auto-seeds two undeletable rows on Add** — **Basic Allowance** and **Gross
  Allowance** (`form.tsx` `useEffect(mode==='add')`). Their Component Name cell is disabled and
  attempting to delete either fires the snackbar *"Cannot delete Basic or Gross allowance
  components"*. The prompt did not mention these.
- **"Amount / Percentage" is a SINGLE column**, not two. The grid column labelled *"Amount /
  Percentage"* maps to one field (`fixed_amount`); when the row's Calculation Method is a
  Percentage type, that same field is submitted as `percentage` (`utils/commons.ts` payload
  mapping). There is no separate Amount and Percentage column.
- **Grid column labels differ from the prompt.** Confirmed rendered headers: **Component Name**,
  **Type** (`component_type`, options Fixed / Variable / Statutory), **Calculation Mathod** *(sic —
  the app's own spelling)* (`calculation_type`, options Fixed Amount / Percentage of CTC /
  Percentage of Basic / Percentage of Gross), **Is Taxable?**, **Amount / Percentage**.
- **No duplicate-component rule exists in the form.** `handleComponentsCreateOrUpdate` has no
  uniqueness check. The prompt's "No duplicate component" is unverified; treat as a possible gap
  and verify server-side before writing it as an enforced rule.
- **No frontend duplicate Salary-Structure-Name rule.** `utils/validation.ts` has no uniqueness
  test on `structure_name` (per Company+Grade or otherwise). If any duplicate check exists it is
  server-side only — marked **Manual first / API** below.
- **Employment Type options are exactly "Unlimited" / "Limited"** (static, hardcoded in `form.tsx`)
  — not Full-Time/Part-Time/etc.
- **Currency is auto-derived and disabled.** Selecting Company writes the company's `currency_data.id`
  into a disabled Currency field (`form.tsx` `getSelectedData`). Currency can never be edited
  directly.
- **Salary numeric rules (confirmed `utils/validation.ts`):** `min_salary` and `max_salary` are both
  optional/nullable; each must be `>= 0` (`must_be_positive`); `min_salary <= max_salary`
  (`min_less_than_max`) and `max_salary >= min_salary` (`max_greater_than_min`); **`max_salary`
  becomes REQUIRED once `min_salary` is entered**; non-numeric input trips `must_be_number`.
  Decimals are supported (DynamicInput `type=number`, `float_step=2`).
- **Overtime Salary Component / Value are NOT required-when-enabled.** The prompt claims they become
  mandatory when the row's checkbox is on; `utils/validation.ts` enforces only `max(100)` on each
  of the three percentages (*"The percentage should not be more than 100"*). Enabling a row with an
  empty Salary Component / Value still saves — a confirmed gap, covered below, not assumed away.
- **Percentage component values are validated 0–100 via a snackbar, not inline** (`form.tsx`
  `handleComponentsCreateOrUpdate`: *"Percentage value must be between 0 and 100"*). Basic Allowance
  is restricted to Fixed Amount / Percentage of CTC; Gross Allowance to Fixed Amount / Percentage of
  CTC / Percentage of Basic — each enforced by its own snackbar.
- **Only two list columns are sortable.** `default-data.ts` sets `enableSorting:false` on Grade,
  Location, Company and Department; only **ID** (`series_number`) and **Structure Name** sort. The
  prompt's "sorting for every sortable column" therefore covers just those two.
- **The list has a Table ⇄ Grid view toggle** (Kanban/Calendar/Gantt are explicitly disabled). Both
  render the same rows via `MaterialTable` / `SalaryStructureGridCard`.
- **Delete happens from two places** — the list row's `...` menu (destructive action → `ConfirmModal`
  on the list) and the View page's **Actions** menu (→ `ConfirmModal`). Both offer confirm/cancel.
- **Save To Draft bypasses validation entirely** (`createDraftSalaryStructure`, no
  `methods.trigger()`), so a draft can be saved with mandatory fields empty.
- **Grade uses `DynamicSearchSelect` (`apiType='grades'`); Location/Department use
  `DynamicDependentField` filtered by `company_id`.** In this account no stable Grade/Location value
  is pinnable, so the automated suite picks first-available Grade and creates a Location via the
  field's own "Create New Location" footer.

Legend — **Priority**: P0 (critical) / P1 (high) / P2 (medium) / P3 (low). **Automation**: Yes (done)
= implemented in the spec; Yes = automatable, not yet written; Manual first = verify live before
automating; API = belongs in an API-level test. **Smoke** / **Regression**: suite membership.

---

## 1. Functional Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-SSM-F-01 | Salary Structure Master | Page Load | List page loads with correct URL and columns | Logged in, `canView` | — | Navigate to the list route | URL matches; table shows ID, Structure Name, Grade, Location, Company, Department, Status | P0 | Yes (done) | Yes | Yes |
| TC-SSM-F-02 | Salary Structure Master | Page Load | Add page loads with all four accordions expanded | `canAdd` | — | Click Add from list | URL matches `add-salary-structure-master`; Basic Details / Components / Overtime / Classification all visible; Save + Discard present | P0 | Yes | Yes | Yes |
| TC-SSM-F-03 | Salary Structure Master | Listing | Table renders existing records | ≥1 record exists | — | Load list | ≥1 row renders with non-empty Structure Name and a Status chip | P0 | Yes | No | Yes |
| TC-SSM-F-04 | Salary Structure Master | Add | Create with mandatory fields only | On Add page | Name, Grade, Employment Type, Company | Fill mandatory fields, Save | Record created, `is_draft=false`; redirected to list; row visible with Active status | P0 | Yes (done) | Yes | Yes |
| TC-SSM-F-05 | Salary Structure Master | Add | Create with Minimum + Maximum Salary set | On Add page | Mandatory + min 10000 / max 50000 | Fill incl. salary, Save | Record created; salary values persist | P1 | Yes (done) | No | Yes |
| TC-SSM-F-06 | Salary Structure Master | Add | Create with Location + Department set | On Add page | Mandatory + Company-scoped Location/Department | Fill Classification, Save | Record created with Location/Department persisted | P1 | Yes | No | Yes |
| TC-SSM-F-07 | Salary Structure Master | Add | Create with an extra custom Component row | On Add page | Mandatory + one new component | Add a component in the grid, Save | Record saves with the extra component alongside the two defaults | P1 | Manual first | No | Yes |
| TC-SSM-F-08 | Salary Structure Master | Add | Create with an Overtime row enabled | On Add page | Mandatory + Over Time Pay on, component + value | Enable Over Time Pay, set component + value, Save | Record saves with overtime persisted | P1 | Manual first | No | Yes |
| TC-SSM-F-09 | Salary Structure Master | View | View renders read-only with all sections | Existing record | — | Open View from list | All sections render; no editable inputs anywhere on the page | P0 | Yes (done) | Yes | Yes |
| TC-SSM-F-10 | Salary Structure Master | View | Currency shows the company's currency on View | Record with a Company | — | Open View | Accounting Currency field shows the company's currency (not blank) | P1 | Yes | No | Yes |
| TC-SSM-F-11 | Salary Structure Master | Add | Currency auto-fills and stays disabled after Company select | On Add page | Company | Select Company, inspect Currency | Currency field populates from company; remains disabled | P0 | Yes (done) | Yes | Yes |
| TC-SSM-F-12 | Salary Structure Master | Add | ID is auto-generated and read-only | On Add page | — | Inspect ID field | ID input is disabled/empty (auto-generated on save) | P1 | Yes (done) | No | Yes |
| TC-SSM-F-13 | Salary Structure Master | Edit | Open Edit and confirm all values preload | Existing record | — | Open Edit from list | Every saved field pre-populates (Company, Grade, Employment Type, salary, components, classification) | P0 | Yes | Yes | Yes |
| TC-SSM-F-14 | Salary Structure Master | Edit | Update a field and Save | Existing record | Updated Structure Name | Change name, Save | Update persists; list reflects new name | P0 | Yes (done) | Yes | Yes |
| TC-SSM-F-15 | Salary Structure Master | Cancel/Discard | Discard a new record mid-fill | On Add page, some fields filled | — | Fill a few fields, Discard | Redirected to list; no record created | P0 | Yes | Yes | Yes |
| TC-SSM-F-16 | Salary Structure Master | Cancel/Discard | Discard an in-progress Edit | On Edit page, field changed | Existing record | Change a field, Discard | Redirected to list; original record unchanged | P1 | Yes | No | Yes |
| TC-SSM-F-17 | Salary Structure Master | Add | Success toast on create | On Add page | Mandatory fields | Save | Snackbar *"Salary structure created successfully."* shown | P2 | Yes | No | No |
| TC-SSM-F-18 | Salary Structure Master | Edit | Success toast on update | Existing record | — | Save from Edit | Snackbar *"Salary structure updated successfully."* shown | P2 | Yes | No | No |
| TC-SSM-F-19 | Salary Structure Master | View | View is reachable via row menu and via row click | Existing record | — | Open View both ways | Both navigate to `view-salary-structure-master` for the same record | P2 | Yes | No | No |
| TC-SSM-F-20 | Salary Structure Master | Add | No Reset/Clear-All control exists | On Add page | — | Inspect footer actions | Only Discard / Save To Draft / Save exist — no Reset (do not assume one) | P3 | Manual first | No | No |

## 2. Draft Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-SSM-DRAFT-01 | Salary Structure Master | Save Draft | Save a new record as Draft with only a name | `saveasdraft.canAdd` | Name only | Fill name, click Save To Draft | Record created `is_draft=true`; list status chip shows Draft (validation bypassed) | P0 | Yes (done) | Yes | Yes |
| TC-SSM-DRAFT-02 | Salary Structure Master | Save Draft → Publish | Publish a Draft via Edit → Save | Existing Draft | Grade + Employment Type | Open Edit on Draft, complete fields, Save | Record becomes Active (`is_draft=false`); status chip changes | P0 | Yes (done) | Yes | Yes |
| TC-SSM-DRAFT-03 | Salary Structure Master | Save Draft | Re-save an existing Draft as Draft again | Existing Draft | — | Open Edit on Draft, change a field, Save To Draft | "Save To Draft" is shown (only because `is_draft`); stays Draft; change persists | P1 | Yes | No | Yes |
| TC-SSM-DRAFT-04 | Salary Structure Master | Save Draft | "Save To Draft" hidden when editing a published record | Existing published record | — | Open Edit on a published record | "Save To Draft" button not rendered (gated on `tData.is_draft`) | P1 | Yes | No | Yes |
| TC-SSM-DRAFT-05 | Salary Structure Master | Save Draft | Draft appears in the list with a Draft chip | Draft exists | — | Search the draft in the list | Row visible; Status chip reads "Draft" | P1 | Yes | No | Yes |
| TC-SSM-DRAFT-06 | Salary Structure Master | Save Draft | Draft success toast wording | On Add page | Name | Save To Draft | Snackbar *"Draft updated successfully."* (add path uses `DRAFT_UPDATED`) | P2 | Yes | No | No |
| TC-SSM-DRAFT-07 | Salary Structure Master | Save Draft | Draft with a full component/overtime payload | On Add page | Name + components + overtime | Fill everything, Save To Draft | Draft persists the full payload, reopenable in Edit | P2 | Manual first | No | No |

## 3. Dropdown / Dependency Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-SSM-DD-01 | Salary Structure Master | Company | Company dropdown is enabled by default | On Add page | — | Observe Company on load | Company combobox is immediately interactable | P0 | Yes | No | No |
| TC-SSM-DD-02 | Salary Structure Master | Grade | Grade dropdown loads options via `grades` API | On Add page | — | Open Grade dropdown | Option list renders (grade master data) once fetch resolves | P1 | Yes | No | Yes |
| TC-SSM-DD-03 | Salary Structure Master | Employment Type | Static options exactly Unlimited / Limited | On Add page | — | Open Employment Type dropdown | Exactly two options: Unlimited, Limited | P1 | Yes | No | Yes |
| TC-SSM-DD-04 | Salary Structure Master | Currency | Currency is disabled and only set by Company | On Add page | — | Try to open Currency before/after Company | Currency never opens for manual pick; value set by Company only | P0 | Yes (done) | Yes | Yes |
| TC-SSM-DD-05 | Salary Structure Master | Location | Location filters by selected Company | Company selected | Company A | Select Company, open Location | Location options scoped to Company A; request carries `company_id` | P1 | Yes | No | Yes |
| TC-SSM-DD-06 | Salary Structure Master | Department | Department filters by selected Company | Company selected | Company A | Select Company, open Department | Department options scoped to Company A | P1 | Yes (done) | No | Yes |
| TC-SSM-DD-07 | Salary Structure Master | Location/Department | Both are empty/unselected on a fresh Add | On Add page | — | Inspect before selecting Company | Both render empty by default | P2 | Yes | No | No |
| TC-SSM-DD-08 | Salary Structure Master | Company | Changing Company clears Location/Department and reloads | 2 real companies | Company A → B | Select A, set Location/Dept, switch to B | Location/Department clear; new company-scoped options load | P1 | Yes (blocked — needs `companyB`) | No | Yes |
| TC-SSM-DD-09 | Salary Structure Master | Company | Currency updates when Company changes | 2 companies w/ different currencies | Company A → B | Switch company | Currency re-derives to the new company's currency | P2 | Manual first | No | No |
| TC-SSM-DD-10 | Salary Structure Master | Grade | Search narrows the Grade option list | On Add page | Partial grade text | Type in Grade search | Non-matching options filtered out | P2 | Yes | No | No |
| TC-SSM-DD-11 | Salary Structure Master | Location | "Create New Location" footer creates + auto-selects | Company selected | New location name | Open Location, use Create New footer, save | New Location created and selected in the field | P1 | Yes | No | No |
| TC-SSM-DD-12 | Salary Structure Master | Location | Empty result for a Company with no Locations | Company w/ 0 locations | — | Select that company, open Location | Dropdown shows no-data state, not an error | P2 | Manual first | No | No |
| TC-SSM-DD-13 | Salary Structure Master | Overtime | Salary Component options mirror the Components grid | On Add page | Components present | Enable an overtime row, open Salary Component | Options equal the current component names (form.tsx `overTimeComponentOptions`) | P1 | Manual first | No | Yes |
| TC-SSM-DD-14 | Salary Structure Master | Dropdown | Selection persists after scrolling/other edits | On Add page | Company + Grade | Select values, edit another field | Selections remain intact | P2 | Yes | No | No |

## 4. Field Validation Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-SSM-VAL-01 | Salary Structure Master | Required | Empty mandatory fields block Save | On Add page | — | Click Save on an empty form | Inline errors for Company, Salary Structure Name, Grades, Employment Type; not saved | P0 | Yes (done) | Yes | Yes |
| TC-SSM-VAL-02 | Salary Structure Master | Required | Company required message wording | On Add page | Name/Grade/Type filled, Company blank | Save | *"Company is required"* shown | P1 | Yes | No | Yes |
| TC-SSM-VAL-03 | Salary Structure Master | Required | Salary Structure Name required wording | On Add page | Name blank | Save | *"Salary Structure Name is required"* shown | P1 | Yes | No | Yes |
| TC-SSM-VAL-04 | Salary Structure Master | Required | Grades required wording | On Add page | Grade blank | Save | *"Grades is required"* shown | P1 | Yes | No | Yes |
| TC-SSM-VAL-05 | Salary Structure Master | Cross-field | Minimum > Maximum Salary rejected | On Add page | min 50000 / max 1000 | Fill both, Save | *"Maximum salary must be greater than minimum salary"* (and/or min-less-than-max); not saved | P0 | Yes (done) | No | Yes |
| TC-SSM-VAL-06 | Salary Structure Master | Numeric | Negative Minimum Salary rejected | On Add page | min -100 | Fill, Save | *"Minimum Salary must be a positive number"* | P0 | Yes (done) | No | Yes |
| TC-SSM-VAL-07 | Salary Structure Master | Cross-field | Maximum Salary required once Minimum entered | On Add page | min 10000, max blank | Fill min only, Save | *"Maximum Salary is required"* (schema `.when('min_salary')`) | P0 | Yes (done) | No | Yes |
| TC-SSM-VAL-08 | Salary Structure Master | Numeric | Negative Maximum Salary rejected | On Add page | max -100 | Fill, Save | *"Maximum Salary must be a positive number"* | P1 | Yes | No | Yes |
| TC-SSM-VAL-09 | Salary Structure Master | Numeric | Non-numeric salary rejected | On Add page | "abc" | Type into salary field | Field is `type=number`; either rejects the keystrokes or trips *"…must be a number"* | P1 | Yes | No | Yes |
| TC-SSM-VAL-10 | Salary Structure Master | Numeric | Decimal salary accepted | On Add page | 12345.67 | Fill decimal, Save | Value accepted and persisted (float_step 2) | P1 | Yes | No | Yes |
| TC-SSM-VAL-11 | Salary Structure Master | Boundary | Equal Minimum and Maximum Salary accepted | On Add page | min = max = 10000 | Fill equal values, Save | Saves (rule is `<=` / `>=`, so equality is valid) | P1 | Yes | No | Yes |
| TC-SSM-VAL-12 | Salary Structure Master | Boundary | Zero salary accepted | On Add page | min 0 / max 0 | Fill zeros, Save | Saves (`>= 0` allows zero) | P2 | Yes | No | No |
| TC-SSM-VAL-13 | Salary Structure Master | Recovery | Fixing an invalid field clears its error | On Add page | invalid → valid | Trigger an error, correct the field | Inline error clears without full resubmit (mode `all`) | P1 | Yes | No | Yes |
| TC-SSM-VAL-14 | Salary Structure Master | Whitespace | Spaces-only Structure Name | On Add page | "   " | Fill spaces, Save | Save blocked (documents actual behaviour — yup `required` treats non-empty string as present; no trim rule) | P2 | Yes (done) | No | Yes |
| TC-SSM-VAL-15 | Salary Structure Master | Uniqueness | Duplicate Structure Name (same Company+Grade) | Existing record | Same name/company/grade | Recreate identical record | No frontend rule exists — verify server response before asserting a duplicate error | P2 | Manual first / API | No | Yes |
| TC-SSM-VAL-16 | Salary Structure Master | Overtime | Overtime percentage > 100 rejected | On Add page | Over Time Pay on, value 150 | Enable row, set 150, Save | *"The percentage should not be more than 100"* | P1 | Manual first | No | Yes |
| TC-SSM-VAL-17 | Salary Structure Master | Overtime | Special Overtime percentage > 100 rejected | On Add page | Special row on, value 150 | Enable, set 150, Save | Same max-100 error on `special_overtime_percentage` | P1 | Manual first | No | Yes |
| TC-SSM-VAL-18 | Salary Structure Master | Overtime | Night Shift percentage > 100 rejected | On Add page | Night Shift on, value 150 | Enable, set 150, Save | Same max-100 error on `night_shift_percentage` | P1 | Manual first | No | Yes |
| TC-SSM-VAL-19 | Salary Structure Master | Overtime (gap) | Enabling an overtime row with empty component/value still saves | On Add page | Over Time Pay on, blanks | Enable row, leave component + value empty, Save | Record saves — CONFIRMED GAP (no required-when-enabled rule in yup). Track with `test.fail()` if it is later fixed | P1 | Manual first | No | Yes |
| TC-SSM-VAL-20 | Salary Structure Master | Component | Percentage component value outside 0–100 rejected | Component grid | calc method = % of CTC, value 150 | Edit a component to a percentage type, set 150 | Snackbar *"Percentage value must be between 0 and 100"* | P1 | Manual first | No | Yes |
| TC-SSM-VAL-21 | Salary Structure Master | Component | Negative Amount / Percentage rejected | Component grid | amount -5 | Set a component amount negative | Column validation *"Value must be at least 0"* (min 0 on `fixed_amount`) | P1 | Manual first | No | Yes |
| TC-SSM-VAL-22 | Salary Structure Master | Component | Component Name required | Component grid | blank name | Add a component with empty name | Column required error *"Field is required"* | P1 | Manual first | No | Yes |
| TC-SSM-VAL-23 | Salary Structure Master | Component | Calculation Method required | Component grid | blank method | Add a component with empty Calculation Mathod | Column required error *"Field is required"* | P1 | Manual first | No | Yes |
| TC-SSM-VAL-24 | Salary Structure Master | Component | Basic Allowance limited to Fixed Amount / % of CTC | Component grid | Basic Allowance | Set Basic Allowance to % of Basic | Snackbar *"Basic Allowance can only have Fixed Amount or Percentage of CTC calculation type"* | P1 | Manual first | No | Yes |
| TC-SSM-VAL-25 | Salary Structure Master | Component | Gross Allowance limited to Fixed/% of CTC/% of Basic | Component grid | Gross Allowance | Set Gross Allowance to % of Gross | Snackbar *"Gross Allowance can only have Fixed Amount, Percentage of CTC or Percentage of Basic calculation type"* | P1 | Manual first | No | Yes |
| TC-SSM-VAL-26 | Salary Structure Master | Draft | Draft bypasses required validation | On Add page | name only | Save To Draft with mandatory blanks | Saves as Draft with no validation errors (confirmed bypass) | P1 | Yes (via DRAFT-01) | No | Yes |

## 5. Components Grid Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-SSM-COMP-01 | Salary Structure Master | Components | Two default rows seeded on Add | On Add page | — | Open Add | Basic Allowance and Gross Allowance rows present by default | P0 | Yes (done) | No | Yes |
| TC-SSM-COMP-02 | Salary Structure Master | Components | Default rows' Component Name is locked | On Add page | — | Try to edit Basic/Gross name cell | Component Name cell disabled for both defaults | P1 | Manual first | No | Yes |
| TC-SSM-COMP-03 | Salary Structure Master | Components | Default rows cannot be deleted | On Add page | — | Delete Basic Allowance | Snackbar *"Cannot delete Basic or Gross allowance components"*; row remains | P1 | Manual first | No | Yes |
| TC-SSM-COMP-04 | Salary Structure Master | Components | Add a new component row | On Add page | New component | Use grid create, fill, save row | New row appears above the defaults | P1 | Manual first | No | Yes |
| TC-SSM-COMP-05 | Salary Structure Master | Components | Delete a custom component row | Custom row exists | — | Delete the custom row | Row removed; defaults untouched | P1 | Manual first | No | Yes |
| TC-SSM-COMP-06 | Salary Structure Master | Components | Add multiple components | On Add page | 3+ components | Add several rows, Save | All persist and show on View | P2 | Manual first | No | Yes |
| TC-SSM-COMP-07 | Salary Structure Master | Components | Type options are Fixed / Variable / Statutory | Component grid | — | Open Type editor | Exactly those three options | P2 | Manual first | No | No |
| TC-SSM-COMP-08 | Salary Structure Master | Components | Calculation Method options complete | Component grid | — | Open Calculation Mathod editor | Fixed Amount / % of CTC / % of Basic / % of Gross | P2 | Manual first | No | No |
| TC-SSM-COMP-09 | Salary Structure Master | Components | Is Taxable? toggle persists | Component grid | taxable on | Toggle Is Taxable?, Save | Value persists and shows Yes/No on View | P2 | Manual first | No | Yes |
| TC-SSM-COMP-10 | Salary Structure Master | Components | Percentage calc submits value as `percentage` | Component grid | % of CTC, value 40 | Set percentage type + value, Save | Payload maps `fixed_amount`→`percentage` (commons.ts); View shows "40% of CTC" | P2 | Manual first / API | No | Yes |
| TC-SSM-COMP-11 | Salary Structure Master | Components | Boundary: exactly one (only defaults) saves | On Add page | defaults only | Save without adding rows | Saves with just Basic + Gross | P2 | Yes | No | No |
| TC-SSM-COMP-12 | Salary Structure Master | Components | Boundary: many components | On Add page | 10+ components | Add many rows, Save | All persist without truncation | P3 | Manual first | No | No |

## 6. Overtime Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-SSM-OT-01 | Salary Structure Master | Overtime | Three rows render: Over Time / Special Overtime / Night Shift Pay | On Add page | — | Open Overtime accordion | All three checkbox rows with Salary Component + Value present | P1 | Yes | No | Yes |
| TC-SSM-OT-02 | Salary Structure Master | Overtime | Enable Over Time Pay, set component + value, Save | On Add page | component + 10 | Enable, fill, Save | Overtime persists; View shows Enabled + Value in % | P1 | Manual first | No | Yes |
| TC-SSM-OT-03 | Salary Structure Master | Overtime | Enable Special Overtime Pay | On Add page | component + 15 | Enable, fill, Save | Persists on the special row | P2 | Manual first | No | Yes |
| TC-SSM-OT-04 | Salary Structure Master | Overtime | Enable Night Shift Pay | On Add page | component + 20 | Enable, fill, Save | Persists on the night-shift row | P2 | Manual first | No | Yes |
| TC-SSM-OT-05 | Salary Structure Master | Overtime | Disabled row ignores its values | On Add page | value set, checkbox off | Set value then leave checkbox off, Save | Row saves as disabled; no validation on it | P2 | Manual first | No | Yes |
| TC-SSM-OT-06 | Salary Structure Master | Overtime | Value must be numeric | On Add page | "abc" | Type non-numeric value | Non-numeric rejected / not submitted as percentage | P2 | Manual first | No | No |
| TC-SSM-OT-07 | Salary Structure Master | Overtime | Boundary: value 100 accepted, 0 accepted | On Add page | 0 and 100 | Set boundary values | Both accepted (max is 100, min unbounded but effectively ≥0) | P2 | Manual first | No | No |
| TC-SSM-OT-08 | Salary Structure Master | Overtime | Info tooltip renders on the section header | On Add page | — | Hover the Overtime info icon | Tooltip content renders | P3 | Manual first | No | No |

## 7. View Page Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-SSM-VIEW-01 | Salary Structure Master | View | Summary section shows ID/Name/Grade/Salary/Type | Existing record | — | Open View | Summary sidebar shows those fields | P1 | Yes | No | Yes |
| TC-SSM-VIEW-02 | Salary Structure Master | View | Basic Details values match what was saved | Existing record | — | Open View | Company/Currency/Name/Grade/salary render correctly | P0 | Yes | No | Yes |
| TC-SSM-VIEW-03 | Salary Structure Master | View | Components table renders saved rows | Record w/ components | — | Open View | Component table shows Name/Type/Calc/Is Taxable/amount | P1 | Yes | No | Yes |
| TC-SSM-VIEW-04 | Salary Structure Master | View | Overtime details render enabled/disabled + value | Record w/ overtime | — | Open View | Each overtime row shows Enabled/Disabled + Value in % | P1 | Manual first | No | Yes |
| TC-SSM-VIEW-05 | Salary Structure Master | View | Classification shows Location + Department | Record w/ classification | — | Open View | Location/Department render (or "-" when unset) | P1 | Yes | No | Yes |
| TC-SSM-VIEW-06 | Salary Structure Master | View | Status chip reflects Active/Draft/Inactive | Records in each state | — | Open View for each | Chip matches lifecycle state | P1 | Yes (done, Active) | No | Yes |
| TC-SSM-VIEW-07 | Salary Structure Master | View | Actions menu offers Edit + Delete | Existing record | — | Open Actions menu | Edit and Delete items present (permission-gated) | P1 | Yes | No | Yes |
| TC-SSM-VIEW-08 | Salary Structure Master | View | Activity logs / Additional Details render | Record w/ activity | — | Open View | Activity/Additional Details section renders without error | P2 | Manual first | No | No |
| TC-SSM-VIEW-09 | Salary Structure Master | View | Currency amounts are formatted with the symbol | Record w/ salary | — | Open View | Min/Max shown formatted with the company currency symbol | P2 | Manual first | No | No |

## 8. Edit Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-SSM-EDIT-01 | Salary Structure Master | Edit | Company preloads; update Structure Name persists | Existing record | Updated name | Edit, change name, Save | Company preloaded; new name persists in list | P0 | Yes (done) | Yes | Yes |
| TC-SSM-EDIT-02 | Salary Structure Master | Edit | Read-only ID stays disabled in Edit | Existing record | — | Open Edit | ID field disabled | P1 | Yes (done) | No | Yes |
| TC-SSM-EDIT-03 | Salary Structure Master | Edit | Update salary values | Existing record | new min/max | Edit salary, Save | New salary persists | P1 | Yes | No | Yes |
| TC-SSM-EDIT-04 | Salary Structure Master | Edit | Edit a component row | Record w/ components | changed amount | Edit component, Save | Change persists on View | P1 | Manual first | No | Yes |
| TC-SSM-EDIT-05 | Salary Structure Master | Edit | Toggle an overtime row on/off | Existing record | — | Edit overtime, Save | New overtime state persists | P2 | Manual first | No | Yes |
| TC-SSM-EDIT-06 | Salary Structure Master | Edit | Changing Company on Edit clears Location/Department | 2 companies | Company A→B | Edit, switch company | Location/Department clear | P1 | Yes (blocked — needs `companyB`) | No | Yes |
| TC-SSM-EDIT-07 | Salary Structure Master | Edit | Single-field edit leaves others intact | Existing record | one field | Change one field, Save | Only that field changes; rest unchanged | P1 | Yes | No | Yes |
| TC-SSM-EDIT-08 | Salary Structure Master | Edit | Cross-field salary rule re-checked on Edit | Existing record | min>max | Edit to invalid pair, Save | Same min/max validation blocks save | P1 | Yes | No | Yes |

## 9. Delete Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-SSM-DEL-01 | Salary Structure Master | Delete | Cancel delete from list preserves record | Existing record | — | Row menu → Delete → cancel | Record still present | P0 | Yes (done) | No | Yes |
| TC-SSM-DEL-02 | Salary Structure Master | Delete | Confirm delete from list removes record | Existing record | — | Row menu → Delete → confirm | Row removed; search shows No Data; toast *"Salary structure deleted successfully."* | P0 | Yes (done) | Yes | Yes |
| TC-SSM-DEL-03 | Salary Structure Master | Delete | Delete from the View Actions menu | Existing record | — | View → Actions → Delete → confirm | Record deleted; redirected to list | P1 | Yes | No | Yes |
| TC-SSM-DEL-04 | Salary Structure Master | Delete | Cancel delete from the View Actions menu | Existing record | — | View → Actions → Delete → cancel | Record preserved; still on View | P1 | Yes | No | Yes |
| TC-SSM-DEL-05 | Salary Structure Master | Delete | Delete confirmation shows the record's ID | Existing record | — | Trigger delete | ConfirmModal description includes the series number | P2 | Yes | No | No |
| TC-SSM-DEL-06 | Salary Structure Master | Delete | Delete a Draft record | Draft exists | — | Delete a Draft | Draft removed | P1 | Yes | No | Yes |
| TC-SSM-DEL-07 | Salary Structure Master | Delete | Delete restriction if referenced by payroll | Record used elsewhere | — | Attempt delete of an in-use structure | If a server-side guard exists it blocks with a message — verify live before asserting | P2 | Manual first / API | No | Yes |

## 10. Search Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-SSM-SR-01 | Salary Structure Master | Search | Search by ID (series number) | Record exists | series number | Search by ID | Matching row shown | P1 | Yes | No | Yes |
| TC-SSM-SR-02 | Salary Structure Master | Search | Search by Structure Name | Record exists | name | Search by name | Matching row shown | P0 | Yes (done) | Yes | Yes |
| TC-SSM-SR-03 | Salary Structure Master | Search | Search with no match | — | gibberish | Search unknown term | No Data row shown, not zero `<tr>` | P1 | Yes (done) | No | Yes |
| TC-SSM-SR-04 | Salary Structure Master | Search | Search by Grade | Record exists | grade text | Search by grade | Verify whether backend search covers related fields before asserting | P2 | Manual first / API | No | No |
| TC-SSM-SR-05 | Salary Structure Master | Search | Search by Company | Record exists | company text | Search by company | Same caveat — confirm searchable fields server-side | P2 | Manual first / API | No | No |
| TC-SSM-SR-06 | Salary Structure Master | Search | Search by Department | Record exists | dept text | Search by department | Same caveat | P2 | Manual first / API | No | No |
| TC-SSM-SR-07 | Salary Structure Master | Search | Clearing search restores full list | After a search | — | Clear the search box | Full list returns | P2 | Yes | No | No |

## 11. Filter Test Cases

Filters use the shared react-querybuilder `filter.tsx` (generic AND/OR rule builder), not a fixed
per-field panel. `BasePage` filter helpers exist but are noted "written from source, not yet
live-verified" — verify live before automating these.

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-SSM-FIL-01 | Salary Structure Master | Filter | Filter by Company | Records exist | Company | Add rule Company = A, Apply | Only Company-A rows | P2 | Manual first | No | Yes |
| TC-SSM-FIL-02 | Salary Structure Master | Filter | Filter by Grade | Records exist | Grade | Add rule Grade = X, Apply | Only that grade | P2 | Manual first | No | Yes |
| TC-SSM-FIL-03 | Salary Structure Master | Filter | Filter by Department | Records exist | Dept | Add rule Department = Y, Apply | Only that department | P2 | Manual first | No | Yes |
| TC-SSM-FIL-04 | Salary Structure Master | Filter | Filter by Status | Draft + Active exist | Status = Draft | Add rule Status = Draft, Apply | Only Draft rows | P2 | Manual first | No | Yes |
| TC-SSM-FIL-05 | Salary Structure Master | Filter | Multiple filters combined | Records exist | Company + Status | Add two rules, Apply | Rows match both | P2 | Manual first | No | Yes |
| TC-SSM-FIL-06 | Salary Structure Master | Filter | Clear filter restores list | After a filter | — | Clear Filter | Full list returns | P2 | Manual first | No | No |

## 12. Sorting Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-SSM-SO-01 | Salary Structure Master | Sorting | Sort ID ascending/descending | Records exist | — | Toggle ID header twice | `aria-sort` cycles ascending↔descending | P1 | Yes (done) | No | Yes |
| TC-SSM-SO-02 | Salary Structure Master | Sorting | Sort Structure Name | Records exist | — | Click Structure Name header | `aria-sort` becomes ascending/descending | P1 | Yes (done) | No | Yes |
| TC-SSM-SO-03 | Salary Structure Master | Sorting | Grade column is NOT sortable | Records exist | — | Click Grade header | No `aria-sort` change (enableSorting:false) | P2 | Yes (done) | No | Yes |
| TC-SSM-SO-04 | Salary Structure Master | Sorting | Location/Company/Department NOT sortable | Records exist | — | Click each header | No sort applied (enableSorting:false) | P2 | Yes | No | Yes |

## 13. Pagination Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-SSM-PG-01 | Salary Structure Master | Pagination | Page indicator shows "Page X of Y" | >1 page | — | Load list | Indicator matches `/Page \d+ of \d+/` | P1 | Yes (done) | No | Yes |
| TC-SSM-PG-02 | Salary Structure Master | Pagination | Next advances a page | >1 page | — | Click Next | Indicator changes; new rows | P1 | Yes (done) | No | Yes |
| TC-SSM-PG-03 | Salary Structure Master | Pagination | Previous returns a page | On page 2 | — | Click Previous | Returns to previous page | P1 | Yes | No | Yes |
| TC-SSM-PG-04 | Salary Structure Master | Pagination | Go-To specific page | >2 pages | 2 | Enter 2 in Go To | Jumps to page 2 | P2 | Yes | No | No |
| TC-SSM-PG-05 | Salary Structure Master | Pagination | Change page size | Enough records | 10/20/50 | Change items-per-page | Row count respects new size | P2 | Yes | No | No |
| TC-SSM-PG-06 | Salary Structure Master | Pagination | Empty-page handling | Filter to zero | — | Search a no-match term | No Data row; no crash | P2 | Yes | No | No |

## 14. UI / View-mode Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-SSM-UI-01 | Salary Structure Master | Labels | Field labels render exactly | On Add page | — | Inspect labels | Salary Structure Name, Grades, Employment Type, Company, Currency, Minimum/Maximum Salary render | P1 | Yes | No | No |
| TC-SSM-UI-02 | Salary Structure Master | Required marks | Required fields show an asterisk | On Add page | — | Inspect required fields | Name/Grade/Employment Type/Company show `*` | P2 | Yes | No | No |
| TC-SSM-UI-03 | Salary Structure Master | Placeholders | Salary placeholders show "0.00" | On Add page | — | Inspect salary inputs | Both show `0.00` | P3 | Yes | No | No |
| TC-SSM-UI-04 | Salary Structure Master | Disabled | ID and Currency are visibly disabled | On Add page | — | Inspect fields | Both disabled | P2 | Yes (done, partial) | No | No |
| TC-SSM-UI-05 | Salary Structure Master | View mode | Table ⇄ Grid toggle switches layout | List page | — | Toggle view | Grid card layout renders the same records | P2 | Manual first | No | No |
| TC-SSM-UI-06 | Salary Structure Master | View mode | Kanban/Calendar/Gantt are disabled | List page | — | Inspect view options | Those three are disabled | P3 | Manual first | No | No |
| TC-SSM-UI-07 | Salary Structure Master | Loading | Spinner shows while the form/list loads | Slow network | — | Load Add/Edit/list | ErpLoader shows then resolves | P3 | Manual first | No | No |
| TC-SSM-UI-08 | Salary Structure Master | Empty state | Empty list shows a Fallback/No-Data state | Zero records/filtered | — | Filter to empty | Fallback/No-Data renders, not a blank page | P2 | Yes | No | No |
| TC-SSM-UI-09 | Salary Structure Master | Tooltip | Overtime info tooltip content shows on hover | On Add page | — | Hover info icon | Tooltip renders | P3 | Manual first | No | No |
| TC-SSM-UI-10 | Salary Structure Master | Messages | Error toast on a failed save | Forced failure | — | Trigger a server error | Error snackbar (*"Failed to create/update salary structure."*) | P2 | Manual first | No | No |

## 15. API Test Cases

Endpoints (redux/actionCreators.ts): List `GET /v1/salary-structure-master`, By-Id
`GET /v1/salary-structure-master/:id`, Create `POST /v1/salary-structure-master`, Update
`PUT /v1/salary-structure-master/:id`, Delete `DELETE /v1/salary-structure-master/:id`, Draft
create `POST /v1/salary-structure-master/save-as-draft`, Draft update
`PATCH /v1/salary-structure-master/:id/save-as-draft`, Grades `GET /v1/grades`.

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-SSM-API-01 | Salary Structure Master | Create API | POST returns 200/201 with created id | Auth token | Valid payload | POST create | Success status; body has new id + series_number | P1 | API | No | Yes |
| TC-SSM-API-02 | Salary Structure Master | Create API | Payload shape (components/overtime mapping) | Auth | Full payload | POST with percentage components | `fixed_amount`→`percentage` mapping honored server-side | P1 | API | No | Yes |
| TC-SSM-API-03 | Salary Structure Master | List API | GET returns `data.salary_structure_master[]` + `pagination` | Auth | — | GET list | Response shape matches (pagination sibling of data) | P1 | API | No | Yes |
| TC-SSM-API-04 | Salary Structure Master | Update API | PUT persists changes | Existing id | Changed payload | PUT | Success; changes reflected on subsequent GET | P1 | API | No | Yes |
| TC-SSM-API-05 | Salary Structure Master | Delete API | DELETE removes the record | Existing id | — | DELETE | Success; record absent on next GET | P1 | API | No | Yes |
| TC-SSM-API-06 | Salary Structure Master | Draft API | POST save-as-draft creates `is_draft=true` | Auth | Minimal payload | POST draft | Draft created with mandatory fields optional | P1 | API | No | Yes |
| TC-SSM-API-07 | Salary Structure Master | Draft API | PATCH save-as-draft updates a draft | Existing draft id | Changed payload | PATCH draft | Draft updated, still `is_draft=true` | P2 | API | No | Yes |
| TC-SSM-API-08 | Salary Structure Master | Validation API | Server rejects invalid payload | Auth | min>max / bad types | POST invalid | Validation error status + message | P1 | API | No | Yes |
| TC-SSM-API-09 | Salary Structure Master | Auth | Unauthorized/expired token blocked | No/expired token | — | Any call | 401/403 (BasePage's listener fails fast on this) | P1 | API | No | Yes |
| TC-SSM-API-10 | Salary Structure Master | Server error | 5xx surfaces an error toast, no partial write | Forced 5xx | — | Trigger server error | Error toast; no record persisted | P2 | API | No | No |
| TC-SSM-API-11 | Salary Structure Master | Persistence | Create → GET-by-id round-trips all fields | Created record | — | POST then GET/:id | Every field (components/overtime/classification) returned intact | P1 | API | No | Yes |

## 16. Boundary / Regression / Accessibility Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-SSM-BND-01 | Salary Structure Master | Boundary | Very large salary value | On Add page | 99999999.99 | Fill large value, Save | Accepted/persisted (or documented server cap) | P2 | Yes | No | No |
| TC-SSM-BND-02 | Salary Structure Master | Boundary | Salary decimal precision (2 places) | On Add page | 1234.567 | Fill 3-dp value | Rounded/handled per float_step 2 | P3 | Manual first | No | No |
| TC-SSM-BND-03 | Salary Structure Master | Boundary | Minimum-length Structure Name | On Add page | 1 char | Save 1-char name | Accepted (no min-length rule) | P3 | Yes | No | No |
| TC-SSM-BND-04 | Salary Structure Master | Boundary | Long Structure Name | On Add page | 255 chars | Save long name | Accepted up to the field's limit | P3 | Manual first | No | No |
| TC-SSM-BND-05 | Salary Structure Master | Boundary | Overtime percentage exactly 100 | On Add page | 100 | Set 100, Save | Accepted (max is inclusive 100) | P2 | Manual first | No | No |
| TC-SSM-BND-06 | Salary Structure Master | Boundary | Overtime percentage 0 | On Add page | 0 | Set 0, Save | Accepted | P3 | Manual first | No | No |
| TC-SSM-REG-01 | Salary Structure Master | Regression | Create → View → Edit → View round-trip integrity | — | Full record | Full lifecycle | Every field survives the round trip | P1 | Yes | No | Yes |
| TC-SSM-REG-02 | Salary Structure Master | Regression | Draft → publish → edit → delete lifecycle | — | — | Full lifecycle | Each transition behaves and status updates | P1 | Yes (partial) | No | Yes |
| TC-SSM-REG-03 | Salary Structure Master | Regression | Deleting a record leaves master data (Company/Grade) intact | Existing record | — | Delete then reuse Company/Grade in a new record | Master data still selectable | P2 | Yes | No | Yes |
| TC-SSM-A11Y-01 | Salary Structure Master | Accessibility | Required fields expose `aria-required`/asterisk | On Add page | — | Inspect a11y tree | Required fields conveyed to AT | P3 | Manual first | No | No |
| TC-SSM-A11Y-02 | Salary Structure Master | Accessibility | Column headers expose `aria-sort` | List page | — | Inspect sortable headers | ID/Structure Name expose aria-sort | P3 | Yes | No | No |
| TC-SSM-A11Y-03 | Salary Structure Master | Accessibility | Dialogs are focus-trapped and Escape-dismissible | Delete flow | — | Open ConfirmModal | Focus trapped; Escape closes | P3 | Manual first | No | No |
| TC-SSM-A11Y-04 | Salary Structure Master | Accessibility | Keyboard navigation through the form | On Add page | — | Tab through fields | Logical tab order; all controls reachable | P3 | Manual first | No | No |

---

## Automation status summary

- **Implemented now** (`tests/hrms/05-salary-structure-master.spec.js`, 27 tests): TC-SSM-F-04/05/09/11/12,
  TC-SSM-COMP-01, TC-SSM-EDIT-01/02, TC-SSM-DRAFT-01/02, TC-SSM-VAL-01/05/06/07/14, TC-SSM-DEP-01,
  TC-SSM-DEL-01/02, TC-SSM-SR-02/03, TC-SSM-SO-01/02/03, TC-SSM-PG-01/02, TC-SSM-L01, plus the
  Company-switch dependency case scaffolded and `test.skip`-gated on `salaryStructureMaster.companyB`.
- **Automatable next** (marked *Yes*): remaining form/edit/view/search/sort/pagination cases that
  reuse existing `BasePage`/page-object helpers.
- **Manual first**: Components-grid inline editing, Overtime enable-and-fill flows, Filters, view-mode
  toggle, tooltips, loading/empty/error states — the selectors for these are not yet verified live.
- **API**: the endpoints in §15 belong in an API-level suite (none exists in this repo yet).

## Blocked / to-do before enabling more cases

1. **`salaryStructureMaster.companyB`** — a second real, live-verified Company is needed for the
   Company-switch clears-Location/Department cases (TC-SSM-DD-08, TC-SSM-EDIT-06). Do not default it
   to `erp-force`.
2. **A pinned Grade value** — if a stable Grade exists in this account, pin it in
   `salaryStructureMaster.valid.grade` so grade-specific assertions can be exact instead of
   first-available.
3. **Components/Overtime editable-cell selectors** — verify the MaterialEditableTable inline
   create/edit interaction live, then lift the COMP-/OT-/VAL-16..25 cases from "Manual first" to
   automated with helpers on the page object.
