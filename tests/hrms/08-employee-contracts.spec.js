const { test, expect } = require('@playwright/test');
const EmployeeContractsPage = require('../../pages/EmployeeContractsPage');
const testData = require('../../config/testData');

// Employee Contracts (Employee Management > Employee Contracts) is a contract-VERSIONING module
// for an already-existing employee, not a plain create-from-scratch screen - confirmed from source
// (erpforce-hrms-fe/src/views/employee-contracts/**): the Add form's Employee-selection field is
// commented out (form/form.tsx) and the backend's create validator requires `employee_id`
// (erpforce-be modules/hrms/lib/employee-contracts/validator/create.employee-contract.js). Every
// test below therefore operates on the first row of the real, shared dataset (captured dynamically
// via EmployeeContractsPage.getFirstRow(), never a hardcoded ID) instead of creating a fresh record.
// A DynamicSearchSelect's own unfilled placeholder ("Search Employment Type") renders AS the
// combobox's visible text, so BasePage.getEditComboboxValue() returns it verbatim - a bare
// `.toBeTruthy()` on that return value can never distinguish "prefilled" from "still empty",
// since the placeholder string itself is truthy. Compare against the known placeholder pattern
// instead (CONFIRMED LIVE via TC-EMPC-06's own screenshot: an unfilled Employment Type combobox
// shows exactly "Search Employment Type").
function isComboboxFilled(value) {
  return Boolean(value) && !/^Search |^Select |^Loading\.\.\./i.test(value.trim());
}

// CONFIRMED LIVE (manual timing probe, not just this suite's own fixed waits): after "Update (In
// New Version)" from the LISTING page, Employment Type briefly still reads its placeholder for
// about a second before the fetch-by-id + `methods.reset()` round trip lands, then settles to
// "Unlimited" and stays - a real timing gap, not a bug (see TC-EMPC-05). Poll instead of asserting
// immediately so that gap doesn't produce a false failure.
async function waitForComboboxFilled(getValueFn, { timeoutMs = 8000, intervalMs = 500 } = {}) {
  const start = Date.now();
  let value = await getValueFn();
  while (Date.now() - start < timeoutMs && !isComboboxFilled(value)) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    value = await getValueFn();
  }
  return value;
}

