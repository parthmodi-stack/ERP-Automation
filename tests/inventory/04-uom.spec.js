const { test, expect } = require('@playwright/test');
const UOMPage  = require('../../pages/UOMPage');
const testData = require('../../config/testData');

test.describe('UOM Management', () => {

  // ─── POSITIVE ───────────────────────────────────────────────

  test('TC-UOM-01 [+] Create UOM with all valid fields', { tag: '@smoke' }, async ({ page }) => {
    const uom = new UOMPage(page);
    await uom.goto();
    await uom.fillForm(testData.uom.valid);
    await uom.addEntry(testData.uom.valid.entry);
    await uom.save();

    await page.waitForURL('**/uom', { timeout: 10000 });
    await expect(page.locator(`text=${testData.uom.valid.unitName}`)).toBeVisible();
  });

  test('TC-UOM-02 [+] Is Base Unit ON disables Conversion Factor field', async ({ page }) => {
    const uom = new UOMPage(page);
    await uom.goto();
    await uom.fillForm(testData.uom.valid);
    await uom.openAddEntryDialog();

    // Enable Is Base Unit toggle
    const checked = await uom.dialogIsBaseUnit.isChecked();
    if (!checked) await uom.dialogIsBaseUnit.click();

    // Conversion Factor must be disabled
    await expect(uom.dialogConvFactor).toBeDisabled();
    await uom.cancelEntryDialog();
  });

  test('TC-UOM-03 [+] Is Base Unit OFF enables Conversion Factor field', async ({ page }) => {
    const uom = new UOMPage(page);
    await uom.goto();
    await uom.fillForm(testData.uom.valid);
    await uom.openAddEntryDialog();

    // Ensure Is Base Unit is OFF
    const checked = await uom.dialogIsBaseUnit.isChecked();
    if (checked) await uom.dialogIsBaseUnit.click();

    await expect(uom.dialogConvFactor).toBeEnabled();
    await uom.cancelEntryDialog();
  });

  test('TC-UOM-04 [+] Cancel dialog does not add entry', async ({ page }) => {
    const uom = new UOMPage(page);
    await uom.goto();
    await uom.fillForm(testData.uom.valid);
    await uom.openAddEntryDialog();
    await uom.cancelEntryDialog();

    // Dialog should be closed, no entry row added
    await expect(page.locator('text=Add Item')).not.toBeVisible();
  });

  // ─── NEGATIVE ───────────────────────────────────────────────

  test('TC-UOM-05 [-] Submit without Unit Name stays on form', async ({ page }) => {
    const uom = new UOMPage(page);
    await uom.goto();
    await uom.fillForm(testData.uom.missingName);
    await uom.save();

    // Should remain on the add page (validation blocks navigation)
    await expect(page).toHaveURL(/add-UOM/);
  });

  test('TC-UOM-06 [-] Submit without Symbol stays on form', async ({ page }) => {
    const uom = new UOMPage(page);
    await uom.goto();
    await uom.fillForm(testData.uom.missingSymbol);
    await uom.save();

    await expect(page).toHaveURL(/add-UOM/);
  });

  test('TC-UOM-07 [-] Save without UOM entries shows inline validation banner', async ({ page }) => {
    const uom = new UOMPage(page);
    await uom.goto();
    // Fill form but do NOT add any entries
    await uom.fillForm(testData.uom.valid);
    await uom.save();

    // App shows "Please Add UOM Items" inline alert banner
    await expect(page.locator('text=Please Add UOM Items')).toBeVisible({ timeout: 6000 });
    await expect(page).toHaveURL(/add-UOM/);
  });

  test('TC-UOM-08 [-] Dialog entry without UOM Name keeps dialog open', async ({ page }) => {
    const uom = new UOMPage(page);
    await uom.goto();
    await uom.fillForm(testData.uom.valid);
    await uom.openAddEntryDialog();

    // Fill only symbol, leave name empty
    await uom.fillEntryDialog(testData.uom.entryMissingName.entry);
    await uom.saveEntryDialog();

    // Dialog should still be visible (validation blocked save)
    await expect(page.locator('text=Add Item')).toBeVisible();
    await uom.cancelEntryDialog();
  });

  test('TC-UOM-09 [-] Dialog entry without Symbol keeps dialog open', async ({ page }) => {
    const uom = new UOMPage(page);
    await uom.goto();
    await uom.fillForm(testData.uom.valid);
    await uom.openAddEntryDialog();

    // Fill only name, leave symbol empty
    await uom.fillEntryDialog(testData.uom.entryMissingSymbol.entry);
    await uom.saveEntryDialog();

    await expect(page.locator('text=Add Item')).toBeVisible();
    await uom.cancelEntryDialog();
  });
});
