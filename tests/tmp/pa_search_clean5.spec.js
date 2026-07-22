const { test, expect } = require('@playwright/test');
const PurchaseAgreementPage = require('../../pages/PurchaseAgreementPage');

test('trace searchList internals', async ({ page }) => {
  const pa = new PurchaseAgreementPage(page);
  await pa.gotoList();

  page.on('request', (r) => {
    if (r.url().includes('purchase-agreements')) console.log('REQ', Date.now(), r.url());
  });
  page.on('response', (r) => {
    if (r.url().includes('purchase-agreements')) console.log('RESP', Date.now(), r.status(), r.url());
  });

  console.log('T0', Date.now());
  await pa.searchList('PA-2026-000153');
  console.log('T1 (searchList returned)', Date.now());
  console.log('rows now', await page.locator('table tbody tr').count());
});
