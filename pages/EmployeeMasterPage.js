const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

class EmployeeMasterPage extends BasePage {
  constructor(page) {
    super(page);
    this.page = page;

    // Navigation & Listing Locators
    this.listAddButton = page.getByRole('button', { name: /Add/i }).first();
    this.searchInput = page.getByPlaceholder('Search');
    this.tableRows = page.locator('tbody tr');

    // Tabs
    this.basicDetailsTab = page.getByRole('tab', { name: /Basic Details/i });
    this.contractDetailsTab = page.getByRole('tab', { name: /Contract Details/i });
    this.documentsTab = page.getByRole('tab', { name: /Documents/i });
    this.assetsTab = page.getByRole('tab', { name: /Assets/i });

    // Header Action Buttons
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.saveAsDraftButton = page.getByRole('button', { name: /Save as Draft|Save To Draft/i });
    this.discardButton = page.getByRole('button', { name: 'Discard' });
    this.nextButton = page.getByRole('button', { name: 'Next', exact: true });
    this.actionsButton = page.getByRole('button', { name: 'Actions' });
    this.contractHistoryButton = page.getByRole('button', { name: /Contract History/i });

    // Basic Details Form Labels
    // CONFIRMED LIVE + from source (erpforce-be translations.json
    // "hrms.employee_management.fields.designation_id_label" = "Designation"): the visible label is
    // just "Designation", NOT "Designation/Grade" - the old value here never matched any field
    // container and would silently resolve to the wrong combobox via selectFieldByLabel's fallback
    // structural lookup.
    this.companyField = 'Company';
    this.departmentField = 'Department';
    this.designationField = 'Designation';
    this.teamField = 'Team';
    this.locationField = 'Location';
    this.genderField = 'Gender';
    this.roleField = 'Role';
    this.appraisalTypeField = 'Appraisal Type';

    // Inputs in Basic Details (resilient locators)
    this.employeeIdInput = page.locator('input[name="employee.series_number"], input[name="series_number"]');
    this.employeeNameInput = page.getByPlaceholder('Enter Employee Name');
    this.emailInput = page.getByPlaceholder('Enter Personal Email Address');
    this.phoneInput = page.getByPlaceholder('Enter Phone Number');
    this.dateOfJoiningInput = page.getByPlaceholder('Select Date').first();
    this.nationalityInput = page.getByPlaceholder('Select Nationality');
    this.dobInput = page.getByPlaceholder('Select Date of Birth');
    this.passportNumberInput = page.getByPlaceholder('Enter Passport Number');
    this.labourContractNoInput = page.getByPlaceholder('Enter Labour Contract Number');
    this.labourIdInput = page.getByPlaceholder('Enter Labour ID');
    this.customAppraisalDateInput = page.locator('input[name="employee.custom_appraisal_date"], input[name="custom_appraisal_date"]');

    // Portal Login & Status
    this.canLoginPortalCheckbox = page.locator('input[name="employee.can_login_portal"], input[name="can_login_portal"]');
    this.isActiveToggle = page.locator('input[name="employee.is_active"], input[name="is_active"]');

    // Contract Details Inputs
    this.employmentTypeField = 'Employment Type';
    this.countryField = 'Country';
    this.timezoneField = 'Timezone';
    this.salaryStructureField = 'Salary Structure';
    this.leavePolicyField = 'Leave Policy';
    // CONFIRMED from source (erpforce-be translations.json "hrms.employee_management.fields
    // .accrual_id_label" = "Accrual"): "Accruals & Benefits" is only the ACCORDION section's title
    // (SECTION_TITLES.ACCRUAL_DEDUCTION_BENEFITS = "Accruals, Deductions & Benefits" in
    // utils/constants.ts), not the field's own label - selectFieldByLabel does an exact getByText
    // match, so the old value here never matched either string and always failed/mis-resolved.
    this.accrualField = 'Accrual';

    // Salary/Accrual "Calculate" buttons (contract-details.tsx) share the exact same visible text
    // ("Calculate") with no distinguishing accessible name - they render in DOM order Salary
    // Details accordion first, Accruals accordion second, so `.first()`/`.last()` disambiguate
    // reliably without needing per-button unique text.
    this.calculateSalaryButton = page.getByRole('button', { name: 'Calculate', exact: true }).first();
    this.calculateAccrualButton = page.getByRole('button', { name: 'Calculate', exact: true }).last();

    this.noticePeriodInput = page.locator('input[name="employee.contract.notice_period"], input[name="notice_period"]');
    this.probationPeriodInput = page.locator('input[name="employee.contract.probation_period"], input[name="probation_period"]');
    this.workingDaysInput = page.locator('input[name="employee.contract.working_days"], input[name="working_days"]');
    this.workingHoursInput = page.locator('input[name="employee.contract.working_hours"], input[name="working_hours"]');
    this.contractStartDateInput = page.locator('input[name="employee.contract.contract_start_date"], input[name="contract_start_date"]');
    this.contractEndDateInput = page.locator('input[name="employee.contract.contract_end_date"], input[name="contract_end_date"]');
    this.effectiveFromDateInput = page.locator('input[name="employee.contract.effective_from_date"], input[name="effective_from_date"]');
    this.ctcInput = page.locator('input[name="employee.contract.ctc"], input[name="ctc"]');

    this.overtimeRateInput = page.locator('input[name="employee.contract.overtime.overtime_rate"], input[name="overtime.overtime_rate"]');
    this.specialOvertimeRateInput = page.locator('input[name="employee.contract.overtime.special_overtime_rate"], input[name="special_overtime_rate"]');
    this.nightShiftOvertimeRateInput = page.locator('input[name="employee.contract.overtime.night_shift_overtime_rate"], input[name="night_shift_overtime_rate"]');

    // Modals
    this.confirmDeleteModal = page.locator('.MuiDialog-root');
    this.confirmDeleteButton = page.getByRole('button', { name: /Delete|Confirm/i }).last();
    this.cancelDeleteButton = page.getByRole('button', { name: 'Cancel' });
  }

