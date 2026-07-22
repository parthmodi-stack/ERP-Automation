class LocationPage {
  constructor(page) {
    this.page = page;

    // Required fields
    this.nameInput = page.getByPlaceholder('Enter Name');
    this.shortNameInput = page.getByPlaceholder('Enter Short Name');

    // Address fields
    this.address1Input = page.getByPlaceholder('Enter Address 1');
    this.address2Input = page.getByPlaceholder('Enter Address 2');
    this.address3Input = page.getByPlaceholder('Enter Address 3');
    this.zipCodeInput = page.getByPlaceholder('Enter ZIP Code');
    this.cityInput = page.getByPlaceholder('Enter city');
    this.summaryInput = page.getByPlaceholder('Enter summary');

    // Checkboxes / toggles
    this.inventoryCheckbox = page
      .locator('[data-position="12"]')
      .locator('..')
      .locator('input[type="checkbox"]');

    this.statusToggle = page.locator('input[name="status"]');
    this.statusSwitch = page.locator('.MuiSwitch-root');

    // Pre-filled read-only labels
    this.entityLabel = page.getByText('erp-force');
    this.countryLabel = page.getByText('United Arab Emirates');

    // Actions
    // exact: true avoids matching the Address column's sort-toggle button,
    // whose accessible name ("Sort by Address ascending") contains "Add".
    this.addButton = page.getByRole('button', { name: 'Add', exact: true });
    this.saveButton = page.getByRole('button', { name: 'Save' });
    this.actionsButton = page.getByRole('button', { name: 'Actions' });
    this.editMenuItem = page.getByRole('menuitem', { name: 'Edit' });
    this.duplicateMenuItem = page.getByRole('menuitem', { name: 'Duplicate' });
    this.deleteMenuItem = page.getByRole('menuitem', { name: 'Delete' });
    this.confirmDeleteButton = page.getByRole('dialog').getByRole('button', { name: 'Delete' });
    this.duplicateNameError = page.locator('text=Warehouse location name already exists.');
  }

  async gotoList() {
    await this.page.goto('/dashboard/inventory/configuration/location');
    await this.page.waitForLoadState('networkidle');
  }

  async goto() {
    await this.gotoList();
    await this.addButton.click();
    await this.page.waitForURL('**/add-location');
    await this.page.waitForLoadState('networkidle');
    await this.nameInput.waitFor({ state: 'visible', timeout: 15000 });
  }

  async fillForm({ name, shortName, address1, address2, address3, zipCode, city, summary }) {
    if (name !== undefined) await this.nameInput.fill(name);
    if (shortName !== undefined) await this.shortNameInput.fill(shortName);
    if (address1 !== undefined) await this.address1Input.fill(address1);
    if (address2 !== undefined) await this.address2Input.fill(address2);
    if (address3 !== undefined) await this.address3Input.fill(address3);
    if (zipCode !== undefined) await this.zipCodeInput.fill(zipCode);
    if (city !== undefined) await this.cityInput.fill(city);
    if (summary !== undefined) await this.summaryInput.fill(summary);
  }

  async ensureInventoryAvailable() {
    if (!(await this.inventoryCheckbox.isChecked())) {
      await this.inventoryCheckbox.check();
    }
  }

  async screenshotBeforeSave(path = 'screenshots/before-save.png') {
    await this.page.screenshot({ path, fullPage: true });
  }

  async toggleStatus() {
    await this.statusSwitch.click();
  }

  async save() {
    await this.saveButton.click();
  }

  async openEdit(locationName) {
    await this.gotoList();
    await this.page.getByRole('link', { name: locationName, exact: true }).first().click();
    await this.page.waitForURL('**/view-location');
    await this.page.waitForLoadState('networkidle');
    await this.actionsButton.click();
    await this.editMenuItem.waitFor({ state: 'visible' });
    await this.editMenuItem.click();
    await this.page.waitForURL('**/edit-location');
    await this.page.waitForLoadState('networkidle');
  }

  async createLocation(locationData) {
    await this.goto();
    await this.fillForm(locationData);
    if (locationData.makeInventoryAvailable) {
      await this.ensureInventoryAvailable();
    }
    await this.save();
  }
}

module.exports = LocationPage;
