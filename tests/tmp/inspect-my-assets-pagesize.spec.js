const { test } = require('@playwright/test');
const LoginPage = require('../../pages/LoginPage');
const MyAssetsPage = require('../../pages/MyAssetsPage');
const testData = require('../../config/testData');

const { requester } = testData.assetManagement.users;

test('inspect my-assets page size options and loading state', async ({ browser }) => {
  test.setTimeout(60000);
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  const loginPage = new LoginPage(page);
  const myAssetsPage = new MyAssetsPage(page);

  await loginPage.goto();
  await loginPage.loginAndWaitForDashboard(requester.email, requester.password);
  await myAssetsPage.goto();

  await page.screenshot({ path: 'test-results/inspect-my-assets-before-pagesize.png', fullPage: true });

  const pageSizeSelect = page.locator('text=Items per page').locator('xpath=following-sibling::*').first();
  console.log('Attempting to open page size dropdown via BasePage.pageSizeSelect()...');

  // Use the same locator BasePage.changePageSize() uses internally.
  const BasePage = require('../../pages/BasePage');
  const bp = new BasePage(page);
  await bp.pageSizeSelect().click();
  await page.waitForTimeout(500);
  const options = page.getByRole('option');
  const count = await options.count();
  const texts = [];
  for (let i = 0; i < count; i++) {
    texts.push(await options.nth(i).innerText());
  }
  console.log('PAGE_SIZE_OPTIONS:', JSON.stringify(texts));
  await page.keyboard.press('Escape');

  if (texts.includes('50')) {
    await bp.changePageSize(50);
    await page.waitForTimeout(1000);
    console.log('Items per page after change:', await page.locator('text=Items per page').locator('xpath=following-sibling::*').first().innerText().catch(() => '?'));
    const skeletonCount = await page.locator('.MuiSkeleton-root').count();
    console.log('SKELETON_COUNT after changePageSize(50):', skeletonCount);
    await page.waitForTimeout(3000);
    const skeletonCountAfterWait = await page.locator('.MuiSkeleton-root').count();
    console.log('SKELETON_COUNT after extra 3s wait:', skeletonCountAfterWait);
  }
  await page.screenshot({ path: 'test-results/inspect-my-assets-after-pagesize.png', fullPage: true });
});
