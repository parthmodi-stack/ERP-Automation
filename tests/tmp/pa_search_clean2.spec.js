const { test, expect } = require('@playwright/test');
const PurchaseAgreementPage = require('../../pages/PurchaseAgreementPage');

test('inspect initial search state', async ({ page }) => {
  const pa = new PurchaseAgreementPage(page);
  await pa.gotoList();

  const searchInput = page.getByPlaceholder('Search', { exact: true });
  const visibleBefore = await searchInput.isVisible().catch(() => false);
  console.log('search input visible before opening:', visibleBefore);

  // open it
  await page.getByRole('button', { name: 'Add' }).first().locator('xpath=preceding-sibling::button[2]').click();
  await searchInput.waitFor({ state: 'visible', timeout: 5000 });
  console.log('value on open:', await searchInput.inputValue());

  page.on('request', (r) => {
    if (r.url().includes('purchase-agreements') ) console.log('REQ', r.url());
  });

  await searchInput.fill('PA-2026-000153');
  await page.waitForTimeout(2000);
  console.log('value after fill+wait', await searchInput.inputValue());
  console.log('rows now', await page.locator('table tbody tr').count());
});
