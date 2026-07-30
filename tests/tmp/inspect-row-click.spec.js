const { test, expect } = require('@playwright/test');
const LoginPage = require('../../pages/LoginPage');
const AssetRequestPage = require('../../pages/AssetRequestPage');
const testData = require('../../config/testData');
const testDataFactory = require('../../config/testDataFactory');

const { requester } = testData.assetManagement.users;

test('inspect row click navigation', async ({ browser }) => {
  test.setTimeout(60000);
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  const loginPage = new LoginPage(page);
  const assetRequestPage = new AssetRequestPage(page);

  page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

  await loginPage.goto();
  await loginPage.loginAndWaitForDashboard(requester.email, requester.password);
  await assetRequestPage.gotoAdd();
  const assetName = testDataFactory.uniqueName('Automation_RowClickProbe');
  await assetRequestPage.submitRequest({
    assetName,
    quantity: '1',
    reason: testDataFactory.narration('Row click probe'),
    categoryOptionIndex: 2,
  });

  await assetRequestPage.gotoList();
  await assetRequestPage.searchList(assetName);
  console.log('URL before click:', page.url());
  const row = assetRequestPage.rowByAssetName(assetName).first();
  console.log('Row count matching:', await assetRequestPage.rowByAssetName(assetName).count());
  console.log('Row text:', await row.innerText());
  await row.click();
  await page.waitForTimeout(2000);
  console.log('URL after click + 2s wait:', page.url());
  await page.screenshot({ path: 'test-results/inspect-row-click-after.png', fullPage: true });
});
