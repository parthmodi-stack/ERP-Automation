const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

// Standalone "Employee Contracts" module (Employee Management > Employee Contracts), NOT the
// embedded "Contract Details" tab inside Employee Master's own add/edit wizard (that one is
// covered by EmployeeMasterPage.fillContractDetails). This module manages contract VERSIONS for
// an already-existing employee: List -> View -> "Edit (In Same Version)" / "Update (In New
// Version)" -> Delete (only for non-Active rows). Confirmed from source
// (erpforce-hrms-fe/src/views/employee-contracts/**): the Add form's own Employee-selection field
// is commented out (form.tsx) and the backend's create validator (create.employee-contract.js)
// marks `employee_id` required - so a fresh "Add" click on the Listing page can never save a
// contract; every contract in this suite is created via "Update (In New Version)" against an
// existing record, never via a blank Add.
class EmployeeContractsPage extends BasePage {
  constructor(page) {
    super(page);
    this.page = page;

    // Listing - CONFIRMED LIVE: unlike every other module's listing page, this one has no visible
    // "Add" button at all (employee-contracts.hrms.tsx's own ActionBar is rendered with
    // `button={false}`, deliberately, matching the Add form's own missing Employee-selection field
    // - see the class comment). There is no UI path to the Add page except "Update (In New
    // Version)" on an existing row; gotoList() therefore waits on the page title, not an Add
    // button, and goto() below navigates by URL directly since there's nothing to click.
    // "Employee Contracts" text itself isn't a safe locator - CONFIRMED LIVE it resolves to 11+
    // matches (sidebar nav item, breadcrumb, page heading, all sharing the same text), several of
    // which report `hidden` (breadcrumb overflow/sidebar collapse) depending on layout state. The
    // "ID" column header is unique to the loaded MaterialTable itself.
    this.listTitle = page.getByRole('columnheader', { name: 'ID' });

    // Header action buttons (Add/Edit forms)
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.discardButton = page.getByRole('button', { name: 'Discard' });
    this.actionsButton = page.getByRole('button', { name: 'Actions' });
    this.contractRecordsButton = page.getByRole('button', { name: /Contract Records/i });

    // Field labels - confirmed rendered correctly live (screenshots) even though this module's
    // own accordion SECTION titles (Contract Details/Salary Details/Overtime/Leave Policy) render
    // as raw, untranslated i18n keys (e.g. "hrms.employee_management.sections.contract_details") -
    // a missing-translation gap distinct from the field labels themselves.
    this.employmentTypeField = 'Employment Type';
    this.countryField = 'Country';
    this.timezoneField = 'Timezone';
    this.noticePeriodField = 'Notice Period (Days)';
    this.probationPeriodField = 'Probation Period (Days)';
    this.workingDaysField = 'Working Days';
    this.workingHoursField = 'Working Hours';
    this.salaryStructureField = 'Salary Structure';
    this.leavePolicyField = 'Leave Policy';
    this.accrualField = 'Accruals & Benefits';

    // Plain inputs - resolved off the RHF `name` attribute (stable regardless of i18n/label
    // wording), same dual-selector convention as EmployeeMasterPage's own Contract Details inputs.
    this.contractStartDateInput = page.locator(
      'input[name="employee_contract.contract_start_date"], input[name="contract_start_date"]'
    );
    this.contractEndDateInput = page.locator(
      'input[name="employee_contract.contract_end_date"], input[name="contract_end_date"]'
    );
    this.effectiveFromDateInput = page.locator(
      'input[name="employee_contract.effective_from_date"], input[name="effective_from_date"]'
    );
    this.ctcInput = page.locator('input[name="employee_contract.ctc"], input[name="ctc"]');
  }

  // ---------- Navigation ----------
  async gotoList() {
    await this.page.goto('/dashboard/hrms/employee-management/employee-contracts');
    // CONFIRMED LIVE: the FIRST navigation into this federated remote (HRMS module, fetched from
    // VITE_HRMS_REMOTE_URL at runtime, against a shared dev server) can sit on a bare full-page
    // spinner anywhere from ~10s to 30+s before the table even mounts - well past
    // waitForNetworkIdle()'s brief 3s window - since this is a one-time cold-load cost, subsequent
    // navigations within the same page/session are fast.
    await expect(this.page.locator('table').first()).toBeVisible({ timeout: 60000 });
    await expect(this.listTitle).toBeVisible({ timeout: 10000 });
  }

