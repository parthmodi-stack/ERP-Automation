const { test, expect } = require('@playwright/test');
const PurchaseAgreementPage = require('../../pages/PurchaseAgreementPage');

test('check search input visibility state before any click', async ({ page }) => {
  const pa = new PurchaseAgreementPage(page);
  await pa.gotoList();

  const searchInput = page.getByPlaceholder('Search', { exact: true });
  console.log('count matching placeholder before any click:', await searchInput.count());
  console.log('isVisible before any click:', await searchInput.isVisible().catch(e => e.message));
  const box = await searchInput.boundingBox().catch(e => e.message);
  console.log('boundingBox before any click:', JSON.stringify(box));
});
