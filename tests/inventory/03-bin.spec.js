const { test, expect } = require('@playwright/test');
const BinPage      = require('../../pages/BinPage');
const LocationPage = require('../../pages/LocationPage');
const testData     = require('../../config/testData');

test.describe('Bin Management', () => {

  let page;
  let bin;
  const data    = testData.bin.valid;
  const locData = testData.location.valid;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'auth.json' });
    page = await context.newPage();
    bin  = new BinPage(page);

    // Ensure the required location exists so bin tests can run standalone
    const location = new LocationPage(page);
    await location.gotoList();
    const updatedExists = await page.getByRole('link', { name: locData.updatedName, exact: true }).count();
    if (updatedExists === 0) {
      const originalExists = await page.getByRole('link', { name: locData.name, exact: true }).count();
      if (originalExists === 0) {
        // Create the location from scratch
        await location.addButton.click();
        await page.waitForURL('**/add-location');
        await page.waitForLoadState('networkidle');
        await location.fillForm(locData);
        await location.ensureInventoryAvailable();
        await location.save();
        await page.waitForURL('**/configuration/location', { timeout: 10000 });
        await page.waitForLoadState('networkidle');
      }
      // Rename original name → updatedName (mirrors what TC-LOC-02 does)
      await location.openEdit(locData.name);
      await location.nameInput.fill(locData.updatedName);
      await location.save();

      // The initial existence check above only looks at the default (paginated)
      // location list, so it can miss a location that already has updatedName
      // (e.g. renamed earlier by TC-LOC-02 in the same run but sitting on a
      // later page). In that case the app blocks this save with a duplicate-name
      // error instead of navigating — which just confirms the location we need
      // already exists, so treat it as success rather than waiting for a
      // navigation that will never happen.
      const duplicate = await location.duplicateNameError.isVisible({ timeout: 3000 }).catch(() => false);
      if (duplicate) {
        await location.gotoList();
      } else {
        await page.waitForURL('**/configuration/location', { timeout: 10000 });
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  // ── TC-BIN-01: Create Bin - Save with Name empty ────────────────────────
  test('TC-BIN-01 [−] Create Bin - save with empty Name shows Name required error', async () => {

    // Step 1: Open Add form
    await bin.gotoList();
    await bin.addButton.click();
    await page.waitForURL('**/add-bins');
    await page.waitForLoadState('networkidle');

    // Step 2: Fill Location only (leave Name empty)
    await bin.selectLocation(data.location);
    await expect(page.getByText(data.location).first()).toBeVisible();

    // Step 3: Save → expect Name required error, page stays on form
    await bin.save();
    await expect(page).toHaveURL(/.*\/add-bins/);
    await expect(bin.nameRequiredError).toBeVisible({ timeout: 5000 });

    // Step 4: Navigate away without saving
    await bin.gotoList();
  });

  // ── TC-BIN-02: Create Bin - Save with Location empty ────────────────────
  test('TC-BIN-02 [−] Create Bin - save with empty Location shows Location required error', async () => {

    // Step 1: Open Add form
    await bin.gotoList();
    await bin.addButton.click();
    await page.waitForURL('**/add-bins');
    await page.waitForLoadState('networkidle');

    // Step 2: Fill Name only (leave Location empty)
    await bin.fillName(data.name);
    await expect(bin.nameInput).toHaveValue(data.name);

    // Step 3: Save → expect Location required error, page stays on form
    await bin.save();
    await expect(page).toHaveURL(/.*\/add-bins/);
    await expect(bin.locationRequiredError).toBeVisible({ timeout: 5000 });

    // Step 4: Navigate away without saving
    await bin.gotoList();
  });

  // ── TC-BIN-03: Create Bin ────────────────────────────────────────────────
  test('TC-BIN-03 [+/-] Create Bin - validate empty form, fill all fields, save and verify', { tag: '@smoke' }, async () => {

    // Step 1: Navigate to Bins list and open Add form
    await bin.gotoList();
    await expect(page.locator('text=Bins').first()).toBeVisible();
    await bin.addButton.click();
    await page.waitForURL('**/add-bins');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Add Bin', { exact: true })).toBeVisible();

    // Step 2: Verify all form field labels are present
    await expect(bin.nameInput).toBeVisible();
    await expect(bin.locationLabel).toBeVisible();
    await expect(bin.binTypeLabel).toBeVisible();
    await expect(bin.entityLabel).toBeVisible();

    // Step 3: Save empty form → validate required field errors
    await bin.save();
    await expect(page).toHaveURL(/.*\/add-bins/);
    await expect(bin.nameRequiredError).toBeVisible({ timeout: 5000 });
    await expect(bin.locationRequiredError).toBeVisible({ timeout: 5000 });

    // Open a fresh Add form - MUI dropdowns enter an error state after a failed save
    // and the Location trigger no longer responds correctly on the same form instance
    await bin.gotoList();
    await bin.addButton.click();
    await page.waitForURL('**/add-bins');
    await page.waitForLoadState('networkidle');

    // Step 4: Fill Name
    await bin.fillName(data.name);
    await expect(bin.nameInput).toHaveValue(data.name);

    // Step 5: Select Location
    await bin.selectLocation(data.location);
    await expect(page.getByText(data.location).first()).toBeVisible();

    // Step 6: Select Bin Type
    await bin.selectBinType(data.binType);
    await expect(page.getByText(data.binType).first()).toBeVisible();

    // Step 7: Verify Entity is pre-filled
    await expect(page.getByText(data.entity).first()).toBeVisible();

    // Step 8: Save and verify record appears in list
    await bin.save();
    await page.waitForURL('**/configuration/bins', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(data.name).first()).toBeVisible();

    const binRow = page.getByRole('row').filter({ hasText: data.name });
    await expect(binRow.getByText(data.location)).toBeVisible();
    await expect(binRow.getByText('Active')).toBeVisible();
  });

  // ── TC-BIN-04: View Bin - Verify saved field values ──────────────────────
  test('TC-BIN-04 View Bin - verify all saved field values on detail page', async () => {

    // Step 1: Open the bin detail view
    await bin.gotoList();
    await page.getByRole('link', { name: data.name, exact: true }).first().click();
    await page.waitForURL('**/view-bins');
    await page.waitForLoadState('networkidle');

    // Step 2: Verify all saved field values are displayed
    await expect(page.getByText(data.name).first()).toBeVisible();
    await expect(page.getByText(data.location).first()).toBeVisible();
    await expect(page.getByText(data.binType).first()).toBeVisible();
    await expect(page.getByText(data.entity).first()).toBeVisible();
    await expect(page.getByText('Active').first()).toBeVisible();
  });

  // ── TC-BIN-05: Edit Bin - Clear Name and save → error ───────────────────
  test('TC-BIN-05 [−] Edit Bin - clear Name field and save shows Name required error', async () => {

    // Step 1: Open edit form
    await bin.openEdit(data.name);
    await expect(bin.nameInput).toHaveValue(data.name);

    // Step 2: Clear the Name field
    await bin.nameInput.clear();
    await expect(bin.nameInput).toHaveValue('');

    // Step 3: Save → expect Name required error, page stays on edit form
    await bin.save();
    await expect(page).toHaveURL(/.*\/edit-bins/);
    await expect(bin.nameRequiredError).toBeVisible({ timeout: 5000 });

    // Step 4: Navigate away without saving
    await bin.gotoList();
  });

  // ── TC-BIN-06: Duplicate Bin - Save without renaming → error ────────────
  test('TC-BIN-06 [−] Duplicate Bin - save with original name shows duplicate name error', async () => {

    // Step 1: Open bin view and select Duplicate
    await bin.gotoList();
    await page.getByRole('link', { name: data.name, exact: true }).first().click();
    await page.waitForURL('**/view-bins');
    await page.waitForLoadState('networkidle');
    await bin.actionsButton.click();
    await expect(bin.duplicateMenuItem).toBeVisible();
    await bin.duplicateMenuItem.click();
    await page.waitForURL('**/add-bins');
    await page.waitForLoadState('networkidle');

    // Step 2: Save without changing the name → duplicate error
    await bin.save();
    await expect(page).toHaveURL(/.*\/add-bins/);
    await expect(bin.duplicateNameError).toBeVisible({ timeout: 5000 });

    // Step 3: Navigate away without saving
    await bin.gotoList();
  });

  // ── TC-BIN-07: Edit Bin - Update name ────────────────────────────────────
  test('TC-BIN-07 Edit Bin - update bin name and verify change in list', async () => {

    // Step 1: Open edit form
    await bin.openEdit(data.name);
    await expect(bin.nameInput).toHaveValue(data.name);

    // Step 2: Replace name with updated name
    await bin.nameInput.clear();
    await bin.fillName(data.updatedName);
    await expect(bin.nameInput).toHaveValue(data.updatedName);

    // Step 3: Save and verify updated name in list, old name gone
    await bin.save();
    await page.waitForURL('**/configuration/bins', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(data.updatedName).first()).toBeVisible();
    await expect(page.getByRole('link', { name: data.name, exact: true })).toHaveCount(0);
  });

  // ── TC-BIN-08: Edit Bin - Change Status to Inactive ─────────────────────
  test('TC-BIN-08 Edit Bin - change status from Active to Inactive', async () => {

    // Step 1: Open edit form (bin now has updatedName)
    await bin.openEdit(data.updatedName);
    await expect(bin.nameInput).toHaveValue(data.updatedName);

    // Step 2: Verify Active, toggle to Inactive
    await expect(bin.statusToggle).toBeChecked();
    await bin.toggleStatus();
    await expect(bin.statusToggle).not.toBeChecked();

    // Step 3: Save and verify Inactive badge in list
    await bin.save();
    await page.waitForURL('**/configuration/bins', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('row').filter({ hasText: data.updatedName }).getByText('Inactive')
    ).toBeVisible({ timeout: 5000 });
  });

  // ── TC-BIN-09: Edit Bin - Reactivate Inactive → Active ───────────────────
  test('TC-BIN-09 Edit Bin - reactivate status from Inactive to Active', async () => {

    // Step 1: Open edit form
    await bin.openEdit(data.updatedName);
    await expect(bin.nameInput).toHaveValue(data.updatedName);

    // Step 2: Verify Inactive, toggle back to Active
    await expect(bin.statusToggle).not.toBeChecked();
    await bin.toggleStatus();
    await expect(bin.statusToggle).toBeChecked();

    // Step 3: Save and verify Active badge in list
    await bin.save();
    await page.waitForURL('**/configuration/bins', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('row').filter({ hasText: data.updatedName }).getByText('Active')
    ).toBeVisible({ timeout: 5000 });
  });

  // ── TC-BIN-10: Duplicate Bin ─────────────────────────────────────────────
  test('TC-BIN-10 [+/-] Duplicate Bin - validate duplicate name error, rename and save', async () => {

    // Step 1: Open bin (updatedName) and select Duplicate
    await bin.gotoList();
    await page.getByRole('link', { name: data.updatedName, exact: true }).first().click();
    await page.waitForURL('**/view-bins');
    await page.waitForLoadState('networkidle');
    await bin.actionsButton.click();
    await expect(bin.duplicateMenuItem).toBeVisible();
    await bin.duplicateMenuItem.click();
    await page.waitForURL('**/add-bins');
    await page.waitForLoadState('networkidle');

    // Step 2: Save without renaming → duplicate error
    await bin.save();
    await expect(page).toHaveURL(/.*\/add-bins/);
    await expect(bin.duplicateNameError).toBeVisible({ timeout: 5000 });

    // Step 3: Rename and save
    await bin.nameInput.clear();
    await bin.fillName(data.duplicatedName);
    await expect(bin.nameInput).toHaveValue(data.duplicatedName);
    await bin.save();

    // Step 4: Verify duplicated bin appears in list
    await page.waitForURL('**/configuration/bins', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(data.duplicatedName).first()).toBeVisible();
  });

  // ── TC-BIN-11: Delete Duplicated Bin ────────────────────────────────────
  test('TC-BIN-11 Delete Bin - delete duplicated bin and verify removed from list', async () => {

    // Step 1: Navigate to the duplicated bin
    await bin.gotoList();
    await page.getByRole('link', { name: data.duplicatedName, exact: true }).first().click();
    await page.waitForURL('**/view-bins');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(data.duplicatedName).first()).toBeVisible();

    // Step 2: Open Actions → Delete
    await bin.actionsButton.click();
    await expect(bin.deleteMenuItem).toBeVisible();
    await bin.deleteMenuItem.click();

    // Step 3: Confirm deletion
    await bin.confirmDeleteButton.waitFor({ state: 'visible' });
    await bin.confirmDeleteButton.click();

    // Step 4: Verify redirect and bin no longer in list
    await page.waitForURL('**/configuration/bins', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('link', { name: data.duplicatedName, exact: true })).toHaveCount(0);
  });

});
