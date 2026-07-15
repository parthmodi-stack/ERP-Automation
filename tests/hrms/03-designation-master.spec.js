const { test, expect } = require('@playwright/test');
const DesignationMasterPage = require('../../pages/DesignationMasterPage');
const testData = require('../../config/testData');

test.describe('Designation Master Module', () => {
  let createdCode = '';
  let createdName = '';

  test.beforeEach(async ({ page }) => {
    const desig = new DesignationMasterPage(page);
    await desig.gotoList();
  });

  test.describe('List View Operations', () => {
    test('TC-027: Display Designation Master List', async ({ page }) => {
      const desig = new DesignationMasterPage(page);
      // const table = page.locator('[role="table"]');
      // await expect(table).toBeVisible();

      // Verify columns
      await expect(desig.columnHeader('ID')).toBeVisible();
      await expect(desig.columnHeader('Company')).toBeVisible();
      await expect(desig.columnHeader('Designation Code')).toBeVisible();
      await expect(desig.columnHeader('Designation Name')).toBeVisible();
    });

    test('TC-028: Pagination - Display Items', async ({ page }) => {
      const rows = page.locator('tbody tr');
      const count = await rows.count();
      expect(count).toBeLessThanOrEqual(10);
    });

    test('TC-029: Pagination - Change Items Per Page to 20', async ({ page }) => {
      const desig = new DesignationMasterPage(page);
      const itemsDropdown = page.locator('[role="combobox"]').first();
      await itemsDropdown.click();

      await page.locator('[role="option"], li').filter({ hasText: /^20$/ }).first().click();
      await page.waitForLoadState('networkidle');

      const rows = page.locator('tbody tr');
      const count = await rows.count();
      expect(count).toBeLessThanOrEqual(20);
    });

    test('TC-030: Pagination - Navigate to Next Page', async ({ page }) => {
      const desig = new DesignationMasterPage(page);
      const nextButton = desig.nextPageButton();
      const isEnabled = await nextButton.isEnabled();

      if (isEnabled) {
        await nextButton.click();
        await page.waitForLoadState('networkidle');

        const rows = page.locator('tbody tr');
        expect(await rows.count()).toBeGreaterThan(0);
      }
    });

    test('TC-031: Pagination - Navigate to Previous Page', async ({ page }) => {
      const desig = new DesignationMasterPage(page);
      const nextButton = desig.nextPageButton();

      if (await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForLoadState('networkidle');

        const prevButton = desig.prevPageButton();
        if (await prevButton.isEnabled()) {
          await prevButton.click();
          await page.waitForLoadState('networkidle');
        }
      }
    });

    test('TC-032: Search by Designation Code', async ({ page }) => {
      const desig = new DesignationMasterPage(page);
      const searchButton = page.locator('button[aria-label="search"]').first();

      if (await searchButton.isVisible()) {
        const firstCode = await page.locator('tbody tr:first-child td:nth-child(4)').innerText().catch(() => 'QA');
        const cleanCode = firstCode.replace(/[\u200B\uFEFF]/g, "").trim();

        await desig.searchList(cleanCode || 'QA');

        const results = page.locator('tbody tr');
        const count = await results.count();
        expect(count).toBeGreaterThan(0);
      }
    });

    test('TC-033: Search by Designation Name', async ({ page }) => {
      const desig = new DesignationMasterPage(page);
      const searchButton = page.locator('button[aria-label="search"]').first();

      if (await searchButton.isVisible()) {
        const firstName = await page.locator('tbody tr:first-child td:nth-child(5)').innerText().catch(() => 'Engineer');
        const cleanName = firstName.replace(/[\u200B\uFEFF]/g, "").trim();

        await desig.searchList(cleanName || 'Engineer');

        const names = await page.locator('tbody td:nth-child(5)').allTextContents();
        expect(names.length).toBeGreaterThan(0);
      }
    });

    test('TC-034: Sort by ID', async ({ page }) => {
      const desig = new DesignationMasterPage(page);
      await desig.clickColumnHeader('ID');
      await page.waitForLoadState('networkidle');

      const sortState = await desig.getColumnAriaSort('ID');
      expect(['ascending', 'descending']).toContain(sortState);
    });

    test('TC-035: Sort by Company', async ({ page }) => {
      const desig = new DesignationMasterPage(page);
      await desig.clickColumnHeader('Company');
      await page.waitForLoadState('networkidle');

      const sortState = await desig.getColumnAriaSort('Company');
      expect(['ascending', 'descending']).toContain(sortState);
    });



    test('TC-037: Sort by Designation Name', async ({ page }) => {
      const desig = new DesignationMasterPage(page);
      await desig.clickColumnHeader('Designation Name');
      await page.waitForLoadState('networkidle');

      const sortState = await desig.getColumnAriaSort('Designation Name');
      expect(['ascending', 'descending']).toContain(sortState);
    });

    test('TC-046: Select Multiple Designations', async ({ page }) => {
      const checkbox = page.locator('input[type="checkbox"]').nth(1);
      if (await checkbox.isVisible()) {
        await checkbox.click();
        const selectedCount = await page.locator('input[type="checkbox"]:checked').count();
        expect(selectedCount).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Add/Edit/View Operations', () => {
    test('TC-040: Add Designation - Success', { tag: '@smoke' }, async ({ page }) => {
      const desig = new DesignationMasterPage(page);
      const data = testData.designationMaster.valid;

      await desig.goto();
      await desig.fillForm(data);
      await desig.save();

      await page.waitForURL('**/organisation/designation-master');
      await page.waitForLoadState('networkidle');

      createdCode = data.designationCode;
      createdName = data.designationName;

      // Verify in list
      await desig.searchList(createdCode);
      await expect(page.getByText(createdCode, { exact: true }).first()).toBeVisible();
    });

    test('TC-041: Add Designation - Validation Errors', async ({ page }) => {
      const desig = new DesignationMasterPage(page);

      await desig.goto();
      await desig.save();

      // Expect errors
      await expect(desig.departmentRequiredError).toBeVisible();
      await expect(desig.nameRequiredError).toBeVisible();

    });

    test('TC-042: Add Designation - Required Fields Only', async ({ page }) => {
      const desig = new DesignationMasterPage(page);
      const data = testData.designationMaster.valid;
      const uniqueCode = 'REQ-' + Date.now();
      const uniqueName = 'Req-Only-' + Date.now();

      await desig.goto();
      await desig.fillForm({
        designationCode: uniqueCode,
        designationName: uniqueName,
        level: '3'
      });
      await desig.save();

      await page.waitForURL('**/organisation/designation-master');
      await page.waitForLoadState('networkidle');

      // Verify in list
      await desig.searchList(uniqueCode);
      await expect(page.getByText(uniqueCode, { exact: true }).first()).toBeVisible();
    });

    test('TC-038: View Designation Details', async ({ page }) => {
      const desig = new DesignationMasterPage(page);
      const code = createdCode || testData.designationMaster.valid.designationCode;

      await desig.searchList(code);
      await page.getByText(code, { exact: true }).first().click();
      await page.waitForURL('**/view-designation-master');
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('main').getByText('Designation Master', { exact: true })).toBeVisible();
    });

    test('TC-039: Verify All Designation Fields in View', async ({ page }) => {
      const desig = new DesignationMasterPage(page);
      const code = createdCode || testData.designationMaster.valid.designationCode;
      const data = testData.designationMaster.valid;

      await desig.searchList(code);
      await page.getByText(code, { exact: true }).first().click();
      await page.waitForURL('**/view-designation-master');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('Company').first()).toBeVisible();
      await expect(page.getByText('Designation Code').first()).toBeVisible();
      await expect(page.getByText('Designation Name').first()).toBeVisible();

      await expect(page.getByText(code).first()).toBeVisible();
      await expect(page.getByText(createdName || data.designationName).first()).toBeVisible();
    });

    test('TC-043: Edit Designation - Update Name', async ({ page }) => {
      const desig = new DesignationMasterPage(page);
      const code = createdCode || testData.designationMaster.valid.designationCode;
      const updatedName = testData.designationMaster.valid.updatedDesignationName;

      await desig.openEdit(code);

      await desig.nameInput.clear();
      await desig.nameInput.fill(updatedName);
      await desig.save();

      await page.waitForURL('**/organisation/designation-master');
      await page.waitForLoadState('networkidle');

      createdName = updatedName;

      // Verify updated name in list
      await desig.searchList(code);
      await expect(page.getByRole('row').filter({ hasText: code }).getByText(updatedName)).toBeVisible();
    });

    test('TC-044: Edit Designation - Update Level', async ({ page }) => {
      const desig = new DesignationMasterPage(page);
      const code = createdCode || testData.designationMaster.valid.designationCode;
      const updatedLevel = testData.designationMaster.valid.updatedLevel;

      await desig.openEdit(code);

      await desig.levelInput.clear();
      await desig.levelInput.fill(updatedLevel);
      await desig.save();

      await page.waitForURL('**/organisation/designation-master');
      await page.waitForLoadState('networkidle');

      // Verify updated level in view
      await desig.searchList(code);
      await page.getByText(code, { exact: true }).first().click();
      await page.waitForURL('**/view-designation-master');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(updatedLevel).first()).toBeVisible();
    });

    test('TC-045: Edit Designation - Discard Changes', async ({ page }) => {
      const desig = new DesignationMasterPage(page);
      const code = createdCode || testData.designationMaster.valid.designationCode;

      await desig.openEdit(code);

      await desig.nameInput.fill('Discarded Designation Temp Name');
      await desig.discardButton.click();

      await page.waitForURL('**/organisation/designation-master');
      await page.waitForLoadState('networkidle');

      // Verify name remains unchanged
      await desig.searchList(code);
      await expect(page.getByRole('row').filter({ hasText: code }).getByText(createdName)).toBeVisible();
    });
  });
});
