---
name: qa-bug-triage-debugger
description: Debugs Playwright test failures, triages auth & session errors, handles dynamic dropdown timing issues, and generates bug reports.
---

# Skill: QA Bug Triage & Debugger (`qa-bug-triage-debugger`)

## Overview
This skill provides a systematic diagnostic workflow for debugging Playwright test failures in `ERP-Automation`, isolating genuine application bugs from test flakiness, and formatting structured defect reports.

## Diagnostic Protocol

### Step 1: Read Log Evidence & HTML Report
1. Run Playwright in headed or trace mode:
   ```bash
   npx playwright test tests/<module>/<spec>.spec.js --headed
   npm run test:report
   ```
2. Inspect Playwright trace logs, screenshots, and console outputs before altering code.

### Step 2: Categorize Failure Type

#### A. Auth / Session Failure (401 / 403 HTTP Error)
- **Symptom**: `BasePage` throws `Auth failure: 401/403` or UI elements fail to render due to an unauthenticated API call.
- **Cause**: Stale `auth.json` token.
- **Resolution**: Do NOT change UI locators or wait times. Delete `auth.json` and re-run global setup:
  ```bash
  rm auth.json
  npx playwright test tests/auth/login.spec.js
  ```

#### B. Dynamic Dropdown / DynamicSelect Timing Bug
- **Symptom**: Combobox dropdown renders "No data available" or option click fails mid-flight.
- **Cause**: Known app bug where sibling field selections interrupt active API calls.
- **Resolution**: Re-use `BasePage` helpers (`openDropdownAndPick`, `selectFieldByLabel`), which execute an Escape key reset, settle delay, and retry sequence.

#### C. Calculation Race Condition
- **Symptom**: Saving a line item submits `null` or `0` for Net Amount, Gross Amount, or Total Tax.
- **Cause**: Form submitted before debounced computation API resolves.
- **Resolution**: Insert `await featurePage.waitForItemAmountsToSettle()` prior to save.

#### D. Verified Application Bug
- **Symptom**: App UI/backend fails to enforce documented business logic (e.g., deleting a Submitted/Approved record succeeds when it should be blocked).
- **Resolution**:
  1. Retain the test case with expected assertions.
  2. Tag the test with `test.fail(true, 'Application bug: <description>')`.
  3. File a defect report using the standard template below.

## Defect Report Template

```markdown
### Bug Report: [Short Title Describing Defect]

- **Module**: [e.g., Procurement / Purchase Order]
- **Severity**: [Critical / Major / Minor]
- **Test Case ID**: [e.g., TC-PO-16]

#### Description
[Clear, concise description of the unexpected behavior]

#### Steps to Reproduce
1. Log in to ERPForce.
2. Navigate to [Module -> Screen].
3. Fill required fields and submit.
4. Attempt action [e.g. Delete record in Submitted status].

#### Expected Result
[What should happen according to specs]

#### Actual Result
[What actually happens, including error messages or screenshots]

#### Artifacts
- Trace file: `playwright-report/data/...`
- Console Log / Stack Trace snippet
```