  // No "Add" button exists to click (see constructor comment) - the Add page is only reachable
  // by direct URL, which is exactly what a real user without the "Update (In New Version)" context
  // cannot do either; this method exists solely so TC-EMPC-08 can prove the resulting save fails.
  async goto() {
    await this.page.goto('/dashboard/hrms/employee-management/employee-contracts/add-employee-contracts');
    await this.waitForNetworkIdle();
  }

  async gotoEdit(id) {
    await this.page.goto(`/dashboard/hrms/employee-management/employee-contracts/${id}/edit-employee-contracts`);
    await this.waitForNetworkIdle();
    await this.recoverFromStuckLoadingFields();
  }

  async gotoView(id) {
    await this.page.goto(`/dashboard/hrms/employee-management/employee-contracts/${id}/view-employee-contracts`);
    await this.waitForNetworkIdle();
  }

  // ---------- Listing helpers ----------
  // Column order/visibility is user-configurable (draggable columns, per-user persisted), so a
  // fixed td index would silently read the wrong column after any reordering - resolve the index
  // from the live header row instead. CONFIRMED LIVE: this table's header row isn't real
  // `<thead><th>` markup (a `table thead th` CSS locator finds zero matches even though the table
  // renders correctly) - only `getByRole('columnheader')` resolves it, while the body rows below
  // ARE plain `<table><tbody><tr><td>`, so column order still lines up positionally between the
  // two despite the mismatched markup.
  async getFirstRowColumnValue(columnName) {
    const headers = this.page.getByRole('columnheader');
    const count = await headers.count();
    let colIndex = -1;
    for (let i = 0; i < count; i++) {
      // CONFIRMED LIVE: a header's innerText is the visible label PLUS a trailing sort-index
      // artifact on its own line (e.g. "ID\n0"), not just the label - compare only the first line.
      const text = (await headers.nth(i).innerText()).split('\n')[0].trim();
      if (text.toLowerCase() === columnName.toLowerCase()) {
        colIndex = i;
        break;
      }
    }
    if (colIndex === -1) {
      throw new Error(`getFirstRowColumnValue("${columnName}"): no matching column header found.`);
    }
    const cell = this.page.locator('table tbody tr').first().locator('td').nth(colIndex);
    // CONFIRMED LIVE: the table mounts with its rows/cells in the DOM slightly before the fetched
    // row DATA paints into them (a brief two-phase render, distinct from the earlier cold-load
    // spinner) - reading innerText() immediately after the table appears can catch that empty
    // window; wait for real (non-whitespace) content first.
    await expect(cell).not.toHaveText(/^\s*$/, { timeout: 8000 });
    return (await cell.innerText()).trim();
  }

  // This suite never creates its own record (see class comment) - it reads whatever the first
  // row of the real, shared, persistent dataset currently is, the same way other suites treat
  // pre-existing master data (never invented, never hardcoded to one specific ID).
  async getFirstRow() {
    return {
      id: await this.getFirstRowColumnValue('ID'),
      employeeName: await this.getFirstRowColumnValue('Employee Name'),
      status: await this.getFirstRowColumnValue('Status'),
    };
  }

  // Overrides BasePage's version, which locates the search toggle off the "Add" button
  // (`getByRole('button', {name:'Add'}).first().locator('xpath=preceding-sibling::button[2]')`) -
  // this listing has no Add button at all (see constructor comment), so that anchor never
  // resolves. CONFIRMED LIVE: the search toggle is the first unlabeled icon button after "+ View"
  // in DOM order instead.
  async ensureSearchInputOpen() {
    const searchInput = this.page.getByPlaceholder('Search', { exact: true });
    if (await searchInput.isVisible().catch(() => false)) {
      return searchInput;
    }
    const searchBtn = this.page.getByRole('button', { name: 'View', exact: true }).locator('xpath=following::button[1]');
    for (let attempt = 0; attempt < 3; attempt++) {
      await searchBtn.click({ timeout: 4000 }).catch(() => {});
      const opened = await searchInput
        .waitFor({ state: 'visible', timeout: 4000 })
        .then(() => true)
        .catch(() => false);
      if (opened) break;
    }
    await searchInput.click().catch(() => {});
    await this.page.waitForTimeout(300);
    return searchInput;
  }

