const BasePage = require('./BasePage');

class DepartmentMasterPage extends BasePage {
  constructor(page) {
    super(page);

    this.codeInput = page.getByPlaceholder('Enter Department Code');
    this.nameInput = page.getByPlaceholder('Enter Department Name');
    // this.noOfTeamsInput = page.getByPlaceholder('Enter No. of Teams');
    // this.noOfSubDepartmentsInput = page.getByPlaceholder('Enter No. of Sub Departments');
    this.descriptionInput = page.getByPlaceholder('Enter Description');
    // ID is server-generated and rendered disabled with this placeholder (form.tsx: DynamicInput
    // for FIELDS.ID has `disabled` + placeholder='Auto-generated').
    this.idField = page.getByPlaceholder('Auto-generated');

    this.addButton = page.getByRole('button', { name: 'Add' }).first();
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    // saveAsDraftButton dispatches saveDepartmentAsDraft (postV1DepartmentsDraft) - confirmed in
    // add-department.hrms.tsx to bypass methods.trigger() validation entirely, unlike Save.
    this.saveAsDraftButton = page.getByRole('button', { name: 'Save as Draft' });
    this.actionsButton = page.getByRole('button', { name: 'Actions' });
    this.editMenuItem = page.getByRole('menuitem', { name: 'Edit' });
    this.duplicateMenuItem = page.getByRole('menuitem', { name: 'Duplicate' });
    this.deleteMenuItem = page.getByRole('menuitem', { name: 'Delete' });
    this.confirmDeleteButton = page.getByRole('button', { name: 'Delete' }).last();
    this.cancelDeleteButton = page.getByRole('button', { name: 'Cancel' });
    this.discardButton = page.getByRole('button', { name: 'Discard' });
    // Company auto-populates with the logged-in user's default company shortly after the Add
    // form loads (confirmed live via ARIA snapshot: combobox goes "Loading..." -> "erp-force"
    // with this "clear selection" button appearing next to it) - to test the required rule you
    // must actively clear it, not just skip selecting a value.
    this.clearCompanyButton = page.getByRole('button', { name: 'clear selection' }).first();

    this.statusToggle = page.locator('input[name="status"]');
    this.statusSwitch = page.locator('.MuiSwitch-root');

    // Validation errors
    this.codeRequiredError = page.getByText('Department Code is required');
    this.nameRequiredError = page.getByText('Department Name is required');
    this.duplicateCodeError = page.locator('text=Department code already exists.');
    // Exact translated string is fetched at runtime (not bundled), so this is a loose match on
    // the confirmed Yup rule (company_id: required + typeError) rather than a hardcoded string.
    this.companyRequiredError = page.getByText(/compan.*required/i);
  }

  async gotoList() {
    await this.page.goto('/dashboard/hrms/organisation/department-master');
    await this.waitForNetworkIdle();
  }

  async goto() {
    await this.gotoList();
    await this.addButton.click();
    await this.page.waitForURL('**/add-department-master');
    await this.waitForNetworkIdle();
  }

  async fillForm(data) {
    // `company: null` (explicit) means "actively clear the auto-populated Company" - for the
    // Company-required validation case. `company: undefined` (the default for every other
    // caller) leaves the auto-populated 'erp-force' default in place unless overridden.
    if (data.company === null) {
      await this.page.getByRole('combobox', { name: 'erp-force' }).waitFor({ timeout: 10000 });
      await this.clearCompanyButton.click();
    } else {
      const companyVal = data.company || 'erp-force';
      await this.selectFieldByLabel('Company', companyVal, { exact: false });
    }

    if (data.departmentCode !== undefined) {
      await this.codeInput.fill(data.departmentCode);
    }
    if (data.departmentName !== undefined) {
      await this.nameInput.fill(data.departmentName);
    }
    // if (data.noOfTeams !== undefined) {
    //   await this.noOfTeamsInput.fill(data.noOfTeams);
    // }
    // if (data.noOfSubDepartments !== undefined) {
    //   await this.noOfSubDepartmentsInput.fill(data.noOfSubDepartments);
    // }
    if (data.description !== undefined) {
      await this.descriptionInput.fill(data.description);
    }
    if (data.parentDepartment) {
      // The dropdown is not searchable/filterable, and accumulating test data from previous runs
      // pushes static options like "Debug Department" out of the default first page.
      // We select the first available option instead.
      await this.selectFirstOptionByLabel('Parent Department');
    }
  }

  async toggleStatus() {
    await this.statusSwitch.click();
  }

  async save() {
    await this.saveButton.click();
  }

  async saveAsDraft() {
    await this.saveAsDraftButton.click();
  }

  // List row status badge - matched by Department Code/Name (this module's row-unique text,
  // same role BasePage.getRowStatusMatching's `seriesNumber` param plays in other modules).
  async getRowStatus(codeOrName) {
    return this.getRowStatusMatching(codeOrName, /Draft|Active|Inactive/);
  }

  async openView(codeOrName) {
    await this.gotoList();
    await this.page.getByText(codeOrName, { exact: true }).first().click();
    await this.page.waitForURL('**/view-department-master');
    await this.waitForNetworkIdle();
  }

  async openEdit(code) {
    await this.openView(code);
    await this.actionsButton.click();
    await this.editMenuItem.waitFor({ state: 'visible' });
    await this.editMenuItem.click();
    await this.page.waitForURL('**/edit-department-master');
    await this.waitForNetworkIdle();
  }

  // View page's own status Chip - class is literally
  // `viewDepartmentEntry--StatusChip viewDepartmentEntry--StatusChip--{Draft|Active|Inactive}`
  // (view-department.hrms.tsx), distinct from the list row's `departmentMaster--StatusChip--*`.
  viewStatusBadge() {
    return this.page.locator('[class*="viewDepartmentEntry--StatusChip--"]').first();
  }

  // Delete via the View page's Actions menu (view-department.hrms.tsx: no successMessage is
  // wired to this delete handler, so no success toast fires - only assert removal + redirect.
  async deleteFromView(codeOrName) {
    await this.openView(codeOrName);
    await this.actionsButton.click();
    await this.deleteMenuItem.waitFor({ state: 'visible' });
    await this.deleteMenuItem.click();
    await this.confirmDeleteButton.click();
    await this.page.waitForURL('**/department-master');
    await this.waitForNetworkIdle();
  }

  async createDepartment(data) {
    await this.goto();
    await this.fillForm(data);
    await this.save();
    // Save doesn't redirect immediately on networkidle alone (confirmed live: the client-side
    // navigate() back to the list lags the request settling) - wait for the actual redirect,
    // same as the existing Add flow in the spec does manually after dept.save().
    await this.page.waitForURL('**/organisation/department-master');
    await this.waitForNetworkIdle();
  }
}

module.exports = DepartmentMasterPage;
