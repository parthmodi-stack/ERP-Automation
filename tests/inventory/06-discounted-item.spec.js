const { test, expect } = require('@playwright/test');
const DiscountedItemPage = require('../../pages/DiscountedItemPage');
const testData           = require('../../config/testData');

test.describe('Discounted Item Management', () => {

  // ── TC-DI-01: Create Discounted Item ─────────────────────────────────────
  test('TC-DI-01 [+/-] Create Discounted Item - validate empty form errors, fill all fields, save and verify in list', { tag: '@smoke' }, async ({ page }) => {
    const discItem = new DiscountedItemPage(page);
    const data     = testData.discountedItem.valid;

    // Step 1: Navigate to list and click Add
    await discItem.openAdd();
    await expect(page.getByText('Add Discounted Item', { exact: true })).toBeVisible();
    await expect(page.getByText('Basic Details')).toBeVisible();

    // Step 2: Verify all required form fields are present
    await expect(discItem.skuInput).toBeVisible();
    await expect(discItem.nameInput).toBeVisible();
    await expect(discItem.discountRateInput).toBeVisible();

    // Step 3: Touch required text fields then save to trigger all validation errors
    await discItem.skuInput.click();
    await discItem.skuInput.press('Tab');
    await discItem.nameInput.click();
    await discItem.nameInput.press('Tab');
    await discItem.save();
    await expect(page).toHaveURL(/.*\/add-discounted-items/);
    await expect(discItem.skuError).toBeVisible({ timeout: 5000 });
    await expect(discItem.nameError).toBeVisible({ timeout: 5000 });
    await expect(discItem.discountTypeError).toBeVisible({ timeout: 5000 });
    await expect(discItem.accountError).toBeVisible({ timeout: 5000 });
    await expect(discItem.discountCatError).toBeVisible({ timeout: 5000 });
    await expect(discItem.discountRateError).toBeVisible({ timeout: 5000 });

    // Navigate to a fresh Add form to avoid MUI error state on dropdowns
    await discItem.gotoList();
    await discItem.addButton.click();
    await page.waitForURL('**/add-discounted-items');
    await page.waitForLoadState('networkidle');

    // Step 4: Fill SKU Number
    await discItem.skuInput.fill(data.skuNumber);
    await expect(discItem.skuInput).toHaveValue(data.skuNumber);

    // Step 5: Fill Name
    await discItem.nameInput.fill(data.name);
    await expect(discItem.nameInput).toHaveValue(data.name);

    // Step 6: Select Discount Type
    await discItem.selectDiscountType(data.discountType);
    await expect(page.getByText(data.discountType).first()).toBeVisible();

    // Step 7: Select Account
    await discItem.selectAccount(data.account);
    await expect(page.getByText(data.account).first()).toBeVisible();

    // Step 8: Select Discount Category
    await discItem.selectDiscountCategory(data.discountCategory);
    await expect(page.getByText(data.discountCategory).first()).toBeVisible();

    // Step 9: Fill Discount Rate
    await discItem.discountRateInput.fill(data.discountRate);
    await expect(discItem.discountRateInput).toHaveValue(data.discountRate);

    // Step 10: Fill Description
    await discItem.descriptionInput.fill(data.description);

    // Step 11: Verify Status is Active by default
    await expect(discItem.statusToggle).toBeChecked();

    // Step 12: Save and verify redirect to list with new record visible
    await discItem.save();
    await page.waitForURL(/discounted-item/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(data.skuNumber).first()).toBeVisible();
  });

});
