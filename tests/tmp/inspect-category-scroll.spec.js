const { test } = require('@playwright/test');
const LoginPage = require('../../pages/LoginPage');
const AssetRequestPage = require('../../pages/AssetRequestPage');
const testData = require('../../config/testData');

const { requester } = testData.assetManagement.users;

// Diagnostic: the user's own live screenshot shows "Computer Hardware and Software" IS a real,
// selectable option in this exact dropdown - but our scan only ever found 26 options in the DOM.
// Theory: the listbox is virtualized (only renders visible + buffer rows), so scrolling the
// listbox container should reveal more options not yet in the DOM.
test('inspect category dropdown via scrolling', async ({ browser }) => {
  test.setTimeout(60000);
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  const loginPage = new LoginPage(page);
  const assetRequestPage = new AssetRequestPage(page);

  await loginPage.goto();
  await loginPage.loginAndWaitForDashboard(requester.email, requester.password);
  await assetRequestPage.gotoAdd();

  const labelRegex = /^Asset Category Needed\s*\*?$/i;
  const combobox = page.getByRole('main').getByText(labelRegex).first().locator('xpath=..').getByRole('combobox').first();
  await combobox.click();
  await page.waitForTimeout(500);

  const listbox = page.getByRole('listbox');
  const seen = new Set();
  let found = false;
  for (let i = 0; i < 30; i++) {
    const options = listbox.getByRole('option');
    const count = await options.count();
    for (let j = 0; j < count; j++) {
      const t = (await options.nth(j).innerText().catch(() => '')).trim();
      if (t) seen.add(t);
      if (t.includes('Computer Hardware')) found = true;
    }
    if (found) break;
    // Scroll the listbox down.
    await listbox.hover().catch(() => {});
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(300);
  }
  console.log('FOUND target after scrolling:', found);
  console.log('TOTAL UNIQUE OPTIONS SEEN:', seen.size);
  console.log('ALL OPTIONS:', JSON.stringify([...seen]));
});
