const BasePage = require('./BasePage');

class DesignationMasterPage extends BasePage {
  constructor(page) {
    super(page);

    this.codeInput = page.getByPlaceholder('Enter Designation Code');
    this.nameInput = page.getByPlaceholder('Enter Designation Name');
    this.departmentInput = page.getByPlaceholder('Search Department');
    this.levelInput = page.getByPlaceholder('Enter Level');
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
    this.departmentRequiredError = page.getByText('Department is required');
    this.nameRequiredError = page.getByText('Designation Name is required');
    this.levelRequiredError = page.getByText('Level is required');
    this.duplicateCodeError = page.locator('text=Designation code already exists.');
  }

  async gotoList() {
    await this.page.goto('/dashboard/hrms/organisation/designation-master');
    await this.page.waitForLoadState('networkidle');
  }

  async goto() {
    await this.gotoList();
    await this.addButton.click();
    await this.page.waitForURL('**/add-designation-master');
    await this.page.waitForLoadState('networkidle');
  }

  async fillForm(data) {
    const companyVal = data.company || 'erp-force';
    await this.selectFieldByLabel('Company', companyVal, { exact: false });

    if (data.department) {
      await this.selectFieldByLabel('Department', data.department, { exact: false });
    } else {
      await this.selectFirstOptionByLabel('Department');
    }
    if (data.designationCode !== undefined) {
      await this.codeInput.fill(data.designationCode);
    }
    if (data.designationName !== undefined) {
      await this.nameInput.fill(data.designationName);
    }
    // if (data.reportsTo) {
    //   await this.selectFieldByLabel('Reports To', data.reportsTo, { exact: false });
    // }

    if (data.description !== undefined) {
      await this.descriptionInput.fill(data.description);
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
    await this.page.waitForURL('**/view-designation-master');
    await this.page.waitForLoadState('networkidle');
    await this.actionsButton.click();
    await this.editMenuItem.waitFor({ state: 'visible' });
    await this.editMenuItem.click();
    await this.page.waitForURL('**/edit-designation-master');
    await this.page.waitForLoadState('networkidle');
  }

  async createDesignation(data) {
    await this.goto();
    await this.fillForm(data);
    await this.save();
  }
}

module.exports = DesignationMasterPage;
