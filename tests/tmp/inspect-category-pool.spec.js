const { test, expect } = require('@playwright/test');
const LoginPage = require('../../pages/LoginPage');
const AssetRequestPage = require('../../pages/AssetRequestPage');
const testData = require('../../config/testData');
const testDataFactory = require('../../config/testDataFactory');

const { requester, approver } = testData.assetManagement.users;

// Diagnostic: for a chosen category (by filtered option index), check whether the Assign modal's
// "Available Assets" left table has ANY rows - i.e. whether Assign would work directly, without
// needing the Transfer-from-another-holder workaround the Damage/Loss suite currently needs for
// category index 0 ("Customer Contracts", confirmed depleted).
async function checkCategory(browser, categoryOptionIndex) {
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
    categoryOptionIndex,
  });
  const requestId = await assetRequestPage.openRequestByAssetName(assetName);
  await loginPage.logout();

  await loginPage.goto();
  await loginPage.loginAndWaitForDashboard(approver.email, approver.password);
  await assetRequestPage.approve(requestId);

  await page.goto(`/dashboard/hrms/asset-allocation/${requestId}/view-asset-allocation`);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  const assignButton = page.getByRole('button', { name: /Assign Assets|Add Assets/i });
  await assignButton.click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1500);
  const availableRows = modal.locator('table').first().locator('tbody tr, tbody [role="row"]');
  const availableCount = await availableRows.count();

  const transferButton = page.getByRole('button', { name: /Transfer Assets|Create New/i });
  const transferEnabled = await transferButton.isEnabled().catch(() => false);
  await page.keyboard.press('Escape').catch(() => {});
  let inUseCount = -1;
  if (transferEnabled) {
    await transferButton.click();
    const modal2 = page.getByRole('dialog');
    await expect(modal2).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);
    const inUseRows = modal2.locator('table').first().locator('tbody tr, tbody [role="row"]');
    inUseCount = await inUseRows.count();
    const rowsText = [];
    for (let i = 0; i < Math.min(inUseCount, 10); i++) {
      rowsText.push((await inUseRows.nth(i).innerText().catch(() => '')).replace(/\n/g, ' | '));
    }
    console.log(`CATEGORY[${categoryOptionIndex}] IN_USE_ROWS:`, JSON.stringify(rowsText));
  }

  console.log(`CATEGORY[${categoryOptionIndex}] requestId=${requestId} availableCount=${availableCount} inUseCount=${inUseCount}`);
  await loginPage.logout().catch(() => {});
  await context.close();
}

test('inspect category pool - index 4', async ({ browser }) => {
  test.setTimeout(120000);
  await checkCategory(browser, 4);
});
