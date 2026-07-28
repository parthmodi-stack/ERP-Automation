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
    this.companyField = 'Company';
    this.departmentField = 'Department';
    this.designationField = 'Designation/Grade';
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
    this.accrualField = 'Accruals & Benefits';

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

  async searchList(query) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500); // debounce Settle
    await this.page.waitForLoadState('networkidle');
  }

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

  async fillContractDetails({
    employmentType = 'Full Time',
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
