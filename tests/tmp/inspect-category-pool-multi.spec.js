const { test, expect } = require('@playwright/test');
const LoginPage = require('../../pages/LoginPage');
const AssetRequestPage = require('../../pages/AssetRequestPage');
const testData = require('../../config/testData');
const testDataFactory = require('../../config/testDataFactory');

const { requester, approver } = testData.assetManagement.users;

// Diagnostic: check available-asset counts for several category indices in ONE session (submit a
// throwaway request per category, approve it, open the Assign modal, count left-table rows) - to
// find one with enough stock to survive provisioning several assets across this suite's blocks,
// since index 1 ("Customer Relationships", availableCount=4 earlier) is now exhausted.
test('inspect multiple category pools', async ({ browser }) => {
  test.setTimeout(300000);
  const indices = [2, 3, 4, 5, 6];
  for (const idx of indices) {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const loginPage = new LoginPage(page);
    const assetRequestPage = new AssetRequestPage(page);

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(requester.email, requester.password);
    await assetRequestPage.gotoAdd();
    const assetName = testDataFactory.uniqueName('Automation_CategoryProbe');
    await assetRequestPage.submitRequest({
      assetName,
      quantity: '1',
      reason: testDataFactory.narration('Category pool probe'),
      categoryOptionIndex: idx,
    });
    let requestId;
    try {
      requestId = await assetRequestPage.openRequestByAssetName(assetName);
    } catch (e) {
      // Flaky click-to-navigate - retry once more.
      requestId = await assetRequestPage.openRequestByAssetName(assetName);
    }
    await loginPage.logout();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(approver.email, approver.password);
    await assetRequestPage.approve(requestId);

    await page.goto(`/dashboard/hrms/asset-allocation/${requestId}/view-asset-allocation`);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const assignButton = page.getByRole('button', { name: /Assign Assets|Add Assets/i });
    let availableCount = -1;
    try {
      await assignButton.click();
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1500);
      const availableRows = modal.locator('table').first().locator('tbody tr, tbody [role="row"]');
      availableCount = await availableRows.count();
      await page.keyboard.press('Escape').catch(() => {});
    } catch (e) {
      availableCount = -2; // button not found/clickable at all
    }
    console.log(`CATEGORY[${idx}] requestId=${requestId} availableCount=${availableCount}`);
    await loginPage.logout().catch(() => {});
    await context.close();
  }
});