  async gotoList() {
    await this.page.goto('/dashboard/hrms/employee-management/employee-master');
    await this.page.waitForLoadState('networkidle');
    await expect(this.listAddButton).toBeVisible({ timeout: 15000 });
  }

  async goto() {
    await this.gotoList();
    await this.listAddButton.click();
    await expect(this.page).toHaveURL(/add-employee/);
    await this.waitForNetworkIdle();
    await expect(this.employeeNameInput).toBeVisible({ timeout: 15000 });
  }

  async gotoEdit(id) {
    await this.page.goto(`/dashboard/hrms/employee-management/employee-master/${id}/edit-employee`);
    await this.waitForNetworkIdle();
    await expect(this.employeeNameInput).toBeVisible({ timeout: 15000 });
  }

  async gotoView(id) {
    await this.page.goto(`/dashboard/hrms/employee-management/employee-master/${id}/view-employee`);
    await this.waitForNetworkIdle();
  }

  // CONFIRMED LIVE: this local override bypassed BasePage.searchList/ensureSearchInputOpen and
  // filled `this.searchInput` (getByPlaceholder('Search')) directly - but that input is collapsed
  // behind an icon-only toggle button by default and doesn't exist in the DOM until clicked (same
  // toolbar pattern as every other module's listing page), so the fill always timed out. Removed
  // in favor of inheriting BasePage's own generic, already-proven searchList/ensureSearchInputOpen,
  // which opens that toggle first (anchored off the "Add" button, present on this module's toolbar).

  async fillBasicDetails({
    name,
    company,
    email,
    phone,
    dateOfJoining,
    nationality,
    dob,
    gender = 'Male',
    department,
    designation,
    passportNumber,
    labourContractNo,
    labourId,
    location,
    canLoginPortal = false,
    role = null
  }) {
    if (name !== undefined) await this.employeeNameInput.fill(name);
    if (company) await this.selectFieldByLabel(this.companyField, company, { exact: false });
    if (email !== undefined) await this.emailInput.fill(email);
    if (phone !== undefined) await this.phoneInput.fill(phone);
    if (dateOfJoining) await this.dateOfJoiningInput.fill(dateOfJoining);
    if (nationality !== undefined) await this.nationalityInput.fill(nationality);
    if (dob) await this.dobInput.fill(dob);
    if (gender) await this.openDropdownAndPick(this.genderField, gender);
    if (department) await this.selectFieldByLabel(this.departmentField, department, { exact: false });
    if (designation) await this.selectFieldByLabel(this.designationField, designation, { exact: false });
    if (passportNumber !== undefined) await this.passportNumberInput.fill(passportNumber);
    if (labourContractNo !== undefined) await this.labourContractNoInput.fill(labourContractNo);
    if (labourId !== undefined) await this.labourIdInput.fill(labourId);
    if (location) await this.selectFieldByLabel(this.locationField, location, { exact: false });

    if (canLoginPortal) {
      const isChecked = await this.canLoginPortalCheckbox.isChecked();
      if (!isChecked) await this.canLoginPortalCheckbox.click();
      if (role) await this.selectFieldByLabel(this.roleField, role, { exact: false });
    }
  }