  async getRowStatus(id) {
    return this.getRowStatusMatching(id, /Active|Draft|Upcoming Contract|Inactive|Expired/i);
  }

  async clickEditInSameVersion(id) {
    await this.openRowActionMenu(id);
    await this.page.getByRole('menuitem', { name: 'Edit (In Same Version)' }).click();
    await expect(this.page).toHaveURL(/edit-employee-contracts/);
    await this.waitForNetworkIdle();
  }

  async clickUpdateInNewVersion(id) {
    await this.openRowActionMenu(id);
    await this.page.getByRole('menuitem', { name: 'Update (In New Version)' }).click();
    await expect(this.page).toHaveURL(/add-employee-contracts/);
    await this.waitForNetworkIdle();
  }

  // ---------- View page actions dropdown ----------
  async openViewActionsMenu() {
    await this.actionsButton.click();
  }

  async clickContractRecords() {
    await this.contractRecordsButton.click();
    await this.waitForNetworkIdle();
  }

  // ---------- Form fill ----------
  // Notice Period/Probation Period/Working Days/Working Hours are a DynamicSelect (a combobox with
  // a fixed discrete option list: "30/60/90/120 Days", "5/6 Days", "08/10 Hours" - confirmed from
  // source, erpforce-hrms-fe/src/views/employee-contracts/form/form.tsx), NOT free-numeric inputs -
  // callers must pass one of those exact option strings, not a bare number.
  async fillContractDetails({
    employmentType,
    country,
    timezone,
    noticePeriod,
    probationPeriod,
    workingDays,
    workingHours,
    contractStartDate,
    contractEndDate,
    effectiveFromDate,
  } = {}) {
    if (employmentType) await this.selectFieldByLabel(this.employmentTypeField, employmentType, { exact: false });
    if (country) await this.selectFieldByLabel(this.countryField, country, { exact: false });
    if (timezone) await this.selectFieldByLabel(this.timezoneField, timezone, { exact: false });
    if (noticePeriod) await this.selectFieldByLabel(this.noticePeriodField, noticePeriod, { exact: false });
    if (probationPeriod) await this.selectFieldByLabel(this.probationPeriodField, probationPeriod, { exact: false });
    if (workingDays) await this.selectFieldByLabel(this.workingDaysField, workingDays, { exact: false });
    if (workingHours) await this.selectFieldByLabel(this.workingHoursField, workingHours, { exact: false });
    if (contractStartDate) await this.contractStartDateInput.fill(contractStartDate);
    if (contractEndDate) await this.contractEndDateInput.fill(contractEndDate);
    if (effectiveFromDate) await this.effectiveFromDateInput.fill(effectiveFromDate);
  }

  async fillSalaryDetails({ salaryStructure, ctc } = {}) {
    if (salaryStructure) await this.selectFieldByLabel(this.salaryStructureField, salaryStructure, { exact: false });
    if (ctc !== undefined) await this.ctcInput.fill(String(ctc));
  }

  // Leave Policy/Accrual are both `is_multiselect` DynamicSearchSelect fields (chips) - call once
  // per value to add it, same combobox re-opened each time.
  async selectLeavePolicies(names = []) {
    for (const name of names) {
      await this.selectFieldByLabel(this.leavePolicyField, name, { exact: false });
    }
  }

  async selectAccruals(names = []) {
    for (const name of names) {
      await this.selectFieldByLabel(this.accrualField, name, { exact: false });
    }
  }

  // ---------- Save / network capture ----------
  // Response shape confirmed from source (erpforce-be modules/hrms/lib/employee-contracts
  // controller.js): `reply.sendResponse(200, { contract }, 'success')` -> `json.data.contract`.
  async save() {
    const responsePromise = this.page.waitForResponse(
      (res) =>
        res.url().includes('/employee-contracts') &&
        (res.request().method() === 'POST' || res.request().method() === 'PUT'),
      { timeout: 15000 }
    );
    await this.saveButton.click();
    const response = await responsePromise;
    let json = {};
    try {
      json = await response.json();
    } catch (e) {
      // A validation failure (400) may return a non-JSON or empty body - caller checks `status`.
    }
    return {
      status: response.status(),
      id: json?.data?.contract?.id,
    };
  }
}

module.exports = EmployeeContractsPage;
