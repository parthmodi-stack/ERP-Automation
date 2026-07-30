const { test } = require('@playwright/test');
const LoginPage = require('../../pages/LoginPage');
const AssetRequestPage = require('../../pages/AssetRequestPage');
const testData = require('../../config/testData');

const { requester } = testData.assetManagement.users;

// Diagnostic: does the Asset Category Needed field support a live server-side search that
// surfaces MORE options than the initial static render (26 categories, none named "Computer
// Hardware and Software")? Type directly into the combobox's own input and watch network + DOM.
test('inspect category dropdown search', async ({ browser }) => {
  test.setTimeout(60000);
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  const loginPage = new LoginPage(page);
  const assetRequestPage = new AssetRequestPage(page);

  page.on('console', (msg) => {
    if (msg.text().includes('payload') || msg.text().includes('assetType')) {
      console.log('CONSOLE:', msg.text());
    }
  });

  await loginPage.goto();
  await loginPage.loginAndWaitForDashboard(requester.email, requester.password);
  await assetRequestPage.gotoAdd();

  const labelRegex = /^Asset Category Needed\s*\*?$/i;
  const combobox = page.getByRole('main').getByText(labelRegex).first().locator('xpath=..').getByRole('combobox').first();
  await combobox.click();
  await page.waitForTimeout(500);

  const input = combobox.locator('input').first();
  const inputVisible = await input.isVisible().catch(() => false);
  console.log('Combobox input visible:', inputVisible);

  const responsePromise = page.waitForResponse((r) => r.url().toLowerCase().includes('asset') || r.url().toLowerCase().includes('categor'), { timeout: 8000 }).catch(() => null);
  if (inputVisible) {
    await input.fill('Computer');
  } else {
    await combobox.fill('Computer').catch(() => console.log('combobox.fill failed'));
  }
  const resp = await responsePromise;
  if (resp) console.log('SEARCH RESPONSE URL:', resp.url(), resp.status());
  await page.waitForTimeout(1500);

  const options = page.getByRole('listbox').getByRole('option');
  const count = await options.count();
  const texts = [];
  for (let i = 0; i < count; i++) texts.push(await options.nth(i).innerText());
  console.log('OPTIONS AFTER TYPING "Computer":', JSON.stringify(texts));

  await page.screenshot({ path: 'test-results/inspect-category-search.png', fullPage: true });
});