  // CONFIRMED from source (erpforce-hrms-fe/src/views/employee-management/form/contract-details.tsx
  // lines ~437-446): Employment Type here is a STATIC DynamicSearchSelect with exactly two options,
  // `["Limited", "Unlimited"]` (matching config/testData.js's employeeContract.employmentTypeOptions)
  // - "Full Time" was never a real option and would have made every caller of the default value
  // fail at the dropdown-option lookup.
  async fillContractDetails({
    employmentType = 'Unlimited',
    country = 'United Arab Emirates',
    timezone = null,
    noticePeriod,
    probationPeriod,
    workingDays = '5',
    workingHours = '8',
    contractStartDate,
    contractEndDate,
    effectiveFromDate,
    salaryStructure,
    ctc,
    leavePolicy,
    accruals
  }) {
    if (employmentType) await this.openDropdownAndPick(this.employmentTypeField, employmentType);
    if (country) await this.selectFieldByLabel(this.countryField, country, { exact: false });
    if (timezone) await this.selectFieldByLabel(this.timezoneField, timezone, { exact: false });
    if (noticePeriod !== undefined) await this.noticePeriodInput.fill(String(noticePeriod));
    if (probationPeriod !== undefined) await this.probationPeriodInput.fill(String(probationPeriod));
    if (workingDays !== undefined) await this.workingDaysInput.fill(String(workingDays));
    if (workingHours !== undefined) await this.workingHoursInput.fill(String(workingHours));
    if (contractStartDate) await this.contractStartDateInput.fill(contractStartDate);
    if (contractEndDate) await this.contractEndDateInput.fill(contractEndDate);
    if (effectiveFromDate) await this.effectiveFromDateInput.fill(effectiveFromDate);

    if (salaryStructure) {
      await this.selectFieldByLabel(this.salaryStructureField, salaryStructure, { exact: false });
    }
    if (ctc !== undefined) {
      await this.ctcInput.fill(String(ctc));
    }
    if (leavePolicy) {
      await this.selectFieldByLabel(this.leavePolicyField, leavePolicy, { exact: false });
    }
    if (accruals) {
      await this.selectFieldByLabel(this.accrualField, accruals, { exact: false });
    }
  }

  // ---------- Department: select "QA" if it exists, else create a fresh one ----------
  // CONFIRMED LIVE (diag script dump of this account's real, unfiltered Department option list for
  // Employee Master's Add form - 28 options, no scroll/typing loads any more, no "QA" among them):
  // "QA" does NOT exist in THIS module's Department dropdown, even though config/testData.js pins
  // "QA" as a live-verified value reused by Leave Policy Master/Salary Structure Master - those
  // modules apparently see a different/larger slice of the same department master data, or "QA" has
  // since been renamed/removed. A plain `selectFieldByLabel(departmentField, 'QA', {exact:false})`
  // is NOT safe here: it falls back to a SUBSTRING match when no exact option is found, and this
  // account's cumulative dataset already contains department names whose random uniqueName() suffix
  // can itself case-insensitively contain "qa" (e.g. "..._SqAb" contains "qA") - confirmed live this
  // silently selects the WRONG department. This method checks the real rendered option list for an
  // EXACT "QA" match first and only falls back to creating a brand-new Department if genuinely absent.
  async selectOrCreateDepartment(preferredName, companyName) {
    const combobox = this.dependentFieldCombobox(this.departmentField);
    await combobox.click();
    await this.page.waitForTimeout(400);

    const options = await this.page.getByRole('listbox').getByRole('option').allTextContents();
    const clean = (s) => (s || '').replace(/[​﻿]/g, '').trim();
    const hasExact = options.some((o) => clean(o) === preferredName);

    if (hasExact) {
      await this.selectOptionFromListbox(preferredName, { timeout: 5000 });
      return { name: preferredName, created: false };
    }

    // Not present - create a fresh one via the footer link instead. Deliberately leave this
    // popover open rather than pressing Escape first: createDepartmentFromFooter detects an
    // already-open listbox and clicks straight through to the footer link (CONFIRMED LIVE this
    // combobox's own "Search Department" popover doesn't reliably close on Escape while its
    // search input has focus, which previously hung the very next click on this same combobox).
    const testDataFactory = require('../config/testDataFactory');
    const newName = testDataFactory.uniqueName('Automation_Department');
    const newCode = 'DPT-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    await this.createDepartmentFromFooter(newName, newCode, companyName, { combobox });
    return { name: newName, created: true };
  }

