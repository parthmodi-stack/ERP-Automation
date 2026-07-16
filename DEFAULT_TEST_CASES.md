# Default Test Case Set for ERPForce Document Modules

This checklist was extracted by analyzing the 14 Procurement Request test cases
(`tests/procurement-request.spec.ts`, TC01-TC19). It applies to any ERPForce
module that follows the standard "document" pattern: Create -> Draft -> Submit
for Approval -> Accept/Reject -> Delete (Accounting, Inventory, Sales,
Manufacturing, Rental, PMS, Document, Project, HRMS, etc.).

When starting a new module's Playwright suite, generate these test cases first,
then add module-specific cases on top. Keep the same TC numbering scheme so
suites stay comparable across modules.

## Test Case Checklist

### Core CRUD (always applicable)

| ID | Name | What it verifies |
|----|------|-------------------|
| TC01 | Create a new record with an item/line and save as Draft | Full create flow works; status lands on Draft, not Pending |
| TC02 | Edit the draft and persist changes | Edit form loads, field changes save, status stays Draft (use "save as draft", not plain save) |
| TC03 | View page displays all previously filled data correctly | Every field saved in TC01/TC02 renders correctly on the View page, including computed totals |
| TC011 | Auto-filled fields on Edit match the View page | Every field pre-populates correctly when reopening Edit (lookups, narration/text, numeric precision) - this is the case most likely to surface real app bugs (see Location gap below) |
| TC012 | Read-only fields stay read-only in Edit mode | System-generated fields (ID, series number, created-by, etc.) cannot be modified |
| TC013 | Editing a single field and saving updates only that field | Change one field (e.g. Quantity), confirm the changed value persists and all other fields are untouched |
| TC014 | Delete a Draft record | Delete succeeds, record disappears from the list, and re-opening it fails |
| TC019 | Related/master data remains intact after delete | Master data referenced by the deleted record (items, vendors, etc.) is unaffected and still usable in a new record |

### Field Validations (always applicable)

Covers the Add/Edit form's client-side validation (React Hook Form + Yup),
independent of whether the record ever gets saved successfully.

| ID | Name | What it verifies |
|----|------|-------------------|
| TC-V01 | Required field left empty blocks save | Submitting with a required field empty shows an inline error and the record is not created; check every required field, not just one |
| TC-V02 | Invalid format is rejected | Type-mismatched input (text in a numeric field, malformed email, out-of-range date) shows a format error and blocks save |
| TC-V03 | Zero/negative numeric values are rejected where not allowed | Quantity/Rate/Amount fields that must be positive reject `0` and negative values with an inline error |
| TC-V04 | Max length / character limit is enforced | Narration/remarks-style free-text fields truncate or reject input beyond their configured limit |
| TC-V05 | Duplicate/uniqueness validation | Creating a record with a value that must be unique (code, name, email) shows a duplicate error instead of saving |
| TC-V06 | Cross-field / business-rule validation | Fields that are conditionally required or must reconcile with each other (e.g. a computed total, a field only required when another field has a specific value) are enforced |
| TC-V07 | Correcting an invalid field clears its error | After a validation error is shown, fixing the value removes the inline error without needing to resubmit the whole form |

Before writing these, check the module's Yup schema (usually alongside the
form component, e.g. `validationSchema.ts` or inline `yup.object({...})`) to
get the exact required/format/min-max rules instead of guessing them from the
UI - it's faster and avoids missing a rule that has no visible hint text.

### Approval Flow (only if the module has an approval workflow)

Before writing these, confirm the module actually has Submit/Approve/Reject
actions (check the view page's `headers.tsx` or equivalent for a
`DropdownButton`/approval-status logic). Skip this whole section for modules
that don't have an approval step (e.g. pure master-data CRUD screens).

| ID | Name | What it verifies |
|----|------|-------------------|
| TC04 | Submit for approval, Quick Approval, Accept | Draft -> Pending transition, approver assignment, Accept -> approved status |
| TC05 | Create a second record, submit, Reject | Independent record; Reject path shows Rejected status and a Re-Submit action |
| TC016 | Attempt to delete a Submitted/Pending record | Should be blocked with a validation message; record remains intact |
| TC017 | Attempt to delete an Approved record | Should be blocked with a validation message; record remains intact |

### Listing Page (always applicable)

Covers the shared `MaterialTable`-based list view, not the record itself.

| ID | Name | What it verifies |
|----|------|-------------------|
| TC-L01 | Search/filter the list | Matching rows appear; a filter with no matches renders the "No Data" row, not zero `<tr>` elements |
| TC-L02 | Sort a column ascending/descending | Clicking the column's sort toggle updates `aria-sort` (`none` -> `ascending` -> `descending`); assert on `aria-sort`, not just visible row order, since default order can coincidentally match one direction |
| TC-L03 | Paginate between pages | Previous/Next buttons and the "Go To" page spinbutton navigate correctly and stay in sync with the "Page X of Y" indicator |
| TC-L04 | Row action menu shows only status-appropriate actions | E.g. Edit/Delete only offered for Draft rows, Submit only for Pending/Rejected rows - verify the "..." menu content changes per row status |
| TC-L05 | Row status badge matches the record's lifecycle state | Create records in a few different statuses (Draft, Pending, Approved, Rejected) and confirm each row's status text is correct |

