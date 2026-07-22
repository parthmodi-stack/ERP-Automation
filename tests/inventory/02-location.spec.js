const { test, expect } = require('@playwright/test');
const LocationPage = require('../../pages/LocationPage');
const testData     = require('../../config/testData');

test.describe('Location Management', () => {

  // ── TC-LOC-01: Create Location ───────────────────────────────────────────
  test('TC-LOC-01 [+] Create Location with all fields and inventory enabled', { tag: '@smoke' }, async ({ page }) => {
    const location = new LocationPage(page);
    const data     = testData.location.valid;

    // Navigate to list and verify page loaded
    await location.gotoList();
    await expect(page.getByRole('main').getByText('Location', { exact: true })).toBeVisible();

    // Open Add Location form
    await location.addButton.click();
    await page.waitForURL('**/add-location');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('main').getByText('Add Location')).toBeVisible();

    // Fill all form fields
    await location.fillForm(data);

    // Verify pre-filled Entity and Country
    await expect(location.entityLabel).toBeVisible();
    await expect(location.countryLabel).toBeVisible();

    // Check Make Inventory Available
    await expect(location.inventoryCheckbox).not.toBeChecked();
    await location.ensureInventoryAvailable();
    await expect(location.inventoryCheckbox).toBeChecked();

    // Verify Status toggle is active by default
    await expect(location.statusToggle).toBeChecked();

    // Screenshot before saving
    await location.screenshotBeforeSave();

    // Save and verify redirect
    await location.save();
    await page.waitForURL('**/configuration/location', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Confirm new location appears in list
    await expect(
      page.getByRole('link', { name: data.name })
    ).toBeVisible();
  });

  // ── TC-LOC-02: Edit Location - Update Name ───────────────────────────────
  test('TC-LOC-02 [+] Edit Location - change name via Actions > Edit > Save', async ({ page }) => {
    const location = new LocationPage(page);
    const data     = testData.location.valid;

    // Find the location created by TC-LOC-01 and open its edit form
    await location.openEdit(data.name);
    await expect(page.getByRole('main').getByText('Edit Location')).toBeVisible();

    // Verify the name field has the original name
    await expect(location.nameInput).toHaveValue(new RegExp(data.name));

    // Update the name
    await location.nameInput.fill(data.updatedName);
    await expect(location.nameInput).toHaveValue(data.updatedName);

    // Screenshot before saving
    await location.screenshotBeforeSave('screenshots/edit-location-before-save.png');

    // Save and verify redirect
    await location.save();
    await page.waitForURL('**/configuration/location', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Confirm updated name appears in list
    await expect(
      page.getByRole('link', { name: data.updatedName, exact: true })
    ).toBeVisible();
  });

  // ── TC-LOC-03: View Location - Verify saved field values ─────────────────
  test('TC-LOC-03 [+] View Location - verify all saved field values on detail page', async ({ page }) => {
    const location = new LocationPage(page);
    const data     = testData.location.valid;

    // Open the location detail view
    await location.gotoList();
    await page.getByRole('link', { name: data.updatedName, exact: true }).first().click();
    await page.waitForURL('**/view-location');
    await page.waitForLoadState('networkidle');

    // Verify all saved field values are displayed
    await expect(page.getByText(data.updatedName).first()).toBeVisible();
    await expect(page.getByText(data.shortName).first()).toBeVisible();
    await expect(page.getByText(data.address1).first()).toBeVisible();
    await expect(page.getByText(data.city).first()).toBeVisible();
    await expect(page.getByText(data.zipCode).first()).toBeVisible();
    await expect(page.getByText('erp-force').first()).toBeVisible();
    await expect(page.getByText('Active').first()).toBeVisible();
  });

  // ── TC-LOC-04: Edit Location - Change Status to Inactive ─────────────────
  test('TC-LOC-04 [+] Edit Location - change status from Active to Inactive', async ({ page }) => {
    const location = new LocationPage(page);
    const data     = testData.location.valid;

    // Open edit form
    await location.openEdit(data.updatedName);
    await expect(page.getByRole('main').getByText('Edit Location')).toBeVisible();

    // Verify Active, then toggle to Inactive
    await expect(location.statusToggle).toBeChecked();
    await location.toggleStatus();
    await expect(location.statusToggle).not.toBeChecked();

    // Save and verify Inactive badge in list
    await location.save();
    await page.waitForURL('**/configuration/location', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('row').filter({ hasText: data.updatedName }).getByText('Inactive')
    ).toBeVisible({ timeout: 5000 });
  });

  // ── TC-LOC-05: Edit Location - Reactivate Inactive → Active ──────────────
  test('TC-LOC-05 [+] Edit Location - reactivate status from Inactive to Active', async ({ page }) => {
    const location = new LocationPage(page);
    const data     = testData.location.valid;

    // Open edit form (location currently Inactive from TC-LOC-04)
    await location.openEdit(data.updatedName);
    await expect(page.getByRole('main').getByText('Edit Location')).toBeVisible();

    // Verify Inactive, then toggle back to Active
    await expect(location.statusToggle).not.toBeChecked();
    await location.toggleStatus();
    await expect(location.statusToggle).toBeChecked();

    // Save and verify Active badge in list
    await location.save();
    await page.waitForURL('**/configuration/location', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('row').filter({ hasText: data.updatedName }).getByText('Active')
    ).toBeVisible({ timeout: 5000 });
  });

  // ── TC-LOC-06: Edit Location - Update Address Fields ─────────────────────
  test('TC-LOC-06 [+] Edit Location - update address fields and verify changes', async ({ page }) => {
    const location = new LocationPage(page);
    const data     = testData.location.valid;

    // Open edit form
    await location.openEdit(data.updatedName);
    await expect(page.getByRole('main').getByText('Edit Location')).toBeVisible();

    // Update Address 1, City, ZIP Code
    await location.address1Input.clear();
    await location.address1Input.fill(data.updatedAddress1);
    await expect(location.address1Input).toHaveValue(data.updatedAddress1);

    await location.cityInput.clear();
    await location.cityInput.fill(data.updatedCity);
    await expect(location.cityInput).toHaveValue(data.updatedCity);

    await location.zipCodeInput.clear();
    await location.zipCodeInput.fill(data.updatedZipCode);
    await expect(location.zipCodeInput).toHaveValue(data.updatedZipCode);

    // Save and verify redirect to list
    await location.save();
    await page.waitForURL('**/configuration/location', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('link', { name: data.updatedName, exact: true })).toBeVisible();

    // Re-open edit to confirm address changes persisted
    await location.openEdit(data.updatedName);
    await expect(location.address1Input).toHaveValue(data.updatedAddress1);
    await expect(location.cityInput).toHaveValue(data.updatedCity);
    await expect(location.zipCodeInput).toHaveValue(data.updatedZipCode);
  });

  // ── TC-LOC-07: Edit Location - Toggle Inventory Off ──────────────────────
  test('TC-LOC-07 [+] Edit Location - toggle Make Inventory Available off and verify', async ({ page }) => {
    const location = new LocationPage(page);
    const data     = testData.location.valid;

    // Open edit form
    await location.openEdit(data.updatedName);
    await expect(page.getByRole('main').getByText('Edit Location')).toBeVisible();

    // Verify inventory is currently checked
    await expect(location.inventoryCheckbox).toBeChecked();

    // Uncheck it
    await location.inventoryCheckbox.uncheck();
    await expect(location.inventoryCheckbox).not.toBeChecked();

    // Save and verify redirect
    await location.save();
    await page.waitForURL('**/configuration/location', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Re-open edit to confirm inventory off state persisted
    await location.openEdit(data.updatedName);
    await expect(location.inventoryCheckbox).not.toBeChecked();

    // Restore inventory availability so bin tests can use this location as their location field
    await location.inventoryCheckbox.check();
    await expect(location.inventoryCheckbox).toBeChecked();
    await location.save();
    await page.waitForURL('**/configuration/location', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  // ── TC-LOC-08: Duplicate Location ────────────────────────────────────────
  test('TC-LOC-08 [+/-] Duplicate Location - validate duplicate name then save with new name', async ({ page }) => {
    const location = new LocationPage(page);
    const data     = testData.location.valid;

    // Navigate to the location and open its view page
    await location.gotoList();
    await page.getByRole('link', { name: data.updatedName, exact: true }).first().click();
    await page.waitForURL('**/view-location');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(data.updatedName, { exact: true }).first()).toBeVisible();

    // Click Actions > Duplicate
    await location.actionsButton.click();
    await location.duplicateMenuItem.waitFor({ state: 'visible' });
    await location.duplicateMenuItem.click();

    // Duplicate opens the add-location form pre-filled with copied data
    await page.waitForURL('**/add-location');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('main').getByText('Add Location')).toBeVisible();

    // Verify the name field is pre-filled with the original (updatedName)
    await expect(location.nameInput).toHaveValue(data.updatedName);

    // Negative: save without changing name → expect validation toast
    await location.save();
    await expect(location.duplicateNameError).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/.*\/add-location/);

    // Positive: change to a unique name and save
    await location.nameInput.fill(data.duplicatedName);
    await expect(location.nameInput).toHaveValue(data.duplicatedName);

    await location.save();
    await page.waitForURL('**/configuration/location', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Confirm the duplicated location appears in the list
    await expect(
      page.getByRole('link', { name: data.duplicatedName, exact: true }).first()
    ).toBeVisible();
  });

  // ── TC-LOC-09: Delete Duplicated Location ────────────────────────────────
  test('TC-LOC-09 [-] Delete the duplicated location created in TC-LOC-08', async ({ page }) => {
    const location = new LocationPage(page);
    const data     = testData.location.valid;

    // Navigate to list and open the duplicated location's view page
    await location.gotoList();
    await page.getByRole('link', { name: data.duplicatedName, exact: true }).first().click();
    await page.waitForURL('**/view-location');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(data.duplicatedName, { exact: true }).first()).toBeVisible();

    // Click Actions > Delete
    await location.actionsButton.click();
    await location.deleteMenuItem.waitFor({ state: 'visible' });
    await location.deleteMenuItem.click();

    // Confirm deletion in the dialog
    await location.confirmDeleteButton.waitFor({ state: 'visible' });
    await page.waitForTimeout(500);
    await location.confirmDeleteButton.click();

    // Wait for navigation back to the location list (URL pattern varies after delete)
    await page.waitForURL(/location/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Confirm the deleted location no longer appears in the list
    await expect(
      page.getByRole('link', { name: data.duplicatedName, exact: true })
    ).not.toBeVisible();
  });

});
// TC-LOC-10 (delete main location) is intentionally omitted here.
// The created location (updatedName) is reused by 03-bin.spec.js as its location field,
// and by 08-stock-transfer.spec.js as the destination location it uses to identify its own records.
// Run a separate cleanup after all inventory tests if deletion is needed.
