const { test } = require('@playwright/test');
const LoginPage = require('../../pages/LoginPage');
const AssetRequestPage = require('../../pages/AssetRequestPage');
const AssetAllocationPage = require('../../pages/AssetAllocationPage');
const testData = require('../../config/testData');
const testDataFactory = require('../../config/testDataFactory');

const { requester, approver } = testData.assetManagement.users;

// Diagnostic: list every "Asset Category Needed" option so we can pick one whose available OR
// in-use pool isn't already exhausted by prior debugging runs, instead of guessing blindly.
test('inspect category options', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  const loginPage = new LoginPage(page);
  const assetRequestPage = new AssetRequestPage(page);

  await loginPage.goto();
  await loginPage.loginAndWaitForDashboard(requester.email, requester.password);
  await assetRequestPage.gotoAdd();

  const combobox = page
    .getByRole('main')
    .getByText(/^Asset Category Needed\s*\*?$/i)
    .first()
    .locator('xpath=..')
    .getByRole('combobox')
    .first();
  await combobox.click();
  await page.getByRole('listbox').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(2000);
  const allOptions = page.getByRole('listbox').getByRole('option');
  const count = await allOptions.count();
  const texts = [];
  for (let i = 0; i < count; i++) {
    texts.push((await allOptions.nth(i).innerText()).trim());
  }
  console.log('CATEGORY_OPTIONS:', JSON.stringify(texts));
});
