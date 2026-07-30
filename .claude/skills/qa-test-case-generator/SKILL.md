---
name: qa-test-case-generator
description: Generates standardized QA test case checklists and test suites based on DEFAULT_TEST_CASES.md for ERP modules.
---

# Skill: QA Test Case Generator (`qa-test-case-generator`)

## Overview
This skill outlines the process for generating comprehensive QA test case checklists for any ERPForce module. It ensures test suites remain consistent, structured, and aligned with `DEFAULT_TEST_CASES.md`.

## Canonical Test Case Checklist Structure

### 1. Core CRUD Test Cases
- **TC01**: Create a new record with line items and save as Draft.
- **TC02**: Edit the draft record and persist changes.
- **TC03**: View page displays all previously saved data correctly (including totals).
- **TC011**: Auto-filled fields on Edit mode match View page data.
- **TC012**: Read-only fields remain disabled/unmodifiable in Edit mode.
- **TC013**: Editing a single field updates only that field without affecting others.
- **TC014**: Delete a Draft record successfully.
- **TC019**: Master data remains intact after record deletion.

### 2. Field Validation Test Cases
- **TC-V01**: Required fields left empty block form submission with inline errors.
- **TC-V02**: Invalid input format (email, date, type mismatch) is rejected.
- **TC-V03**: Zero/negative numeric values are rejected where positive numbers are required.
- **TC-V04**: Max character limits on text/narration fields are enforced.
- **TC-V05**: Duplicate values for unique fields trigger validation errors.
- **TC-V06**: Cross-field business logic dependencies are validated.
- **TC-V07**: Correcting an invalid input clears its inline error.

### 3. Approval Workflow Test Cases (For Document Modules)
- **TC04**: Submit for approval, perform Quick Approval, and verify Accept status.
- **TC05**: Create a separate record, submit for approval, and perform Reject action.
- **TC016**: Attempting to delete a Submitted/Pending record is blocked.
- **TC017**: Attempting to delete an Approved record is blocked.

### 4. Listing Page Test Cases
- **TC-L01**: Search/filter the list view and verify empty state for non-matching queries.
- **TC-L02**: Column sorting toggling updates `aria-sort` (`none` -> `ascending` -> `descending`).
- **TC-L03**: Pagination controls (Prev, Next, Page spinbutton) navigate accurately.
- **TC-L04**: Action menu ("...") dynamically offers only status-appropriate actions.
- **TC-L05**: Status badges accurately reflect record lifecycle state.

### 5. Module-Specific Test Cases (Reserved TC06-TC10, TC015, TC018)
- Specialized calculations (e.g. multi-currency conversions, tax calculations, discount tiers).
- Module-specific status transitions (e.g. Partial Delivery, Closed, Cancelled).

## Workflow to Scaffold New Test Cases
1. **Read Frontend Schema**: Inspect `validationSchema.ts` or Yup schemas in `erpforce-fe` to capture exact field constraints.
2. **Draft Test Cases**: Apply the canonical numbering structure (`TC01-TC19`, `TC-V0x`, `TC-L0x`).
3. **Format Output**: Produce Markdown tables or exportable CSVs for QA tracking tools.
4. **Don't stop at client-side validation**: some rejections only happen server-side and never show up in the frontend Yup schema at all (e.g. an eligibility/business rule like "employee not eligible for this record type during probation", or a duplicate/overlap-range check). These are usually invisible from source reading alone and only surface once a real Save is attempted live - if a manual test case doc claims "Save succeeds," confirm that against a live run (or the corresponding Playwright suite) before publishing it, and add a dedicated negative test case once found rather than folding it into an unrelated one.
