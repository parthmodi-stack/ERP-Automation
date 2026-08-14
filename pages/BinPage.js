class BinPage {
  constructor(page) {
    this.page = page;

    this.nameInput = page.getByPlaceholder('Enter Name');
    this.addButton = page.getByRole('button', { name: 'Add' }).first();
    this.saveButton = page.getByRole('button', { name: 'Save' });
    this.actionsButton = page.getByRole('button', { name: 'Actions' });
    this.editMenuItem = page.getByRole('menuitem', { name: 'Edit' });
    this.duplicateMenuItem = page.getByRole('menuitem', { name: 'Duplicate' });
    this.deleteMenuItem = page.getByRole('menuitem', { name: 'Delete' });
    this.confirmDeleteButton = page.getByRole('button', { name: 'Delete' }).last();
    this.statusToggle = page.locator('input[name="status"]');
    this.statusSwitch = page.locator('.MuiSwitch-root');
    this.nameRequiredError = page.getByText('Name is required');
    this.locationRequiredError = page.getByText('Location is required');
    this.duplicateNameError = page.locator("text=body must have required property 'name'");
    this.discardButton      = page.getByRole('button', { name: 'Discard' });

    // Field labels used for form-presence assertions
    this.locationLabel = page.getByText('Location').first();
    this.binTypeLabel = page.getByText('Bin type').first();
    this.entityLabel = page.getByText('Entity').first();
  }

  async gotoList() {
    // Same stuck-loading-spinner recovery as LocationPage.gotoList() - a single networkidle wait
    // can leave the page stuck on its own spinner well past a generous timeout, and only a reload
    // recovers it. Retry with a reload instead of trusting one wait, so callers of addButton right
    // after gotoList() don't time out on it.
    await this.page.goto('/dashboard/inventory/configuration/bins', { timeout: 60000 });
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

  async openEdit(name) {
    await this.gotoList();
    await this.page.getByRole('link', { name, exact: true }).first().click();
    await this.page.waitForURL('**/view-bins');
    await this.page.waitForLoadState('networkidle');
    await this.actionsButton.click();
    await this.editMenuItem.waitFor({ state: 'visible' });
    await this.editMenuItem.click();
    await this.page.waitForURL('**/edit-bins');
    await this.page.waitForLoadState('networkidle');
  }

  async fillName(name) {
    await this.nameInput.fill(name);
  }

  async selectLocation(location) {
    // Click the outer trigger to open the dropdown (exposes the inner search input)
    await this.page.getByText('Search Location', { exact: true }).first().click();
    // Type into the inner search box to filter options (needed for dynamic/long names)
    await this.page.getByPlaceholder('Search Location').fill(location.substring(0, 25));
    await this.page.waitForTimeout(500);
    await this.page.getByRole('option', { name: location, exact: true }).first().click();
  }

  async selectBinType(binType) {
    await this.page.getByText('Search Bin type', { exact: true }).first().click();
    // Use a prefix shorter than the full name so the search box text doesn't exactly
    // match the option name — otherwise .first() lands on the search-container row
    await this.page.getByPlaceholder('Search Bin type').fill(binType.substring(0, 8));
    await this.page.waitForTimeout(500);
    await this.page.getByRole('option', { name: binType, exact: true }).last().click();
  }

  async selectEntity(entity) {
    // Entity field may be pre-filled; click its dropdown trigger using the label
    //await this.page.getByLabel('Entity').click();
    //await this.page.getByRole('option', { name: entity, exact: true }).click();
  }

  async toggleStatus() {
    await this.statusSwitch.click();
  }

  async save() {
    await this.saveButton.click();
  }
}

module.exports = BinPage;
