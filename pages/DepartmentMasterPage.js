const BasePage = require('./BasePage');

class DepartmentMasterPage extends BasePage {
  constructor(page) {
    super(page);

    this.codeInput = page.getByPlaceholder('Enter Department Code');
    this.nameInput = page.getByPlaceholder('Enter Department Name');
    // this.noOfTeamsInput = page.getByPlaceholder('Enter No. of Teams');
    // this.noOfSubDepartmentsInput = page.getByPlaceholder('Enter No. of Sub Departments');
    this.descriptionInput = page.getByPlaceholder('Enter Description');

    this.addButton = page.getByRole('button', { name: 'Add' }).first();
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.actionsButton = page.getByRole('button', { name: 'Actions' });
    this.editMenuItem = page.getByRole('menuitem', { name: 'Edit' });
    this.duplicateMenuItem = page.getByRole('menuitem', { name: 'Duplicate' });
    this.deleteMenuItem = page.getByRole('menuitem', { name: 'Delete' });
    this.confirmDeleteButton = page.getByRole('button', { name: 'Delete' }).last();
    this.discardButton = page.getByRole('button', { name: 'Discard' });

    this.statusToggle = page.locator('input[name="status"]');
    this.statusSwitch = page.locator('.MuiSwitch-root');

    // Validation errors
    this.codeRequiredError = page.getByText('Department Code is required');
    this.nameRequiredError = page.getByText('Department Name is required');
    this.duplicateCodeError = page.locator('text=Department code already exists.');
  }

  async gotoList() {
    await this.page.goto('/dashboard/hrms/organisation/department-master');
    await this.page.waitForLoadState('networkidle');
  }

  async goto() {
    await this.gotoList();
    await this.addButton.click();
    await this.page.waitForURL('**/add-department-master');
    await this.page.waitForLoadState('networkidle');
  }

  async fillForm(data) {
    const companyVal = data.company || 'erp-force';
    await this.selectFieldByLabel('Company', companyVal, { exact: false });

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
      await this.selectFieldByLabel('Parent Department', data.parentDepartment, { exact: false });
    }
  }

  async toggleStatus() {
    await this.statusSwitch.click();
  }

  async save() {
    await this.saveButton.click();
  }

  async openEdit(code) {
    await this.gotoList();
    await this.page.getByText(code, { exact: true }).first().click();
    await this.page.waitForURL('**/view-department-master');
    await this.page.waitForLoadState('networkidle');
    await this.actionsButton.click();
    await this.editMenuItem.waitFor({ state: 'visible' });
    await this.editMenuItem.click();
    await this.page.waitForURL('**/edit-department-master');
    await this.page.waitForLoadState('networkidle');
  }

  async createDepartment(data) {
    await this.goto();
    await this.fillForm(data);
    await this.save();
  }
}

module.exports = DepartmentMasterPage;
