const { test, expect } = require('@playwright/test');
const DepartmentMasterPage = require('../../pages/DepartmentMasterPage');
const testData = require('../../config/testData');

test.describe('Department Master Module', () => {
  let createdCode = '';
  let createdName = '';

  test.beforeEach(async ({ page }) => {
    const dept = new DepartmentMasterPage(page);
    await dept.gotoList();
  });

  test.describe('List View Operations', () => {
    test('TC-012: Display Department Master List', async ({ page }) => {
      const dept = new DepartmentMasterPage(page);
      // const table = page.locator('[role="table"]');
      // await expect(table).toBeVisible();

      // Verify columns
      await expect(dept.columnHeader('Department Code')).toBeVisible();
      await expect(dept.columnHeader('Department Name')).toBeVisible();
      await expect(dept.columnHeader('Parent Department')).toBeVisible();
      await expect(dept.columnHeader('Status')).toBeVisible();
    });

    test('TC-013: Pagination - Change Items Per Page', async ({ page }) => {
      const dept = new DepartmentMasterPage(page);

      // Get the items per page dropdown
      const itemsDropdown = page.locator('[role="combobox"]').first();
      await itemsDropdown.click();

      // Select 10 items per page
      await page.locator('[role="option"], li').filter({ hasText: /^10$/ }).first().click();
      await page.waitForLoadState('networkidle');

      const rows = page.locator('tbody tr');
      const count = await rows.count();
      expect(count).toBeLessThanOrEqual(10);
    });

    test('TC-014: Pagination - Go To Specific Page', async ({ page }) => {
      const dept = new DepartmentMasterPage(page);

      if (await dept.goToPageInput().isVisible()) {
        await dept.goToPage(2);
        await page.waitForLoadState('networkidle');

        const label = await dept.getPaginationLabel();
        expect(label).toContain('Page 2');
      }
    });

    test('TC-015: Search Department by Code', async ({ page }) => {
      const dept = new DepartmentMasterPage(page);

      const searchButton = page.locator('button[aria-label="search"]').first();
      if (await searchButton.isVisible()) {
        const firstCode = await page.locator('tbody tr:first-child td:first-child').innerText().catch(() => 'AUTO');
        const cleanCode = firstCode.replace(/[\u200B\uFEFF]/g, "").trim();

        await dept.searchList(cleanCode || 'AUTO');

        const codes = await page.locator('tbody td:first-child').allTextContents();
        for (const code of codes) {
          const clean = code.replace(/[\u200B\uFEFF]/g, "").trim().toLowerCase();
          expect(clean).toContain((cleanCode || 'AUTO').toLowerCase());
        }
      }
    });

    test('TC-016: Search Department by Name', async ({ page }) => {
      const dept = new DepartmentMasterPage(page);

      const searchButton = page.locator('button[aria-label="search"]').first();
      if (await searchButton.isVisible()) {
        const firstName = await page.locator('tbody tr:first-child td:nth-child(3)').innerText().catch(() => 'Automation');
        const cleanName = firstName.replace(/[\u200B\uFEFF]/g, "").trim();

        await dept.searchList(cleanName || 'Automation');

        const names = await page.locator('tbody td:nth-child(3)').allTextContents();
        expect(names.length).toBeGreaterThan(0);
      }
    });

    test('TC-017: Sort by Department Code', async ({ page }) => {
      const dept = new DepartmentMasterPage(page);

      await dept.clickColumnHeader('Department Code');
      await page.waitForLoadState('networkidle');

      const sortState = await dept.getColumnAriaSort('Department Code');
      expect(['ascending', 'descending']).toContain(sortState);
    });

    test('TC-018: Sort by Department Name', async ({ page }) => {
      const dept = new DepartmentMasterPage(page);

      await dept.clickColumnHeader('Department Name');
      await page.waitForLoadState('networkidle');

      const sortState = await dept.getColumnAriaSort('Department Name');
      expect(['ascending', 'descending']).toContain(sortState);
    });

    // test('TC-019: Sort by Status', async ({ page }) => {
    //   const dept = new DepartmentMasterPage(page);

    //   await dept.clickColumnHeader('Status');
    //   await page.waitForLoadState('networkidle');

    //   const sortState = await dept.getColumnAriaSort('Status');
    //   expect(['ascending', 'descending']).toContain(sortState);
    // });
  });

  test.describe('Add/Edit/View Operations', () => {
    test('TC-022: Add Department - Success', { tag: '@smoke' }, async ({ page }) => {
      const dept = new DepartmentMasterPage(page);
      const data = testData.departmentMaster.valid;

      await dept.goto();
      await dept.fillForm(data);
      await dept.save();

      await page.waitForURL('**/organisation/department-master');
      await page.waitForLoadState('networkidle');

      createdCode = data.departmentCode;
      createdName = data.departmentName;

      // Verify in list
      await dept.searchList(createdCode);
      await expect(page.getByText(createdCode, { exact: true }).first()).toBeVisible();
    });

    test('TC-023: Add Department - Mandatory Field Validation', async ({ page }) => {
      const dept = new DepartmentMasterPage(page);

      await dept.goto();
      await dept.save();

      // Verify inline validation errors
      await expect(dept.codeRequiredError).toBeVisible();
      await expect(dept.nameRequiredError).toBeVisible();
    });

    test('TC-024: Add Department - Duplicate Code Validation', async ({ page }) => {
      const dept = new DepartmentMasterPage(page);
      const data = testData.departmentMaster.valid;

      await dept.goto();
      await dept.fillForm({
        departmentCode: createdCode || 'DEPT-EXISTING',
        departmentName: 'Another Department'
      });
      await dept.save();

      // Expect duplicate error
      await expect(dept.duplicateCodeError).toBeVisible();
    });

    test('TC-020: View Department Details', async ({ page }) => {
      const dept = new DepartmentMasterPage(page);
      const code = createdCode || testData.departmentMaster.valid.departmentCode;
      await dept.searchList(code);
      await page.getByText(code, { exact: true }).first().click();
      await page.waitForURL('**/view-department-master');
      await page.waitForLoadState('networkidle');

      // Verify view page title
      await expect(page.getByRole('main').getByText('Department Master', { exact: true })).toBeVisible();
    });

    test('TC-021: Verify All Department Fields in View', async ({ page }) => {
      const dept = new DepartmentMasterPage(page);
      const code = createdCode || testData.departmentMaster.valid.departmentCode;
      const data = testData.departmentMaster.valid;

      await dept.searchList(code);
      await page.getByText(code, { exact: true }).first().click();
      await page.waitForURL('**/view-department-master');
      await page.waitForLoadState('networkidle');

      // Check fields are visible
      await expect(page.getByText('Department Code').first()).toBeVisible();
      await expect(page.getByText('Department Name').first()).toBeVisible();
      await expect(page.getByText('Parent Department').first()).toBeVisible();

      // Check values match
      await expect(page.getByText(code).first()).toBeVisible();
      await expect(page.getByText(createdName || data.departmentName).first()).toBeVisible();
    });

    test('TC-025: Edit Department - Success', async ({ page }) => {
      const dept = new DepartmentMasterPage(page);
      const code = createdCode || testData.departmentMaster.valid.departmentCode;
      const updatedName = testData.departmentMaster.valid.updatedDepartmentName;

      await dept.openEdit(code);

      // Update name
      await dept.nameInput.clear();
      await dept.nameInput.fill(updatedName);
      await dept.save();

      await page.waitForURL('**/organisation/department-master');
      await page.waitForLoadState('networkidle');

      createdName = updatedName;

      // Verify updated name in list
      await dept.searchList(code);
      await expect(page.getByRole('row').filter({ hasText: code }).getByText(updatedName)).toBeVisible();
    });

    test('TC-026: Edit Department - Cancel Changes', async ({ page }) => {
      const dept = new DepartmentMasterPage(page);
      const code = createdCode || testData.departmentMaster.valid.departmentCode;

      await dept.openEdit(code);

      // Change name but discard
      await dept.nameInput.fill('Discarded Temp Department');
      await dept.discardButton.click();
      await page.waitForURL('**/organisation/department-master');
      await page.waitForLoadState('networkidle');

      // Verify name was not changed
      await dept.searchList(code);
      await expect(page.getByRole('row').filter({ hasText: code }).getByText(createdName)).toBeVisible();
    });
  });
});
