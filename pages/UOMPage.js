class UOMPage {
  constructor(page) {
    this.page = page;

    // Main form
    this.unitNameInput = page.locator('input[name="add_uom.name"]');
    this.symbolInput = page.locator('input[name="add_uom.symbol"]');
    this.descriptionInput = page.locator('input[name="add_uom.description"]');
    this.addEntryButton = page.locator('button:has-text("Add")');
    this.saveButton = page.locator('button[type="submit"]:has-text("Save")');

    // Entry dialog — use name-based selectors to avoid strict-mode collision with main form
    this.dialogUomNameInput = page.locator('input[placeholder="Enter Unit of measure"]');
    this.dialogSymbolInput = page.locator('input[name="uom_item.symbol"]');
    this.dialogIsBaseUnit = page.locator('input[type="checkbox"]').last();
    this.dialogConvFactor = page.locator('input[placeholder="Enter Conversation Factor"]');
    this.dialogSaveButton = page.locator('dialog button:has-text("Save"), [role="dialog"] button:has-text("Save")');
    this.dialogCancelButton = page.locator('dialog button:has-text("Cancel"), [role="dialog"] button:has-text("Cancel")');

    // Feedback
    this.successToast = page.locator('[class*="success"], [class*="toast"]').first();
    this.errorToast = page.locator('[class*="error"], [class*="alert"], [class*="toast"]').first();
  }

  async goto() {
    // CONFIRMED LIVE: same stuck-on-its-own-bare-loading-spinner class of bug as
    // LocationPage.gotoList()/BinPage.gotoList()/DiscountedItemPage.gotoList() - a single
    // load-state wait can hang well past a generous timeout on a cold first load, and only a
    // reload recovers it. Retry with a reload instead of trusting one wait.
    await this.page.goto('/dashboard/inventory/configuration/uom/add-UOM', { timeout: 60000 });
    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      try {
        await this.unitNameInput.waitFor({ state: 'visible', timeout: 15000 });
        return;
      } catch (e) {
        if (attempt === 3) throw e;
        await this.page.reload({ timeout: 60000 }).catch(() => {});
      }
    }
  }

  async gotoList() {
    await this.page.goto('/dashboard/inventory/configuration/uom');
    await this.page.waitForLoadState('load');
  }

  async fillForm({ unitName, symbol, description }) {
    if (unitName !== undefined) await this.unitNameInput.fill(unitName);
    if (symbol !== undefined) await this.symbolInput.fill(symbol);
    if (description !== undefined) await this.descriptionInput.fill(description);
  }

  async openAddEntryDialog() {
    await this.addEntryButton.click();
    await this.page.waitForSelector('text=Add Item');
  }

  async fillEntryDialog({ uomName, symbol, isBaseUnit = false }) {
    if (uomName !== undefined) await this.dialogUomNameInput.fill(uomName);
    if (symbol !== undefined) await this.dialogSymbolInput.fill(symbol);

    if (isBaseUnit) {
      const checked = await this.dialogIsBaseUnit.isChecked();
      if (!checked) await this.dialogIsBaseUnit.click();
    }
  }

  async saveEntryDialog() {
    await this.dialogSaveButton.click();
    await this.page.waitForTimeout(500);
  }

  async cancelEntryDialog() {
    await this.dialogCancelButton.click();
  }

  async addEntry(entryData) {
    await this.openAddEntryDialog();
    await this.fillEntryDialog(entryData);
    await this.saveEntryDialog();
  }

  async save() {
    await this.saveButton.click();
  }

  async createUOM(uomData) {
    await this.goto();
    await this.fillForm(uomData);
    if (uomData.entry) {
      await this.addEntry(uomData.entry);
    }
    await this.save();
  }

  async isDialogOpen() {
    return this.page.locator('text=Add Item').isVisible();
  }
}

module.exports = UOMPage;
