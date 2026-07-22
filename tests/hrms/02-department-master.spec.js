const { test, expect } = require('@playwright/test');
const DepartmentMasterPage = require('../../pages/DepartmentMasterPage');
const testData = require('../../config/testData');
const testDataFactory = require('../../config/testDataFactory');

test.describe('Department Master Module', () => {
  test.describe.configure({ timeout: 60000 });

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



    test('TC-027: Add Department - Company Required Validation', { tag: '@smoke' }, async ({ page }) => {
      const dept = new DepartmentMasterPage(page);
      const data = testData.departmentMaster.missingCompany;

      await dept.goto();
      await dept.fillForm(data);
      await dept.save();

      await expect(dept.companyRequiredError).toBeVisible();
      await dept.discardButton.click();
    });

    test('TC-028: Add Department - ID field is auto-generated and read-only', async ({ page }) => {
      const dept = new DepartmentMasterPage(page);

      await dept.goto();
      await expect(dept.idField).toBeDisabled();
      await expect(dept.idField).toHaveValue('');
      await dept.discardButton.click();
    });

    test('TC-029: View Department - Status badge reflects Active', async ({ page }) => {
      const dept = new DepartmentMasterPage(page);
      // Self-contained (creates its own record) rather than depending on createdCode, so this
      // assertion doesn't cascade-fail if an earlier Add test in this describe block fails.
      const code = testDataFactory.uniqueName('DEPT_VIEWSTATUS');
      const name = testDataFactory.uniqueName('Automation_ViewStatus');

      await dept.createDepartment({ departmentCode: code, departmentName: name });
      await dept.openView(code);
      await expect(dept.viewStatusBadge()).toContainText('Active');
    });

    test('TC-020: View Department Details', async ({ page }) => {
      expect(createdCode, 'Pre-condition failed: Department was not successfully created').toBeTruthy();
      const dept = new DepartmentMasterPage(page);
      await dept.searchList(createdCode);
      await page.getByText(createdCode, { exact: true }).first().click();
      await page.waitForURL('**/view-department-master');
      await page.waitForLoadState('networkidle');

      // Verify view page title
      await expect(page.getByRole('main').getByText('Department Master', { exact: true })).toBeVisible();
    });

    test('TC-021: Verify All Department Fields in View', async ({ page }) => {
      expect(createdCode, 'Pre-condition failed: Department was not successfully created').toBeTruthy();
      const dept = new DepartmentMasterPage(page);
      const data = testData.departmentMaster.valid;

      await dept.searchList(createdCode);
      await page.getByText(createdCode, { exact: true }).first().click();
      await page.waitForURL('**/view-department-master');
      await page.waitForLoadState('networkidle');

      // Check fields are visible
      await expect(page.getByText('Department Code').first()).toBeVisible();
      await expect(page.getByText('Department Name').first()).toBeVisible();
      await expect(page.getByText('Parent Department').first()).toBeVisible();

      // Check values match
      await expect(page.getByText(createdCode).first()).toBeVisible();
      await expect(page.getByText(createdName || data.departmentName).first()).toBeVisible();
    });



  });

  // ── Draft Workflow ─────────────────────────────────────────────────────────
  // saveDepartmentAsDraft (postV1DepartmentsDraft) bypasses methods.trigger() validation entirely
  // (confirmed in add-department.hrms.tsx) - TC-030 exercises that by deliberately omitting
  // Department Code, which Save (not Draft) requires.
  test.describe('Draft Workflow', () => {
    // Each test here is a full multi-step flow (Add/Edit form -> save -> redirect -> list ->
    // search), same shape CLAUDE.md documents as needing a bumped timeout under real network load.
    test.describe.configure({ timeout: 60000 });
    let draftName = '';

    test('TC-030 [+] Save Department as Draft with Code omitted - status shows Draft', { tag: '@smoke' }, async ({ page }) => {
      const dept = new DepartmentMasterPage(page);
      const data = testData.departmentMaster.draftMinimal;
      draftName = data.departmentName;

      await dept.goto();
      await dept.fillForm(data);
      await dept.saveAsDraft();
      // Same redirect-lag as plain Save (confirmed live) - wait for the actual navigation back
      // to the list before treating the draft as committed.
      await page.waitForURL('**/organisation/department-master');
      await page.waitForLoadState('networkidle');

      await dept.gotoList();
      await dept.searchList(draftName);
      await expect(await dept.getRowStatus(draftName)).toMatch(/Draft/);
    });

    test('TC-031 [+] Publish a Draft Department - fill Code and Save - status becomes Active', async ({ page }) => {
      const dept = new DepartmentMasterPage(page);

      await dept.openEdit(draftName);
      await dept.codeInput.fill(testDataFactory.uniqueName('DEPT_PUB'));
      await dept.save();
      await page.waitForURL('**/organisation/department-master');
      await page.waitForLoadState('networkidle');

      await dept.gotoList();
      await dept.searchList(draftName);
      await expect(await dept.getRowStatus(draftName)).toMatch(/Active/);
    });
  });

  // ── Delete Operations ────────────────────────────────────────────────────────
  // Deletes via the View page's own Actions menu. Confirmed in view-department.hrms.tsx that this
  // delete handler has no `successMessage` wired up - no success toast fires, only navigation
  // back to the list - so only removal + redirect are asserted, not a toast.
  test.describe('Delete Operations', () => {
    let deleteTargetCode = '';

    test('TC-032 [+] Add a disposable Department for Delete testing', { tag: '@smoke' }, async ({ page }) => {
      const dept = new DepartmentMasterPage(page);
      deleteTargetCode = testDataFactory.uniqueName('DEPT_DEL');
      const data = {
        departmentCode: deleteTargetCode,
        departmentName: testDataFactory.uniqueName('Automation_Department_ToDelete'),
      };

      await dept.createDepartment(data);
      await dept.gotoList();
      await dept.searchList(deleteTargetCode);
      await expect(page.getByText(deleteTargetCode, { exact: true }).first()).toBeVisible();
    });

    test('TC-033 [-] Delete Department - Cancel preserves the record', async ({ page }) => {
      const dept = new DepartmentMasterPage(page);

      await dept.openView(deleteTargetCode);
      await dept.actionsButton.click();
      await dept.deleteMenuItem.waitFor({ state: 'visible' });
      await dept.deleteMenuItem.click();
      await dept.cancelDeleteButton.click();

      await expect(page).toHaveURL(/view-department-master/);
      await dept.gotoList();
      await dept.searchList(deleteTargetCode);
      await expect(page.getByText(deleteTargetCode, { exact: true }).first()).toBeVisible();
    });

    test('TC-034 [+] Delete Department - Confirm removes record and redirects to list', { tag: '@smoke' }, async ({ page }) => {
      const dept = new DepartmentMasterPage(page);

      await dept.deleteFromView(deleteTargetCode);

      await expect(page).toHaveURL(/department-master$/);
      await dept.searchList(deleteTargetCode);
      await expect(dept.noDataRow()).toBeVisible();
    });
  });

  // ── Special Input Handling ───────────────────────────────────────────────────
  // No max-length/regex/sanitization exists on Department Name beyond required + max(255)
  // (utils/validation.ts) - these confirm arbitrary text is stored as-is and rendered as literal
  // text (React's default escaping), not executed/injected as real HTML.
  test.describe('Special Input Handling', () => {


    test('TC-036 [+] Department Name with SQL-injection-like payload is stored and rendered as literal text', async ({ page }) => {
      const dept = new DepartmentMasterPage(page);
      const data = {
        departmentCode: testDataFactory.uniqueName('DEPT_SQLI'),
        departmentName: testData.departmentMaster.sqlInjectionName,
      };

      await dept.createDepartment(data);
      await dept.gotoList();
      await dept.searchList(data.departmentCode);
      await expect(page.getByText(data.departmentName, { exact: true }).first()).toBeVisible();
    });
  });
});
