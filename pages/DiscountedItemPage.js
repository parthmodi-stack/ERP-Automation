class DiscountedItemPage {
  constructor(page) {
    this.page = page;

    this.skuInput          = page.locator('input[name="add_discounted_items.sku_number"]');
    this.nameInput         = page.locator('input[name="add_discounted_items.name"]');
    this.discountRateInput = page.locator('input[name="add_discounted_items.discount_rate_amount"]');
    this.descriptionInput  = page.locator('textarea[name="add_discounted_items.description"]');
    this.statusToggle      = page.locator('input[name="status"][type="checkbox"]');

    this.addButton  = page.getByRole('button', { name: 'Add' }).first();
    this.saveButton = page.getByRole('button', { name: 'Save' });

    this.skuError          = page.getByText('SKU/Number is required');
    this.nameError         = page.getByText('Name is required');
    this.discountTypeError = page.getByText('Discount type is required');
    this.accountError      = page.getByText('Account is required');
    this.discountCatError  = page.getByText('Discount Category is required');
    this.discountRateError = page.getByText('Discount Rate/Amount is required');
  }

  async gotoList() {
    await this.page.goto('/dashboard/inventory/product-management/discounted-item');
    await this.page.waitForLoadState('networkidle');
  }

  async openAdd() {
    await this.gotoList();
    await this.addButton.click();
    await this.page.waitForURL('**/add-discounted-items');
    await this.page.waitForLoadState('networkidle');
  }

  async selectDiscountType(displayText) {
    const select = this.page.locator('[id="mui-component-select-add_discounted_items.discount_type"]');
    await select.click();
    const listbox = this.page.getByRole('listbox');
    await listbox.waitFor({ state: 'visible', timeout: 5000 });
    await listbox.getByRole('option', { name: displayText }).click();
  }

  async selectAccount(searchText) {
    await this.page.locator('[id="mui-component-select-add_discounted_items.account_id"]').click();
    const menu = this.page.locator('[id="menu-add_discounted_items.account_id"]');
    await menu.waitFor({ state: 'visible', timeout: 5000 });
    await menu.locator('input').fill(searchText);
    await this.page.waitForTimeout(500);
    await menu.locator(`li:has-text("${searchText}")`).first().click();
    await menu.waitFor({ state: 'hidden', timeout: 5000 });
  }

  async selectDiscountCategory(displayText) {
    const select = this.page.locator('[id="mui-component-select-add_discounted_items.discount_category"]');
    await select.click();
    const listbox = this.page.getByRole('listbox');
    await listbox.waitFor({ state: 'visible', timeout: 5000 });
    await listbox.getByRole('option', { name: displayText }).click();
  }

  async save() {
    await this.saveButton.click();
  }
}

module.exports = DiscountedItemPage;
