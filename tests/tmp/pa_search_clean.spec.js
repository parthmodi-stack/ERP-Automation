const { test, expect } = require('@playwright/test');
const PurchaseAgreementPage = require('../../pages/PurchaseAgreementPage');

test('clean repro of L01 sequence', async ({ page }) => {
  const pa = new PurchaseAgreementPage(page);
  await pa.gotoList();

  await pa.searchList('PA-2026-000153');
  console.log('rows after 1st search', await page.locator('table tbody tr').count());

  await pa.searchList('no-such-agreement-zzz-999');
  console.log('rows after 2nd search', await page.locator('table tbody tr').count());
  console.log('No Data visible:', await pa.noDataRow().isVisible().catch(() => false));
});
