const { test, expect } = require('@playwright/test');
const LoginPage = require('../../pages/LoginPage');
const MyAssetsPage = require('../../pages/MyAssetsPage');
const testData = require('../../config/testData');

const { requester } = testData.assetManagement.users;

// Diagnostic: dump every button/icon inside the Damage-Loss Details row while it's in edit mode,
// to find whatever actually commits it (Enter/Escape are both confirmed wrong; a plain outside
// click doesn't truly exit edit mode either - see inspect-damage-loss-commit.spec.js results).
test('inspect row action buttons', async ({ browser }) => {
  test.setTimeout(60000);
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  const loginPage = new LoginPage(page);
  const myAssetsPage = new MyAssetsPage(page);

  await loginPage.goto();
  await loginPage.loginAndWaitForDashboard(requester.email, requester.password);
  await myAssetsPage.reportDamageLoss();

  const table = page.locator('table').first();
  const row = table.locator('tbody tr, [role="row"]').first();
  await row.locator('td, [role="cell"]').nth(3).click();
  await page.waitForTimeout(300);

  const conditionCombobox = table.getByRole('combobox').first();
  await conditionCombobox.click();
  await page.getByRole('option', { name: 'Damaged', exact: true }).click();

  // Dump every button (with name/title/aria-label) inside the row, AND the first cell's full
  // HTML (likely holds row-level save/cancel actions, given AssetTransferPage's own row actions
  // column pattern).
  const buttons = row.locator('button');
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const btn = buttons.nth(i);
    const name = (await btn.getAttribute('aria-label')) || (await btn.getAttribute('title')) || (await btn.innerText().catch(() => ''));
    console.log(`ROW_BUTTON[${i}]:`, JSON.stringify(name));
  }

  const firstCellHtml = await row.locator('td, [role="cell"]').first().innerHTML();
  console.log('FIRST_CELL_HTML:', firstCellHtml);

  // Also check if there's a global "Save"/"Confirm" row-action icon rendered OUTSIDE the row
  // (e.g. a floating action bar) while editing.
  const allVisibleButtons = page.getByRole('button');
  const totalButtons = await allVisibleButtons.count();
  const names = [];
  for (let i = 0; i < totalButtons; i++) {
    const n = await allVisibleButtons.nth(i).innerText().catch(() => '');
    const aria = await allVisibleButtons.nth(i).getAttribute('aria-label').catch(() => null);
    names.push(n || aria || '(no name)');
  }
  console.log('ALL_PAGE_BUTTONS:', JSON.stringify(names));

  await page.screenshot({ path: 'test-results/inspect-row-actions.png', fullPage: true });
});
