const { test, expect } = require('@playwright/test');
const ItemCategoryPage = require('../../pages/ItemCategoryPage');
const testData         = require('../../config/testData');

test.describe('Item Category Management', () => {

  // ── TC-CAT-01: Create Item Category ──────────────────────────────────────
  test('TC-CAT-01 [+] Create Item Category - fill all fields, add attribute, save and verify in list', { tag: '@smoke' }, async ({ page }) => {
    const category = new ItemCategoryPage(page);
    const data     = testData.itemCategory.valid;

    // Step 1: Navigate to list and open Add form
    await category.openAdd();
    await expect(page.getByText('Add Category')).toBeVisible();
    await expect(page.getByText('Draft')).toBeVisible();

    // Step 2: Verify Status is Active by default
    await expect(category.statusToggle).toBeChecked();

    // Step 3: Fill all form fields
    await category.fillForm(data);

    // Step 4: Verify SKU preview updates with prefix
    await expect(page.getByText(data.skuPreview)).toBeVisible({ timeout: 5000 });

    // Step 5: Add attribute
    await category.addAttribute(data.attribute);
    await expect(page.getByText(data.attribute).first()).toBeVisible();

    // Step 6: Save and verify redirect to list
    await category.save();
    await page.waitForURL(/item-category/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Step 7: Confirm new category appears in list
    await expect(
      page.getByRole('link', { name: data.name, exact: true }).first()
    ).toBeVisible();
  });

  // ── TC-CAT-02: Create Item Category - empty name validation ──────────────
  test('TC-CAT-02 [-] Create Item Category - save with empty name shows validation error', async ({ page }) => {
    const category = new ItemCategoryPage(page);

    // Step 1: Open Add form
    await category.openAdd();
    await expect(page.getByText('Add Category')).toBeVisible();

    // Step 2: Touch the Category Name field (click + Tab) so React marks it as touched,
    // then click Save to trigger inline validation
    await category.categoryNameInput.click();
    await category.categoryNameInput.press('Tab');
    await category.save();

    // Step 3: Verify page stays on add form
    await expect(page).toHaveURL(/.*\/add-item-category/);

    // Step 4: Verify Category Name required error appears
    await expect(category.categoryNameError).toBeVisible({ timeout: 5000 });

    // Step 5: Verify Category Name field has error styling
    await expect(
      category.categoryNameInput.locator('..')
    ).toHaveClass(/Mui-error/);
  });

});