test.describe.serial('Employee Contracts Module Suite', () => {
  test.describe.configure({ timeout: 120000 });

  let contractsPage;
  let sourceRecord = {};

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    contractsPage = new EmployeeContractsPage(page);
  });

  test.afterAll(async () => {
    if (contractsPage && contractsPage.page) {
      await contractsPage.page.close();
    }
  });

  // ── Listing Page ─────────────────────────────────────────────────────────────

  test('TC-EMPC-L01 [+] Employee Contracts listing loads with core columns and existing records', async () => {
    await contractsPage.gotoList();

    await expect(contractsPage.page.getByRole('columnheader', { name: 'ID' })).toBeVisible();
    await expect(contractsPage.page.getByRole('columnheader', { name: 'Employee Name' })).toBeVisible();
    await expect(contractsPage.page.getByRole('columnheader', { name: 'Status' })).toBeVisible();

    sourceRecord = await contractsPage.getFirstRow();
    expect(sourceRecord.id).toBeTruthy();
    expect(sourceRecord.employeeName).toBeTruthy();
  });

  // CONFIRMED LIVE: this listing's ActionBar renders with no "Add" button at all (screenshot
  // shows Table View/View toggle and the search/filter icons, but no "+ Add"), unlike every other
  // module's listing page in this suite. Matches the source-level finding that the Add form has
  // no Employee-selection field - the product deliberately removed the only UI entry point to a
  // flow that can't succeed on its own (see TC-EMPC-08).
  test('TC-EMPC-L01b [~] Listing page has no "Add" button (contracts are created only via "Update in New Version")', async () => {
    await contractsPage.gotoList();
    await expect(contractsPage.page.getByRole('button', { name: /^Add$/i })).toHaveCount(0);
  });

  test('TC-EMPC-L02 [+] Search Employee Contracts list by employee name', async () => {
    expect(sourceRecord.employeeName).toBeTruthy();

    await contractsPage.gotoList();
    await contractsPage.searchList(sourceRecord.employeeName);

    await expect(contractsPage.page.getByText(sourceRecord.employeeName, { exact: false }).first()).toBeVisible();
  });

  test('TC-EMPC-L03 [+] Row status badge reflects the record\'s lifecycle state', async () => {
    expect(sourceRecord.id).toBeTruthy();

    await contractsPage.gotoList();
    await contractsPage.searchList(sourceRecord.employeeName);

    const status = await contractsPage.getRowStatus(sourceRecord.id);
    expect(status).toMatch(/Active|Draft|Upcoming Contract|Inactive|Expired/i);
    sourceRecord.status = status.trim();
  });

  // ── View Page ────────────────────────────────────────────────────────────────

  test('TC-EMPC-01 [+] View page displays Summary sidebar and Contract/Salary Details sections', async () => {
    expect(sourceRecord.id).toBeTruthy();

    await contractsPage.gotoView(sourceRecord.id);

    // Summary sidebar (right panel) - labels are the shared Summary component's own hardcoded
    // strings, not this module's (partly untranslated) field labels.
    await expect(contractsPage.page.getByText('ID', { exact: true }).first()).toBeVisible();
    await expect(contractsPage.page.getByText('Personal Email', { exact: true })).toBeVisible();
    await expect(contractsPage.page.getByText(sourceRecord.employeeName, { exact: false }).first()).toBeVisible();

    // Contract Details section fields - these individual field labels render correctly even
    // though the accordion's own section title is a broken/untranslated i18n key.
    await expect(contractsPage.page.getByText(contractsPage.employmentTypeField, { exact: false })).toBeVisible();
    await expect(contractsPage.page.getByText(contractsPage.salaryStructureField, { exact: false })).toBeVisible();
  });

  test('TC-EMPC-02 [+] "Contract Records" button navigates to the employee\'s Contract History page', async () => {
    expect(sourceRecord.id).toBeTruthy();

    await contractsPage.gotoView(sourceRecord.id);
    await contractsPage.clickContractRecords();

    // Route confirmed live (pathname.hrms.ts EMPLOYEE_MASTER_CONTRACTS uses the Employee Master
    // module's own path segment, "employee-master", not "employee-contracts"):
    // /employee-management/employee-master/:id/contracts
    await expect(contractsPage.page).toHaveURL(/employee-management\/employee-master\/\d+\/contracts/);
  });

  // ── Edit (In Same Version) ───────────────────────────────────────────────────

  test('TC-EMPC-03 [+] "Edit (In Same Version)" from the Listing row menu opens the prefilled Edit form', async () => {
    expect(sourceRecord.id).toBeTruthy();

    await contractsPage.gotoList();
    await contractsPage.searchList(sourceRecord.employeeName);
    await contractsPage.clickEditInSameVersion(sourceRecord.id);

    await expect(contractsPage.page).toHaveURL(
      new RegExp(`employee-contracts/${sourceRecord.id}/edit-employee-contracts`)
    );
    // Employment Type is always set on a real, previously-saved contract - its combobox should
    // already show a value rather than the "Search Employment Type" placeholder.
    const employmentType = await contractsPage.getEditComboboxValue(contractsPage.employmentTypeField);
    expect(isComboboxFilled(employmentType)).toBe(true);
  });

  // CONFIRMED LIVE (source record ID 161, an "Active"-status contract): opening this real contract
  // in Edit and clicking Save with ONLY Notice Period changed shows required-field errors on
  // Country, Contract Start Date, Contract End Date, Effective From, Salary Structure and CTC -
  // all fields the current Yup schema (validation.ts) marks required, but which this
  // previously-saved record has stored empty (a data/schema drift, likely from an older version of
  // the form). The practical impact: this record can never be Saved again from the Edit form until
  // a user backfills every one of those unrelated fields, even to change something as small as
  // Notice Period.
  test('TC-EMPC-04 [-] Saving an existing contract with legacy-missing required fields is blocked by unrelated validation errors', async () => {
    test.fail(
      true,
      'Confirmed live: this contract was saved with Country/Contract Start Date/Contract End Date/' +
        'Effective From/Salary Structure/CTC all empty, which the CURRENT Yup schema marks required - ' +
        'so Save is blocked by those unrelated fields even when only Notice Period is being changed.'
    );
    expect(sourceRecord.id).toBeTruthy();
    const { noticePeriodOptions } = testData.employeeContract;

    await contractsPage.gotoEdit(sourceRecord.id);

    const currentNoticePeriod = await contractsPage.getEditComboboxValue(contractsPage.noticePeriodField);
    const targetNoticePeriod = noticePeriodOptions.find((opt) => opt !== currentNoticePeriod);

    await contractsPage.fillContractDetails({ noticePeriod: targetNoticePeriod });

    // Client-side validation blocks the request entirely (no network call ever fires), so
    // `save()`'s own waitForResponse() would otherwise time out rather than resolve - catch that
    // and let the assertion below report the failure cleanly either way.
    let result;
    try {
      result = await contractsPage.save();
    } catch (e) {
      result = { status: null };
    }
    expect(result.status).toBe(200);

    await contractsPage.discardButton.click().catch(() => {});
  });

  // ── Update (In New Version) ──────────────────────────────────────────────────

  test('TC-EMPC-05 [+] "Update (In New Version)" from the Listing row menu prefills the Add form from the source contract', async () => {
    expect(sourceRecord.id).toBeTruthy();

    await contractsPage.gotoList();
    await contractsPage.searchList(sourceRecord.employeeName);
    await contractsPage.clickUpdateInNewVersion(sourceRecord.id);

    // employee-contracts.hrms.tsx's own "Update (In New Version)" menu item navigates with
    // `state: { request }`, matching what add-employee-contracts.hrms.tsx reads
    // (`location.state?.request`) - so the Add form's own fetch-and-prefill effect fires and the
    // Employment Type combobox (always set on a real contract) is populated, not left on its
    // placeholder. CONFIRMED LIVE this briefly still shows the placeholder for ~1s while the
    // fetch-by-id + reset() round trip lands - poll rather than reading immediately.
    const employmentType = await waitForComboboxFilled(() =>
      contractsPage.getEditComboboxValue(contractsPage.employmentTypeField)
    );
    expect(isComboboxFilled(employmentType)).toBe(true);
  });

  // FIXED in erpforce-hrms-fe (view-employee-contracts.hrms.tsx): the "Update (In New Version)"
  // menu item used to navigate with `state: tData` (the raw record), but
  // add-employee-contracts.hrms.tsx only reads `location.state?.request` to decide whether to call
  // methods.reset() with the fetched data - so that reset never ran via this path and the form
  // stayed on react-hook-form's own blank defaults (Employment Type stuck on its "Search Employment
  // Type" placeholder, Country/Timezone stuck on "Loading...", CONFIRMED LIVE by polling 16+
  // seconds). Changed to `state: { request: tData }` to match, mirroring the Listing page's own
  // equivalent action (TC-EMPC-05), which already wrapped it correctly. This test previously
  // documented that bug via `test.fail()`; it now asserts the corrected, prefilled behavior - it
  // will only pass once this fix has been built/deployed to whatever environment this suite targets.
  test('TC-EMPC-06 [+] "Update (In New Version)" from the View page\'s own Actions menu prefills the Add form', async () => {
    expect(sourceRecord.id).toBeTruthy();

    await contractsPage.gotoView(sourceRecord.id);
    await contractsPage.openViewActionsMenu();
    await contractsPage.page.getByRole('menuitem', { name: 'Update (In New Version)' }).click();
    await expect(contractsPage.page).toHaveURL(/add-employee-contracts/);
    await contractsPage.waitForNetworkIdle();

    const employmentType = await waitForComboboxFilled(() =>
      contractsPage.getEditComboboxValue(contractsPage.employmentTypeField)
    );
    expect(isComboboxFilled(employmentType)).toBe(true);
  });

  // ── Delete gating ────────────────────────────────────────────────────────────

  test('TC-EMPC-07 [+] Delete is disabled in the row menu for an Active-status contract', async () => {
    expect(sourceRecord.id).toBeTruthy();
    test.skip(
      !/^active$/i.test(sourceRecord.status || ''),
      `Source record's status is "${sourceRecord.status}", not Active - this gating rule only applies to Active rows.`
    );

    await contractsPage.gotoList();
    await contractsPage.searchList(sourceRecord.employeeName);

    const disabled = await contractsPage.isRowActionDisabled(sourceRecord.id, 'Delete');
    expect(disabled).toBe(true);
  });

  // ── Field Validation ─────────────────────────────────────────────────────────

  test('TC-V01 [-] Clearing a required Contract Details field blocks Save', async () => {
    expect(sourceRecord.id).toBeTruthy();

    await contractsPage.gotoEdit(sourceRecord.id);

    // Clear Employment Type via its own "clear selection" button (same pattern proven working on
    // EmployeeMasterPage's TC-V03) so the required-field check has an empty value to catch.
    await contractsPage.page.getByRole('button', { name: 'clear selection' }).first().click();
    await contractsPage.saveButton.click();

    await expect(contractsPage.page.getByText(/is required/i).first()).toBeVisible();
    // Blocked submission never navigates away from the Edit form.
    await expect(contractsPage.page).toHaveURL(/edit-employee-contracts/);

    await contractsPage.discardButton.click();
  });

  test('TC-V02 [-] Contract End Date before Contract Start Date is rejected', async () => {
    expect(sourceRecord.id).toBeTruthy();

    await contractsPage.gotoEdit(sourceRecord.id);

    // Set both dates directly rather than relying on the record's own existing Start Date value -
    // CONFIRMED LIVE (see TC-EMPC-04) at least one real record in this dataset has it stored empty.
    await contractsPage.contractStartDateInput.fill('01/01/2027');
    await contractsPage.contractEndDateInput.fill('01/01/2000');
    await contractsPage.saveButton.click();

    // Blocked submission never navigates away from the Edit form - exact translated error wording
    // isn't asserted here since the date-after message is template-built (`common.validation
    // .date_after`) and not confirmed live in this account's translation set.
    await expect(contractsPage.page).toHaveURL(/edit-employee-contracts/);

    await contractsPage.discardButton.click();
  });

  // ── Documented gap: fresh Add cannot succeed ─────────────────────────────────

  test('TC-EMPC-08 [-] A fresh "Add" (no existing-contract context) cannot create a contract', async () => {
    test.fail(
      true,
      'Confirmed from source: the Add form\'s Employee-selection field is commented out ' +
        '(employee-contracts/form/form.tsx) and only ever gets populated via `location.state.request` ' +
        'when arriving from an existing contract\'s "Update (In New Version)" action. Clicking "Add" ' +
        'directly on the Listing page never sets `employee_id`, which the backend\'s create validator ' +
        '(create.employee-contract.js) marks required - so this save is expected to fail with a ' +
        'validation error, not succeed with a 200.'
    );

    await contractsPage.goto();
    await contractsPage.fillContractDetails({
      employmentType: 'Unlimited',
      country: 'United Arab Emirates',
      timezone: 'Asia/Dubai',
      contractStartDate: '2026-08-01',
      contractEndDate: '2027-07-31',
      effectiveFromDate: '2026-08-01',
    });

    const result = await contractsPage.save();
    expect(result.status).toBe(200);
  });
});
