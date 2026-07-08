class AttributePage {
  constructor(page) {
    this.page = page;

    this.attributeNameInput = page.getByPlaceholder('Enter Attribute Name');
    this.fieldTypeDropdown  = page.getByRole('combobox', { name: 'Search Field type' });
    this.addButton          = page.getByRole('button', { name: 'Add' }).first();
    this.addValueRowButton  = page.getByRole('button', { name: 'Add' }).last();
    this.saveButton         = page.getByRole('button', { name: 'Save' });
    this.actionsButton      = page.getByRole('button', { name: 'Actions' });
    this.editMenuItem       = page.getByRole('menuitem', { name: 'Edit' });
    this.duplicateMenuItem   = page.getByRole('menuitem', { name: 'Duplicate' });
    this.deleteMenuItem      = page.getByRole('menuitem', { name: 'Delete' });
    this.confirmDeleteButton = page.getByRole('button', { name: 'Delete' }).last();
    this.statusToggle       = page.locator('input[name="status"]');
    this.statusSwitch       = page.locator('.MuiSwitch-root');
    this.duplicateNameError = page.locator('text=Attribute name already exists');
    this.attributeNameLabel = page.getByText('Attribute Name *');
    this.fieldTypeLabel     = page.getByText('Field type *');
  }

  async gotoList() {
    await this.page.goto('/dashboard/inventory/configuration/attributes');
    await this.page.waitForLoadState('networkidle');
  }

  async goto() {
    await this.gotoList();
    await this.addButton.click();
    await this.page.waitForURL('**/add-attributes');
    await this.page.waitForLoadState('networkidle');
    await this.attributeNameInput.waitFor({ state: 'visible', timeout: 15000 });
  }

  async openEdit(name) {
    await this.gotoList();
    await this.page.getByRole('link', { name, exact: true }).first().click();
    await this.page.waitForURL('**/view-attributes');
    await this.page.waitForLoadState('networkidle');
    await this.actionsButton.click();
    await this.editMenuItem.waitFor({ state: 'visible' });
    await this.editMenuItem.click();
    await this.page.waitForURL('**/edit-attributes');
    await this.page.waitForLoadState('networkidle');
  }

  async fillAttributeName(name) {
    await this.attributeNameInput.fill(name);
  }

  async selectFieldType(typeName) {
    await this.fieldTypeDropdown.click();
    await this.page.getByRole('option', { name: typeName, exact: true }).click();
  }

  getValueInput(index) {
    return this.page.getByPlaceholder('Enter value').nth(index);
  }

  async fillValue(index, value) {
    await this.getValueInput(index).fill(value);
  }

  async addValueRow() {
    await this.addValueRowButton.click();
  }

  async deleteValueRow(index) {
    // Walk up ancestors to find the nearest container that has a direct button child (the delete icon button)
    await this.page.getByPlaceholder('Enter value').nth(index)
      .locator('xpath=ancestor::*[button][1]/button')
      .click();
  }

  async toggleStatus() {
    await this.statusSwitch.click();
  }

  async save() {
    await this.saveButton.click();
  }
}

module.exports = AttributePage;