Numbering intentionally skips TC06-TC10, TC015, TC018 - reserve those for
module-specific cases (e.g. module-only fields, calculations, or workflows)
without renumbering the shared set. Listing-page cases use an `L` suffix and
validation cases use a `V` suffix so they stay distinguishable from
record-level cases at a glance.

## Implementation Conventions

These conventions came out of building the Procurement Request suite and
should be reused as-is unless a module has a concrete reason to deviate.

- **Page Object Model**: one `pages/<module>.page.ts` per module/feature, with
  navigation helpers (`gotoList`, `gotoAdd`, `gotoEdit`, `gotoView`), form
  helpers, and read-back helpers (`getFieldValueOnView`, `getEditComboboxValue`).
- **Serial, stateful groups**: group dependent test cases with
  `test.describe.serial()` and share one browser context/page via
  `test.beforeAll`/`test.afterAll` instead of Playwright's default
  fresh-page-per-test. Do not close the browser between test cases in the same
  group. Typical grouping: one group for TC01-TC05 (full lifecycle, only
  including TC04/TC05 if the module has an approval flow), one for
  TC011-TC013 (edit integrity), one for TC014/TC016/TC017/TC019 (delete
  flows), one for TC-L0x (listing-page cases, which don't depend on a
  specific created record so they can run independently/in parallel), and one
  for TC-V0x (validation cases, which also don't need a persisted record -
  each test fills the form, asserts the error, and never saves).
- **Capturing the created record's ID**: the list is a shared, persistent,
  real dataset - never assume "first row" is the just-created record. Capture
  the ID from the list's own network refetch after save
  (`page.waitForResponse(...)` on the listing endpoint), reading the first
  entry of the response body, not from DOM scraping.
- **Known app gaps, not silent workarounds**: if a test case reveals a real
  business-rule gap (e.g. delete not actually blocked server-side), keep the
  test and mark it with `test.fail(true, 'reason')` rather than quietly
  relaxing the assertion. This keeps the gap visible in the report - Playwright
  will flag it as an unexpected pass if/when it's fixed, prompting removal of
  `test.fail()`. Document the gap in a code comment and in this repo's
  automation-locators memory/notes.
- **Debounced computed fields**: any module with client-side calculated totals
  (tax, gross/net amounts, etc.) needs a settle-wait after filling
  quantity/rate and before Save - check for a lodash `_.debounce` in the
  relevant `*-entry-modal.tsx` component before writing the test.
- **Date fields on edit**: editing a record on a later day than it was created
  can trip "date cannot be in the past" validation - reset the date field to
  today before saving in any TC02/TC013-style edit-then-save flow.
- **Combobox/lookup fields**: read selected values via the combobox's own
  accessible text/innerText, not `getByPlaceholder`, and strip stray
  zero-width space / BOM characters (`/[​﻿]/g`) that MUI's
  clear-selection icon can leave behind.
- **Listing page (shared across every module)**: the search input's only
  accessible name is its hardcoded `"Search"` placeholder; the row `"..."`
  menu's own accessible name is `"More Icon"` (from its icon's alt text, not
  a label); column sort is stock `material-react-table`/MUI `aria-sort`
  behavior with no per-module custom code; the empty-state row renders
  `"No Data"` (`common.noData`) inside a non-`<tr>` `Box`, not a real table
  row. The shared `Pagination` component's Prev/Next buttons are bare
  `IconButton`s with **no `aria-label`** - locate them structurally (e.g. off
  the `"Go To :"` label) rather than by accessible name. The `"Go To"` page
  number input has **no associated `<label>`** (`id="outlined-required"`,
  no `htmlFor`), so it isn't reachable via a name-based role query either.
  `"Page X of Y"` renders as several separate text nodes, not one string -
  regex-match the container's collapsed text content instead of an
  exact-text locator. `BasePage.js` has reusable helpers for all of this
  (`searchList`, `noDataRow`, `columnHeader`/`getColumnAriaSort`,
  `prevPageButton`/`nextPageButton`/`goToPage`/`getPaginationLabel`,
  `isRowActionDisabled`).

## Adapting to a New Module

1. Copy this checklist and note which TCs don't apply (e.g. a module with no
   line items skips the "related master data" nuance in TC019).
2. Check whether the module has an approval workflow at all (look for
   Submit/Accept/Reject actions on the view page) before including the
   Approval Flow section - if it doesn't, skip TC04/TC05/TC016/TC017 entirely
   rather than forcing them in.
3. If it does have an approval flow, read the module's approval/workflow
   component (usually `views/<feature>/view-<feature>/components/headers.tsx`
   or equivalent in `erpforce-fe`) to confirm the actual status-gating logic
   and button/menu structure before writing TC04/TC05 - don't assume it
   matches Procurement's split-button/portal-menu pattern.
4. Confirm the list/detail API response shape to know how to capture the
   created record's ID (field name may differ from `purchase_requests`).
5. Write TC01-TC03 first, get them green, then Approval Flow (if applicable),
   then TC011-TC019 field/delete integrity cases, then the TC-L0x listing
   cases and TC-V0x validation cases, then any module-specific cases.
