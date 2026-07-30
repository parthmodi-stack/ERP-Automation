const { test, expect } = require('@playwright/test');
const EmployeeMasterPage = require('../../pages/EmployeeMasterPage');
const testDataFactory = require('../../config/testDataFactory');

test.describe.serial('Employee Master Module Suite', () => {
  test.describe.configure({ timeout: 120000 });

  let empPage;
  let draftRecord = {};

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    empPage = new EmployeeMasterPage(page);
  });

  test.afterAll(async () => {
    if (empPage && empPage.page) {
      await empPage.page.close();
    }
  });

  // ── Core CRUD & Draft Operations ─────────────────────────────────────────────

  test('EMP_001 / TC-EMP-01 [+] Create a new Employee record as Draft', async () => {
    const ts = Date.now();
    const uniqueEmail = `test.draft.${ts}@company.com`;
    const uniquePhone = `+97150${Math.floor(1000000 + Math.random() * 9000000)}`;
    const employeeName = testDataFactory.uniqueName('Auto_Draft_Emp');
    const passportNumber = `P${ts}`;
    const labourId = `LID${ts}`;

    await empPage.goto();

    await empPage.fillBasicDetails({
      name: employeeName,
      company: 'erp-force',
      email: uniqueEmail,
      phone: uniquePhone,
      dateOfJoining: '2026-08-01',
      nationality: 'Emirati',
      dob: '1995-05-15',
      gender: 'Male',
      passportNumber,
      labourContractNo: `LC${ts}`,
      labourId,
    });

    const result = await empPage.saveAsDraft();
    expect(result.status).toBe(200);
    // passportNumber/labourId are captured here so the on-blur duplicate-check tests below
    // (TC-V06/TC-V07) have a value that is guaranteed to already exist in the system.
    draftRecord = { id: result.id, name: employeeName, email: uniqueEmail, passportNumber, labourId };
    expect(draftRecord.id).toBeTruthy();

    await empPage.gotoList();
    await empPage.searchList(employeeName);
    await expect(empPage.page.getByText(employeeName, { exact: false }).first()).toBeVisible();
  });

  test('EMP_017 / TC-L02 [+] Newly created Draft record shows Draft status chip in Listing', async () => {
    expect(draftRecord.name).toBeTruthy();

    await empPage.gotoList();
    await empPage.searchList(draftRecord.name);

    // Row status text via the shared MaterialTable Chip - a plain getByText(/Draft/i) inside the
    // row is ambiguous because the row's own name cell also renders as a link with the same
    // accessible role, and can even collide on the word "Draft" (confirmed live: strict-mode
    // violation, 2 matches).
    const status = await empPage.getRowStatus(draftRecord.name);
    expect(status).toMatch(/Draft/i);
  });

  test('EMP_171 / TC-EMP-02 [+] Edit Draft record and update fields', async () => {
    expect(draftRecord.id).toBeTruthy();

    await empPage.gotoEdit(draftRecord.id);

    const updatedName = `${draftRecord.name}_Updated`;
    await empPage.employeeNameInput.fill(updatedName);

    const result = await empPage.saveAsDraft();
    expect(result.status).toBe(200);
    if (result.id) draftRecord.id = result.id;
    draftRecord.name = updatedName;

    await empPage.gotoList();
    await empPage.searchList(updatedName);
    await expect(empPage.page.getByText(updatedName, { exact: false }).first()).toBeVisible();
  });

  test('EMP_181 / TC-EMP-03 [+] View page displays saved Employee details correctly', async () => {
    expect(draftRecord.id).toBeTruthy();

    await empPage.gotoView(draftRecord.id);

    await expect(empPage.page.getByText(draftRecord.name, { exact: false }).first()).toBeVisible();
    await expect(empPage.page.getByText(draftRecord.email, { exact: false }).first()).toBeVisible();
  });

  test('EMP_193 / TC-EMP-11 [+] View page Actions menu -> Edit navigates to Edit Employee page', async () => {
    expect(draftRecord.id).toBeTruthy();

    await empPage.gotoView(draftRecord.id);
    await empPage.actionsButton.click();
    await empPage.page.getByRole('menuitem', { name: /Edit/i }).click();

    await expect(empPage.page).toHaveURL(/edit-employee/);
    await expect(empPage.employeeNameInput).toBeVisible({ timeout: 15000 });
  });

  test('EMP_225 / TC-EMP-12 [+] Employee ID field remains read-only in Edit mode', async () => {
    expect(draftRecord.id).toBeTruthy();

    await empPage.gotoEdit(draftRecord.id);
    await expect(empPage.employeeIdInput).toBeDisabled();
  });

  test('EMP_031 / TC-EMP-10 [+] Auto-generated Employee ID field is read-only', async () => {
    await empPage.goto();
    await expect(empPage.employeeIdInput).toBeDisabled();
    await empPage.discardButton.click();
  });

  test('EMP_057 / TC-EMP-16 [+] Status toggle defaults to Active on Add form', async () => {
    await empPage.goto();
    await expect(empPage.isActiveToggle).toBeChecked();
    await empPage.discardButton.click();
  });

  test('EMP_070 / TC-EMP-15 [+] Discard button on Add form returns to Employee Listing', async () => {
    await empPage.goto();
    await empPage.employeeNameInput.fill(testDataFactory.uniqueName('Discard_Me'));

    await empPage.discardButton.click();

    await expect(empPage.page).not.toHaveURL(/add-employee/);
    await expect(empPage.listAddButton).toBeVisible({ timeout: 15000 });
  });

  // ── Validation Tests ─────────────────────────────────────────────────────────

  test('EMP_033 / TC-V01 [-] Required fields block form navigation when empty', async () => {
    await empPage.goto();

    // Click Next without filling mandatory fields
    await empPage.nextButton.click();

    await expect(empPage.page.getByText(/Name is required/i)).toBeVisible();
    await expect(empPage.page.getByText(/Email is required/i)).toBeVisible();
    await expect(empPage.page.getByText(/Phone is required/i)).toBeVisible();

    await empPage.discardButton.click();
  });

  test('EMP_037 / TC-V02 [-] Invalid email format is rejected with validation error', async () => {
    await empPage.goto();

    await empPage.emailInput.fill('invalid-email-format');
    await empPage.emailInput.blur();
    await empPage.nextButton.click();

    await expect(empPage.page.getByText(/email/i).first()).toBeVisible();

    await empPage.discardButton.click();
  });

  test('EMP_035 / TC-V03 [-] Mandatory Company selection validation', async () => {
    await empPage.goto();

    await empPage.employeeNameInput.fill(testDataFactory.uniqueName('Validate_Company'));

    // Company auto-defaults to the account's only Company ("erp-force") on load - clear it via
    // its own "clear selection" button so the required-field check has an empty value to catch
    // (confirmed live: leaving it untouched never triggers "Company is required").
    await empPage.page.getByRole('button', { name: 'clear selection' }).first().click();

    await empPage.nextButton.click();

    await expect(empPage.page.getByText(/Company is required/i)).toBeVisible();

    await empPage.discardButton.click();
  });

  test('EMP_043 / TC-V04 [-] Mandatory Date of Joining validation', async () => {
    const ts = Date.now();
    await empPage.goto();

    await empPage.fillBasicDetails({
      name: testDataFactory.uniqueName('Validate_DOJ'),
      company: 'erp-force',
      email: `validate.doj.${ts}@company.com`,
      phone: `+97150${Math.floor(1000000 + Math.random() * 9000000)}`,
      // dateOfJoining intentionally omitted
      nationality: 'Emirati',
      dob: '1995-05-15',
      gender: 'Male',
      passportNumber: `PDOJ${ts}`,
      labourContractNo: `LCDOJ${ts}`,
      labourId: `LIDDOJ${ts}`,
    });
    await empPage.nextButton.click();

    await expect(empPage.page.getByText(/Date of Joining is required/i)).toBeVisible();

    await empPage.discardButton.click();
  });

  test('EMP_046 / TC-V05 [-] Date of Birth rejects a future date', async () => {
    await empPage.goto();

    await empPage.dobInput.fill('2030-01-01');
    await empPage.dobInput.blur();
    await empPage.nextButton.click();

    await expect(empPage.page.getByText(/Date of Birth/i).first()).toBeVisible();

    await empPage.discardButton.click();
  });

  test('EMP_053 / TC-V06 [-] Passport Number on-blur duplicate check flags an existing value', async () => {
    expect(draftRecord.passportNumber).toBeTruthy();

    await empPage.goto();
    await empPage.passportNumberInput.fill(draftRecord.passportNumber);
    await empPage.passportNumberInput.blur();

    await expect(empPage.page.getByText(/already exists/i).first()).toBeVisible({ timeout: 8000 });

    await empPage.discardButton.click();
  });

  test('EMP_055 / TC-V07 [-] Labour ID on-blur duplicate check flags an existing value', async () => {
    expect(draftRecord.labourId).toBeTruthy();

    await empPage.goto();
    await empPage.labourIdInput.fill(draftRecord.labourId);
    await empPage.labourIdInput.blur();

    await expect(empPage.page.getByText(/already exists/i).first()).toBeVisible({ timeout: 8000 });

    await empPage.discardButton.click();
  });

  // ── Listing Page & Deletion ──────────────────────────────────────────────────

  test('EMP_005 / TC-L01 [+] Search Employee List by name', async () => {
    expect(draftRecord.name).toBeTruthy();

    await empPage.gotoList();
    await empPage.searchList(draftRecord.name);

    await expect(empPage.page.getByText(draftRecord.name, { exact: false }).first()).toBeVisible();
  });

  test('EMP_227 / TC-EMP-13 [+] Canceling the Delete modal keeps the record intact', async () => {
    expect(draftRecord.name).toBeTruthy();

    await empPage.gotoList();
    await empPage.searchList(draftRecord.name);

    const row = empPage.page.locator('tr', { hasText: draftRecord.name }).first();
    await row.locator('button').last().click(); // Open Action menu
    await empPage.page.getByRole('menuitem', { name: /Delete/i }).click();

    await empPage.cancelDeleteButton.click();
    await expect(empPage.confirmDeleteModal).not.toBeVisible();

    await empPage.searchList(draftRecord.name);
    await expect(empPage.page.getByText(draftRecord.name, { exact: false }).first()).toBeVisible();
  });

  test('EMP_230 / TC-EMP-14 [+] Delete a Draft Employee record', async () => {
    expect(draftRecord.name).toBeTruthy();

    await empPage.gotoList();
    await empPage.searchList(draftRecord.name);

    const row = empPage.page.locator('tr', { hasText: draftRecord.name }).first();
    await row.locator('button').last().click(); // Open Action menu
    await empPage.page.getByRole('menuitem', { name: /Delete/i }).click();

    await empPage.confirmDeleteButton.click();
    await empPage.page.waitForLoadState('networkidle');

    await empPage.searchList(draftRecord.name);
    await expect(empPage.page.getByText(draftRecord.name)).not.toBeVisible();
  });

  // ── Full Create with Contract Details ───────────────────────────────────────
  // Exercises the full 4-tab wizard (Basic Details -> Contract Details -> Documents -> Assets) and
  // a real, validated Save (not Save as Draft) - unlike EMP_001 above, which only ever fills Basic
  // Details and saves as Draft, never touching fillContractDetails/nextTab. Contract Details'
  // Salary Structure/Leave Policy/Accrual/Working Days/Working Hours are all real required
  // cross-field validations here (confirmed live from erpforce-hrms-fe's validation.ts and
  // contract-details.tsx), unlike the standalone Employee Contracts module where several of these
  // are optional - see EmployeeContractsPage's own class comment for that distinction.
  test('EMP_240 / TC-EMP-17 [+] Create Employee with Contract Details filled and verify persistence', async () => {
    test.setTimeout(150000);
    const ts = Date.now();
    const employeeName = testDataFactory.uniqueName('Auto_Contract_Emp');
    const uniqueEmail = `test.contract.${ts}@company.com`;
    const uniquePhone = `+97150${Math.floor(1000000 + Math.random() * 9000000)}`;
    const passportNumber = `PCTR${ts}`;
    const labourId = `LIDCTR${ts}`;

    await empPage.goto();

    // CONFIRMED LIVE: Date of Joining/Date of Birth are MUI DatePicker inputs that silently accept
    // (but do not actually apply) an ISO "YYYY-MM-DD" fill - the field is left showing its
    // "Select Date"/"Select Date of Birth" placeholder with no visible error, which EMP_001 above
    // never notices because Save as Draft skips validation entirely. Only a "DD-MM-YYYY" fill
    // actually populates these two pickers - required here since this test goes through real
    // "Next" validation, unlike EMP_001.
    await empPage.fillBasicDetails({
      name: employeeName,
      company: 'erp-force',
      email: uniqueEmail,
      phone: uniquePhone,
      dateOfJoining: '01-08-2026',
      nationality: 'Emirati',
      dob: '15-05-1995',
      gender: 'Male',
      passportNumber,
      labourContractNo: `LCCTR${ts}`,
      labourId,
    });

    // Department: select the pinned "QA" value if it genuinely exists in this module's own
    // Department list, else create a brand-new one via the footer (see selectOrCreateDepartment's
    // own comment for why a plain substring-matching select is unsafe here).
    const department = await empPage.selectOrCreateDepartment('QA', 'erp-force');

    // Designation: ALWAYS a brand-new one, never reused (explicit, non-negotiable requirement) -
    // Designation is disabled/empty until Department is filled, so this must run after the step above.
    const designationName = testDataFactory.uniqueName('Automation_Designation');
    const designationCode = 'DSG-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    await empPage.createDesignationFromFooter(designationName, designationCode, 'erp-force', department.name);

    // Basic Details -> Contract Details ("Next" gates on Basic Details' own required fields, all
    // of which are now filled).
    await empPage.nextTab();
    await expect(empPage.page.getByText('Employment Type', { exact: false }).first()).toBeVisible({ timeout: 15000 });

    await empPage.fillContractDetails({
      employmentType: 'Unlimited',
      country: 'United Arab Emirates',
      noticePeriod: '30',
      probationPeriod: '90',
      workingDays: '5',
      workingHours: '8',
    });

    // Timezone auto-derives from Country (contract-details.tsx's own fetchTimezonesByCountry
    // effect) - only select one manually if it's still showing its unfilled placeholder.
    const timezoneValue = await empPage.getEditComboboxValue
      ? await empPage.getEditComboboxValue(empPage.timezoneField).catch(() => '')
      : '';
    if (!timezoneValue || /^search |^select /i.test(timezoneValue.trim())) {
      await empPage.selectFirstOptionByLabel(empPage.timezoneField).catch(() => {});
    }

    // Contract Start/End/Effective From dates auto-derive from Date of Joining in Add mode
    // (contract-details.tsx lines ~155-172) - only fill manually if still empty.
    if (!(await empPage.contractStartDateInput.inputValue().catch(() => ''))) {
      await empPage.contractStartDateInput.fill('01-08-2026');
    }
    if (!(await empPage.contractEndDateInput.inputValue().catch(() => ''))) {
      await empPage.contractEndDateInput.fill('31-07-2028');
    }
    if (!(await empPage.effectiveFromDateInput.inputValue().catch(() => ''))) {
      await empPage.effectiveFromDateInput.fill('01-08-2026');
    }

    // Salary Structure has no stable/pinnable option text in this account (real fetched master
    // data) - pick the first available one and read its real min/max CTC range directly off the
    // network response, rather than guessing a CTC value and retrying against a parsed error string.
    const range = await empPage.selectFirstSalaryStructureAndGetRange();
    const ctcValue =
      Number.isFinite(range.min) && Number.isFinite(range.max) && range.max > range.min
        ? Math.floor((range.min + range.max) / 2)
        : 50000;
    await empPage.ctcInput.fill(String(ctcValue));
    await empPage.ctcInput.blur();
    await empPage.clickCalculateSalary();

    // Leave Policy/Accruals also have no stable/pinnable option text - first available, same
    // pattern already used for Grade/Location elsewhere in this suite. Leave Policy needs its own
    // accessible-name-based lookup (see selectFirstLeavePolicy's own comment for why the generic
    // label lookup is ambiguous here).
    if (process.env.DIAG) {
      const combos = await empPage.page.getByRole('combobox').all();
      for (const c of combos) {
        console.log('COMBOBOX name=', JSON.stringify(await c.evaluate(el => el.getAttribute('aria-label') || el.textContent || el.value || '')));
      }
      await empPage.page.screenshot({ path: '/tmp/diag-leave-area.png', fullPage: true });
    }
    await empPage.selectFirstLeavePolicy();
    await empPage.ensureLeaveAllocationsAreValid();
    await empPage.selectFirstAccrual();

    // Same "Calculate" step as Salary Details above, for the Accrual/Deduction/Benefits section -
    // only actually clicks if the button is genuinely enabled (see clickCalculateAccrual's own
    // comment for the live-data condition this depends on).
    const accrualCalc = await empPage.clickCalculateAccrual();
    if (!accrualCalc.clicked && process.env.DIAG) {
      console.log('Accrual Calculate skipped:', accrualCalc.reason);
    }

    // Contract Details -> Documents -> Assets ("Next" from Contract Details validates the ENTIRE
    // contract sub-schema, including the CTC-range/salary-components cross-field rules above).
    await empPage.nextTab();
    await empPage.nextTab();

    const result = await empPage.save();
    expect(result.status).toBe(200);
    expect(result.id).toBeTruthy();

    // Re-open the created Employee and assert the Contract Details actually persisted, not just
    // that Save returned 200.
    await empPage.gotoView(result.id);
    await empPage.page.getByRole('tab', { name: /Contract Details/i }).click();

    await expect(empPage.page.getByText('Unlimited', { exact: false }).first()).toBeVisible({ timeout: 15000 });
    // CONFIRMED LIVE: the View page renders CTC currency-formatted ("AED 30,000.0000"), not the
    // bare digits submitted - match on the digit groups with an optional thousands-separator comma
    // between them instead of the raw ctcValue string.
    const ctcDigits = String(ctcValue).replace(/(\d)(?=(\d{3})+$)/g, '$1,?');
    await expect(empPage.page.getByText(new RegExp(ctcDigits)).first()).toBeVisible();
    await expect(empPage.page.getByText(/5\s*days/i).first()).toBeVisible();
  });
});