  // Structural label lookup used by selectOrCreateDepartment/selectFieldByLabel-style callers that
  // need the raw combobox locator itself (e.g. to pass into createDepartmentFromFooter without a
  // second, redundant label lookup).
  dependentFieldCombobox(labelText) {
    const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`, 'i');
    return this.page
      .getByRole('main')
      .getByText(labelRegex)
      .first()
      .locator('xpath=..')
      .getByRole('combobox')
      .first();
  }

  // ---------- Designation: ALWAYS create a brand-new one (never select/reuse) ----------
  // Per explicit product/test requirement: every run must create its own fresh Designation via the
  // combobox's own "Create New Designation" footer action, mirroring BasePage.createLocationFromFooter's
  // structure, rather than selecting whatever already renders. CONFIRMED LIVE + from source
  // (erpforce-hrms-fe basic-details.tsx: Designation is a DynamicDependentField with
  // `filterFields={FIELDS.DEPARTMENT.fieldName}`) - Designation is DISABLED and has NO real options
  // until Department is already filled, so `departmentName` must be a value that's already selected
  // in the outer form before calling this. CONFIRMED LIVE (designation-add-modal.tsx,
  // erpforce-common-hub-fe): the quick-create dialog requires Company AND Department itself (its own
  // independent fields, NOT pre-filled from the parent form's own selection) - Designation Code,
  // Reports To, Level (disabled), Status, Description are all optional/skippable. Same
  // not-auto-selected bug as Location/Department - manually reselect from the reopened listbox after
  // Save.
  async createDesignationFromFooter(designationName, designationCode, companyName, departmentName) {
    const combobox = this.dependentFieldCombobox(this.designationField);
    await this.page.keyboard.press('Escape').catch(() => {});
    await combobox.click();
    await this.page.getByText('Create New Designation', { exact: false }).click();

    const dialog = this.page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });

    await this.selectFieldByLabel('Company', companyName, { exact: false, scope: dialog });
    await this.selectFieldByLabel('Department', departmentName, { exact: false, scope: dialog });
    await dialog.getByPlaceholder('Enter Designation Code').fill(designationCode);
    await dialog.getByPlaceholder('Enter Designation Name').fill(designationName);

    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });

    await this.page.locator('body').click({ position: { x: 300, y: 10 }, force: true }).catch(() => {});
    await this.page
      .locator('.MuiPopover-root, .MuiMenu-root')
      .first()
      .waitFor({ state: 'hidden', timeout: 3000 })
      .catch(() => {});

    await this.page.keyboard.press('Escape').catch(() => {});
    await combobox.click();
    const found = await this.selectOptionFromListbox(designationName, { timeout: 7000 });
    if (!found) {
      throw new Error(
        `createDesignationFromFooter("${designationName}"): created but never appeared selectable in the dropdown.`
      );
    }
  }

  // ---------- Salary Structure: pick the first USABLE option and capture its real min/max CTC range ----------
  // This account's Salary Structure master data has no stable/pinnable option text (same caution as
  // config/testData.js's salaryStructureMaster.valid.grade). The live cross-field CTC-range yup rule
  // (validation.ts's 'ctc-range' test) is driven by `min_salary`/`max_salary` on the fetched
  // salary-structure-master record (contract-details.tsx's own `getSelectedData` callback) - reading
  // that same network response directly is far more deterministic than guessing a CTC value and
  // retrying against a parsed error string. CONFIRMED LIVE: this account's very first Salary
  // Structure option (by whatever default sort order the combobox renders) can itself have
  // min_salary/max_salary both 0 (a Draft/incomplete record) - the literal first option is NOT
  // always usable, so this walks the real option list until it finds one with an actual max > min
  // > 0 range, instead of assuming index 0 works.
  async selectFirstSalaryStructureAndGetRange() {
    const combobox = this.dependentFieldCombobox(this.salaryStructureField);
    const optionLocator = this.page
      .getByRole('listbox')
      .getByRole('option')
      .filter({ hasNot: this.page.locator('input') })
      .filter({ hasNotText: /Select|No data available|Create New/ });

    await combobox.click().catch(() => {});
    await optionLocator.first().waitFor({ state: 'visible', timeout: 7000 });
    const count = Math.min(await optionLocator.count(), 10);

    for (let i = 0; i < count; i++) {
      if (i > 0) {
        await combobox.click();
        await optionLocator.first().waitFor({ state: 'visible', timeout: 7000 });
      }
      const optionText = (await optionLocator.nth(i).innerText()).trim();
      const responsePromise = this.page
        .waitForResponse((res) => /\/v1\/salary-structure-master\/\d+/.test(res.url()) && res.request().method() === 'GET', {
          timeout: 10000,
        })
        .catch(() => null);
      await optionLocator.nth(i).click();
      const response = await responsePromise;
      if (!response) continue;
      const json = await response.json().catch(() => ({}));
      const data = json?.data?.salary_structure_master || {};
      const min = Number(data.min_salary);
      const max = Number(data.max_salary);
      if (Number.isFinite(min) && Number.isFinite(max) && max > min && max > 0) {
        return { min, max, name: optionText };
      }
    }
    throw new Error(
      'selectFirstSalaryStructureAndGetRange: no Salary Structure option in this account has a usable (max > min > 0) CTC range.'
    );
  }

  // Waits for the real `/v1/salary-structure-master/calculate` response (confirmed endpoint in
  // erpforce-hrms-fe's api.hrms/api.ts) rather than a fixed timeout - handleCalculate populates
  // Basic Allowance/Gross Allowance/etc. asynchronously from this response via setValue(), so a
  // bare click + short sleep can read those fields before the real value ever lands.
  async clickCalculateSalary() {
    const responsePromise = this.page
      .waitForResponse((res) => /\/v1\/salary-structure-master\/calculate/.test(res.url()) && res.request().method() === 'POST', {
        timeout: 15000,
      })
      .catch(() => null);
    await this.calculateSalaryButton.click();
    await responsePromise;
    await this.page.waitForTimeout(500);
  }

  // The Accrual "Calculate" button (contract-details.tsx's `disableAccuralCalculate`) only enables
  // once the selected Salary Structure's own components include ones literally named "Basic"/
  // "Basic Allowance" AND "Gross"/"Gross Allowance" with values populated by clickCalculateSalary()
  // above, PLUS at least one Accrual already selected - a real, live-data-dependent condition this
  // account's first-available Salary Structure is not guaranteed to satisfy. Wait for it to become
  // enabled rather than assuming it always will; if it never does within a real user's patience
  // window, that's a genuine data-shape gap (missing Basic/Gross Allowance components on this
  // structure), not a locator bug, so surface it distinctly instead of failing on a bare click.
  async clickCalculateAccrual({ timeout = 8000 } = {}) {
    try {
      await expect(this.calculateAccrualButton).toBeEnabled({ timeout });
    } catch (e) {
      return { clicked: false, reason: 'Accrual Calculate never became enabled within timeout - selected Salary Structure likely has no Basic/Gross Allowance components.' };
    }
    await this.calculateAccrualButton.click();
    await this.page.waitForTimeout(800);
    return { clicked: true };
  }

  // CONFIRMED LIVE: a plain label-text lookup for "Leave Policy" is ambiguous on THIS tab - the
  // Leave Policy ACCORDION's own section title (SECTION_TITLES.LEAVE_POLICY) renders the exact same
  // string "Leave Policy" as the field's own label, so `getByText(/^Leave Policy$/).first()` matches
  // the accordion title (which has no combobox as a structural sibling), not the field - the generic
  // BasePage.selectFirstOptionByLabel/selectFieldByLabel helpers silently fail here as a result.
  // The field's own accessible name has no such collision, so resolve the combobox by accessible
  // name instead - CONFIRMED LIVE (error-context.md accessibility snapshot) the real rendered name
  // is "Search Leave Policy", NOT "Select Leave Policy" (this field is `is_multiselect`, and this
  // account's multiselect DynamicSearchSelect fields render a "Search {label}" placeholder rather
  // than "Select {label}" - Accrual, the sibling multiselect field, shows "Search Accrual" the same
  // way).
  async selectFirstLeavePolicy() {
    const combobox = this.page.getByRole('combobox', { name: 'Search Leave Policy' }).first();
    await this.selectFirstAvailableMultiselectOption(combobox);
  }

  // Mirrors the already-proven multiselect pattern used elsewhere in this suite (see
  // LoanConfigurationPage.selectFirstMultiSelectOption / AccrualsAndBenefitPage
  // .selectMultiSelectOptionByText): a single click on the `<li role="option">` row itself IS
  // sufficient to toggle its embedded MUI checkbox - do NOT also click the nested checkbox
  // `<input>` afterwards (an earlier version of this method did exactly that as a "fallback",
  // which actually double-toggles the SAME option off again when the first click already worked,
  // silently leaving the field empty). Close via Escape first (works for LoanConfiguration's
  // fields), falling back to a click-away from the page body only if the popover is still open,
  // exactly like LoanConfigurationPage's own fallback.
  async selectFirstAvailableMultiselectOption(combobox) {
    await combobox.click().catch(() => {});
    const listbox = this.page.getByRole('listbox');
    const firstOption = listbox
      .getByRole('option')
      .filter({ hasNot: this.page.getByRole('textbox') })
      .filter({ hasNotText: /Select|No data available|Create New/ })
      .first();
    await firstOption.waitFor({ state: 'visible', timeout: 7000 });
    await firstOption.click();

    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(500);

    const stillOpen = await listbox.first().isVisible().catch(() => false);
    if (stillOpen) {
      await this.page.locator('body').click({ position: { x: 10, y: 10 }, force: true }).catch(() => {});
      await listbox.first().waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    }
  }

  async selectFirstAccrual() {
    const combobox = this.dependentFieldCombobox(this.accrualField);
    await this.selectFirstAvailableMultiselectOption(combobox);
  }

  // Leave Policy's "Allocated" days input auto-fills from the selected policy's own
  // `annualEntitlement` default (contract-details.tsx) the instant a policy is selected - but the
  // Yup schema requires each allocated value to be >= 1, and a policy whose default entitlement is
  // 0 would otherwise silently block Save. Defensively top up any 0/empty allocated input to "1"
  // after selecting a policy.
  async ensureLeaveAllocationsAreValid() {
    const allocatedInputs = this.page.locator('input[name*="leaves"][name*="allocated" i]');
    const count = await allocatedInputs.count();
    for (let i = 0; i < count; i++) {
      const input = allocatedInputs.nth(i);
      const value = await input.inputValue().catch(() => '');
      if (!value || Number(value) < 1) {
        await input.fill('1');
      }
    }
  }

  async nextTab() {
    await this.nextButton.click();
    await this.page.waitForTimeout(300);
  }

  async save() {
    const responsePromise = this.page.waitForResponse(
      (res) => (res.url().includes('/v1/employee') || res.url().includes('/hrms/v1/employee')) && (res.request().method() === 'POST' || res.request().method() === 'PUT'),
      { timeout: 15000 }
    );
    await this.saveButton.click();
    const response = await responsePromise;
    const json = await response.json();
    return {
      status: response.status(),
      id: json?.data?.employee?.id || json?.data?.id,
      seriesNumber: json?.data?.employee?.series_number || json?.data?.series_number,
    };
  }

  async saveAsDraft() {
    const responsePromise = this.page.waitForResponse(
      (res) => res.url().includes('save-as-draft') && (res.request().method() === 'POST' || res.request().method() === 'PATCH'),
      { timeout: 15000 }
    );
    await this.saveAsDraftButton.click();
    const response = await responsePromise;
    const json = await response.json();
    return {
      status: response.status(),
      id: json?.data?.employee?.id || json?.data?.id,
    };
  }

  async deleteRecord(seriesNumber) {
    await this.searchList(seriesNumber);
    const row = this.page.locator('tr', { hasText: seriesNumber }).first();
    await row.locator('button').last().click(); // Open Action Menu
    await this.page.getByRole('menuitem', { name: /Delete/i }).click();
    await this.confirmDeleteButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async getRowStatus(seriesNumber) {
    const row = this.page.locator('tr', { hasText: seriesNumber }).first();
    return await row.locator('.MuiChip-root').innerText();
  }
}

module.exports = EmployeeMasterPage;
