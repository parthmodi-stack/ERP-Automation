class ItemCategoryPage {
  constructor(page) {
    this.page = page;

    this.categoryNameInput = page.locator('input[name="add_item_category.category_name"]');
    this.descriptionInput  = page.locator('input[name="add_item_category.description"]');
    this.skuPrefixInput    = page.locator('input[name="add_item_category.sku_prefix"]');
    this.startingSkuInput  = page.locator('input[name="add_item_category.unique_items"]');
    this.statusToggle      = page.locator('input[name="status"][type="checkbox"]');
    this.statusSwitch      = page.locator('.MuiSwitch-root');

    this.addButton           = page.getByRole('button', { name: 'Add' }).first();
    this.saveButton          = page.getByRole('button', { name: 'Save' });
    this.actionsButton       = page.getByRole('button', { name: 'Actions' });
    this.editMenuItem        = page.getByRole('menuitem', { name: 'Edit' });
    this.duplicateMenuItem   = page.getByRole('menuitem', { name: 'Duplicate' });
    this.deleteMenuItem      = page.getByRole('menuitem', { name: 'Delete' });
    this.confirmDeleteButton = page.getByRole('dialog').getByRole('button', { name: 'Delete' });

    this.categoryNameError = page.getByText('Category name is required');
  }

  async gotoList() {
    await this.page.goto('/dashboard/inventory/product-management/item-category');
    await this.page.waitForLoadState('networkidle');
  }

  async openAdd() {
    await this.gotoList();
    await this.addButton.click();
    await this.page.waitForURL('**/add-item-category');
    await this.page.waitForLoadState('networkidle');
  }

  async openView(name) {
    await this.gotoList();
    await this.page.getByRole('link', { name, exact: true }).first().click();
    await this.page.waitForURL('**/view-item-category');
    await this.page.waitForLoadState('networkidle');
  }

  async openEdit(name) {
    await this.gotoList();
    await this.page.getByRole('link', { name, exact: true }).first().click();
    await this.page.waitForURL('**/view-item-category');
    await this.page.waitForLoadState('networkidle');
    await this.page.getByRole('button', { name: 'Edit' }).click();
    await this.page.waitForURL('**/edit-item-category');
    await this.page.waitForLoadState('networkidle');
  }

  async fillForm({ name, description, skuPrefix, startingSku }) {
    if (name !== undefined)        await this.categoryNameInput.fill(name);
    if (description !== undefined) await this.descriptionInput.fill(description);
    if (skuPrefix !== undefined)   await this.skuPrefixInput.fill(skuPrefix);
    if (startingSku !== undefined) await this.startingSkuInput.fill(String(startingSku));
  }

  async addAttribute(attributeName) {
    await this.page.locator('.attributeForm--FieldContainer button:has-text("Attribute")').click();
    const popover = this.page.locator('.MuiPopover-paper').last();
    await popover.waitFor({ state: 'visible', timeout: 5000 });
    await this.page.getByPlaceholder('Search Attribute').fill(attributeName);
    await this.page.waitForTimeout(500);
    await popover.locator(`li.MuiMenuItem-root:has-text("${attributeName}")`).first().click();
  }

  async toggleStatus() {
    await this.statusSwitch.click();
  }

  async save() {
    await this.saveButton.click();
  }
}

module.exports = ItemCategoryPage;
