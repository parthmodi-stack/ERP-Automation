const { test, expect, chromium } = require('@playwright/test');
const AttributePage = require('../../pages/AttributePage');
const testData      = require('../../config/testData');

test.describe('Attribute Management', () => {

  let page;
  let attribute;
  const data = testData.attribute.valid;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'auth.json' });
    page      = await context.newPage();
    attribute = new AttributePage(page);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  // ── TC-ATT-01: Create Attribute ──────────────────────────────────────────
  test('TC-ATT-01 [+/-] Create Attribute - validate empty form, add values, delete one, save', { tag: '@smoke' }, async () => {

    // Step 1: Navigate to Attributes list and open Add form
    await attribute.gotoList();
    await expect(page.getByRole('main').getByText('Attributes', { exact: true })).toBeVisible();

    await attribute.addButton.click();
    await page.waitForURL('**/add-attributes');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('New Attribute')).toBeVisible();

    // Step 2: Save empty form → page stays on form
    await attribute.save();
    await expect(page).toHaveURL(/.*\/add-attributes/);
    await expect(attribute.attributeNameLabel).toBeVisible();
    await expect(attribute.fieldTypeLabel).toBeVisible();

    // Step 3: Fill Attribute Name and select Field Type
    await attribute.fillAttributeName(data.name);
    await expect(attribute.attributeNameInput).toHaveValue(data.name);

    await attribute.selectFieldType(data.fieldType);
    await expect(page.getByText(data.fieldType).first()).toBeVisible();

    // Step 4: Add two option values
    await attribute.fillValue(0, data.values[0]);
    await expect(attribute.getValueInput(0)).toHaveValue(data.values[0]);

    await attribute.addValueRow();
    await attribute.getValueInput(1).waitFor({ state: 'visible' });
    await attribute.fillValue(1, data.values[1]);
    await expect(attribute.getValueInput(1)).toHaveValue(data.values[1]);

    // Step 5: Delete Value 1 → only Value 2 remains, save
    await attribute.deleteValueRow(0);
    await page.waitForTimeout(500);
    await expect(attribute.getValueInput(0)).toHaveValue(data.values[1]);

    await attribute.save();
    await page.waitForURL('**/configuration/attributes', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(data.name).first()).toBeVisible();
  });

  // ── TC-ATT-02: Edit Attribute - Change Status to Inactive ────────────────
  test('TC-ATT-02 Edit Attribute - change status from Active to Inactive', async () => {

    // Step 1: Navigate to attribute view and open Actions dropdown
    await attribute.gotoList();
    await page.getByRole('link', { name: data.name, exact: true }).first().click();
    await page.waitForURL('**/view-attributes');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(data.name).first()).toBeVisible();
    await expect(page.getByText('Active').first()).toBeVisible();
    await attribute.actionsButton.click();
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible();

    // Step 2: Click Edit → verify edit form loads with correct attribute
    await attribute.editMenuItem.click();
    await page.waitForURL('**/edit-attributes');
    await page.waitForLoadState('networkidle');
    await expect(attribute.attributeNameInput).toHaveValue(data.name);

    // Step 3: Verify Active status, then toggle to Inactive
    await expect(attribute.statusToggle).toBeChecked();
    await attribute.toggleStatus();
    await expect(attribute.statusToggle).not.toBeChecked();

    // Step 4: Save and verify Inactive badge in the list
    await attribute.save();
    await page.waitForURL('**/configuration/attributes', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('row').filter({ hasText: data.name }).getByText('Inactive')
    ).toBeVisible({ timeout: 5000 });
  });

  // ── TC-ATT-03: Reactivate Attribute - Inactive → Active ──────────────────
  test('TC-ATT-03 Edit Attribute - reactivate status from Inactive to Active', async () => {

    // Step 1: Navigate to the attribute (currently Inactive from TC-ATT-02)
    await attribute.gotoList();
    await page.getByRole('link', { name: data.name, exact: true }).first().click();
    await page.waitForURL('**/view-attributes');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(data.name).first()).toBeVisible();
    await expect(page.getByText('Inactive').first()).toBeVisible();
    await attribute.actionsButton.click();
    await expect(attribute.editMenuItem).toBeVisible();

    // Step 2: Click Edit → verify edit form loads
    await attribute.editMenuItem.click();
    await page.waitForURL('**/edit-attributes');
    await page.waitForLoadState('networkidle');
    await expect(attribute.attributeNameInput).toHaveValue(data.name);

    // Step 3: Verify Inactive status, then toggle back to Active
    await expect(attribute.statusToggle).not.toBeChecked();
    await attribute.toggleStatus();
    await expect(attribute.statusToggle).toBeChecked();

    // Step 4: Save and verify Active badge in the list
    await attribute.save();
    await page.waitForURL('**/configuration/attributes', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('row').filter({ hasText: data.name }).getByText('Active')
    ).toBeVisible({ timeout: 5000 });
  });

  // ── TC-ATT-04: Duplicate Attribute ───────────────────────────────────────
  test('TC-ATT-04 [+/-] Duplicate Attribute - validate duplicate name error, rename and save', async () => {

    // Step 1: Navigate to the attribute and open Actions dropdown
    await attribute.gotoList();
    await page.getByRole('link', { name: data.name, exact: true }).first().click();
    await page.waitForURL('**/view-attributes');
    await page.waitForLoadState('networkidle');
    await attribute.actionsButton.click();
    await expect(attribute.duplicateMenuItem).toBeVisible();

    // Step 2: Select Duplicate
    await attribute.duplicateMenuItem.click();
    await page.waitForURL('**/add-attributes');
    await page.waitForLoadState('networkidle');
    await expect(attribute.attributeNameInput).toBeVisible();

    // Step 3: Save without changing name → expect duplicate name error
    await attribute.save();
    await expect(page).toHaveURL(/.*\/add-attributes/);
    await expect(attribute.duplicateNameError).toBeVisible({ timeout: 5000 });

    // Step 4: Change name and save
    await attribute.attributeNameInput.clear();
    await attribute.fillAttributeName(data.duplicatedName);
    await expect(attribute.attributeNameInput).toHaveValue(data.duplicatedName);
    await attribute.save();

    // Step 5: Verify duplicated attribute appears in the list
    await page.waitForURL('**/configuration/attributes', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(data.duplicatedName).first()).toBeVisible();
  });

  // ── TC-ATT-05: Delete Duplicated Attribute ───────────────────────────────
  test('TC-ATT-05 Delete Attribute - delete duplicated attribute and verify removed from list', async () => {

    // Step 1: Navigate to the duplicated attribute from TC-ATT-04
    await attribute.gotoList();
    await page.getByRole('link', { name: data.duplicatedName, exact: true }).first().click();
    await page.waitForURL('**/view-attributes');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(data.duplicatedName).first()).toBeVisible();

    // Step 2: Open Actions → Delete
    await attribute.actionsButton.click();
    await expect(attribute.deleteMenuItem).toBeVisible();
    await attribute.deleteMenuItem.click();

    // Step 3: Confirm deletion in the dialog
    await attribute.confirmDeleteButton.waitFor({ state: 'visible' });
    await attribute.confirmDeleteButton.click();

    // Step 4: Verify redirect to list and attribute no longer appears
    await page.waitForURL('**/configuration/attributes', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('link', { name: data.duplicatedName, exact: true })).toHaveCount(0);
  });

});
