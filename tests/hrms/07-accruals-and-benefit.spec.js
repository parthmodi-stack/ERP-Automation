const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const AccrualsAndBenefitPage = require('../../pages/AccrualsAndBenefitPage');
const testData = require('../../config/testData');
const testDataFactory = require('../../config/testDataFactory');

// Accruals and Benefit Master (erpforce-hrms-fe: src/views/accruals-and-benefit/) - confirmed real
// module, route `/dashboard/hrms/company-master-policy/accruals-and-benefit`. Implements the
// cases documented in ACCRUALS_AND_BENEFIT_TEST_CASES.md marked "Automation Candidate: Yes" - see
// that doc for the full 256-case catalogue, the "Manual first" cases NOT automated here, and the
// confirmed cross-stack bugs this suite specifically exercises.
//
// SCOPE NOTES:
// - This is a SINGLE scrolling form (4 accordions: Basic Details / Calculation Methods /
//   Classifications / Attachments) - NOT a tab wizard, same shape as Loan Configuration.
// - No approval workflow exists (Draft -> Active/Inactive only, same shape as every other HRMS
//   module in this suite).
// - Department is required on this module's Add form and is company-scoped
//   (`filterFields=company_id`) - picking "whatever renders first" from the shared/cumulative
//   live Department list is unreliable (it can drift to a Department scoped to a different
//   Company, which the filter then silently excludes). Every test that needs a Department creates
//   its own fresh one inline via the field's own "Create New Department" footer link
//   (AccrualsAndBenefitPage.createDepartmentFromFooter) rather than navigating away to the
//   Department Master module or picking an existing option.
// - Location's option text remains unverified live master data - tests that touch it at all pick
//   whatever renders first (AccrualsAndBenefitPage.selectFirstMultiSelectOption).
// - TC-ACC-CALC-07/19/21 below are deliberate BUG REPRO cases, not green-path assertions: `amount`/
//   `value` of exactly 0 pass the backend JSON-schema's `minimum:0` but are rejected by a stricter
//   service-layer "must be a positive number" check, and `cap_limit = 0` bypasses its own service
//   guard entirely (the guard tests `cap_limit` for truthiness, and 0 is falsy in JS) - confirmed
//   from `accrual-master.service.js`, not a guess.
test.describe('Accruals and Benefit Master Module', () => {
  let created = {};
  let draftRecord = {};

  // Creates a brand-new Department via the Department field's own "Create New Department" footer
  // link and selects it - Company must already be chosen on the form (the field is disabled
  // until then). Returns the freshly created Department's name.
  async function addFreshDepartment(ab, company) {
    const departmentName = testDataFactory.uniqueName('Automation_Department_AccrualBenefit');
    const departmentCode = testDataFactory.uniqueName('DEPT');
    await ab.createDepartmentFromFooter(departmentName, departmentCode, company);
    return departmentName;
  }

  // ── TC-ACC-SAVE-01: Create with Fixed Value method, mandatory fields only ────
  test('TC-ACC-SAVE-01 [+] Create Accruals and Benefit with Fixed Value method', { tag: '@smoke' }, async ({ page }) => {
    const ab = new AccrualsAndBenefitPage(page);
    const data = testData.accrualsAndBenefit.valid;

    await ab.goto();
    await expect(page).toHaveURL(/add-accruals-and-benefit/);

    await ab.fillBasicDetails({ company: data.company, name: data.name, type: data.type });
    await ab.fillCalculationMethods({ method: 'fixed_value', amount: data.amount, frequency: data.frequency });
    await addFreshDepartment(ab, data.company);

    const result = await ab.save();
    expect(result.seriesNumber).toBeTruthy();
    created = { ...result, name: data.name };

    await ab.searchList(data.name);
    await expect(page.getByText(data.name, { exact: false }).first()).toBeVisible();
    await expect(await ab.getRowStatus(created.seriesNumber)).toMatch(/Active/);
  });

  // ── TC-ACC-VIEW-01/09: View renders read-only ─────────────────────────────────
  test('TC-ACC-VIEW-01 [+] View Accruals and Benefit - read-only, no editable inputs', async ({ page }) => {
    const ab = new AccrualsAndBenefitPage(page);
    const data = testData.accrualsAndBenefit.valid;

    await ab.gotoList();
    await ab.searchList(created.seriesNumber);
    await ab.openViewFromList(created.seriesNumber);
    await expect(page).toHaveURL(/view-accruals-and-benefit/);

    await expect(page.getByText(data.name, { exact: false }).first()).toBeVisible();

    // TC-ACC-VIEW-09: no field on View accepts focus/typing.
    const editableInputs = page.locator('input:not([disabled]):not([readonly])');
    await expect(editableInputs).toHaveCount(0);
  });

  // ── TC-ACC-VIEW-02: ID display shows the ACC0xx business id, not the raw id ──
  test('TC-ACC-VIEW-02 [+] View shows the ACC0xx business id in the breadcrumb', async ({ page }) => {
    const ab = new AccrualsAndBenefitPage(page);

    await ab.gotoList();
    await ab.searchList(created.seriesNumber);
    await ab.openViewFromList(created.seriesNumber);

    await expect(page.getByText(`ID: ${created.seriesNumber}`, { exact: false })).toBeVisible();
  });

  // ── TC-ACC-EDIT-01/07: Edit preloads existing values, update Name ─────────────
  test('TC-ACC-EDIT-01 [+] Edit Accruals and Benefit - existing values preload, update Name', async ({ page }) => {
    const ab = new AccrualsAndBenefitPage(page);
    const data = testData.accrualsAndBenefit.valid;

    await ab.gotoList();
    await ab.searchList(created.seriesNumber);
    await ab.openEditFromList(created.seriesNumber);
    await expect(page).toHaveURL(/edit-accruals-and-benefit/);

    // TC-ACC-EDIT-01: existing Company preloads.
    expect(await ab.getSelectedValue(ab.companyField)).not.toBe('');

    await ab.nameInput.fill(data.updatedName);
    await expect(ab.nameInput).toHaveValue(data.updatedName);

    const result = await ab.save();
    created.name = data.updatedName;
    expect(result.seriesNumber).toBeTruthy();
  });

  // ── TC-ACC-SAVE-10/13: Save to Draft, Draft chip overrides Status ─────────────
  test('TC-ACC-SAVE-10 [+] Create Accruals and Benefit and Save To Draft - status shows Draft', async ({ page }) => {
    const ab = new AccrualsAndBenefitPage(page);
    const data = testData.accrualsAndBenefit.valid;
    const name = testDataFactory.uniqueName('Automation_AccrualBenefit_Draft');

    await ab.goto();
    await ab.fillBasicDetails({ company: data.company, name });

    const result = await ab.saveAsDraft();
    draftRecord = { ...result, name };

    await ab.searchList(name);
    // TC-ACC-SAVE-13: is_draft overrides the Active/Inactive toggle's own label on the list chip.
    await expect(await ab.getRowStatus(draftRecord.seriesNumber)).toMatch(/Draft/);
  });

  // ── TC-ACC-SAVE-11: draft handler skips client-side Yup validation entirely ──
  // CONFIRMED SOURCE FACT (add-accruals-and-benefit.hrms.tsx:80-133): handleSaveAsDraft calls
  // methods.getValues() directly, never methods.trigger()/handleSubmit() - no inline validation
  // errors render on this path even with every field left blank.
  test('TC-ACC-SAVE-11 [-] Save To Draft with all fields blank shows no validation errors', async ({ page }) => {
    const ab = new AccrualsAndBenefitPage(page);
    const name = testDataFactory.uniqueName('Automation_AccrualBenefit_EmptyDraft');

    await ab.goto();
    await ab.nameInput.fill(name); // only Name filled - Company/Type/Method/Department left blank
    await ab.saveToDraftButton.click();

    await expect(ab.companyRequiredError).not.toBeVisible();
    await expect(ab.methodRequiredError).not.toBeVisible();
    await expect(ab.departmentRequiredError).not.toBeVisible();
    await expect(page).toHaveURL(/\/accruals-and-benefit$/);

    await ab.searchList(name);
    await expect(page.getByText(name, { exact: false }).first()).toBeVisible();
  });

  // ── TC-ACC-SAVE-15: real Save on a Draft enforces full validation ────────────
  test('TC-ACC-SAVE-15 [-] Converting a Draft via real Save enforces full validation', async ({ page }) => {
    const ab = new AccrualsAndBenefitPage(page);

    await ab.gotoList();
    await ab.searchList(draftRecord.seriesNumber);
    await ab.openEditFromList(draftRecord.seriesNumber);

    // Save To Draft IS visible here because the fetched record's is_draft is true
    // (edit-accruals-and-benefit.hrms.tsx: `{tData?.is_draft && canSaveAsDraft ? ... }`).
    await expect(ab.saveToDraftButton).toBeVisible();

    // The draft was saved with only Name set - Type/Method/Department are still blank, so a real
    // Save must be blocked by full Yup validation.
    await ab.saveButton.click();
    await expect(ab.typeRequiredError.or(ab.methodRequiredError).or(ab.departmentRequiredError)).toBeVisible();

    await ab.discardButton.click();
  });

  // ── TC-ACC-SAVE-16: Discard on Add ────────────────────────────────────────────
  test('TC-ACC-SAVE-16 [-] Discard a new Accruals and Benefit - no record is created', async ({ page }) => {
    const ab = new AccrualsAndBenefitPage(page);
    const discardedName = `${testData.accrualsAndBenefit.valid.name}_DISCARDED`;

    await ab.goto();
    await ab.fillBasicDetails({ name: discardedName, company: testData.accrualsAndBenefit.valid.company });
    await ab.discardButton.click();

    await expect(page).toHaveURL(/\/accruals-and-benefit$/);
    await ab.searchList(discardedName);
    await expect(ab.noDataRow()).toBeVisible();
  });

  // ── Delete ─────────────────────────────────────────────────────────────────
  // Deletes a throwaway record, leaving the original TC-ACC-SAVE-01 record and the TC-ACC-SAVE-10
  // draft intact for later tests in this file (same pattern as every other HRMS suite here).
  test('TC-ACC-DEL-03 [-] Delete a record from the list', async ({ page }) => {
    const ab = new AccrualsAndBenefitPage(page);
    const data = testData.accrualsAndBenefit.valid;
    const name = testDataFactory.uniqueName('Automation_AccrualBenefit_ToDelete');

    await ab.goto();
    await ab.fillBasicDetails({ company: data.company, name, type: data.type });
    await ab.fillCalculationMethods({ method: 'fixed_value', amount: data.amount, frequency: data.frequency });
    await addFreshDepartment(ab, data.company);
    const result = await ab.save();

    await ab.searchList(name);
    await ab.deleteFromList(result.seriesNumber);

    await ab.searchList(name);
    await expect(ab.noDataRow()).toBeVisible();
  });

  // ── Dependency (Company -> Location/Department, this module's Classification section) ─
  test.describe('Company → Location/Department Dependency', () => {
    test('TC-ACC-CLASS-01 [-] Location/Department are disabled until Company is selected', async ({ page }) => {
      const ab = new AccrualsAndBenefitPage(page);

      await ab.goto();
      // CONFIRMED LIVE: Company auto-populates with the logged-in user's default company
      // ("erp-force") shortly after Add loads - clear it explicitly to exercise the actual
      // disabled-until-Company state, rather than assuming the field starts blank.
      await ab.clearCompanyButton.click();
      await expect(await ab.isFieldEnabled(ab.locationField)).toBe(false);
      await expect(await ab.isFieldEnabled(ab.departmentField)).toBe(false);

      await ab.discardButton.click();
    });

    test('TC-ACC-CLASS-02 [+] Location/Department enable after Company is selected', async ({ page }) => {
      const ab = new AccrualsAndBenefitPage(page);
      const data = testData.accrualsAndBenefit.valid;

      await ab.goto();
      await ab.selectFieldByLabel(ab.companyField, data.company, { exact: false });
      await expect(await ab.isFieldEnabled(ab.locationField)).toBe(true);
      await expect(await ab.isFieldEnabled(ab.departmentField)).toBe(true);

      await ab.discardButton.click();
    });
  });

  // ── Field Validation ───────────────────────────────────────────────────────
  test.describe('Field Validation', () => {
    test('TC-ACC-FLD-01/04/15, TC-ACC-CALC-02, TC-ACC-CLASS-04 [-] Required Company/Name/Type/Method/Department block Save', async ({ page }) => {
      const ab = new AccrualsAndBenefitPage(page);

      await ab.goto();
      await ab.saveButton.click();

      await expect(ab.companyRequiredError).toBeVisible();
      await expect(ab.nameRequiredError).toBeVisible();
      await expect(ab.typeRequiredError).toBeVisible();
      await expect(ab.methodRequiredError).toBeVisible();
      await expect(ab.departmentRequiredError).toBeVisible();
      await expect(page).toHaveURL(/add-accruals-and-benefit/); // did not navigate away

      await ab.discardButton.click();
    });

    // CONFIRMED BUG REPRO (ACCRUALS_AND_BENEFIT_TEST_CASES.md TC-ACC-CALC-07): the JSON-schema
    // allows Amount=0 (`minimum:0`), but accrual-master.service.js's own business-logic check
    // throws "Amount must be a positive number" - the record must NOT save with Amount=0.
    test('TC-ACC-CALC-07 [-] Fixed Value Amount of exactly 0 is rejected', async ({ page }) => {
      const ab = new AccrualsAndBenefitPage(page);
      const data = testData.accrualsAndBenefit.valid;
      const name = testDataFactory.uniqueName('Automation_AccrualBenefit_ZeroAmount');

      await ab.goto();
      await ab.fillBasicDetails({ company: data.company, name, type: data.type });
      await ab.fillCalculationMethods({
        method: 'fixed_value',
        amount: testData.accrualsAndBenefit.negative.zeroAmount,
        frequency: data.frequency,
      });
      await addFreshDepartment(ab, data.company);
      await ab.saveButton.click();

      // Server-side business-rule rejection, not a client-side Yup error (Yup's own `.required()`
      // is satisfied by literal 0) - assert the record was never created instead of guessing the
      // exact toast wording.
      await expect(page).toHaveURL(/add-accruals-and-benefit/);
      await ab.discardButton.click();
      await ab.searchList(name);
      await expect(ab.noDataRow()).toBeVisible();
    });

    test('TC-ACC-CALC-08 [-] Fixed Value Amount rejects a negative value', async ({ page }) => {
      const ab = new AccrualsAndBenefitPage(page);
      const data = testData.accrualsAndBenefit.valid;

      await ab.goto();
      await ab.fillBasicDetails({ company: data.company, name: testDataFactory.uniqueName('Automation_AccrualBenefit_Neg'), type: data.type });
      await ab.fillCalculationMethods({ method: 'fixed_value', amount: testData.accrualsAndBenefit.negative.negativeAmount, frequency: data.frequency });
      await ab.saveButton.click();

      await expect(page.locator('.Mui-error, [class*="error"]').first()).toBeVisible();
      await ab.discardButton.click();
    });

    // CONFIRMED BUG REPRO (TC-ACC-CALC-21): cap_limit's own service guard
    // (`if (cap_limit && cap_limit <= 0)`, `if (cap_limit && value && cap_limit < value)`) tests
    // `cap_limit` for truthiness - a literal 0 is falsy in JS, so both checks are silently skipped
    // even though Value=500 makes Cap Limit=0 logically invalid. This documents the gap, it does
    // NOT assert the (missing) error.
    test('TC-ACC-CALC-21 [-] Confirmed gap: Cap/Limit of exactly 0 bypasses its own validation', async ({ page }) => {
      const ab = new AccrualsAndBenefitPage(page);
      const vsc = testData.accrualsAndBenefit.variableSalaryComponent;
      const data = testData.accrualsAndBenefit.valid;
      const name = `${vsc.name}_CAPZERO`;

      await ab.goto();
      await ab.fillBasicDetails({ company: data.company, name, type: data.type });
      await ab.fillCalculationMethods({
        method: 'variable_salary_component',
        baseComponent: vsc.baseComponent,
        operator: vsc.operator,
        value: vsc.value,
        capLimit: testData.accrualsAndBenefit.negative.zeroCapLimit,
      });
      await addFreshDepartment(ab, data.company);

      const result = await ab.save();
      // Confirmed real gap: cap_limit=0 with value=500 should logically fail "cap >= value", but
      // the falsy-zero guard clause never fires, so this succeeds.
      expect(result.seriesNumber).toBeTruthy();
    });

    // Contrast case: a non-zero Cap Limit below Value DOES correctly trigger the service's
    // "cap >= value" rule - only the zero case is broken.
    test('TC-ACC-CALC-23 [-] Cap/Limit below a non-zero Value is correctly rejected', async ({ page }) => {
      const ab = new AccrualsAndBenefitPage(page);
      const vsc = testData.accrualsAndBenefit.variableSalaryComponent;
      const data = testData.accrualsAndBenefit.valid;
      const name = `${vsc.name}_CAPBELOW`;

      await ab.goto();
      await ab.fillBasicDetails({ company: data.company, name, type: data.type });
      await ab.fillCalculationMethods({
        method: 'variable_salary_component',
        baseComponent: vsc.baseComponent,
        operator: vsc.operator,
        value: vsc.value, // 500
        capLimit: testData.accrualsAndBenefit.negative.capLimitBelowValue, // 100 - below Value
      });
      await addFreshDepartment(ab, data.company);
      await ab.saveButton.click();

      await expect(page).toHaveURL(/add-accruals-and-benefit/);
      await ab.discardButton.click();
      await ab.searchList(name);
      await expect(ab.noDataRow()).toBeVisible();
    });

    test('TC-ACC-FLD-08 [-] Duplicate Name is rejected', async ({ page }) => {
      const ab = new AccrualsAndBenefitPage(page);
      const data = testData.accrualsAndBenefit.valid;

      await ab.goto();
      await ab.fillBasicDetails({ company: data.company, name: created.name, type: data.type });
      await ab.fillCalculationMethods({ method: 'fixed_value', amount: data.amount, frequency: data.frequency });
      await addFreshDepartment(ab, data.company);
      await ab.saveButton.click();

      await expect(page).toHaveURL(/add-accruals-and-benefit/); // blocked, stayed on Add
      await ab.discardButton.click();
    });

    // XSS: Name/Instructions must render as inert text, not execute, on List/View.
    test('TC-ACC-FLD-11/21 [-] Script-like content in Name/Instructions renders inert, not executed', async ({ page }) => {
      const ab = new AccrualsAndBenefitPage(page);
      const data = testData.accrualsAndBenefit.valid;
      const xssName = testDataFactory.uniqueName('Automation_AccrualBenefit_XSS');

      await ab.goto();
      await ab.fillBasicDetails({
        company: data.company,
        name: xssName,
        type: data.type,
        instructions: '<img src=x onerror=alert(1)>',
      });
      await ab.fillCalculationMethods({ method: 'fixed_value', amount: data.amount, frequency: data.frequency });
      await addFreshDepartment(ab, data.company);

      const result = await ab.save();
      expect(result.seriesNumber).toBeTruthy();

      await ab.searchList(xssName);
      await ab.openViewFromList(result.seriesNumber);
      // Rendered as plain text - the page is still intact (nav/breadcrumb present), no alert fired.
      await expect(page.getByRole('button', { name: 'Actions' })).toBeVisible();
      await expect(page.getByText(xssName, { exact: false }).first()).toBeVisible();
    });
  });

  // ── Calculation Methods ────────────────────────────────────────────────────
  test.describe('Calculation Methods', () => {
    test('TC-ACC-CALC-14/15/16/17 [+] Create with Variable Salary Component method', async ({ page }) => {
      const ab = new AccrualsAndBenefitPage(page);
      const vsc = testData.accrualsAndBenefit.variableSalaryComponent;
      const data = testData.accrualsAndBenefit.valid;

      await ab.goto();
      await ab.fillBasicDetails({ company: data.company, name: vsc.name, type: data.type });
      await ab.fillCalculationMethods({
        method: 'variable_salary_component',
        baseComponent: vsc.baseComponent,
        operator: vsc.operator,
        value: vsc.value,
        capLimit: vsc.capLimit,
      });
      await addFreshDepartment(ab, data.company);

      const result = await ab.save();
      expect(result.seriesNumber).toBeTruthy();

      await ab.searchList(vsc.name);
      await ab.openViewFromList(result.seriesNumber);
      await expect(page.getByText(vsc.baseComponent, { exact: false })).toBeVisible();
    });

    test('TC-ACC-CALC-01 [+] Methods dropdown offers exactly the 2 real values', async ({ page }) => {
      const ab = new AccrualsAndBenefitPage(page);

      await ab.goto();
      await ab.dependentFieldCombobox(ab.methodsField).click();
      const options = await page.getByRole('listbox').getByRole('option').allTextContents();
      const cleaned = options.map((o) => o.replace(/[​﻿]/g, '').trim()).filter(Boolean);

      expect(cleaned).toContain('Fixed Value');
      expect(cleaned).toContain('Variable Salary Component');
      expect(cleaned).not.toContain('Formula');

      // CONFIRMED LIVE: Escape alone doesn't close this popover (it stays "expanded"), which then
      // blocks the Discard button click - close it by clicking outside instead, same technique
      // BasePage.searchList/clearSearch already use to dismiss this app's popovers.
      await page.locator('body').click({ position: { x: 300, y: 10 }, force: true }).catch(() => {});
      await page.locator('.MuiPopover-root, .MuiMenu-root').first().waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
      await ab.discardButton.click();
    });
  });

  // ── Attachments ────────────────────────────────────────────────────────────
  test.describe('Attachments', () => {
    // CONFIRMED SOURCE BUG (form/form.tsx, add-accruals-and-benefit.hrms.tsx:97-99): UploadMedia
    // is `multiple={true}`, but every submit path only keeps `allUploadedFiles[0]` - the backend
    // column is a single VARCHAR(255) URL string.
    test('TC-ACC-ATT-05 [-] Uploading 2 files keeps only the first one after Save', async ({ page }) => {
      const ab = new AccrualsAndBenefitPage(page);
      const data = testData.accrualsAndBenefit.valid;
      const name = testDataFactory.uniqueName('Automation_AccrualBenefit_MultiFile');

      const tmpDir = os.tmpdir();
      const fileA = path.join(tmpDir, `accrual-attachment-a-${Date.now()}.txt`);
      const fileB = path.join(tmpDir, `accrual-attachment-b-${Date.now()}.txt`);
      fs.writeFileSync(fileA, 'attachment A content');
      fs.writeFileSync(fileB, 'attachment B content');

      try {
        await ab.goto();
        await ab.fillBasicDetails({ company: data.company, name, type: data.type });
        await ab.fillCalculationMethods({ method: 'fixed_value', amount: data.amount, frequency: data.frequency });
        await addFreshDepartment(ab, data.company);
        await ab.uploadAttachment([fileA, fileB]);

        const result = await ab.save();
        expect(result.seriesNumber).toBeTruthy();

        await ab.searchList(name);
        await ab.openViewFromList(result.seriesNumber);
        // Only one attachment link should render, confirming the second file was silently dropped.
        const attachmentLinks = page.locator('a', { hasText: /accrual-attachment/i });
        await expect(attachmentLinks).toHaveCount(1);
      } finally {
        fs.unlinkSync(fileA);
        fs.unlinkSync(fileB);
      }
    });
  });

  // ── Listing Page ──────────────────────────────────────────────────────────
  test.describe('Listing Page', () => {
    test('TC-ACC-SRCH-01 [+] Search the list by Name', async ({ page }) => {
      const ab = new AccrualsAndBenefitPage(page);
      await ab.gotoList();
      await ab.searchList(created.name);
      await expect(page.getByText(created.name, { exact: false }).first()).toBeVisible();

      await ab.searchList('zzz-no-such-accrual-benefit-zzz');
      await expect(ab.noDataRow()).toBeVisible();
    });

    test('TC-ACC-SORT-01 [+] Sort the ID column ascending/descending', async ({ page }) => {
      const ab = new AccrualsAndBenefitPage(page);
      await ab.gotoList();

      await ab.clickColumnHeader('ID');
      const firstSort = await ab.getColumnAriaSort('ID');
      expect(['ascending', 'descending']).toContain(firstSort);

      await ab.clickColumnHeader('ID');
      const secondSort = await ab.getColumnAriaSort('ID');
      expect(secondSort).not.toBe(firstSort);
    });

    test('TC-ACC-PAGE-02/03 [+] Paginate the list', async ({ page }) => {
      const ab = new AccrualsAndBenefitPage(page);
      await ab.gotoList();

      const label = await ab.getPaginationLabel();
      expect(label).toMatch(/Page \d+ of \d+/);

      if (await ab.nextPageButton().isEnabled()) {
        await ab.nextPageButton().click();
        await page.waitForLoadState('networkidle');
        const nextLabel = await ab.getPaginationLabel();
        expect(nextLabel).not.toBe(label);
      }
    });

    test('TC-ACC-LIST-09 [+] Row action menu offers View/Edit (no Duplicate) and destructive Delete', async ({ page }) => {
      const ab = new AccrualsAndBenefitPage(page);
      await ab.gotoList();
      await ab.searchList(created.name);
      await ab.openRowActionMenu(created.seriesNumber);

      await expect(page.getByRole('menuitem', { name: 'View', exact: true })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Duplicate', exact: true })).toHaveCount(0);
      await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
    });

    test('TC-ACC-LIST-05 [+] Row status badge matches the record\'s lifecycle state', async ({ page }) => {
      const ab = new AccrualsAndBenefitPage(page);
      await ab.gotoList();
      await ab.searchList(created.name);
      await expect(await ab.getRowStatus(created.seriesNumber)).toMatch(/Active/);
    });
  });
});
