const { test, expect } = require('@playwright/test');
const PurchaseAgreementPage = require('../../pages/PurchaseAgreementPage');

test('single searchList call', async ({ page }) => {
  const pa = new PurchaseAgreementPage(page);
  await pa.gotoList();
  await pa.searchList('PA-2026-000153');
  console.log('rows now', await page.locator('table tbody tr').count());
});
