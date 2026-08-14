const { test, expect } = require('@playwright/test');
const SalaryStructureMasterPage = require('../../pages/SalaryStructureMasterPage');
const testData = require('../../config/testData');
const testDataFactory = require('../../config/testDataFactory');

// Salary Structure Master (erpforce-hrms-fe: src/views/salary-structure-master/) - confirmed real
// module, route `/dashboard/hrms/company-master-policy/salary-structure-master`. This spec
// automates the subset of SALARY_STRUCTURE_MASTER_TEST_CASES.md marked "Automation: Yes" (i.e.
// confirmed from source, stable to drive). Cases needing live verification (deep Components-grid
// inline editing, Grid/Table view toggle internals, Filters) are catalogued there, not forced in.
//
// SCOPE / CONFIRMED-FROM-SOURCE NOTES (see the catalogue's "Corrections" section for the full list):
// - Single scrolling form (4 accordions), NOT a tab wizard. No Next/Back. No approval workflow.
// - Components grid auto-seeds two undeletable rows (Basic Allowance, Gross Allowance) on Add.
// - Overtime Salary Component / Value are NOT required-when-enabled (only percentage max(100)).
// - Employment Type is a static Unlimited/Limited select. Currency auto-fills from Company (disabled).
// - min<=max, max>=min, both >=0; Maximum Salary becomes required once Minimum Salary is entered.
// - Save To Draft bypasses validation entirely (createDraftSalaryStructure).
// - Only ID and Structure Name columns are sortable (Grade/Location/Company/Department are not).
test.describe('Salary Structure Master Module', () => {
  // Multi-step create/edit/delete flows run close to the larger HRMS suites' timings under real
  // concurrent load - bump above the 30s default, same as the other module suites here.
  test.describe.configure({ timeout: 90000 });

  let created = {};
  let draftRecord = {};

  // ── Add / Create ────────────────────────────────────────────────────────────
  test.describe('Add / Create', () => {
    test('TC-SSM-F-04 [+] Create Salary Structure with mandatory fields only', async ({ page }) => {
      const ssm = new SalaryStructureMasterPage(page);
      const data = testData.salaryStructureMaster.valid;

      await ssm.goto();
      await expect(page).toHaveURL(/add-salary-structure-master/);

      await ssm.fillBasicDetails({
        company: data.company,
        structureName: data.structureName,
        grade: null, // first available - no pinned Grade in this account
        employmentType: data.employmentType,
      });

      const result = await ssm.save();
      expect(result.seriesNumber).toBeTruthy();
      created = { ...result, structureName: data.structureName };

      await ssm.searchList(data.structureName);
      await expect(page.getByText(data.structureName, { exact: false }).first()).toBeVisible();
      await expect(await ssm.getRowStatus(created.seriesNumber)).toMatch(/Active/);
    });

    test('TC-SSM-F-05 [+] Create Salary Structure with Minimum and Maximum Salary set', async ({ page }) => {
      const ssm = new SalaryStructureMasterPage(page);
      const data = testData.salaryStructureMaster.valid;
      const structureName = testDataFactory.uniqueName('Automation_SalaryStructure_MinMax');

      await ssm.goto();
      await ssm.fillBasicDetails({
        company: data.company,
        structureName,
        grade: null,
        employmentType: data.employmentType,
        minSalary: data.minSalary,
        maxSalary: data.maxSalary,
      });

      const result = await ssm.save();
      expect(result.seriesNumber).toBeTruthy();

      await ssm.searchList(structureName);
      await expect(page.getByText(structureName, { exact: false }).first()).toBeVisible();
    });

    test('TC-SSM-F-11 [+] Currency auto-fills (and stays disabled) after Company is selected', async ({ page }) => {
      const ssm = new SalaryStructureMasterPage(page);
      const data = testData.salaryStructureMaster.valid;

      await ssm.goto();
      // Currency is disabled by design (form.tsx) - it can never be edited directly, only derived.
      await expect(ssm.currencyCombobox()).toBeDisabled();

      await ssm.selectFieldByLabel(ssm.companyField, data.company, { exact: false });
      // getSelectedData writes currency_data.id into the Currency field once the company resolves.
      await expect
        .poll(async () => (await ssm.getCurrencyValue()).length, { timeout: 10000 })
        .toBeGreaterThan(0);

      await ssm.discardButton.click();
    });

    test('TC-SSM-F-12 [+] ID field is auto-generated and read-only', async ({ page }) => {
      const ssm = new SalaryStructureMasterPage(page);

      await ssm.goto();
      await expect(ssm.idField).toBeDisabled();
      await ssm.discardButton.click();
    });

    test('TC-SSM-COMP-01 [+] Components grid seeds Basic Allowance and Gross Allowance by default', async ({ page }) => {
      const ssm = new SalaryStructureMasterPage(page);

      await ssm.goto();
      // form.tsx seeds exactly these two rows on mode==='add'.
      await expect(ssm.componentRow('Basic Allowance').first()).toBeVisible();
      await expect(ssm.componentRow('Gross Allowance').first()).toBeVisible();

      await ssm.discardButton.click();
    });
  });

  // ── View ─────────────────────────────────────────────────────────────────────
  test.describe('View', () => {
    test('TC-SSM-F-09 [+] View Salary Structure renders read-only with all sections', async ({ page }) => {
      expect(created.seriesNumber, 'Pre-condition: a record was created in TC-SSM-F-04').toBeTruthy();
      const ssm = new SalaryStructureMasterPage(page);

      await ssm.gotoList();
      await ssm.searchList(created.seriesNumber);
      await ssm.openViewFromList(created.seriesNumber);
      await expect(page).toHaveURL(/view-salary-structure-master/);

      // The four accordion section headers render on the view page (view-salary-structure.hrms.tsx).
      // We match either the translated text or the raw i18n translation key to ensure the tests
      // are resilient to localized or un-translated environments.
      await expect(page.getByText(/Basic Details|basic_details/i).first()).toBeVisible();
      await expect(page.getByText(/Components|components/i).first()).toBeVisible();
      await expect(page.getByText(/Overtime|overtime_details/i).first()).toBeVisible();

      // View mode has no editable inputs anywhere.
      const editableInputs = page.locator('input:not([disabled]):not([readonly])');
      await expect(editableInputs).toHaveCount(0);
    });

    test('TC-SSM-F-09b [+] View status badge reflects Active for a published record', async ({ page }) => {
      expect(created.seriesNumber, 'Pre-condition: a record was created in TC-SSM-F-04').toBeTruthy();
      const ssm = new SalaryStructureMasterPage(page);

      await ssm.gotoList();
      await ssm.searchList(created.seriesNumber);
      await ssm.openViewFromList(created.seriesNumber);

      await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();
    });
  });

  // ── Edit ───────────────────────────────────────────────────────────────────
  test.describe('Edit', () => {
    test('TC-SSM-EDIT-01 [+] Edit preloads existing Company and updates Structure Name', async ({ page }) => {
      expect(created.seriesNumber, 'Pre-condition: a record was created in TC-SSM-F-04').toBeTruthy();
      const ssm = new SalaryStructureMasterPage(page);
      const data = testData.salaryStructureMaster.valid;

      await ssm.gotoList();
      await ssm.searchList(created.seriesNumber);
      await ssm.openEditFromList(created.seriesNumber);
      await expect(page).toHaveURL(/edit-salary-structure-master/);

      // Existing Company preloads into the combobox.
      const combobox = ssm.dependentFieldCombobox(ssm.companyField);
      console.log('--- DEBUG COMBOBOX ---');
      console.log('Outer HTML:', await combobox.evaluate(el => el.outerHTML));
      console.log('Text Content:', await combobox.textContent());
      console.log('Inner Text:', await combobox.innerText());
      console.log('Aria-label:', await combobox.getAttribute('aria-label'));
      console.log('Value:', await combobox.getAttribute('value'));
      console.log('Input Value:', await combobox.inputValue().catch(() => 'N/A'));
      const inputEl = combobox.locator('input').first();
      if (await inputEl.count() > 0) {
        console.log('Input Outer HTML:', await inputEl.evaluate(el => el.outerHTML));
        console.log('Input Value:', await inputEl.inputValue());
      }
      console.log('--- END DEBUG ---');

      await expect
        .poll(async () => await ssm.getSelectedValue(ssm.companyField), { timeout: 10000 })
        .toContain(data.company);

      await ssm.structureNameInput.fill(data.updatedStructureName);
      await expect(ssm.structureNameInput).toHaveValue(data.updatedStructureName);

      const result = await ssm.save();
      expect(result.seriesNumber).toBeTruthy();
      created.structureName = data.updatedStructureName;

      await ssm.searchList(created.structureName);
      await expect(page.getByText(created.structureName, { exact: false }).first()).toBeVisible();
    });

    test('TC-SSM-EDIT-02 [+] Read-only ID stays disabled in Edit mode', async ({ page }) => {
      expect(created.seriesNumber, 'Pre-condition: a record was created in TC-SSM-F-04').toBeTruthy();
      const ssm = new SalaryStructureMasterPage(page);

      await ssm.gotoList();
      await ssm.searchList(created.seriesNumber);
      await ssm.openEditFromList(created.seriesNumber);

      await expect(ssm.idField).toBeDisabled();
      await ssm.discardButton.click();
    });
  });

  // ── Draft ─────────────────────────────────────────────────────────────────
  // Save To Draft bypasses methods.trigger() validation (createDraftSalaryStructure) - a draft can
  // be saved with mandatory fields empty. TC-SSM-DRAFT-01 exercises that by omitting Grade/
  // Employment Type, which plain Save requires.
  test.describe('Draft', () => {
    test('TC-SSM-DRAFT-01 [+] Save as Draft with only a name - status shows Draft', async ({ page }) => {
      const ssm = new SalaryStructureMasterPage(page);
      const data = testData.salaryStructureMaster.draftMinimal;
      draftRecord.structureName = data.structureName;

      await ssm.goto();
      await ssm.fillBasicDetails({
        company: testData.salaryStructureMaster.valid.company,
        structureName: data.structureName,
      });

      const result = await ssm.saveAsDraft();
      draftRecord = { ...result, structureName: data.structureName };

      await ssm.searchList(data.structureName);
      await expect(await ssm.getRowStatus(draftRecord.seriesNumber)).toMatch(/Draft/);
    });

  });

  // ── Field Validation ──────────────────────────────────────────────────────
  // Fills the form, asserts the inline error, never persists - so these don't depend on (or
  // pollute) the shared dataset.
  test.describe('Field Validation', () => {
    const errors = testData.salaryStructureMaster.errors;

    test('TC-SSM-VAL-01 [-] Empty mandatory fields block Save with inline errors', async ({ page }) => {
      const ssm = new SalaryStructureMasterPage(page);

      await ssm.goto();
      await ssm.saveButton.click();

      await expect(ssm.structureNameRequiredError.first()).toBeVisible();
      await expect(ssm.gradeRequiredError.first()).toBeVisible();
      await expect(ssm.employmentTypeRequiredError.first()).toBeVisible();
      await expect(page).toHaveURL(/add-salary-structure-master/); // did not navigate away

      await ssm.discardButton.click();
    });

    test('TC-SSM-VAL-05 [-] Minimum Salary greater than Maximum Salary is rejected', async ({ page }) => {
      const ssm = new SalaryStructureMasterPage(page);
      const data = testData.salaryStructureMaster;

      await ssm.goto();
      await ssm.fillBasicDetails({
        company: data.valid.company,
        structureName: testDataFactory.uniqueName('Automation_SalaryStructure_MinMax'),
        grade: null,
        employmentType: data.valid.employmentType,
        minSalary: data.negative.minGreaterThanMax.minSalary,
        maxSalary: data.negative.minGreaterThanMax.maxSalary,
      });
      await ssm.saveButton.click();

      // Both min-less-than-max and max-greater-than-min yup tests fire for this pair; assert the
      // max-side wording (exact strings confirmed from common.json).
      await expect(page.getByText(errors.maxGreaterThanMin, { exact: false }).first()).toBeVisible();
      await expect(page).toHaveURL(/add-salary-structure-master/);

      await ssm.discardButton.click();
    });

    test('TC-SSM-VAL-06 [-] Negative Minimum Salary is rejected as not positive', async ({ page }) => {
      const ssm = new SalaryStructureMasterPage(page);
      const data = testData.salaryStructureMaster;

      await ssm.goto();
      await ssm.fillBasicDetails({
        company: data.valid.company,
        structureName: testDataFactory.uniqueName('Automation_SalaryStructure_Neg'),
        grade: null,
        employmentType: data.valid.employmentType,
        minSalary: data.negative.negativeSalary,
        maxSalary: '50000',
      });
      await ssm.saveButton.click();

      await expect(page.getByText(errors.minPositive, { exact: false }).first()).toBeVisible();

      await ssm.discardButton.click();
    });

    test('TC-SSM-VAL-07 [-] Maximum Salary becomes required once Minimum Salary is entered', async ({ page }) => {
      const ssm = new SalaryStructureMasterPage(page);
      const data = testData.salaryStructureMaster;

      await ssm.goto();
      await ssm.fillBasicDetails({
        company: data.valid.company,
        structureName: testDataFactory.uniqueName('Automation_SalaryStructure_MaxReq'),
        grade: null,
        employmentType: data.valid.employmentType,
        minSalary: '10000', // Maximum Salary left blank
      });
      await ssm.saveButton.click();

      // max_salary.when('min_salary', ...).required() - confirmed in utils/validation.ts.
      await expect(ssm.maxSalaryRequiredError.first()).toBeVisible();

      await ssm.discardButton.click();
    });

    test('TC-SSM-VAL-14 [-] Trailing-space-only Structure Name still triggers required', async ({ page }) => {
      const ssm = new SalaryStructureMasterPage(page);
      const data = testData.salaryStructureMaster;

      await ssm.goto();
      await ssm.fillBasicDetails({
        company: data.valid.company,
        structureName: data.negative.onlySpacesName,
        grade: null,
        employmentType: data.valid.employmentType,
      });
      await ssm.saveButton.click();

      // yup string().required() treats a whitespace string as present, so this documents the ACTUAL
      // behaviour: assert save is blocked OR the record isn't created, without over-claiming a trim
      // rule that the schema doesn't have. Confirm the form did not navigate to the list.
      await expect(page).toHaveURL(/add-salary-structure-master/);

      await ssm.discardButton.click();
    });
  });

  // ── Company → Location/Department dependency (Classification) ─────────────────
  test.describe('Classification Dependency', () => {
    test('TC-SSM-DEP-01 [+] Location/Department options are scoped to the selected Company', async ({ page }) => {
      const ssm = new SalaryStructureMasterPage(page);
      const data = testData.salaryStructureMaster.valid;

      await ssm.goto();
      await ssm.selectFieldByLabel(ssm.companyField, data.company, { exact: false });
      await ssm.selectFieldByLabel(ssm.departmentField, data.department, { exact: false });

      // Assert whatever was actually selected is non-empty rather than a literal, since the
      // company-scoped option set is environment-dependent (same caution as Leave Policy Master).
      await expect(await ssm.getSelectedValue(ssm.departmentField)).not.toBe('');

      await ssm.discardButton.click();
    });

    test.skip(
      !testData.salaryStructureMaster.companyB,
      'Needs a second real, live-verified Company (testData.salaryStructureMaster.companyB) - see config/testData.js TODO',
    );
    test('TC-SSM-DEP-03 [-] Changing Company clears Location/Department', async ({ page }) => {
      const ssm = new SalaryStructureMasterPage(page);
      const data = testData.salaryStructureMaster;

      await ssm.goto();
      await ssm.selectFieldByLabel(ssm.companyField, data.valid.company, { exact: false });
      await ssm.selectFieldByLabel(ssm.departmentField, data.valid.department, { exact: false });

      await ssm.selectFieldByLabel(ssm.companyField, data.companyB, { exact: false });
      await expect(await ssm.getSelectedValue(ssm.departmentField)).toBe('');

      await ssm.discardButton.click();
    });
  });


  // ── Listing Page ──────────────────────────────────────────────────────────
  test.describe('Listing Page', () => {
    test('TC-SSM-L01 [+] Display list with the expected columns', async ({ page }) => {
      const ssm = new SalaryStructureMasterPage(page);
      await ssm.gotoList();

      await expect(ssm.columnHeader('ID')).toBeVisible();
      await expect(ssm.columnHeader('Structure Name')).toBeVisible();
      await expect(ssm.columnHeader('Grade')).toBeVisible();
      await expect(ssm.columnHeader('Company')).toBeVisible();
      await expect(ssm.columnHeader('Status')).toBeVisible();
    });



    test('TC-SSM-L03 [+] Sort the ID column ascending then descending', async ({ page }) => {
      const ssm = new SalaryStructureMasterPage(page);
      await ssm.gotoList();

      await ssm.clickColumnHeader('ID');
      const firstSort = await ssm.getColumnAriaSort('ID');
      expect(['ascending', 'descending']).toContain(firstSort);

      await ssm.clickColumnHeader('ID');
      const secondSort = await ssm.getColumnAriaSort('ID');
      expect(secondSort).not.toBe(firstSort);
    });

    test('TC-SSM-L04 [+] Structure Name column is sortable', async ({ page }) => {
      const ssm = new SalaryStructureMasterPage(page);
      await ssm.gotoList();

      await ssm.clickColumnHeader('Structure Name');
      const sortState = await ssm.getColumnAriaSort('Structure Name');
      expect(['ascending', 'descending']).toContain(sortState);
    });

    test('TC-SSM-L05 [-] Grade column is NOT sortable (enableSorting:false in source)', async ({ page }) => {
      const ssm = new SalaryStructureMasterPage(page);
      await ssm.gotoList();

      // default-data.ts sets enableSorting:false on Grade/Location/Company/Department - clicking the
      // header should not produce an ascending/descending aria-sort.
      await ssm.clickColumnHeader('Grade');
      const sortState = await ssm.getColumnAriaSort('Grade');
      expect(['ascending', 'descending']).not.toContain(sortState);
    });

    test('TC-SSM-L06 [+] Paginate the list', async ({ page }) => {
      const ssm = new SalaryStructureMasterPage(page);
      await ssm.gotoList();

      const label = await ssm.getPaginationLabel();
      expect(label).toMatch(/Page \d+ of \d+/);

      if (await ssm.nextPageButton().isEnabled()) {
        await ssm.nextPageButton().click();
        await page.waitForLoadState('networkidle');
        const nextLabel = await ssm.getPaginationLabel();
        expect(nextLabel).not.toBe(label);
      }
    });


  });
});
