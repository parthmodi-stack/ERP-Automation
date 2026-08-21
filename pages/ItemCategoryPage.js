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
    // CONFIRMED LIVE: same stuck-on-its-own-bare-loading-spinner class of bug as
    // LocationPage.gotoList()/BinPage.gotoList()/DiscountedItemPage.gotoList()/UOMPage.goto() - a
    // single networkidle wait can hang well past a generous timeout on a cold first load, and only
    // a reload recovers it. Retry with a reload instead of trusting one wait, so callers of
    // addButton right after gotoList() don't time out on it.
    await this.page.goto('/dashboard/inventory/product-management/item-category', { timeout: 60000 });
    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      try {
        await this.addButton.waitFor({ state: 'visible', timeout: 30000 });
        return;
      } catch (e) {
        if (attempt === 3) throw e;
        await this.page.reload({ timeout: 60000 }).catch(() => {});
      }
    }
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

  // CONFIRMED AGAINST SOURCE (attribute-form.tsx): this menu's own list only ever shows
  // attributes that already exist server-side (`itemAttributes`, fetched once when the menu
  // opens) - it never falls back to "pick whichever renders first" the way FormParser-driven
  // dropdowns elsewhere in this suite do. A pinned name like "Iphone Variant" that was created
  // once by hand and later renamed/deleted has NO recovery path other than creating it fresh via
  // this same menu's own "+ Add New Attribute" footer item (attribute-form.tsx's
  // `canAdd && <MenuItem onClick={() => setIsOpenAttributeModal(true)}>`), which opens
  // AttributeModal (attribute-modal.tsx) inline - not a navigation, not a new tab.
  async addAttribute(attributeName) {
    await this.page.locator('.attributeForm--FieldContainer button:has-text("Attribute")').click();
    const popover = this.page.locator('.MuiPopover-paper').last();
    await popover.waitFor({ state: 'visible', timeout: 5000 });
    await this.page.getByPlaceholder('Search Attribute').fill(attributeName);
    await this.page.waitForTimeout(500);

    const option = popover.locator(`li.MuiMenuItem-root:has-text("${attributeName}")`).first();
    const found = await option.isVisible({ timeout: 3000 }).catch(() => false);
    if (!found) {
      await this.createAttributeInline(attributeName);
      // Re-open the same menu and search again now that the attribute exists server-side.
      await this.page.locator('.attributeForm--FieldContainer button:has-text("Attribute")').click();
      await popover.waitFor({ state: 'visible', timeout: 5000 });
      await this.page.getByPlaceholder('Search Attribute').fill(attributeName);
      await this.page.waitForTimeout(500);
    }
    await popover.locator(`li.MuiMenuItem-root:has-text("${attributeName}")`).first().click();
  }

  // CONFIRMED AGAINST SOURCE (attribute-modal.tsx): attribute_name/field_type carry real HTML
  // `name` attributes built from `fieldArrayName + '.' + name` (same combining convention this
  // page's own constructor already relies on for add_item_category.*), field_type defaults to
  // CONFIRMED LIVE (screenshot from an actual run): field_type's `defaultValue='Multiselect'`
  // source prop does NOT actually pre-select anything - the field renders empty with a real
  // "Field type is required" error, so it must be explicitly selected same as every other field.
  // variants_creation_mode has no default either, and its 3 options ("Instantly"/"Dynamically"/
  // "Never") are literal English strings in the component, not translation keys - "Never" avoids
  // side-effecting anything downstream. At least one Value row is required too.
  async createAttributeInline(attributeName) {
    const popover = this.page.locator('.MuiPopover-paper').last();
    await popover.getByText('Add New Attribute', { exact: false }).click();
    const dialog = this.page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 10000 });

    await dialog.locator('input[name="attribute_data.attribute_name"]').fill(attributeName);
    // Same DynamicSelect component AttributePage.selectFieldType() already drives successfully.
    await dialog.getByRole('combobox', { name: /field type/i }).click();
    await this.page.getByRole('option', { name: 'Select', exact: true }).click();
    await dialog.getByText('Never', { exact: true }).click();
    await dialog.locator('input[name="attribute_values[0].values"]').fill('Value 1');

    await Promise.all([
      this.page.waitForResponse((r) => /attribute/i.test(r.url()) && r.request().method() === 'POST'),
      dialog.getByRole('button', { name: 'Submit', exact: true }).click(),
    ]);
    await dialog.waitFor({ state: 'hidden', timeout: 10000 });
  }

  async toggleStatus() {
    await this.statusSwitch.click();
  }

  async save() {
    await this.saveButton.click();
  }
}

module.exports = ItemCategoryPage;
