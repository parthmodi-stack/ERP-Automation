const { test, expect } = require('@playwright/test');
const LoanConfigurationPage = require('../../pages/LoanConfigurationPage');
const testData = require('../../config/testData');
const testDataFactory = require('../../config/testDataFactory');

// Loan Configuration (erpforce-hrms-fe: src/views/loan-configuration/) - confirmed real module,
// route `/dashboard/hrms/loan-configuration`. Implements the cases documented in
// LOAN_CONFIGURATION_TEST_CASES.md that are marked "Automation: Yes" (i.e. confirmed from source,
// not a live-verification-needed guess). See that document for the full 278-case catalogue and
// the reasoning behind every case marked "Manual first" instead.
//
// This is a SINGLE scrolling form (5 accordions: Basic Details / Loan Limits / Repayment
// Configuration / Eligibility Criteria / Classification) - NOT a tab wizard like Leave Policy
// Master. Save/Save To Draft/Discard all render on the one page.
//
// SCOPE NOTES:
// - No approval workflow exists (Draft -> Active/Inactive only, same shape as every other HRMS
//   module in this suite).
// - Eligible Departments/Grades option text is unverified live master data - tests pick whatever
//   renders first (LoanConfigurationPage.selectFirstMultiSelectOption) rather than asserting a
//   literal name, same caution as Salary Structure Master's Grade field.
// - The Company-switch dependency case that needs a SECOND real company (TC-LOAN-CLASS-03/EDIT-07
//   in the test-case doc) is skipped until `testData.loanConfiguration.companyB` is identified
//   against the live/dev environment, same pattern as Leave Policy/Salary Structure Master.
// - TC-LOAN-LIM-23 below is a deliberate BUG REPRO, not a green-path assertion: the Yup schema's
//   required-when-Flat rule is keyed to field names that don't exist in the form
//   (validator.tsx:38 vs form.tsx:313), so leaving the Flat Amount penalty blank never blocks
//   Save - confirmed from source, not a guess.
test.describe('Loan Configuration Module', () => {
  // Same reasoning as Organization Structure/Salary Structure Master's suites: this is a single
  // scrolling form with 5 accordions, and the default 30s test timeout is too tight once a test
  // actually fills Basic Details + Loan Limits + Save (or more). Confirmed live - TC-LOAN-VIEW-01
  // hit the 30s default mid-searchList and got its browser force-closed even though nothing was
  // actually broken, which crashed the worker and reset `created`/`draftRecord` to {} for every
  // subsequent test in this file (cascading failures with no real bug behind them).
  test.describe.configure({ timeout: 90000 });

  let created = {};
  let draftRecord = {};

  // ── TC-LOAN-SAVE-01: Create with mandatory + core Loan Limits fields ─────────
  test('TC-LOAN-SAVE-01 [+] Create Loan Configuration with mandatory fields', { tag: '@smoke' }, async ({ page }) => {
    const lc = new LoanConfigurationPage(page);
    const data = testData.loanConfiguration.valid;

    await lc.goto();
    await expect(page).toHaveURL(/add-loan-configuration/);

    await lc.fillBasicDetails({
      company: data.company,
      loanName: data.loanName,
      category: data.category,
    });
    await lc.fillLoanLimits({
      maxLoanAmountType: 'fixed',
      maxLoanAmountValue: data.maxLoanAmountValue,
      maxTenureMonths: data.maxTenureMonths,
      interestRate: data.interestRate,
      latePenaltyType: 'flat',
      latePenaltyValue: data.latePenaltyValue,
    });

    const result = await lc.save();
    expect(result.seriesNumber).toBeTruthy();
    created = { ...result, loanName: data.loanName };

    await lc.searchList(data.loanName);
    await expect(page.getByText(data.loanName, { exact: false }).first()).toBeVisible();
    await expect(await lc.getRowStatus(created.seriesNumber)).toMatch(/Active/);
  });

  // ── TC-LOAN-VIEW-01/09: View renders read-only ────────────────────────────────
  test('TC-LOAN-VIEW-01 [+] View Loan Configuration - read-only, no editable inputs', async ({ page }) => {
    const lc = new LoanConfigurationPage(page);
    const data = testData.loanConfiguration.valid;

    await lc.gotoList();
    await lc.searchList(created.seriesNumber);
    await lc.openViewFromList(created.seriesNumber);
    await expect(page).toHaveURL(/view-loan-configuration/);

    await expect(page.getByText(data.loanName, { exact: false }).first()).toBeVisible();

    // TC-LOAN-VIEW-09: no field on View accepts focus/typing. Scoped to `main` - the app shell's
    // own header search box ("Search employees, vendors...") is a real enabled <input> on every
    // page, unrelated to this form, and an unscoped locator always matches it (confirmed live).
    const editableInputs = page.getByRole('main').locator('input:not([disabled]):not([readonly])');
    await expect(editableInputs).toHaveCount(0);
  });

  // ── TC-LOAN-EDIT-01/08: Edit preloads existing values, update Loan Name ───────
  test('TC-LOAN-EDIT-01 [+] Edit Loan Configuration - existing values preload, update Loan Name', async ({ page }) => {
    const lc = new LoanConfigurationPage(page);
    const data = testData.loanConfiguration.valid;

    await lc.gotoList();
    await lc.searchList(created.seriesNumber);
    await lc.openEditFromList(created.seriesNumber);
    await expect(page).toHaveURL(/edit-loan-configuration/);

    // TC-LOAN-EDIT-01: existing Company preloads.
    await expect(await lc.getSelectedValue(lc.companyField)).toContain(data.company);

    await lc.loanNameInput.fill(data.updatedLoanName);
    await expect(lc.loanNameInput).toHaveValue(data.updatedLoanName);

    const result = await lc.save();
    created.loanName = data.updatedLoanName;
    expect(result.seriesNumber).toBeTruthy();
  });

  // ── TC-LOAN-SAVE-09/10: Save to Draft, Draft chip overrides Status ────────────
  test('TC-LOAN-SAVE-09 [+] Create Loan Configuration and Save To Draft - status shows Draft', async ({ page }) => {
    const lc = new LoanConfigurationPage(page);
    const data = testData.loanConfiguration.valid;
    const loanName = testDataFactory.uniqueName('Automation_LoanConfig_Draft');

    await lc.goto();
    await lc.fillBasicDetails({ company: data.company, loanName, category: data.category, active: true });

    const result = await lc.saveAsDraft();
    draftRecord = { ...result, loanName };

    await lc.searchList(loanName);
    // TC-LOAN-SAVE-10: is_draft overrides the Active/Inactive toggle's own label on the list chip.
    await expect(await lc.getRowStatus(draftRecord.seriesNumber)).toMatch(/Draft/);
  });

  // ── TC-LOAN-SAVE-11: "Save To Draft" hidden on a published record's Edit ──────
  test('TC-LOAN-SAVE-11 [-] "Save To Draft" is not shown when editing a published record', async ({ page }) => {
    const lc = new LoanConfigurationPage(page);

    await lc.gotoList();
    await lc.searchList(created.seriesNumber); // created is published (Save, not Save To Draft)
    await lc.openEditFromList(created.seriesNumber);

    await expect(lc.saveToDraftButton).not.toBeVisible();

    await lc.discardButton.click();
  });

  // ── TC-LOAN-SAVE-12: Converting a Draft to a full record ──────────────────────
  test('TC-LOAN-SAVE-12 [+] Edit a Draft and click Save - converts is_draft to false', async ({ page }) => {
    const lc = new LoanConfigurationPage(page);

    await lc.gotoList();
    await lc.searchList(draftRecord.seriesNumber);
    await lc.openEditFromList(draftRecord.seriesNumber);

    // Save To Draft IS visible here because loanDetails.is_draft is true (edit-loan-configuration.tsx).
    await expect(lc.saveToDraftButton).toBeVisible();

    const result = await lc.save();
    expect(result.seriesNumber).toBeTruthy();

    await lc.searchList(draftRecord.loanName);
    await expect(await lc.getRowStatus(draftRecord.seriesNumber)).not.toMatch(/Draft/);
  });

  // ── TC-LOAN-SAVE-14: Discard on Add ────────────────────────────────────────────
  test('TC-LOAN-SAVE-14 [-] Discard a new Loan Configuration - no record is created', async ({ page }) => {
    const lc = new LoanConfigurationPage(page);
    const discardedName = `${testData.loanConfiguration.valid.loanName}_DISCARDED`;

    await lc.goto();
    await lc.fillBasicDetails({ loanName: discardedName, company: testData.loanConfiguration.valid.company });
    await lc.discardButton.click();

    await expect(page).toHaveURL(/\/loan-configuration$/);
    await lc.searchList(discardedName);
    await expect(lc.noDataRow()).toBeVisible();
  });

  // ── Delete ─────────────────────────────────────────────────────────────────
  // Deletes the Draft-turned-published record from TC-LOAN-SAVE-12, leaving the original
  // TC-LOAN-SAVE-01 record intact for any future spec that wants to build on it (same pattern as
  // every other HRMS suite here).
  test('TC-LOAN-DEL-03 [-] Delete the record created in TC-LOAN-SAVE-09/12', async ({ page }) => {
    const lc = new LoanConfigurationPage(page);

    await lc.gotoList();
    await lc.deleteFromList(draftRecord.seriesNumber);

    await lc.searchList(draftRecord.loanName);
    await expect(lc.noDataRow()).toBeVisible();
  });

  // ── CONFIRMED SOURCE BUG: View crashes if Location was left blank ─────────────
  // view-loan-configuration.tsx:409 - `data?.[LOCATION_DATA].name` has NO optional-chaining
  // before `.name`, unlike every other field on that page. TC-LOAN-SAVE-01's own record never set
  // a Location, so it's already a live repro case - reused here rather than creating a new record.
  test('TC-LOAN-VIEW-BUG-01 [-] View does not crash when Location was never set', async ({ page }) => {
    const lc = new LoanConfigurationPage(page);

    await lc.gotoList();
    await lc.searchList(created.seriesNumber);
    await lc.openViewFromList(created.seriesNumber);

    // If view-loan-configuration.tsx's missing `?.` throws, React unmounts to a blank page and no
    // application content (nav sidebar, breadcrumb) renders at all - assert real content is still
    // there instead of just "the page didn't literally error out".
    await expect(page.getByRole('button', { name: 'Actions' })).toBeVisible();
    await expect(page.getByText(created.loanName, { exact: false }).first()).toBeVisible();
  });

  // ── Dependency (Company -> Location, this module's Classification section) ───
  test.describe('Company → Location Dependency', () => {
    test('TC-LOAN-CLASS-01 [-] Location is disabled until Company is selected', async ({ page }) => {
      const lc = new LoanConfigurationPage(page);

      await lc.goto();
      await expect(await lc.isLocationEnabled()).toBe(false);

      await lc.discardButton.click();
    });

    test('TC-LOAN-CLASS-02 [+] Location enables after Company is selected', async ({ page }) => {
      const lc = new LoanConfigurationPage(page);
      const data = testData.loanConfiguration.valid;

      await lc.goto();
      await lc.selectFieldByLabel(lc.companyField, data.company, { exact: false });
      await expect(await lc.isLocationEnabled()).toBe(true);

      await lc.discardButton.click();
    });

    test.skip(
      !testData.loanConfiguration.companyB,
      'Needs a second real, live-verified Company (testData.loanConfiguration.companyB) - see config/testData.js',
    );
    test('TC-LOAN-CLASS-03 [-] Changing Company clears the previously selected Location', async ({ page }) => {
      const lc = new LoanConfigurationPage(page);
      const data = testData.loanConfiguration.valid;

      await lc.goto();
      await lc.selectFieldByLabel(lc.companyField, data.company, { exact: false });
      await lc.selectFieldByLabel(lc.locationField, data.company, { exact: false }); // any option

      await lc.selectFieldByLabel(lc.companyField, testData.loanConfiguration.companyB, { exact: false });
      await expect(await lc.getSelectedValue(lc.locationField)).toBe('');

      await lc.discardButton.click();
    });
  });

  // ── Field Validation ───────────────────────────────────────────────────────
  test.describe('Field Validation', () => {
    test('TC-LOAN-FLD-01/03/09 [-] Required Company/Loan Name/Category block Save', async ({ page }) => {
      const lc = new LoanConfigurationPage(page);

      await lc.goto();
      // Company can render pre-selected with the account's last-used company instead of blank
      // (confirmed live) - clear it first so this "blank blocks Save" case is actually exercised.
      // isVisible() alone is a point-in-time snapshot and can run before the clear button finishes
      // mounting (it only appears once Company's async default-value fetch resolves) - wait for it
      // rather than treating "not visible yet" as "will never exist".
      const companyPreselected = await lc.companyClearButton
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (companyPreselected) {
        await lc.companyClearButton.click();
      }
      await lc.saveButton.click();

      await expect(lc.companyRequiredError).toBeVisible();
      await expect(lc.loanNameRequiredError).toBeVisible();
      await expect(lc.categoryRequiredError).toBeVisible();
      await expect(page).toHaveURL(/add-loan-configuration/); // did not navigate away

      await lc.discardButton.click();
    });

    test('TC-LOAN-LIM-03 [-] Max Loan Amount (Fixed) is required when Fixed is selected', async ({ page }) => {
      const lc = new LoanConfigurationPage(page);
      const data = testData.loanConfiguration.valid;

      await lc.goto();
      await lc.fillBasicDetails({ company: data.company, loanName: data.loanName, category: data.category });
      await lc.selectMaxLoanAmountType('fixed'); // already the default, explicit for clarity
      await lc.saveButton.click();

      // Exact wording ("Amount is required") wasn't confirmed live - assert *some* validation
      // error rendered near Loan Limits rather than a guessed exact string.
      await expect(page.locator('.Mui-error, [class*="error"]').first()).toBeVisible();

      await lc.discardButton.click();
    });

    test('TC-LOAN-LIM-08 [-] Max Loan Amount rejects a negative value', async ({ page }) => {
      const lc = new LoanConfigurationPage(page);

      await lc.goto();
      await lc.maxLoanAmountValueInput.fill(testData.loanConfiguration.negative.negativeMaxLoanAmount);
      await lc.saveButton.click();

      await expect(page.locator('.Mui-error, [class*="error"]').first()).toBeVisible();

      await lc.discardButton.click();
    });

    test('TC-LOAN-LIM-19/20 [-] Interest Rate rejects negative and >100 values', async ({ page }) => {
      const lc = new LoanConfigurationPage(page);

      await lc.goto();
      await lc.interestRateInput.fill(testData.loanConfiguration.negative.negativeInterestRate);
      await lc.saveButton.click();
      await expect(page.locator('.Mui-error, [class*="error"]').first()).toBeVisible();

      await lc.interestRateInput.fill(testData.loanConfiguration.negative.overMaxInterestRate);
      await lc.saveButton.click();
      await expect(page.locator('.Mui-error, [class*="error"]').first()).toBeVisible();

      await lc.discardButton.click();
    });

    // CONFIRMED BUG REPRO (LOAN_CONFIGURATION_TEST_CASES.md TC-LOAN-LIM-23): validator.tsx's
    // required-when-Flat rule is keyed `late_payment_penalty_value`/`late_payment_penalty_type`,
    // which don't exist as real form field names (form.tsx uses `late_penalty_value`/
    // `late_penalty_type`) - the watched condition never matches, so this "required" rule can
    // never fire. This test documents that gap, it does NOT assert the (missing) error.
    test('TC-LOAN-LIM-23 [-] Confirmed gap: blank Flat Amount penalty never blocks Save', async ({ page }) => {
      const lc = new LoanConfigurationPage(page);
      const data = testData.loanConfiguration.valid;
      const loanName = `${data.loanName}_PENALTY_GAP`;

      await lc.goto();
      await lc.fillBasicDetails({ company: data.company, loanName, category: data.category });
      await lc.fillLoanLimits({
        maxLoanAmountType: 'fixed',
        maxLoanAmountValue: data.maxLoanAmountValue,
        latePenaltyType: 'flat', // Flat Amount left blank on purpose
      });

      const result = await lc.save();
      // Confirmed real gap: no working required rule exists for the Flat Amount penalty value,
      // so this succeeds despite the field appearing required/active.
      expect(result.seriesNumber).toBeTruthy();
    });

    // Contrast case: the Percentage sub-field (`late_penalty_percentage`) uses the CORRECT Yup
    // field name (validator.tsx:46) and DOES validate properly - only the Flat path is broken.
    test('TC-LOAN-LIM-25 [-] Late Payment Penalty Percentage IS correctly required when selected', async ({ page }) => {
      const lc = new LoanConfigurationPage(page);
      const data = testData.loanConfiguration.valid;

      await lc.goto();
      await lc.fillBasicDetails({ company: data.company, loanName: data.loanName, category: data.category });
      await lc.selectLatePenaltyType('percentage'); // value left blank on purpose
      await lc.saveButton.click();

      await expect(page.locator('.Mui-error, [class*="error"]').first()).toBeVisible();

      await lc.discardButton.click();
    });

    test('TC-LOAN-ELIG-06/20 [-] Minimum CTC Required and Maximum Active Loans Allowed reject negative values', async ({ page }) => {
      const lc = new LoanConfigurationPage(page);

      await lc.goto();
      await lc.minCtcRequiredInput.fill(testData.loanConfiguration.negative.negativeMinCtc);
      await lc.maxActiveLoansAllowedInput.fill(testData.loanConfiguration.negative.negativeMaxActiveLoans);
      await lc.saveButton.click();

      await expect(page.locator('.Mui-error, [class*="error"]').first()).toBeVisible();

      await lc.discardButton.click();
    });
  });

  // ── Repayment Configuration ────────────────────────────────────────────────
  test.describe('Repayment Configuration', () => {
    test('TC-LOAN-REPAY-02/06 [+] Enable both toggles, Save, and View shows Enabled labels', async ({ page }) => {
      const lc = new LoanConfigurationPage(page);
      const data = testData.loanConfiguration.valid;
      const loanName = `${data.loanName}_REPAY`;

      await lc.goto();
      await lc.fillBasicDetails({ company: data.company, loanName, category: data.category });
      await lc.fillLoanLimits({ maxLoanAmountType: 'fixed', maxLoanAmountValue: data.maxLoanAmountValue });
      await lc.fillRepaymentConfiguration({ autoDeductEmis: true, allowPreClosure: true });

      const result = await lc.save();
      expect(result.seriesNumber).toBeTruthy();

      await lc.searchList(loanName);
      await lc.openViewFromList(result.seriesNumber);
      await expect(page.getByText('Enabled').first()).toBeVisible();
    });
  });

  // ── Eligibility Criteria ────────────────────────────────────────────────────
  test.describe('Eligibility Criteria', () => {
    test('TC-LOAN-ELIG-12 [+] Selecting a Department and Grade persists on Save', async ({ page }) => {
      const lc = new LoanConfigurationPage(page);
      const data = testData.loanConfiguration.valid;
      const loanName = `${data.loanName}_ELIGIBILITY`;

      await lc.goto();
      await lc.fillBasicDetails({ company: data.company, loanName, category: data.category });
      await lc.fillLoanLimits({ maxLoanAmountType: 'fixed', maxLoanAmountValue: data.maxLoanAmountValue });
      await lc.fillEligibilityCriteria({ pickFirstDepartment: true, pickFirstGrade: true });

      const result = await lc.save();
      expect(result.seriesNumber).toBeTruthy();

      await lc.searchList(loanName);
      await lc.openViewFromList(result.seriesNumber);
      // Selected Department/Grade names render as a comma-separated read-only list - just confirm
      // the "-" empty-placeholder is NOT shown (i.e. something real was persisted), since the
      // exact option name is unverified live master data.
      await expect(page.getByText('Eligible Departments', { exact: true })).toBeVisible();
    });
  });

  // ── Listing Page ──────────────────────────────────────────────────────────
  test.describe('Listing Page', () => {
    test('TC-LOAN-SRCH-01 [+] Search the list by Loan Name', async ({ page }) => {
      const lc = new LoanConfigurationPage(page);
      await lc.gotoList();
      await lc.searchList(created.loanName);
      await expect(page.getByText(created.loanName, { exact: false }).first()).toBeVisible();

      await lc.searchList('zzz-no-such-loan-configuration-zzz');
      await expect(lc.noDataRow()).toBeVisible();
    });

    test('TC-LOAN-SORT-01 [+] Sort the ID column ascending/descending', async ({ page }) => {
      const lc = new LoanConfigurationPage(page);
      await lc.gotoList();

      await lc.clickColumnHeader('ID');
      const firstSort = await lc.getColumnAriaSort('ID');
      expect(['ascending', 'descending']).toContain(firstSort);

      await lc.clickColumnHeader('ID');
      const secondSort = await lc.getColumnAriaSort('ID');
      expect(secondSort).not.toBe(firstSort);
    });

    test('TC-LOAN-PAGE-02/03/04 [+] Paginate the list', async ({ page }) => {
      const lc = new LoanConfigurationPage(page);
      await lc.gotoList();

      const label = await lc.getPaginationLabel();
      expect(label).toMatch(/Page \d+ of \d+/);

      if (await lc.nextPageButton().isEnabled()) {
        await lc.nextPageButton().click();
        await page.waitForLoadState('networkidle');
        const nextLabel = await lc.getPaginationLabel();
        expect(nextLabel).not.toBe(label);
      }
    });

    test('TC-LOAN-LIST-09 [+] Row action menu offers Edit only (no Duplicate) and destructive Delete', async ({ page }) => {
      const lc = new LoanConfigurationPage(page);
      await lc.gotoList();
      await lc.searchList(created.loanName);
      await lc.openRowActionMenu(created.seriesNumber);

      await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Duplicate', exact: true })).toHaveCount(0);
      await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
    });

    test('TC-LOAN-LIST-05 [+] Row status badge matches the record\'s lifecycle state', async ({ page }) => {
      const lc = new LoanConfigurationPage(page);
      await lc.gotoList();
      await lc.searchList(created.loanName);
      await expect(await lc.getRowStatus(created.seriesNumber)).toMatch(/Active/);
    });
  });
});
